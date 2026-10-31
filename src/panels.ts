import { BILI } from "./contract";
import { state, setSetting, normalizeSetting, debugTransient, type AppState } from "./settings";
import { Utils, runSafely } from "./utils";
import { VIP_QUALITIES, DEFAULT_CUSTOM_ORDER, CUSTOM_HIGHEST, normalizeCustomOrder, customEffectiveCutoff, saveCustomOrder } from "./quality-vocab";

interface SlotPoint {
    x: number;
    y: number;
}

type NumericValueInput = Omit<HTMLInputElement, "value"> & { value: string | number };
import { PANEL_IDS, showPanel, hidePanel, mountPanelToRenderRoot } from "./panel-chrome";
import { renderPanelHeader, renderToggleRow, renderStepperGroup, renderStatusTabs, renderActionRow, type ActionButtonSpec } from "./panel-parts";
import { selectQualityBasedOnSetting } from "./video-quality";
import { selectLiveQuality, startLivePolling, stopLivePolling, restartLivePollingIfNeeded, startLiveKeepAlive, stopLiveKeepAlive, updateLiveSettingsPanel, updatePollingStatusIndicator, updateKeepAliveStatusIndicator } from "./live";
import { applyDecodeSetting } from "./decode";
import { applyAutoWidescreen } from "./features";
import { applyVisibilityHijack } from "./visibility";
import { restartAdaptiveQuality } from "./adaptive";
import { ensureQualitySettingsButton, hideQualityButton } from "./controls-button";
import { runExportDiagnostics, runExportSettings, runImportSettings, runResetAllSettings, realPanelActionDeps, type PanelActionDeps } from "./panel-actions";

export function setDevPanelEnabled(panel: HTMLElement, enabled: boolean): void {
    panel.querySelectorAll('input[type="checkbox"]:not(#dev-mode):not(#preserve-touch-points), input[type="number"]').forEach((option: Element) => {
        (option as HTMLInputElement).disabled = !enabled;
    });
    panel.querySelectorAll('.baq-input-group').forEach((group: Element) => {
        if (enabled) {
            group.classList.remove('baq-disabled');
        } else {
            group.classList.add('baq-disabled');
        }
    });
    panel.querySelectorAll('.baq-vip-status-tabs').forEach((tabs: Element) => {
        tabs.classList.toggle('baq-disabled', !enabled);
        syncTabsAria(tabs as HTMLElement);
    });
}

function bindPanelKeyGuard(panel: HTMLElement): void {
    const guard = (e: KeyboardEvent) => {
        if (e.key === "Escape") return;
        const target = e.target as Element | null;
        const onThemeToggle = !!(target && typeof target.closest === "function" && target.closest(".baq-theme-toggle"));
        // 只放行主题开关自己认的那两个键，其余照挡
        if (onThemeToggle && (e.key === "Enter" || e.key === " ")) return;
        e.stopPropagation();
    };
    panel.addEventListener("keydown", guard, true);
    panel.addEventListener("keyup", guard, true);
}
function decorateChromeAria(panel: HTMLElement): void {
    panel.querySelectorAll("svg").forEach(svg => {
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
    });
    const github = panel.querySelector(".baq-github-link");
    if (github && !github.hasAttribute("aria-label")) github.setAttribute("aria-label", "在 GitHub 查看项目主页");
}
function setupPanelA11y(panel: HTMLElement): void {
    panel.setAttribute("tabindex", "-1");
    bindPanelKeyGuard(panel);
    bindRadioGridRoving(panel);
    decorateChromeAria(panel);
}
function setAriaFlag(el: Element, name: string, on: boolean): void {
    if (on) el.setAttribute(name, "true");
    else el.removeAttribute(name);
}
interface RadioGroupAriaOptions {
    labelledBy?: string;
    label?: string;
    disabled?: boolean;
    describedBy?: string;
}
function syncRadioGroupAria(container: HTMLElement | null, itemSelector: string, options: RadioGroupAriaOptions = {}): void {
    if (!container) return;
    container.setAttribute("role", "radiogroup");
    if (options.labelledBy) container.setAttribute("aria-labelledby", options.labelledBy);
    else if (options.label) container.setAttribute("aria-label", options.label);
    setAriaFlag(container, "aria-disabled", !!options.disabled);
    const items = Utils.queryAll(itemSelector, container);
    let tabStop = items.findIndex(it => it.classList.contains("baq-active"));
    if (tabStop === -1 && items.length) tabStop = 0;
    items.forEach((item, i) => {
        item.setAttribute("role", "radio");
        item.setAttribute("aria-checked", item.classList.contains("baq-active") ? "true" : "false");
        item.setAttribute("tabindex", i === tabStop ? "0" : "-1");
        item.removeAttribute("aria-label");
        setAriaFlag(item, "aria-disabled", !!options.disabled);
        if (options.describedBy) item.setAttribute("aria-describedby", options.describedBy);
        else item.removeAttribute("aria-describedby");
    });
}
// 三组单选网格（画质卡 / 直播画质卡 / 解码卡）的容器与项
const RADIO_GRID_CONTAINERS = "#quality-grid, .baq-live-quality-group, .baq-decode-group";
const RADIO_GRID_ITEMS = ".baq-quality-button, .baq-live-quality-button, .baq-decode-option";
function bindRadioGridRoving(root: HTMLElement): void {
    root.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        const target = e.target as HTMLElement | null;
        if (!target || typeof target.matches !== "function" || !target.matches(RADIO_GRID_ITEMS)) return;
        const container = target.closest(RADIO_GRID_CONTAINERS) as HTMLElement | null;
        if (!container || container.getAttribute("role") !== "radiogroup") return;
        const items = Utils.queryAll(RADIO_GRID_ITEMS, container);
        const from = items.indexOf(target);
        if (from === -1) return;
        let to: number;
        if (e.key === "Home") to = 0;
        else if (e.key === "End") to = items.length - 1;
        else {
            let step: number;
            if (e.key === "ArrowRight" || e.key === "ArrowDown") step = 1;
            else if (e.key === "ArrowLeft" || e.key === "ArrowUp") step = -1;
            else return;
            to = (from + step + items.length) % items.length;
        }
        e.preventDefault();
        e.stopPropagation();
        items.forEach((it, i) => it.setAttribute("tabindex", i === to ? "0" : "-1"));
        items[to].focus();
    }, true);
}

function bindSettingCheckbox(panel: HTMLElement, inputId: string, settingName: string, options: { gated?: boolean; after?: () => void } = {}): void {
    panel.querySelector("#" + inputId)!.addEventListener("change", function (e: Event) {
        if (options.gated && state.isLoading) return;
        const input = e.target as HTMLInputElement;
        if (!setSetting(settingName, input.checked)) {
            input.checked = !!(state as AppState & Record<string, unknown>)[settingName];
            return;
        }
        if (options.after) options.after();
    });
}
// 复选框状态回写（面板刷新路径专用，只赋值不派发事件）
function syncCheckbox(panel: HTMLElement, inputId: string, checked: boolean): void {
    const input = panel.querySelector<HTMLInputElement>("#" + inputId);
    if (input) input.checked = checked;
}
export function syncStatusTabs(tabs: HTMLElement, active: string): void {
    tabs.setAttribute("data-active", active);
    tabs.querySelectorAll(".baq-vip-status-tab").forEach((tab: Element) => {
        tab.classList.toggle("baq-active", tab.getAttribute("data-status") === active);
    });
    syncTabsAria(tabs);
}
function setupStatusTabs(panel: HTMLElement, tabs: HTMLElement, isEnabled: () => boolean, apply: (value: string) => void): void {
    tabs.addEventListener("click", function (e: Event) {
        if (!isEnabled()) return;
        if ((e.target as HTMLElement).classList.contains("baq-vip-status-tab")) {
            apply((e.target as HTMLElement).getAttribute("data-status")!);
        }
    });
    bindTabsKeyboard(panel, tabs, isEnabled, apply);
    syncTabsAria(tabs);
}

function setWarningText(el: HTMLElement, text: string): void {
    if (!text) {
        el.style.display = "none";
        return;
    }
    el.style.display = "block";
    if (el.textContent !== text) el.textContent = text;
}
function updateWarnings(panel: HTMLElement): void {
    if (!panel || state.isLoading || !state.vipStatusChecked) return;
    const nonVipWarning = panel.querySelector("#non-vip-warning") as HTMLElement;
    const audioWarning = panel.querySelector("#audio-warning") as HTMLElement;
    setWarningText(nonVipWarning, !state.isVipUser && VIP_QUALITIES.includes(state.userQualitySetting)
        ? (state.useHighestQualityFallback
            ? "无法使用此会员画质。已自动选择最高可用画质。"
            : "无法使用此会员画质。将保持当前画质。")
        : "");
    setWarningText(audioWarning, !state.isVipUser && (state.hiResAudioEnabled || state.dolbyAtmosEnabled)
        ? "非大会员用户不能使用高级音频选项。"
        : "");
}
function setLiveText(el: Element | null, text: string): void {
    if (el && el.textContent !== text) el.textContent = text;
}
// 加载期把画质卡的禁用原因指向状态胶囊（「正在获取账号状态」）
const QUALITY_STATUS_ID = "quality-status-bar";
function syncQualityGridAria(panel: HTMLElement): void {
    const grid = panel.querySelector("#quality-grid") as HTMLElement | null;
    if (!grid) return;
    if (state.customSortEnabled) {
        grid.setAttribute("role", "group");
        grid.setAttribute("aria-labelledby", "quality-section-title");
        setAriaFlag(grid, "aria-disabled", state.isLoading);
        return;
    }
    syncRadioGroupAria(grid, ".baq-quality-button", {
        labelledBy: "quality-section-title",
        disabled: state.isLoading,
        describedBy: state.isLoading ? QUALITY_STATUS_ID : undefined
    });
}
export function updateQualityButtons(panel: HTMLElement): void {
    if (!panel) return;
    const statusBar = panel.querySelector(".baq-status-bar")!;
    const vipDependentSelector = "#quality-grid .baq-quality-button, #custom-sort-container, #highest-quality-fallback-container, #hi-res-audio-container, #dolby-atmos-container";
    const vipGatedInputs = "#custom-sort, #hi-res-audio, #dolby-atmos";
    if (state.isLoading) {
        setLiveText(statusBar, "正在获取账号状态");
        statusBar.className = "baq-status-bar baq-loading";
        Utils.queryAll(vipDependentSelector, panel).forEach(el => {
            el.style.opacity = "0.5";
        });
        panel.querySelectorAll<HTMLInputElement>(vipGatedInputs).forEach(input => { input.disabled = true; });
    } else {
        Utils.queryAll(vipDependentSelector, panel).forEach(el => {
            el.style.opacity = "1";
        });
        panel.querySelectorAll<HTMLInputElement>(vipGatedInputs).forEach(input => { input.disabled = false; });
        if (state.vipStatusChecked) {
            setLiveText(statusBar, state.isVipUser
                ? "大会员 · 全部选项可用"
                : "非大会员 · 会员专属选项不可用");
            statusBar.className = "baq-status-bar " + (state.isVipUser ? "baq-vip" : "baq-non-vip");
        } else {
            setLiveText(statusBar, "会员状态未知 · 画质选项不受影响");
            statusBar.className = "baq-status-bar baq-non-vip";
        }
    }
    Utils.queryAll("#quality-grid .baq-quality-button", panel).forEach(button => {
        const wasActive = button.classList.contains("baq-active");
        button.classList.remove("baq-active", "baq-vip-quality");
        if (!state.customSortEnabled && button.getAttribute("data-quality") === state.userQualitySetting) {
            button.classList.add("baq-active");
            if (VIP_QUALITIES.includes(button.getAttribute("data-quality") as string)) {
                button.classList.add("baq-vip-quality");
            }
            if (!wasActive && button.getAttribute("data-quality") === "最高画质") {
                try {
                    if (typeof button.animate === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                        button.animate([
                            { opacity: 0, filter: "blur(12px)", webkitMaskSize: "10% 14%", maskSize: "10% 14%" },
                            { opacity: 1, offset: 0.3 },
                            { opacity: 1, filter: "blur(0px)", webkitMaskSize: "340% 340%", maskSize: "340% 340%" }
                        ], { duration: 1100, easing: "cubic-bezier(0.2, 0, 0.2, 1)", pseudoElement: "::before" });
                    }
                } catch (e) { debugTransient(e); }
            }
        }
    });
    if (state.customSortEnabled) refreshCustomGridDecorations(panel);
    const hintWrap = panel.querySelector("#quality-grid-hint-wrap");
    if (hintWrap) hintWrap.classList.toggle("baq-collapsed", !state.customSortEnabled);
    const sectionTitle = panel.querySelector("#quality-section-title");
    if (sectionTitle) sectionTitle.textContent = state.customSortEnabled ? "画质优先级" : "画质选择";
    const fallbackContainer = panel.querySelector("#highest-quality-fallback-container");
    if (fallbackContainer) fallbackContainer.classList.toggle("baq-disabled", state.customSortEnabled);
    syncCheckbox(panel, "custom-sort", state.customSortEnabled);
    syncCheckbox(panel, "hi-res-audio", state.hiResAudioEnabled);
    syncCheckbox(panel, "dolby-atmos", state.dolbyAtmosEnabled);
    const fallbackCheckbox = panel.querySelector<HTMLInputElement>("#highest-quality-fallback");
    if (fallbackCheckbox) {
        fallbackCheckbox.checked = state.useHighestQualityFallback;
        fallbackCheckbox.disabled = state.customSortEnabled || state.isLoading;
    }
    syncCheckbox(panel, "inject-quality-button", state.injectQualityButton);
    syncCheckbox(panel, "auto-widescreen", state.autoWidescreen);
    syncCheckbox(panel, "adaptive-quality-downgrade", state.adaptiveQualityEnabled);
    const sensSection = panel.querySelector("#adaptive-sensitivity-section");
    if (sensSection) sensSection.classList.toggle("baq-disabled", !state.adaptiveQualityEnabled);
    const sensTabs = panel.querySelector("#adaptive-quality-sensitivity") as HTMLElement | null;
    if (sensTabs) {
        sensTabs.classList.toggle("baq-disabled", !state.adaptiveQualityEnabled);
        syncStatusTabs(sensTabs, state.adaptiveQualitySensitivity);
    }
    const adaptiveRow = panel.querySelector("#adaptive-toggle-row");
    if (adaptiveRow) adaptiveRow.setAttribute("data-level", state.adaptiveQualitySensitivity);
    syncQualityGridAria(panel);
    updateWarnings(panel);
}
export function createSettingsPanel(): void {
    const panel = document.createElement("div") as BaqPanelElement;
    panel.id = "bilibili-quality-selector";
    const QUALITIES = DEFAULT_CUSTOM_ORDER;
    function buildDefaultItemsHTML() {
        return QUALITIES.map(q => `<button class="baq-quality-button" data-quality="${q}">${q}</button>`).join('');
    }
    function buildCustomItemsHTML() {
        const order = normalizeCustomOrder(state.customQualityOrder);
        const cutoff = customEffectiveCutoff(order);
        return order.map((q, i) => {
            const isFallback = q === CUSTOM_HIGHEST;
            const dimmed = cutoff !== -1 && i > cutoff;
            const cls = ["baq-quality-button", "baq-cq-grid-item"];
            if (isFallback) cls.push("baq-cq-fallback");
            if (dimmed) cls.push("baq-cq-dimmed");
            if (VIP_QUALITIES.includes(q)) cls.push("baq-cq-vip");
            const tag = isFallback ? `<span class="baq-cq-tag" role="img" aria-label="兜底档位">兜底</span>` : "";
            const title = isFallback ? ` title="兜底：找不到上方偏好画质时，选当前可用的最高画质"` : "";
            return `<button class="${cls.join(' ')}" data-quality="${q}" draggable="false"${title}><span class="baq-cq-rank">${i + 1}</span>${q}${tag}</button>`;
        }).join('');
    }
    function gridHTML() {
        return state.customSortEnabled ? buildCustomItemsHTML() : buildDefaultItemsHTML();
    }
    function renderGrid() {
        const grid = panel.querySelector("#quality-grid");
        if (!grid) return;
        grid.innerHTML = gridHTML();
    }
    panel.innerHTML = `
      ${renderPanelHeader("画质设置", `<div class="baq-status-bar" id="${QUALITY_STATUS_ID}" role="status"></div>`)}
      <div class="baq-columns">
        <div class="baq-col">
          <div class="baq-section-title" id="quality-section-title">${state.customSortEnabled ? '画质优先级' : '画质选择'}</div>
          <div class="baq-quality-group" id="quality-grid">
            ${gridHTML()}
          </div>
          <div class="baq-hint-collapse${state.customSortEnabled ? '' : ' baq-collapsed'}" id="quality-grid-hint-wrap"><div class="baq-hint-inner">
            <div class="baq-cq-hint" id="quality-grid-hint" role="note" aria-label="长按拖动排序，或聚焦某一档后按 Alt 加上下方向键换位。标有蓝点的「最高画质」是兜底档位，代表找不到上方偏好画质时改选当前可用的最高画质；它与「默认」之后的档位不再生效，界面上以灰显表示。">长按拖动排序，「最高画质」和「默认」之后的档位不生效</div>
          </div></div>
          <div id="non-vip-warning" class="baq-warning" role="alert" style="display:none;"></div>
          ${renderToggleRow({ rowId: "custom-sort-container", inputId: "custom-sort", label: "自定义排序", checked: state.customSortEnabled })}
          ${renderToggleRow({ rowId: "highest-quality-fallback-container", rowClass: state.customSortEnabled ? "baq-disabled" : "", inputId: "highest-quality-fallback", label: "找不到目标画质时使用最高画质", checked: state.useHighestQualityFallback, disabled: state.customSortEnabled })}
        </div>
        <div class="baq-col">
          <div class="baq-section-title">会员音频</div>
          ${renderToggleRow({ rowId: "hi-res-audio-container", inputId: "hi-res-audio", label: "Hi-Res 音质", checked: state.hiResAudioEnabled, slider: "baq-vip-audio" })}
          ${renderToggleRow({ rowId: "dolby-atmos-container", inputId: "dolby-atmos", label: "杜比全景声", checked: state.dolbyAtmosEnabled, slider: "baq-vip-audio" })}
          <div id="audio-warning" class="baq-warning" role="alert" style="display:none;"></div>
          <div class="baq-section-title">播放器</div>
          ${renderToggleRow({ inputId: "inject-quality-button", label: "控制栏设置入口", sublabel: "在播放器控制栏显示本面板按钮", checked: state.injectQualityButton, slider: "baq-c-cyan" })}
          ${renderToggleRow({ inputId: "auto-widescreen", label: "自动宽屏", checked: state.autoWidescreen, slider: "baq-c-cyan" })}
          <div class="baq-group-last">
            <div class="baq-section-title">智能降档</div>
            ${renderToggleRow({ rowId: "adaptive-toggle-row", rowAttrs: `data-level="${state.adaptiveQualitySensitivity}"`, inputId: "adaptive-quality-downgrade", label: "网络自适应降画质", sublabel: "卡顿或网络不佳时自动降低一档", checked: state.adaptiveQualityEnabled, slider: "baq-smart" })}
            <div class="baq-sens-section ${state.adaptiveQualityEnabled ? '' : 'baq-disabled'}" id="adaptive-sensitivity-section">
              <div class="baq-sens-label" id="adaptive-sens-label">降档灵敏度</div>
              ${renderStatusTabs({ id: "adaptive-quality-sensitivity", extraClass: "baq-sens-tabs", disabled: !state.adaptiveQualityEnabled, active: state.adaptiveQualitySensitivity, options: ["灵敏", "标准", "保守"], labelledBy: "adaptive-sens-label" })}
            </div>
          </div>
        </div>
      </div>
    `;
    setupPanelA11y(panel);
    bindCustomOrderKeyboard(panel);
    panel.addEventListener("click", function (e: MouseEvent) {
        const btn = (e.target as HTMLElement).closest(".baq-quality-button");
        if (btn && !state.customSortEnabled && !state.isLoading) {
            setSetting("userQualitySetting", btn.getAttribute("data-quality"));
            updateQualityButtons(panel);
            selectQualityBasedOnSetting();
        }
    });
    bindSettingCheckbox(panel, "custom-sort", "customSortEnabled", { gated: true, after: () => {
        const hintWrap = panel.querySelector("#quality-grid-hint-wrap");
        if (hintWrap) hintWrap.classList.toggle("baq-collapsed", !state.customSortEnabled);
        const grid = panel.querySelector("#quality-grid") as HTMLElement;
        grid.style.transition = "opacity 0.16s ease";
        grid.style.opacity = "0";
        setTimeout(() => {
            renderGrid();
            updateQualityButtons(panel);
            const rebuilt = panel.querySelector("#quality-grid") as HTMLElement;
            rebuilt.style.transition = "opacity 0.16s ease";
            rebuilt.style.opacity = "1";
        }, 170);
        selectQualityBasedOnSetting();
    } });
    bindSettingCheckbox(panel, "highest-quality-fallback", "useHighestQualityFallback", { gated: true, after: selectQualityBasedOnSetting });
    bindSettingCheckbox(panel, "hi-res-audio", "hiResAudioEnabled", { gated: true, after: () => {
        updateQualityButtons(panel);
        selectQualityBasedOnSetting();
    } });
    bindSettingCheckbox(panel, "dolby-atmos", "dolbyAtmosEnabled", { gated: true, after: () => {
        updateQualityButtons(panel);
        selectQualityBasedOnSetting();
    } });
    // 以下三项与会员状态无关，不受加载锁
    bindSettingCheckbox(panel, "inject-quality-button", "injectQualityButton", { after: () => ensureQualitySettingsButton(state.injectQualityButton) });
    // 关闭时也调用以清理等待中的观察器
    bindSettingCheckbox(panel, "auto-widescreen", "autoWidescreen", { after: applyAutoWidescreen });
    bindSettingCheckbox(panel, "adaptive-quality-downgrade", "adaptiveQualityEnabled", { after: () => {
        const section = panel.querySelector("#adaptive-sensitivity-section");
        if (section) section.classList.toggle("baq-disabled", !state.adaptiveQualityEnabled);
        const tabs = panel.querySelector("#adaptive-quality-sensitivity") as HTMLElement | null;
        if (tabs) {
            tabs.classList.toggle("baq-disabled", !state.adaptiveQualityEnabled);
            syncTabsAria(tabs);
        }
        restartAdaptiveQuality();
    } });
    const sensitivityTabs = panel.querySelector("#adaptive-quality-sensitivity") as HTMLElement | null;
    if (sensitivityTabs) {
        setupStatusTabs(panel, sensitivityTabs, () => state.adaptiveQualityEnabled, (level: string) => {
            setSetting("adaptiveQualitySensitivity", level);
            syncStatusTabs(sensitivityTabs, level);
            const adaptiveRow = panel.querySelector("#adaptive-toggle-row");
            if (adaptiveRow) adaptiveRow.setAttribute("data-level", level);
            restartAdaptiveQuality();
            console.log(`[智能降画质] 灵敏度设置为: ${level}`);
        });
    }
    document.body.appendChild(panel);
    panel.renderGrid = renderGrid;
    setupCustomGridDrag(panel);
    updateQualityButtons(panel);
}
function refreshCustomGridDecorations(panel: HTMLElement): void {
    const grid = panel.querySelector("#quality-grid");
    if (!grid) return;
    const items = Utils.queryAll(".baq-cq-grid-item", grid);
    const cutoff = customEffectiveCutoff(items.map(it => it.getAttribute("data-quality") as string));
    items.forEach((it, i) => {
        const rank = it.querySelector(".baq-cq-rank");
        if (rank) rank.textContent = String(i + 1);
        const dimmed = cutoff !== -1 && i > cutoff;
        const fallback = it.getAttribute("data-quality") === CUSTOM_HIGHEST;
        it.classList.toggle("baq-cq-dimmed", dimmed);
        it.classList.toggle("baq-cq-fallback", fallback);
        it.removeAttribute("role");
        it.removeAttribute("aria-checked");
        it.setAttribute("tabindex", "0");
        setAriaFlag(it, "aria-disabled", state.isLoading);
        it.setAttribute("aria-describedby", state.isLoading ? `quality-grid-hint ${QUALITY_STATUS_ID}` : "quality-grid-hint");
        it.setAttribute("aria-label", `${it.getAttribute("data-quality")}，第 ${i + 1} 位，共 ${items.length} 位${fallback ? "，兜底档位" : ""}${dimmed ? "，不生效" : ""}`);
    });
}
function commitCustomOrder(panel: BaqPanelElement, orderedItems: HTMLElement[]): void {
    saveCustomOrder(orderedItems.map(n => n.getAttribute("data-quality")));
    refreshCustomGridDecorations(panel);
    if (!state.customSortEnabled && typeof panel.renderGrid === "function") {
        panel.renderGrid();
        updateQualityButtons(panel);
    }
    selectQualityBasedOnSetting();
}
function bindCustomOrderKeyboard(panel: BaqPanelElement): void {
    panel.addEventListener("keydown", (e: KeyboardEvent) => {
        if (!e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        const target = e.target as Element | null;
        const item = target && typeof target.closest === "function" ? target.closest(".baq-cq-grid-item") as HTMLElement | null : null;
        if (!item) return;
        const grid = panel.querySelector("#quality-grid") as HTMLElement | null;
        if (!grid || !grid.contains(item)) return;
        e.preventDefault();
        e.stopPropagation();
        if (!state.customSortEnabled || state.isLoading) return;
        if (grid.classList.contains("baq-cq-dragging")) return;
        const items = Utils.queryAll(".baq-cq-grid-item", grid);
        const from = items.indexOf(item);
        if (from === -1) return;
        const to = from + (e.key === "ArrowDown" ? 1 : -1);
        if (to < 0 || to >= items.length) return;
        const neighbor = items[to];
        if (to > from) grid.insertBefore(neighbor, item);
        else grid.insertBefore(item, neighbor);
        // 顺序从 DOM 现读，避免本地数组与真实落位各说各话
        commitCustomOrder(panel, Utils.queryAll(".baq-cq-grid-item", grid));
        item.focus();
    }, true);
}
function setupCustomGridDrag(panel: BaqPanelElement): void {
    const grid = panel.querySelector("#quality-grid") as HTMLElement;
    if (!grid || grid.dataset.dragBound === "1") return;
    grid.dataset.dragBound = "1";

    const LONG_PRESS_MS = 260;
    const MOVE_CANCEL_PX = 10;
    const EDGE = 48;
    const SCROLL_SPEED = 14;

    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let pressEl: HTMLElement | null = null;
    let activePointerId: number | null = null;
    let activated = false;
    let committed = false;
    let dragging: HTMLElement | null = null;
    let items: HTMLElement[] = [];
    let slots: SlotPoint[] = [];
    let startIndex = -1;
    let currentIndex = -1;
    let pointerStartClientX = 0;
    let pointerStartClientY = 0;
    let lastClientX = 0;
    let lastClientY = 0;
    let moveRAF: number | null = null;
    let autoScrollRAF: number | null = null;

    function clearPress() {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        if (pressEl) { pressEl.classList.remove("baq-cq-press"); pressEl = null; }
    }
    function captureSlots() {
        const gridRect = grid.getBoundingClientRect();
        slots = items.map(it => {
            const r = it.getBoundingClientRect();
            return { x: r.left - gridRect.left + r.width / 2, y: r.top - gridRect.top + r.height / 2 };
        });
    }
    function pointerRel() {
        const gridRect = grid.getBoundingClientRect();
        return { x: lastClientX - gridRect.left, y: lastClientY - gridRect.top };
    }
    function nearestIndex(p: SlotPoint): number {
        let best = 0, bestD = Infinity;
        for (let i = 0; i < slots.length; i++) {
            const dx = slots[i].x - p.x, dy = slots[i].y - p.y;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; best = i; }
        }
        return best;
    }
    function workingOrder() {
        const arr = items.slice();
        arr.splice(startIndex, 1);
        arr.splice(currentIndex, 0, dragging!);
        return arr;
    }
    function applyLayout() {
        const order = workingOrder();
        const cutoff = customEffectiveCutoff(order.map(it => it.getAttribute("data-quality") as string));
        order.forEach((it, newIdx) => {
            const oldIdx = items.indexOf(it);
            const rank = it.querySelector(".baq-cq-rank");
            if (rank) rank.textContent = String(newIdx + 1);
            if (it === dragging) return;
            it.classList.toggle("baq-cq-dimmed", cutoff !== -1 && newIdx > cutoff);
            const dx = slots[newIdx].x - slots[oldIdx].x;
            const dy = slots[newIdx].y - slots[oldIdx].y;
            it.style.transform = `translate(${dx}px, ${dy}px)`;
        });
    }
    function updateDrag() {
        moveRAF = null;
        if (!activated || !dragging) return;
        const p = pointerRel();
        const dx = p.x - slots[startIndex].x;
        const dy = p.y - slots[startIndex].y;
        dragging.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
        const idx = nearestIndex(p);
        if (idx !== currentIndex) {
            currentIndex = idx;
            applyLayout();
        }
    }
    function stopAutoScroll() {
        if (autoScrollRAF) { cancelAnimationFrame(autoScrollRAF); autoScrollRAF = null; }
    }
    function handleAutoScroll() {
        const rect = panel.getBoundingClientRect();
        let dir = 0;
        if (lastClientY < rect.top + EDGE) dir = -1;
        else if (lastClientY > rect.bottom - EDGE) dir = 1;
        if (dir === 0) { stopAutoScroll(); return; }
        if (autoScrollRAF) return;
        const tick = () => {
            if (!activated) { stopAutoScroll(); return; }
            const before = panel.scrollTop;
            panel.scrollTop += dir * SCROLL_SPEED;
            if (panel.scrollTop !== before) updateDrag();
            autoScrollRAF = requestAnimationFrame(tick);
        };
        autoScrollRAF = requestAnimationFrame(tick);
    }
    function activateDrag(item: HTMLElement): void {
        items = Utils.queryAll(".baq-cq-grid-item", grid);
        startIndex = items.indexOf(item);
        if (startIndex === -1) {
            item.classList.remove("baq-cq-press");
            return;
        }
        activated = true;
        committed = false;
        dragging = item;
        currentIndex = startIndex;
        captureSlots();
        grid.classList.add("baq-cq-dragging");
        item.classList.remove("baq-cq-press");
        item.classList.add("baq-dragging");
        items.forEach(it => { it.style.transform = ""; });
    }
    function commitOrder() {
        if (committed) return;
        committed = true;
        const order = workingOrder();
        order.forEach(n => {
            n.style.transition = "none";
            n.style.transform = "";
            grid.appendChild(n);
        });
        // 先强制回流再恢复过渡，不然会闪
        void grid.offsetHeight;
        order.forEach(n => { n.style.transition = ""; });
        grid.classList.remove("baq-cq-dragging");
        dragging = null;
        activated = false;
        commitCustomOrder(panel, order);
    }
    function finishDrag() {
        stopAutoScroll();
        if (moveRAF) { cancelAnimationFrame(moveRAF); moveRAF = null; }
        if (!dragging) { activated = false; grid.classList.remove("baq-cq-dragging"); return; }
        const item = dragging;
        const dx = slots[currentIndex].x - slots[startIndex].x;
        const dy = slots[currentIndex].y - slots[startIndex].y;
        item.classList.remove("baq-dragging");
        requestAnimationFrame(() => {
            item.style.transform = `translate(${dx}px, ${dy}px)`;
        });
        let done = false;
        const onEnd = (ev: TransitionEvent) => {
            if (ev && ev.propertyName && ev.propertyName !== "transform") return;
            if (done) return;
            done = true;
            item.removeEventListener("transitionend", onEnd);
            commitOrder();
        };
        item.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 300);
    }
    function onPointerDown(e: PointerEvent): void {
        if (!state.customSortEnabled || state.isLoading) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (activated || pressTimer || activePointerId !== null) return;
        const item = (e.target as HTMLElement).closest(".baq-cq-grid-item") as HTMLElement | null;
        if (!item || !grid.contains(item)) return;
        try {
            grid.setPointerCapture(e.pointerId);
        } catch (err) {
            debugTransient(err);
            return;
        }
        pressEl = item;
        activePointerId = e.pointerId;
        pointerStartClientX = e.clientX;
        pointerStartClientY = e.clientY;
        lastClientX = e.clientX;
        lastClientY = e.clientY;
        item.classList.add("baq-cq-press");
        pressTimer = setTimeout(() => {
            pressTimer = null;
            const pointerId = activePointerId;
            if (pointerId === null || !grid.hasPointerCapture(pointerId)) {
                clearPress();
                activePointerId = null;
                return;
            }
            activateDrag(item);
        }, LONG_PRESS_MS);
    }
    function onPointerMove(e: PointerEvent): void {
        if (e.pointerId !== activePointerId) return;
        if (!activated) {
            if (pressTimer && (Math.abs(e.clientY - pointerStartClientY) > MOVE_CANCEL_PX || Math.abs(e.clientX - pointerStartClientX) > MOVE_CANCEL_PX)) {
                clearPress();
            }
            return;
        }
        e.preventDefault();
        lastClientX = e.clientX;
        lastClientY = e.clientY;
        if (!moveRAF) moveRAF = requestAnimationFrame(updateDrag);
        handleAutoScroll();
    }
    function onPointerUp(e: PointerEvent): void {
        if (e.pointerId !== activePointerId) return;
        clearPress();
        try { grid.releasePointerCapture(activePointerId!); } catch (err) { debugTransient(err); }
        activePointerId = null;
        if (activated) finishDrag();
    }
    grid.addEventListener("pointerdown", onPointerDown);
    grid.addEventListener("pointermove", onPointerMove);
    grid.addEventListener("pointerup", onPointerUp);
    grid.addEventListener("pointercancel", onPointerUp);
    grid.addEventListener("dragstart", (e: Event) => e.preventDefault());
    grid.addEventListener("contextmenu", (e: Event) => { if (activated || pressTimer) e.preventDefault(); });
}
export function syncTabsAria(container: HTMLElement): void {
    if (!container) return;
    syncRadioGroupAria(container, ".baq-vip-status-tab", { disabled: container.classList.contains("baq-disabled") });
}
function bindTabsKeyboard(root: HTMLElement, container: HTMLElement, isEnabled: () => boolean, onSelect: (status: string) => void): void {
    if (!root || !container) return;
    root.addEventListener("keydown", (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target || !container.contains(target) || !target.classList.contains("baq-vip-status-tab")) return;
        const tabs = Utils.queryAll(".baq-vip-status-tab", container);
        if (!tabs.length) return;
        let next: HTMLElement;
        if (e.key === "Enter" || e.key === " ") next = target;
        else if (e.key === "Home") next = tabs[0];
        else if (e.key === "End") next = tabs[tabs.length - 1];
        else {
            const step = (e.key === "ArrowRight" || e.key === "ArrowDown") ? 1
                : (e.key === "ArrowLeft" || e.key === "ArrowUp") ? -1
                : 0;
            if (!step) return;
            const from = tabs.indexOf(target);
            next = tabs[((from === -1 ? 0 : from) + step + tabs.length) % tabs.length];
        }
        e.preventDefault();
        e.stopPropagation();
        if (!isEnabled()) return;
        onSelect(next.getAttribute("data-status")!);
        next.focus();
    }, true);
}

export function isInputBusy(input: HTMLInputElement): boolean {
    return document.activeElement === input || !!input.closest(".baq-num-stepper[data-holding]");
}
function getNumberMirror(): HTMLElement {
    let m = document.getElementById("baq-num-mirror");
    if (!m) {
        m = document.createElement("span");
        m.id = "baq-num-mirror";
        m.style.cssText = "position:absolute;left:-9999px;top:-9999px;visibility:hidden;white-space:pre;pointer-events:none;";
        document.body.appendChild(m);
    }
    return m;
}
export function setupSteppers(panel: HTMLElement): void {
    Utils.queryAll(".baq-num-stepper", panel).forEach(stepper => {
        if (stepper.dataset.stepperBound === "1") return;
        stepper.dataset.stepperBound = "1";
        const input = stepper.querySelector('input[type="number"]') as HTMLInputElement;
        const dec = stepper.querySelector(".baq-ns-dec") as HTMLButtonElement;
        const inc = stepper.querySelector(".baq-ns-inc") as HTMLButtonElement;
        if (!input || !dec || !inc) return;
        const step = parseFloat(input.step) || 1;
        const min = input.min !== "" ? parseFloat(input.min) : -Infinity;
        const max = input.max !== "" ? parseFloat(input.max) : Infinity;
        const labelEl = input.id ? panel.querySelector("#" + input.id + "-label") : null;
        const fieldName = (labelEl && labelEl.textContent) || input.id || "数值";
        const unitText = (stepper.querySelector(".baq-unit") as HTMLElement | null)?.textContent || "";
        function clampSnap(v: number): number {
            if (isNaN(v)) v = (min !== -Infinity ? min : 0);
            if (min !== -Infinity) v = Math.round((v - min) / step) * step + min;
            v = Math.min(max, Math.max(min, v));
            return Math.round(v * 1000) / 1000;
        }
        function fitWidth() {
            // 用镜像量出真实宽度，免得数字被裁
            const cs = getComputedStyle(input);
            const m = getNumberMirror();
            m.style.fontSize = cs.fontSize;
            m.style.fontFamily = cs.fontFamily;
            m.style.fontWeight = cs.fontWeight;
            m.style.letterSpacing = cs.letterSpacing;
            m.textContent = input.value === "" ? "0" : input.value;
            input.style.width = Math.max(12, m.offsetWidth + 2) + "px";
        }
        function refreshButtons() {
            const v = parseFloat(input.value);
            const cur = isNaN(v) ? null : clampSnap(v);
            dec.disabled = cur !== null && cur <= min;
            inc.disabled = cur !== null && cur >= max;
        }
        function applyDelta(dir: number): void {
            if (input.disabled) return;
            let v = parseFloat(input.value);
            if (isNaN(v)) v = (min !== -Infinity ? min : 0);
            v = clampSnap(v + dir * step);
            if (String(v) !== input.value) {
                input.value = String(v);
                input.dispatchEvent(new Event("input", { bubbles: true }));
                fitWidth();
            }
            refreshButtons();
        }
        // 长按连续步进，松手时只提交一次
        function bindHold(btn: HTMLButtonElement, dir: number): void {
            let delayTimer: ReturnType<typeof setTimeout> | null = null;
            let repeatTimer: ReturnType<typeof setInterval> | null = null;
            let held = false;
            function stop(): void {
                if (delayTimer) { clearTimeout(delayTimer); delayTimer = null; }
                if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; }
                stepper.removeAttribute("data-holding");
                if (held) { held = false; input.dispatchEvent(new Event("change", { bubbles: true })); }
            }
            btn.addEventListener("pointerdown", function (e: PointerEvent) {
                if (e.button != null && e.button !== 0) return;
                if (btn.disabled || input.disabled) return;
                e.preventDefault();
                held = true;
                stepper.setAttribute("data-holding", "1");
                applyDelta(dir);
                try { btn.setPointerCapture(e.pointerId); } catch (err) { debugTransient(err); }
                delayTimer = setTimeout(function () {
                    repeatTimer = setInterval(function () {
                        if (btn.disabled || input.disabled) { stop(); return; }
                        applyDelta(dir);
                    }, 90);
                }, 350);
            });
            ["pointerup", "pointercancel", "lostpointercapture"].forEach(ev => btn.addEventListener(ev, stop));
            // 键盘触发的 click，detail 是 0
            btn.addEventListener("click", function (e: MouseEvent) {
                if (e.detail === 0 && !btn.disabled && !input.disabled) {
                    applyDelta(dir);
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                }
            });
        }
        bindHold(dec, -1);
        bindHold(inc, 1);
        input.addEventListener("input", function () { fitWidth(); refreshButtons(); });
        // 失焦时把越界值夹回来再保存
        input.addEventListener("change", function () {
            if (!input.disabled) {
                const typed = input.value;
                const raw = parseFloat(typed);
                const snapped = clampSnap(isNaN(raw) ? (min !== -Infinity ? min : 0) : raw);
                if (String(snapped) !== input.value) {
                    console.log(`[设置] ${fieldName}：输入「${typed === "" ? "空" : typed}」不可用，已修正为 ${snapped}${unitText}`);
                    input.value = String(snapped);
                    input.dispatchEvent(new Event("input", { bubbles: true }));
                }
            }
            fitWidth();
            refreshButtons();
        });
        fitWidth();
        refreshButtons();
    });
}
export function createLiveSettingsPanel(): void {
    if (document.getElementById("bilibili-live-quality-selector")) return;
    const panel = document.createElement("div") as BaqPanelElement;
    panel.id = "bilibili-live-quality-selector";
    function syncPanel() {
        const keepAliveActive = state.liveKeepAliveEnabled && state.liveKeepAliveTimerId !== null;
        panel.querySelectorAll("[data-quality].baq-live-quality-button").forEach(btn => {
            btn.classList.toggle("baq-active", btn.getAttribute("data-quality") === state.userLiveQualitySetting);
        });
        syncRadioGroupAria(panel.querySelector<HTMLElement>(".baq-live-quality-group"), "[data-quality].baq-live-quality-button", { labelledBy: "live-quality-title" });
        syncCheckbox(panel, "live-quality-polling", state.liveQualityPollingEnabled);
        updatePollingStatusIndicator();
        const pollingGroup = panel.querySelector("#live-polling-interval-group");
        if (pollingGroup) pollingGroup.classList.toggle("baq-disabled", !state.liveQualityPollingEnabled);
        const pollingInput = panel.querySelector<HTMLInputElement>("#live-polling-interval");
        if (pollingInput) {
            if (!isInputBusy(pollingInput)) (pollingInput as NumericValueInput).value = state.livePollingInterval;
            pollingInput.disabled = !state.liveQualityPollingEnabled;
        }
        syncCheckbox(panel, "live-keep-alive", state.liveKeepAliveEnabled);
        setLiveText(panel.querySelector("#live-keepalive-status"), keepAliveActive ? `运行中，每 ${state.liveKeepAliveInterval} 分钟模拟一次` : "未启用");
        const keepAliveGroup = panel.querySelector("#live-keepalive-interval-group");
        if (keepAliveGroup) keepAliveGroup.classList.toggle("baq-disabled", !state.liveKeepAliveEnabled);
        const keepAliveInput = panel.querySelector<HTMLInputElement>("#live-keepalive-interval");
        if (keepAliveInput) {
            if (!isInputBusy(keepAliveInput)) (keepAliveInput as NumericValueInput).value = state.liveKeepAliveInterval;
            keepAliveInput.disabled = !state.liveKeepAliveEnabled;
        }
        syncCheckbox(panel, "prevent-bg-degrade", state.preventBackgroundDegrade);
        syncCheckbox(panel, "live-auto-recover", state.liveAutoRecoverOnVisible);
        syncCheckbox(panel, "live-danmaku-sync", state.liveDanmakuSync);
    }
    function buildPanel() {
        const LIVE_QUALITY_LABELS: Record<string, string> = { "1080P 原画": "1080P 原画 / 高码率" };
        const LIVE_QUALITIES = [
            { value: CUSTOM_HIGHEST, label: CUSTOM_HIGHEST },
            ...Object.keys(BILI.live.qnMap).map(value => ({ value, label: LIVE_QUALITY_LABELS[value] || value })),
        ];
        const pollingActive = state.liveQualityPollingEnabled && state.livePollingTimerId !== null;
        const keepAliveActive = state.liveKeepAliveEnabled && state.liveKeepAliveTimerId !== null;
        panel.innerHTML = `
        ${renderPanelHeader("直播设置")}
        <div class="baq-columns baq-even">
          <div class="baq-col">
            <div class="baq-section-title" id="live-quality-title">画质选择</div>
            <div class="baq-live-quality-group">
              ${LIVE_QUALITIES.map(q => `<button class="baq-live-quality-button ${q.value === state.userLiveQualitySetting ? 'baq-active' : ''}" data-quality="${q.value}">${q.label}</button>`).join('')}
            </div>
            <div class="baq-group-last">
              <div class="baq-section-title">画质锁定<span class="baq-beta-tag">BETA</span></div>
              ${renderToggleRow({ inputId: "live-quality-polling", label: "画质轮询锁定", description: pollingActive ? '运行中，每 ' + state.livePollingInterval + ' 秒检查一次' : '未启用', descriptionId: "live-polling-status", descriptionLive: true, checked: state.liveQualityPollingEnabled, slider: "baq-c-orange" })}
              ${renderStepperGroup({ groupId: "live-polling-interval-group", disabled: !state.liveQualityPollingEnabled, inputId: "live-polling-interval", label: "轮询间隔", description: "检查画质的间隔", value: state.livePollingInterval, min: 5, max: 3600, step: 1, unit: "秒" })}
            </div>
          </div>
          <div class="baq-col">
            <div class="baq-section-title">画质稳定<span class="baq-beta-tag">BETA</span></div>
            ${renderToggleRow({ inputId: "prevent-bg-degrade", label: "防后台降画质", description: "切到其他标签时不降画质", checked: state.preventBackgroundDegrade, slider: "baq-c-cyan" })}
            ${renderToggleRow({ inputId: "live-auto-recover", label: "切回前台时自动纠正画质", description: "发现画质与目标不符时自动重切", checked: state.liveAutoRecoverOnVisible, slider: "baq-c-cyan" })}
            ${renderToggleRow({ inputId: "live-danmaku-sync", label: "切回前台时刷新弹幕", description: "自动开关弹幕以同步弹幕状态", checked: state.liveDanmakuSync, slider: "baq-c-cyan" })}
            <div class="baq-group-last">
              <div class="baq-section-title">页面保活<span class="baq-beta-tag">BETA</span></div>
              ${renderToggleRow({ inputId: "live-keep-alive", label: "模拟用户活跃", description: keepAliveActive ? '运行中，每 ' + state.liveKeepAliveInterval + ' 分钟模拟一次' : '未启用', descriptionId: "live-keepalive-status", descriptionLive: true, checked: state.liveKeepAliveEnabled, slider: "baq-c-green" })}
              ${renderStepperGroup({ groupId: "live-keepalive-interval-group", disabled: !state.liveKeepAliveEnabled, inputId: "live-keepalive-interval", label: "保活间隔", description: "模拟活跃的间隔", value: state.liveKeepAliveInterval, min: 1, max: 1440, step: 1, unit: "分钟" })}
            </div>
          </div>
        </div>
      `;
        setupPanelA11y(panel);
        panel.querySelectorAll("[data-quality].baq-live-quality-button").forEach(button => {
            button.addEventListener("click", () => {
                setSetting("userLiveQualitySetting", button.getAttribute("data-quality"));
                syncPanel();
                runSafely(selectLiveQuality(), "直播画质");
                restartLivePollingIfNeeded();
            });
        });
        bindSettingCheckbox(panel, "live-quality-polling", "liveQualityPollingEnabled", { after: () => {
            const intervalGroup = panel.querySelector("#live-polling-interval-group");
            const intervalInputEl = panel.querySelector<HTMLInputElement>("#live-polling-interval");
            if (intervalGroup) intervalGroup.classList.toggle("baq-disabled", !state.liveQualityPollingEnabled);
            if (intervalInputEl) intervalInputEl.disabled = !state.liveQualityPollingEnabled;
            if (state.liveQualityPollingEnabled) {
                startLivePolling();
            } else {
                stopLivePolling();
            }
        } });
        const intervalInput = panel.querySelector<HTMLInputElement>("#live-polling-interval");
        if (intervalInput) {
            intervalInput.addEventListener("change", function (e: Event) {
                // 绑定三个数字输入框的事件
                const target = e.target as HTMLInputElement;
                const value = normalizeSetting("livePollingInterval", parseInt(target.value, 10));
                target.value = value as string;
                setSetting("livePollingInterval", value);
                restartLivePollingIfNeeded();
                updatePollingStatusIndicator();
            });
        }
        bindSettingCheckbox(panel, "live-keep-alive", "liveKeepAliveEnabled", { after: () => {
            const kaGroup = panel.querySelector("#live-keepalive-interval-group");
            const kaInput = panel.querySelector<HTMLInputElement>("#live-keepalive-interval");
            if (kaGroup) kaGroup.classList.toggle("baq-disabled", !state.liveKeepAliveEnabled);
            if (kaInput) kaInput.disabled = !state.liveKeepAliveEnabled;
            if (state.liveKeepAliveEnabled) {
                startLiveKeepAlive();
            } else {
                stopLiveKeepAlive();
            }
        } });
        const keepAliveIntervalInput = panel.querySelector<HTMLInputElement>("#live-keepalive-interval");
        if (keepAliveIntervalInput) {
            keepAliveIntervalInput.addEventListener("change", function (e: Event) {
                const target = e.target as HTMLInputElement;
                const value = normalizeSetting("liveKeepAliveInterval", parseInt(target.value, 10));
                target.value = value as string;
                setSetting("liveKeepAliveInterval", value);
                if (state.liveKeepAliveEnabled) startLiveKeepAlive();
                updateKeepAliveStatusIndicator();
            });
        }
        bindSettingCheckbox(panel, "prevent-bg-degrade", "preventBackgroundDegrade", { after: () => applyVisibilityHijack(state.preventBackgroundDegrade) });
        bindSettingCheckbox(panel, "live-auto-recover", "liveAutoRecoverOnVisible");
        bindSettingCheckbox(panel, "live-danmaku-sync", "liveDanmakuSync");
        setupSteppers(panel);
    }
    document.body.appendChild(panel);
    panel.updatePanel = syncPanel;
    buildPanel();
    syncPanel();
}

function createDecodeSettingsPanel(): void {
    const panel = document.createElement("div");
    panel.id = "bilibili-decode-settings";
    const OPTIONS = [
        { value: "默认", desc: "跟随 B 站自动选择" },
        { value: "AV1", desc: "压缩率最高，需较新设备" },
        { value: "HEVC", desc: "硬解广泛，功耗较低" },
        { value: "AVC", desc: "兼容性最好，码率较高" },
    ];
    const current = state.isLivePage ? state.userLiveDecodeSetting : state.userVideoDecodeSetting;
    panel.innerHTML = `
      ${renderPanelHeader("解码设置")}
      ${renderToggleRow({ inputId: "decode-setting-enabled", label: "启用解码设置", sublabel: "替您切换 B 站播放设置中的视频编码", checked: state.decodeSettingEnabled, slider: "baq-c-cyan" })}
      <div class="baq-decode-strategy${state.decodeSettingEnabled ? '' : ' baq-disabled'}" id="decode-strategy">
        <div class="baq-section-title">解码策略<span class="baq-title-note">仅模拟点选，生效与否由 B 站决定</span></div>
        <div class="baq-decode-group">
          ${OPTIONS.map(o => `<button class="baq-decode-option ${current === o.value ? 'baq-active' : ''}" data-decode="${o.value}">
            <span class="baq-decode-badge" data-codec="${o.value}">${o.value}</span>
            <span class="baq-decode-desc">${o.desc}</span>
          </button>`).join('')}
        </div>
      </div>
    `;
    setupPanelA11y(panel);
    bindSettingCheckbox(panel, "decode-setting-enabled", "decodeSettingEnabled", { after: () => {
        console.log(`[解码设置] 解码设置已${state.decodeSettingEnabled ? '启用' : '关闭'}`);
        const strategy = panel.querySelector("#decode-strategy");
        if (strategy) strategy.classList.toggle("baq-disabled", !state.decodeSettingEnabled);
        syncDecodeGroupAria(panel);
        if (state.decodeSettingEnabled) {
            applyDecodeSetting();
        }
    } });
    panel.addEventListener("click", function (e: MouseEvent) {
        if (!state.decodeSettingEnabled) return;
        const target = (e.target as HTMLElement).closest(".baq-decode-option");
        if (target && panel.contains(target)) {
            const value = target.getAttribute("data-decode");
            setSetting(state.isLivePage ? "userLiveDecodeSetting" : "userVideoDecodeSetting", value);
            Utils.queryAll(".baq-decode-option", panel).forEach(btn => {
                btn.classList.toggle("baq-active", btn === target);
            });
            syncDecodeGroupAria(panel);
            applyDecodeSetting();
        }
    });
    document.body.appendChild(panel);
}
function syncDecodeGroupAria(panel: HTMLElement): void {
    syncRadioGroupAria(panel.querySelector<HTMLElement>(".baq-decode-group"), ".baq-decode-option", {
        label: "解码策略",
        disabled: !state.decodeSettingEnabled
    });
}
export function updateDecodeButtons(panel: HTMLElement): void {
    if (!panel) return;
    syncCheckbox(panel, "decode-setting-enabled", state.decodeSettingEnabled);
    const strategy = panel.querySelector('#decode-strategy');
    if (strategy) strategy.classList.toggle('baq-disabled', !state.decodeSettingEnabled);
    Utils.queryAll('.baq-decode-option', panel).forEach(btn => {
        const wanted = state.isLivePage ? state.userLiveDecodeSetting : state.userVideoDecodeSetting;
        btn.classList.toggle('baq-active', btn.getAttribute('data-decode') === (wanted || '默认'));
    });
    syncDecodeGroupAria(panel);
}
export function toggleDecodeSettingsPanel(): void {
    togglePanel("bilibili-decode-settings", createDecodeSettingsPanel, updateDecodeButtons);
}
// 解码重试链单例：新调用/换页会覆盖或取消挂起的旧重试，不叠跑

function createUnlockSettingsPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.id = "bilibili-unlock-settings";
    panel.innerHTML = `
      ${renderPanelHeader("解锁设置")}
      <div class="baq-section-title">环境伪装</div>
      ${renderToggleRow({ inputId: "unlock-ua", label: "UA 修改", description: "模拟 Safari 标识并调整触控点", checked: state.unlockUA, slider: "baq-c-amber" })}
      <div class="baq-section-title">进阶选项<span class="baq-title-note">写入本地标记，不保证一定生效</span></div>
      ${renderToggleRow({ inputId: "unlock-hdr", label: "HDR 修改", description: "尝试显示 HDR 相关画质选项", checked: state.unlockHDR, slider: "baq-c-amber" })}
      ${renderToggleRow({ inputId: "unlock-marker", label: "标记解锁", description: "尝试解锁杜比全景声与 8K 选项", checked: state.unlockMarker, slider: "baq-c-amber" })}
      <button class="baq-action-button baq-action-primary" id="unlock-confirm-reload">确认并刷新页面</button>
    `;
    document.body.appendChild(panel);
    setupPanelA11y(panel);
    bindSettingCheckbox(panel, "unlock-ua", "unlockUA", { after: () => console.log(`[解锁设置] 开启 UA 修改: ${state.unlockUA}`) });
    bindSettingCheckbox(panel, "unlock-hdr", "unlockHDR", { after: () => console.log(`[解锁设置] 开启 HDR 修改: ${state.unlockHDR}`) });
    bindSettingCheckbox(panel, "unlock-marker", "unlockMarker", { after: () => console.log(`[解锁设置] 开启标记解锁: ${state.unlockMarker}`) });
    panel.querySelector('#unlock-confirm-reload')!.addEventListener('click', function () {
        console.log('[解锁设置] 已确认，准备刷新页面以应用设置');
        location.reload();
    });
    return panel;
}
type ActionHandler = (deps: PanelActionDeps) => void;

const DEV_PANEL_MANUAL_ACTIONS: Record<string, ActionHandler> = {
    "dev-export-diagnostics": runExportDiagnostics,
    "dev-export-settings": runExportSettings,
    "dev-import-settings": runImportSettings,
    "dev-reset-settings": runResetAllSettings,
};

const DEV_PANEL_ACTIONS: ActionButtonSpec[] = [
    { id: "dev-export-diagnostics", label: "导出诊断信息", tone: "secondary", description: "打印运行状态快照，随反馈附上" },
    { id: "dev-export-settings", label: "导出设置", tone: "secondary", description: "打印全部设置的 JSON 备份" },
    { id: "dev-import-settings", label: "导入设置", tone: "secondary", description: "粘贴备份 JSON 恢复设置" },
    { id: "dev-reset-settings", label: "恢复默认设置", tone: "danger", description: "重置全部设置并刷新，不可撤销" },
];

function bindDevPanelActions(panel: HTMLElement): void {
    const deps = realPanelActionDeps();
    for (const [id, handler] of Object.entries(DEV_PANEL_MANUAL_ACTIONS)) {
        const button = panel.querySelector<HTMLButtonElement>(`#${id}`);
        if (!button) throw new Error(`开发者面板缺少动作按钮 #${id}`);
        button.addEventListener("click", () => handler(deps));
    }
}

function createDevSettingsPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.id = "bilibili-dev-settings";
    const devLocked = !state.devModeEnabled;
    panel.innerHTML = `
      ${renderPanelHeader("开发者设置", `<div class="baq-dev-warning-pill">错误配置可能影响脚本正常工作</div>`)}
      ${renderToggleRow({ rowId: "dev-mode-container", inputId: "dev-mode", label: "开发者模式", description: "启用后可以使用以下开发者选项", checked: state.devModeEnabled })}
      <div class="baq-columns baq-even">
        <div class="baq-col">
          <div class="baq-section-title">模拟状态</div>
          <div class="baq-vip-status-section">
            <div class="baq-vip-status-title" id="dev-vip-status-title">模拟会员状态</div>
            <div class="baq-vip-status-description" id="dev-vip-status-desc">模拟脚本所识别到的大会员状态，<b>并非破解</b></div>
            ${renderStatusTabs({ disabled: devLocked, active: state.devModeVipStatus, options: ["默认", "普通", "会员"], labelledBy: "dev-vip-status-title", describedBy: "dev-vip-status-desc" })}
          </div>
          ${renderToggleRow({ inputId: "dev-no-login", label: "未登录模式", description: "不等待头像加载，最高画质 1080P", checked: state.devModeNoLoginStatus, disabled: devLocked, slider: "baq-c-red" })}
          ${renderToggleRow({ inputId: "dev-allow-freevip", label: "非会员允许限免画质", description: "默认关闭，避免可能出现的会员推广", checked: state.devAllowFreeVipQualities, disabled: devLocked, slider: "baq-c-red" })}
          <div class="baq-group-last">
            <div class="baq-section-title">音质切换</div>
            ${renderStepperGroup({ disabled: devLocked, inputId: "dev-audio-delay", label: "初始延迟", description: "重试等待的基数", value: state.devModeAudioDelay, min: 500, max: 10000, step: 100, unit: "毫秒" })}
            ${renderStepperGroup({ disabled: devLocked, inputId: "dev-audio-retries", label: "重试次数", description: "失败后的重试次数", value: state.devModeAudioRetries, min: 0, max: 5, step: 1, unit: "次" })}
          </div>
        </div>
        <div class="baq-col">
          <div class="baq-section-title">画质验证</div>
          ${renderToggleRow({ inputId: "quality-double-check", label: "视频画质二次验证", description: "切换后延时复核，不符则重切", checked: state.qualityDoubleCheck, disabled: devLocked })}
          ${renderToggleRow({ inputId: "live-quality-double-check", label: "直播画质二次验证", description: "直播画质切换后的延时复核", checked: state.liveQualityDoubleCheck, disabled: devLocked })}
          ${renderStepperGroup({ disabled: devLocked, inputId: "dev-double-check-delay", label: "验证等待时间", description: "验证前等待时长", value: state.devDoubleCheckDelay, min: 1000, max: 20000, step: 100, unit: "毫秒" })}
          <div class="baq-group-last">
            <div class="baq-section-title">播放器行为</div>
            ${renderToggleRow({ inputId: "preserve-touch-points", label: "保留触控点", description: "不修改 maxTouchPoints，保持设备原值", checked: state.preserveTouchPoints, slider: "baq-c-amber" })}
            ${renderToggleRow({ inputId: "disable-hdr", label: "禁用 HDR 和杜比视界", description: "选择两者以外的最高画质", checked: state.disableHDROption, disabled: devLocked, slider: "baq-c-amber" })}
            ${renderToggleRow({ inputId: "remove-quality-button", label: "移除清晰度按钮", description: "隐藏播放器原生清晰度按钮", checked: state.takeOverQualityControl, disabled: devLocked, slider: "baq-c-amber" })}
          </div>
        </div>
      </div>
      ${renderActionRow({
          title: "数据管理",
          note: "备份与维护，不需要开启开发者模式",
          actions: DEV_PANEL_ACTIONS,
      })}
      <button class="baq-action-button baq-action-primary" id="dev-confirm-reload">确认并刷新页面</button>
    `;
    document.body.appendChild(panel);
    setupPanelA11y(panel);
    setupSteppers(panel);
    bindDevPanelActions(panel);
    bindSettingCheckbox(panel, "dev-mode", "devModeEnabled", { after: () => {
        setDevPanelEnabled(panel, state.devModeEnabled);
        hideQualityButton();
    } });
    bindSettingCheckbox(panel, "quality-double-check", "qualityDoubleCheck");
    bindSettingCheckbox(panel, "live-quality-double-check", "liveQualityDoubleCheck");
    // 会员状态按钮点击事件
    const vipStatusTabs = panel.querySelector('.baq-vip-status-tabs') as HTMLElement | null;
    if (vipStatusTabs) {
        setupStatusTabs(panel, vipStatusTabs, () => state.devModeEnabled, (status: string) => {
            setSetting("devModeVipStatus", status);
            syncStatusTabs(vipStatusTabs, status);
            console.log(`[开发者模式] 会员状态设置为: ${status}`);
        });
    }
    bindSettingCheckbox(panel, "dev-no-login", "devModeNoLoginStatus");
    bindSettingCheckbox(panel, "dev-allow-freevip", "devAllowFreeVipQualities");
    bindSettingCheckbox(panel, "preserve-touch-points", "preserveTouchPoints");
    bindSettingCheckbox(panel, "disable-hdr", "disableHDROption");
    bindSettingCheckbox(panel, "remove-quality-button", "takeOverQualityControl", { after: hideQualityButton });
    ([["#dev-double-check-delay", "devDoubleCheckDelay"],
     ["#dev-audio-delay", "devModeAudioDelay"],
     ["#dev-audio-retries", "devModeAudioRetries"]] as [string, string][]).forEach(([sel, name]) => {
        const input = panel.querySelector(sel)!;
        input.addEventListener('change', function (e: Event) {
            const target = e.target as HTMLInputElement;
            const value = normalizeSetting(name, parseInt(target.value, 10));
            target.value = value as string;
            setSetting(name, value);
        });
    });
    panel.querySelector('#dev-confirm-reload')!.addEventListener('click', function () {
        location.reload();
    });
    return panel;
}
function togglePanel(panelId: string, createPanelFunc: () => void, updateFunc?: (panel: HTMLElement) => void): void {
    let panel = document.getElementById(panelId) as BaqPanelElement | null;
    if (!panel) {
        createPanelFunc();
        panel = document.getElementById(panelId) as BaqPanelElement | null;
    }
    // 打开时按需挂载到当前全屏根，避免全屏下不可见
    mountPanelToRenderRoot(panel);
    // 退出动画播放中（.hiding）视为已关闭：此时再点开关是想重新打开
    if (!panel!.classList.contains("baq-show") || panel!.classList.contains("baq-hiding")) {
        PANEL_IDS.forEach(id => {
            if (id !== panelId) {
                hidePanel(document.getElementById(id) as BaqPanelElement | null);
            }
        });
        showPanel(panel!);
    } else {
        hidePanel(panel!);
    }
    if (updateFunc) updateFunc(panel!);
}
export function toggleSettingsPanel(): void {
    togglePanel("bilibili-quality-selector", createSettingsPanel, updateQualityButtons);
}
export function toggleLiveSettingsPanel(): void {
    togglePanel("bilibili-live-quality-selector", createLiveSettingsPanel, updateLiveSettingsPanel);
}
export function toggleDevSettingsPanel(): void {
    togglePanel("bilibili-dev-settings", createDevSettingsPanel, function (panel: HTMLElement) {
        syncCheckbox(panel, "remove-quality-button", state.takeOverQualityControl);
        // 更新会员状态UI
        const vipStatusTabs = panel.querySelector('.baq-vip-status-tabs') as HTMLElement | null;
        if (vipStatusTabs) syncStatusTabs(vipStatusTabs, state.devModeVipStatus);
    });
}
export function toggleUnlockSettingsPanel(): void {
    togglePanel("bilibili-unlock-settings", createUnlockSettingsPanel);
}

