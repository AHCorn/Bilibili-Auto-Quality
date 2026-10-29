import { setSetting, state, debugTransient } from "./settings";
import { setEntryExpanded } from "./controls-button";

export const PANEL_IDS = [
    "bilibili-quality-selector",
    "bilibili-live-quality-selector",
    "bilibili-dev-settings",
    "bilibili-unlock-settings",
    "bilibili-decode-settings"
];
const ENTRY_PANEL_ID = PANEL_IDS[0];

interface FullscreenDocument extends Document {
    webkitFullscreenElement?: Element | null;
}
function fullscreenRoot(): Element | null {
    const fsDoc = document as FullscreenDocument;
    return document.fullscreenElement || fsDoc.webkitFullscreenElement || null;
}
export function mountPanelToRenderRoot(panel: BaqPanelElement | null): void {
    if (!panel) return;
    const root = fullscreenRoot() || document.body;
    if (panel.parentElement === root) return;
    const keepFocus = panel.contains(document.activeElement);
    root.appendChild(panel);
    if (keepFocus) {
        try { panel.focus({ preventScroll: true }); } catch (e) { debugTransient(e); }
    }
}

function bgIsDark(el: Element | null): boolean | null {
    if (!el) return null;
    const bg = getComputedStyle(el).backgroundColor;
    const m = bg && bg.match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) return null;
    const a = m.length >= 4 ? parseFloat(m[3]) : 1;
    if (!(a > 0.5)) return null;
    const lum = 0.2126 * Number(m[0]) + 0.7152 * Number(m[1]) + 0.0722 * Number(m[2]);
    if (lum < 100) return true;
    if (lum > 160) return false;
    return null;
}
function isPageDark() {
    try {
        const fromBody = bgIsDark(document.body);
        if (fromBody !== null) return fromBody;
        const fromRoot = bgIsDark(document.documentElement);
        if (fromRoot !== null) return fromRoot;
    } catch (e) { debugTransient(e); /* 判定失败走系统偏好 */ }
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}
const panelOutsideHandlers = new WeakMap();
const outsideBoundPanels = new Set<BaqPanelElement>();
function bindOutsideClose(panel: BaqPanelElement) {
    unbindOutsideClose(panel);
    // 起点在面板里就不关，避免拖拽合成的外部 mousedown 误关
    let pressStartedInside = false;
    function panelDetached() {
        if (panel.isConnected) return false;
        unbindOutsideClose(panel);
        return true;
    }
    function onPointerDown(event: PointerEvent) {
        if (panelDetached()) return;
        pressStartedInside = !!(panel && panel.contains(event.target as Node));
    }
    function onMouseDown(event: MouseEvent) {
        if (panelDetached()) return;
        if (pressStartedInside) return;
        // 控制栏入口自己负责开关切换：外点关闭让行，否则会"先关再开"永远合不上
        if (event.target && (event.target as Element).closest && (event.target as Element).closest(".baq-panel-entry")) return;
        if (panel && !panel.contains(event.target as Node)) {
            hidePanel(panel);
        }
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("mousedown", onMouseDown, true);
    panelOutsideHandlers.set(panel, { onPointerDown, onMouseDown });
    outsideBoundPanels.add(panel);
}
function unbindOutsideClose(panel: BaqPanelElement) {
    outsideBoundPanels.delete(panel);
    const handlers = panelOutsideHandlers.get(panel);
    if (!handlers) return;
    document.removeEventListener("pointerdown", handlers.onPointerDown, true);
    document.removeEventListener("mousedown", handlers.onMouseDown, true);
    panelOutsideHandlers.delete(panel);
}
export function sweepDetachedPanels(): void {
    outsideBoundPanels.forEach(panel => {
        if (!panel.isConnected) unbindOutsideClose(panel);
    });
}
const panelReturnFocus = new WeakMap<Element, HTMLElement>();
function canFocus(el: Element | null): el is HTMLElement {
    return !!el && typeof (el as HTMLElement).focus === "function";
}
function rememberTrigger(panel: BaqPanelElement) {
    const active = document.activeElement;
    if (active && panel.contains(active)) return;
    if (canFocus(active) && active !== document.body && active !== document.documentElement) panelReturnFocus.set(panel, active);
    else panelReturnFocus.delete(panel);
}
function restoreTrigger(panel: BaqPanelElement) {
    const target = panelReturnFocus.get(panel);
    panelReturnFocus.delete(panel);
    if (!target) return;
    if (!panel.contains(document.activeElement)) return;
    if (!target.isConnected) return;
    try { target.focus({ preventScroll: true }); } catch (e) { debugTransient(e); }
}
export function showPanel(panel: BaqPanelElement | null) {
    if (!panel) return;
    if (!panel.hasAttribute("role")) {
        panel.setAttribute("role", "dialog");
        const title = panel.querySelector(".baq-header h2");
        if (title && title.textContent) panel.setAttribute("aria-label", title.textContent);
    }
    if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
    if (panel._hideTimer) {
        clearTimeout(panel._hideTimer);
        panel._hideTimer = null;
    }
    panel.classList.toggle("baq-dark", effectiveDark());
    panel.classList.remove("baq-hiding");
    panel.classList.add("baq-show");
    bindOutsideClose(panel);
    if (panel.id === ENTRY_PANEL_ID) setEntryExpanded(true);
    rememberTrigger(panel);
    try { panel.focus({ preventScroll: true }); } catch (e) { debugTransient(e); }
}
export function hidePanel(panel: BaqPanelElement | null) {
    if (!panel) return;
    unbindOutsideClose(panel);
    if (!panel.classList.contains("baq-show") || panel.classList.contains("baq-hiding")) return;
    if (panel.id === ENTRY_PANEL_ID) setEntryExpanded(false);
    restoreTrigger(panel);
    panel.classList.add("baq-hiding");
    panel._hideTimer = setTimeout(() => {
        panel.classList.remove("baq-show", "baq-hiding");
        panel._hideTimer = null;
    }, 160);
}
function closeAllPanels() {
    PANEL_IDS.forEach(id => {
        hidePanel(document.getElementById(id) as BaqPanelElement | null);
    });
}
function closeAllPanelsUnlessDragging(): boolean {
    if (document.querySelector(".baq-cq-dragging")) return false;
    closeAllPanels();
    return true;
}
function remountShownPanels(): void {
    PANEL_IDS.forEach(id => {
        const panel = document.getElementById(id) as BaqPanelElement | null;
        if (panel && panel.classList.contains("baq-show")) mountPanelToRenderRoot(panel);
    });
}
['fullscreenchange','webkitfullscreenchange'].forEach(e => document.addEventListener(e, () => {
    if (!closeAllPanelsUnlessDragging()) remountShownPanels();
    applyPanelThemeNow();
}));
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeAllPanelsUnlessDragging();
});
export function applyPanelThemeNow() {
    const dark = effectiveDark();
    PANEL_IDS.forEach(id => {
        const panel = document.getElementById(id);
        if (panel) panel.classList.toggle("baq-dark", dark);
    });
    syncThemeToggles();
}
const GITHUB_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>`;
export function renderGithubLink() {
    return `<a href="https://github.com/AHCorn/Bilibili-Auto-Quality/" target="_blank" rel="noopener noreferrer" class="baq-github-link" aria-label="项目主页（GitHub，新标签页打开）">${GITHUB_SVG}</a>`;
}
// 面板在"跟随"态下会显示的明暗：把手动覆盖摘掉之后的结果
function followDark(): boolean {
    if (fullscreenRoot()) return true;
    return isPageDark();
}
// 当前应显示的主题：手动切换过则用覆盖值，否则跟随页面
export function effectiveDark() {
    if (state.panelThemeOverride === "dark") return true;
    if (state.panelThemeOverride === "light") return false;
    return followDark();
}
function nextThemeOverride(): string {
    const followValue = followDark() ? "dark" : "light";
    const current = state.panelThemeOverride;
    if (current !== "light" && current !== "dark") return followValue === "dark" ? "light" : "dark";
    return current === followValue ? "" : followValue;
}
const THEME_MODE_LABELS: Record<string, string> = {
    "": "跟随页面",
    light: "亮色",
    dark: "深色",
};
function themeToggleMode(): string {
    return state.panelThemeOverride === "light" || state.panelThemeOverride === "dark" ? state.panelThemeOverride : "";
}
function themeToggleLabel(mode: string): string {
    return `面板主题：${THEME_MODE_LABELS[mode] || THEME_MODE_LABELS[""]}（点击切换）`;
}
function syncThemeToggles(): void {
    const mode = themeToggleMode();
    const label = themeToggleLabel(mode);
    document.querySelectorAll(".baq-theme-toggle").forEach(el => {
        el.setAttribute("data-theme-mode", mode || "auto");
        el.setAttribute("aria-label", label);
        el.setAttribute("title", label);
    });
}
let themeToggleSeq = 0;
export function renderThemeToggle() {
    const maskId = `baq-tm-mask-${++themeToggleSeq}`;
    const mode = themeToggleMode();
    const label = themeToggleLabel(mode);
    return `<span class="baq-theme-toggle" role="button" tabindex="0" data-theme-mode="${mode || "auto"}" aria-label="${label}" title="${label}">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
        <mask id="${maskId}">
          <rect x="0" y="0" width="24" height="24" fill="white"></rect>
          <circle class="baq-tm-hole" cx="17" cy="7" r="8.2" fill="black"></circle>
        </mask>
        <circle class="baq-tm-core" cx="12" cy="12" r="8.6" mask="url(#${maskId})"></circle>
        <g class="baq-tm-rays" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none">
          <line x1="12" y1="4.2" x2="12" y2="2"></line>
          <line x1="12" y1="19.8" x2="12" y2="22"></line>
          <line x1="18.76" y1="8.1" x2="20.66" y2="7"></line>
          <line x1="5.24" y1="8.1" x2="3.34" y2="7"></line>
          <line x1="18.76" y1="15.9" x2="20.66" y2="17"></line>
          <line x1="5.24" y1="15.9" x2="3.34" y2="17"></line>
        </g>
      </svg>
    </span>`;
}
function togglePanelTheme() {
    setSetting("panelThemeOverride", nextThemeOverride());
    const dark = effectiveDark();
    syncThemeToggles();
    PANEL_IDS.forEach(id => {
        const panel = document.getElementById(id) as BaqPanelElement | null;
        if (!panel) return;
        // 临时给全体子元素挂颜色过渡，亮暗渐变切换而非瞬变
        panel.classList.add("baq-theme-anim");
        panel.classList.toggle("baq-dark", dark);
        if (panel._themeAnimTimer) clearTimeout(panel._themeAnimTimer);
        panel._themeAnimTimer = setTimeout(() => {
            panel.classList.remove("baq-theme-anim");
            panel._themeAnimTimer = null;
        }, 420);
    });
}
document.addEventListener("click", (e) => {
    const btn = e.target && (e.target as Element).closest && (e.target as Element).closest(".baq-theme-toggle");
    if (btn) togglePanelTheme();
});
document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target && (e.target as Element).classList && (e.target as Element).classList.contains("baq-theme-toggle")) {
        e.preventDefault();
        e.stopPropagation();
        togglePanelTheme();
    }
});
