import { BILI } from "./contract";
import { state } from "./settings";
import { toggleSettingsPanel } from "./panels";

type DomSelectorKey = "qualityControl" | "qualityButton" | "playerControls";

const QUALITY_CONTROL_SELECTOR = BILI.video.qualityCtrl + ":not(.baq-injected)";

let entryExpanded = false;
export function setEntryExpanded(expanded: boolean): void {
    entryExpanded = expanded;
    document.querySelectorAll('.baq-panel-entry').forEach(el => el.setAttribute('aria-expanded', expanded ? 'true' : 'false'));
}

// 注入设置按钮相关操作
export function ensureQualitySettingsButton(shouldInject: boolean, resolvedControl?: Element) {
    if (!shouldInject) {
        document.querySelectorAll('.baq-injected').forEach(el => el.remove());
        return;
    }
    const qualityControl = resolvedControl || document.querySelector(QUALITY_CONTROL_SELECTOR);
    if (!qualityControl) return;
    const parent = qualityControl.parentElement;
    if (!parent) return;

    const existing = parent.querySelector('.baq-injected');
    if (!existing) {
        const settingsButton = document.createElement('div');
        settingsButton.className = `${BILI.video.ctrlBtnClass} baq-injected baq-panel-entry`;
        settingsButton.setAttribute('role', 'button');
        settingsButton.setAttribute('tabindex', '0');
        settingsButton.setAttribute('aria-label', '画质设置');
        settingsButton.setAttribute('aria-haspopup', 'dialog');
        settingsButton.setAttribute('aria-expanded', entryExpanded ? 'true' : 'false');
        settingsButton.innerHTML = `<div class="${BILI.video.ctrlBtnIconClass}"><span class="${BILI.video.commonSvgIconClass}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="4" y1="6" x2="20" y2="6"></line><circle cx="14" cy="6" r="2.4" fill="currentColor" stroke="none"></circle><line x1="4" y1="12" x2="20" y2="12"></line><circle cx="8" cy="12" r="2.4" fill="currentColor" stroke="none"></circle><line x1="4" y1="18" x2="20" y2="18"></line><circle cx="17" cy="18" r="2.4" fill="currentColor" stroke="none"></circle></svg></span></div>`;
        settingsButton.addEventListener('click', toggleSettingsPanel);
        settingsButton.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                toggleSettingsPanel();
            }
        });
        parent.insertBefore(settingsButton, qualityControl);
    }
}

export const DOM: {
    selectors: Record<DomSelectorKey, string>;
    query(key: DomSelectorKey): HTMLElement | null;
} = {
    selectors: {
        qualityControl: QUALITY_CONTROL_SELECTOR,
        qualityButton: BILI.video.qualityCtrlButton + ":not(.baq-injected)",
        playerControls: BILI.video.controlWrap
    },
    query(key: DomSelectorKey) {
        return document.querySelector<HTMLElement>(this.selectors[key]);
    }
};
export function hideQualityButton() {
    const qualityControl = DOM.query('qualityButton');
    if (!qualityControl) return;
    const shouldHide = state.devModeEnabled && state.takeOverQualityControl && !qualityControl.classList.contains('baq-injected');
    qualityControl.classList.toggle('baq-quality-button-hidden', shouldHide);
}
let playerControlsObserver: MutationObserver | null = null;
let playerControlsObservedTarget: Node | null = null;
const PLAYER_CONTROLS_CHECK_COALESCE_MS = 150;
let playerControlsCheckTimer: ReturnType<typeof setTimeout> | null = null;
function retargetPlayerControlsObserver(): void {
    const observer = playerControlsObserver;
    if (!observer) return;
    const controls = DOM.query('playerControls');
    const playerRoot = document.getElementById(BILI.video.playerRoot);
    const target = controls || playerRoot || document.body;
    if (target === playerControlsObservedTarget) return;
    observer.disconnect();
    playerControlsObservedTarget = target;
    if (!controls) {
        observer.observe(target, { childList: true, subtree: true });
        return;
    }
    observer.observe(controls, { childList: true, subtree: true });
    if (controls.parentElement) observer.observe(controls.parentElement, { childList: true });
    if (playerRoot) observer.observe(playerRoot, { childList: true });
}
function runPlayerControlsCheck() {
    playerControlsCheckTimer = null;
    const qualityControl = DOM.query('qualityControl');
    if (qualityControl) {
        hideQualityButton();
        ensureQualitySettingsButton(state.injectQualityButton, qualityControl);
    }
    retargetPlayerControlsObserver();
}
export function ensurePlayerControlsBinding() {
    if (!playerControlsObserver) {
        playerControlsObserver = new MutationObserver(function () {
            if (playerControlsCheckTimer !== null) return;
            playerControlsCheckTimer = setTimeout(runPlayerControlsCheck, PLAYER_CONTROLS_CHECK_COALESCE_MS);
        });
    }
    retargetPlayerControlsObserver();
    hideQualityButton();
    ensureQualitySettingsButton(state.injectQualityButton);
}
export function releasePlayerControlsBinding() {
    if (playerControlsCheckTimer !== null) {
        clearTimeout(playerControlsCheckTimer);
        playerControlsCheckTimer = null;
    }
    if (playerControlsObserver) playerControlsObserver.disconnect();
    playerControlsObservedTarget = null;
}
