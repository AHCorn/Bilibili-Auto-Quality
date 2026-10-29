import { SETTINGS, state, normalizeSetting, briefValue, type AppState } from "./settings";
import { normalizeCustomOrder } from "./quality-vocab";
import { applyVisibilityHijack } from "./visibility";
import { restartAdaptiveQuality } from "./adaptive";
import { ensureQualitySettingsButton, hideQualityButton } from "./controls-button";
import { applyAutoWidescreen } from "./features";
import { startLivePolling, stopLivePolling, startLiveKeepAlive, stopLiveKeepAlive, updateLiveSettingsPanel } from "./live";
import { updateQualityButtons, updateDecodeButtons, setDevPanelEnabled, syncStatusTabs, isInputBusy } from "./panels";
import { PANEL_IDS, applyPanelThemeNow } from "./panel-chrome";

export function installSettingsSync(): void {
const REMOTE_SYNC_INPUT_IDS: Record<string, string> = {
    injectQualityButton: "inject-quality-button",
    devModeNoLoginStatus: "dev-no-login",
        devAllowFreeVipQualities: "dev-allow-freevip",
        qualityDoubleCheck: "quality-double-check",
        liveQualityDoubleCheck: "live-quality-double-check",
        preserveTouchPoints: "preserve-touch-points",
        disableHDROption: "disable-hdr",
        takeOverQualityControl: "remove-quality-button",
        unlockUA: "unlock-ua",
        unlockHDR: "unlock-hdr",
        unlockMarker: "unlock-marker",
        devModeAudioDelay: "dev-audio-delay",
        devModeAudioRetries: "dev-audio-retries",
        devDoubleCheckDelay: "dev-double-check-delay",
    };
    function findPanelInput(inputId: string): HTMLInputElement | null {
        for (const panelId of PANEL_IDS) {
            const panel = document.getElementById(panelId);
            const input = panel ? panel.querySelector<HTMLInputElement>("#" + inputId) : null;
            if (input) return input;
        }
        return null;
    }
    function applyRemoteSettingChange(names: Set<string>) {
        const has = (name: string) => names.has(name);
        if (has("preventBackgroundDegrade")) applyVisibilityHijack(state.preventBackgroundDegrade);
        if (has("adaptiveQualityEnabled") || has("adaptiveQualitySensitivity")) restartAdaptiveQuality();
        if (has("injectQualityButton")) ensureQualitySettingsButton(state.injectQualityButton);
        if (has("takeOverQualityControl") || has("devModeEnabled")) hideQualityButton();
        if (has("autoWidescreen")) applyAutoWidescreen();
        if (has("panelThemeOverride")) applyPanelThemeNow();
        if (state.isLivePage) {
            if (has("liveQualityPollingEnabled") || has("livePollingInterval")) {
                if (state.liveQualityPollingEnabled) startLivePolling();
                else stopLivePolling();
            }
            if (has("liveKeepAliveEnabled") || has("liveKeepAliveInterval")) {
                if (state.liveKeepAliveEnabled) startLiveKeepAlive();
                else stopLiveKeepAlive();
            }
        }
    }
    function syncPanelsAfterRemoteChange(names: Set<string>) {
        const qualityPanel = document.getElementById("bilibili-quality-selector") as BaqPanelElement | null;
        if (qualityPanel) {
            // 网格结构随这两项整体重建；本页拖拽进行中不打断，以本页随后的提交为准
            if ((names.has("customSortEnabled") || names.has("customQualityOrder"))
                && typeof qualityPanel.renderGrid === "function"
                && !qualityPanel.querySelector(".baq-cq-dragging")) {
                qualityPanel.renderGrid();
            }
            updateQualityButtons(qualityPanel);
        }
        updateLiveSettingsPanel();
        const decodePanel = document.getElementById("bilibili-decode-settings");
        if (decodePanel) updateDecodeButtons(decodePanel);
        const devPanel = document.getElementById("bilibili-dev-settings");
        if (devPanel && names.has("devModeEnabled")) {
            const devSwitch = devPanel.querySelector("#dev-mode") as HTMLInputElement | null;
            if (devSwitch) devSwitch.checked = state.devModeEnabled;
            setDevPanelEnabled(devPanel, state.devModeEnabled);
        }
        if (devPanel && names.has("devModeVipStatus")) {
            const tabs = devPanel.querySelector(".baq-vip-status-tabs");
            if (tabs) syncStatusTabs(tabs as HTMLElement, state.devModeVipStatus);
        }
        names.forEach(name => {
            const inputId = REMOTE_SYNC_INPUT_IDS[name];
            if (!inputId) return;
            const input = findPanelInput(inputId);
            if (input && (input.type === "checkbox" || !isInputBusy(input))) {
                if (input.type === "checkbox") input.checked = !!state[name as keyof typeof state];
                else input.value = state[name as keyof typeof state] as string;
            }
        });
    }
    const REMOTE_FLUSH_WINDOW_MS = 50;
    let pendingRemoteNames: Set<string> | null = null;
    let pendingFlushTimer: ReturnType<typeof setTimeout> | null = null;
    function queueRemoteFlush(name: string) {
        if (!pendingRemoteNames) pendingRemoteNames = new Set<string>();
        pendingRemoteNames.add(name);
        if (pendingFlushTimer !== null) return;
        pendingFlushTimer = setTimeout(() => {
            pendingFlushTimer = null;
            const batch = pendingRemoteNames || new Set<string>();
            pendingRemoteNames = null;
            try {
                applyRemoteSettingChange(batch);
                syncPanelsAfterRemoteChange(batch);
            } catch (e) {
                console.error("[设置同步] 应用其他标签页的变更时出错:", e);
            }
        }, REMOTE_FLUSH_WINDOW_MS);
    }
    if (typeof GM_addValueChangeListener === "function") {
        const addValueChangeListener = GM_addValueChangeListener;
        (Object.keys(SETTINGS) as Array<keyof typeof SETTINGS>).forEach(name => {
            addValueChangeListener(SETTINGS[name].key, (_key, _oldValue, newValue, remote) => {
                // remote=false 是本页自己的写入，state 已就位
                if (!remote) return;
                if (name === "customQualityOrder") {
                    let raw = newValue;
                    if (typeof raw === "string") {
                        try {
                            raw = JSON.parse(raw);
                        } catch (e) {
                            console.warn(`[设置] 其他标签页写入的自定义画质顺序不是合法 JSON（${briefValue(raw)}），已回退为默认顺序:`, e);
                            raw = null;
                        }
                    }
                    state.customQualityOrder = normalizeCustomOrder(raw);
                } else {
                    (state as AppState & Record<string, unknown>)[name] = normalizeSetting(name, newValue);
                }
                console.log(`[设置同步] 其他标签页更新 ${name}:`, state[name as keyof typeof state]);
                queueRemoteFlush(name);
            });
        });
    }
}
