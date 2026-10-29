import { BILI } from "./contract";
import { state } from "./settings";

type WideOutcome = "clicked" | "already-wide" | "no-button" | "no-enter-icon";

let _wsObserver: MutationObserver | null = null;
let _wsTimeout: ReturnType<typeof setTimeout> | null = null;
let _wsRaf: number | null = null;
let _wsTick: ReturnType<typeof setTimeout> | null = null;
let _wsScope: Element | null = null;
let _wsLastOutcome: WideOutcome = "no-button";

function clickWide(): WideOutcome {
    const btn = document.querySelector(BILI.video.wideButton) as HTMLElement | null;
    if (!btn) return "no-button";
    const enter = btn.querySelector(BILI.video.wideEnterIcon);
    if (!enter) return "no-enter-icon";
    if (getComputedStyle(enter).display === "none") return "already-wide";
    btn.click();
    return "clicked";
}

function settleOutcome(outcome: WideOutcome): boolean {
    _wsLastOutcome = outcome;
    if (outcome === "clicked") {
        console.log("[自动宽屏] 已自动切换到宽屏模式");
        return true;
    }
    return outcome === "already-wide";
}

function clearPendingCheck(): void {
    if (_wsRaf !== null) { cancelAnimationFrame(_wsRaf); _wsRaf = null; }
    if (_wsTick !== null) { clearTimeout(_wsTick); _wsTick = null; }
}

function stopWatching(): void {
    if (_wsObserver) { _wsObserver.disconnect(); _wsObserver = null; }
    if (_wsTimeout) { clearTimeout(_wsTimeout); _wsTimeout = null; }
    clearPendingCheck();
    _wsScope = null;
}

function armObserver(): void {
    if (!_wsObserver) return;
    const scope = document.querySelector(BILI.video.controlWrap);
    _wsObserver.disconnect();
    _wsScope = scope;
    if (!scope) {
        _wsObserver.observe(document.getElementById(BILI.video.playerRoot) || document.body, { childList: true, subtree: true });
        return;
    }
    _wsObserver.observe(scope, { childList: true, subtree: true });
    if (scope.parentElement) _wsObserver.observe(scope.parentElement, { childList: true });
}

function runCheck(): void {
    if (!_wsObserver) return;
    if (settleOutcome(clickWide())) { stopWatching(); return; }
    if (document.querySelector(BILI.video.controlWrap) !== _wsScope) armObserver();
}

function scheduleCheck(): void {
    if (_wsRaf !== null || _wsTick !== null) return;
    _wsRaf = requestAnimationFrame(() => { _wsRaf = null; clearPendingCheck(); runCheck(); });
    _wsTick = setTimeout(() => { _wsTick = null; clearPendingCheck(); runCheck(); }, 250);
}

export function applyAutoWidescreen() {
    stopWatching();
    if (!state.autoWidescreen || state.isLivePage) return;
    if (settleOutcome(clickWide())) return;
    _wsObserver = new MutationObserver(scheduleCheck);
    armObserver();
    _wsTimeout = setTimeout(() => {
        const reason = _wsLastOutcome === "no-enter-icon"
            ? "未找到宽屏切换图标"
            : "未找到宽屏按钮";
        stopWatching();
        console.warn(`[自动宽屏] 等待 15 秒后放弃：${reason}`);
    }, 15000);
}
