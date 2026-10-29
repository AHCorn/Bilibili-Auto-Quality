import { BILI } from "./contract";
import { state, getDoubleCheckConfig, debugTransient, SETTINGS, type QualityFlowOutcome } from "./settings";
import { Utils } from "./utils";
import { cleanQuality } from "./quality-vocab";
import { parseQualityMenuItem, isQualityItemActive, findActiveQualityItem, readActiveQualityText, isQualityFilteredByDevMode, isQualityUsableForUser, qualityFailConsumedToasts, audioToggleGraceActive, QUALITY_FAIL_WATCH_WINDOW_MS } from "./video-quality";

type AdaptiveBoundPlayer = NonNullable<BiliWindow["player"]>;

interface AdaptiveSensitivityPreset {
    settleMs: number;
    hardStallMs: number;
    strikeMinMs: number;
    strikesToTrigger: number;
    strikeWindowMs: number;
    predictive: boolean;
    lowWaterS: number;
    drainRateS: number;
    cooldownMs: number;
    maxSteps: number;
}

interface AdaptiveSwitchingState {
    targetClean: string;
    targetQn: number | null;
    fromQn: number | null;
    stableTicks: number;
    divergedTicks: number;
    deadline: number;
}

interface AdaptiveLowerTarget {
    name: string;
    clean: string;
    qn: number | null;
    element: Element;
}

interface AdaptiveTargetRef {
    qn: number | null;
    clean: string;
}

interface AdaptiveBufferSample {
    t: number;
    ct: number;
    pt: number;
    ahead: number;
}

interface AdaptiveState {
    timerId: ReturnType<typeof setInterval> | null;
    flowDoneSeen: boolean;
    armedAt: number;
    observationHoldUntil: number;
    cooldownUntil: number;
    stepsUsed: number;
    failures: number;
    disabledForVideo: boolean;
    switching: AdaptiveSwitchingState | null;
    lastActiveClean: string;
    lastCt: number;
    stallStartAt: number;
    strikes: number[];
    bufferSamples: AdaptiveBufferSample[];
    lastSeekAt: number;
    lastTickAt: number;
    lastTickWallAt: number;
    retryAt: number;
    retryExpireAt: number;
    consumedToasts: WeakSet<Element> | null;
    failedQns: Set<number | string> | null;
    timeoutTarget: AdaptiveTargetRef | null;
    blindYieldKey: string;
    floorLogged: boolean;
    boundPlayer: AdaptiveBoundPlayer | null;
    playerLagHandler: (() => void) | null;
}

const ADAPTIVE_SENSITIVITY_PRESETS: Record<string, AdaptiveSensitivityPreset> = {
    "灵敏": { settleMs: 5000,  hardStallMs: 2000, strikeMinMs: 600,  strikesToTrigger: 2, strikeWindowMs: 60000, predictive: true,  lowWaterS: 6, drainRateS: 0.4, cooldownMs: 15000, maxSteps: 4 },
    "标准": { settleMs: 8000,  hardStallMs: 3000, strikeMinMs: 700,  strikesToTrigger: 3, strikeWindowMs: 60000, predictive: true,  lowWaterS: 4, drainRateS: 0.5, cooldownMs: 30000, maxSteps: 3 },
    "保守": { settleMs: 12000, hardStallMs: 5000, strikeMinMs: 1000, strikesToTrigger: 4, strikeWindowMs: 45000, predictive: false, lowWaterS: 3, drainRateS: 0.6, cooldownMs: 60000, maxSteps: 2 },
};
const ADAPTIVE_TOAST_PATTERN = BILI.toast.weakNetPattern;
export const ADAPTIVE_FAIL_TOAST_PATTERN = BILI.toast.switchFailPattern;
const ADAPTIVE_FAIL_RETRY_BACKOFF_MS = 4000;
const ADAPTIVE_TICK_MS = 500;
const ADAPTIVE_CONFIRM_TIMEOUT_MS = 30000;   // 弱网下切换实测可达 20 秒以上
const ADAPTIVE_MAX_FAILURES = 2;
const ADAPTIVE_SEEK_GRACE_MS = 2000;         // seek 后的缓冲属预期行为，不计入卡顿
const ADAPTIVE_TAIL_GUARD_S = 10;            // 临近片尾缓冲余量自然递减，且降档已无收益
const ADAPTIVE_RETRY_WINDOW_MS = 10000;      // 失败重试的有效窗：过窗仍未发起就放弃，等新信号
const ADAPTIVE_ARM_VERIFY_BUFFER_MS = 3000;
const ADAPTIVE_TICK_GAP_FACTOR = 4;

export const adaptive: AdaptiveState = {
    timerId: null,
    flowDoneSeen: false,
    armedAt: 0,
    observationHoldUntil: 0,
    cooldownUntil: 0,
    stepsUsed: 0,
    failures: 0,
    disabledForVideo: false,
    switching: null,
    lastActiveClean: "",
    lastCt: -1,
    stallStartAt: 0,
    strikes: [],
    bufferSamples: [],
    lastSeekAt: 0,
    lastTickAt: 0,
    lastTickWallAt: 0,
    retryAt: 0,
    retryExpireAt: 0,
    consumedToasts: null,
    failedQns: null,          // Set，本视频内切换失败过的档位（qn 与名称），后续降档跳过
    timeoutTarget: null,
    blindYieldKey: "",
    floorLogged: false,       // 本视频已触底（无更低档）的日志一次性标记
    boundPlayer: null,
    playerLagHandler: null,
};

function adaptiveConfig(): AdaptiveSensitivityPreset {
    return ADAPTIVE_SENSITIVITY_PRESETS[state.adaptiveQualitySensitivity] || ADAPTIVE_SENSITIVITY_PRESETS["标准"];
}

const adaptiveReportedFaults = new Set<string>();
function adaptiveFaultFirstSeen(channel: string, e: unknown): boolean {
    const key = channel + "|" + (e instanceof Error ? e.name + ": " + e.message : String(e));
    if (adaptiveReportedFaults.has(key)) return false;
    adaptiveReportedFaults.add(key);
    return true;
}
function adaptiveDebugOnce(e: unknown) {
    if (!state.devModeEnabled) return;
    if (adaptiveFaultFirstSeen("debug", e)) debugTransient(e);
}
function adaptiveWarnOnce(message: string, e: unknown) {
    if (adaptiveFaultFirstSeen("warn", e)) console.warn(message, e);
}

function adaptiveDeadlinePending(now: number, deadline: number, maxSpanMs: number): boolean {
    return deadline > now && deadline - now <= maxSpanMs;
}

function adaptiveRetryChainMaxMs(): number {
    return ADAPTIVE_FAIL_RETRY_BACKOFF_MS + ADAPTIVE_RETRY_WINDOW_MS + QUALITY_FAIL_WATCH_WINDOW_MS;
}

function adaptiveArmMaxSpanMs(): number {
    const presetMax = Math.max(...Object.values(ADAPTIVE_SENSITIVITY_PRESETS).map(p => p.settleMs));
    const verifyMax = SETTINGS.devDoubleCheckDelay.max;
    return Math.max(presetMax, (typeof verifyMax === "number" ? verifyMax : 0) + ADAPTIVE_ARM_VERIFY_BUFFER_MS);
}
function adaptiveArmPending(now: number): boolean {
    return adaptiveDeadlinePending(now, adaptive.armedAt, adaptiveArmMaxSpanMs());
}

export function adaptiveReadActiveClean() {
    return cleanQuality(readActiveQualityText());
}

export function adaptiveHoldObservation(untilMs: number) {
    const now = Date.now();
    const previous = adaptive.observationHoldUntil;
    adaptive.observationHoldUntil = Math.min(Math.max(previous, untilMs), now + QUALITY_FAIL_WATCH_WINDOW_MS);
    const heldFor = adaptive.observationHoldUntil - Math.max(now, previous);
    if (adaptive.retryExpireAt && heldFor > 0) adaptive.retryExpireAt += heldFor;
}

// 清空信号累计，不动冷却/次数等会话级状态
function adaptiveResetSignals() {
    adaptive.stallStartAt = 0;
    adaptive.strikes = [];
    adaptive.bufferSamples = [];
}

function resetAdaptiveSession() {
    adaptive.flowDoneSeen = false;
    adaptive.armedAt = 0;
    adaptive.cooldownUntil = 0;
    adaptive.retryAt = 0;
    adaptive.retryExpireAt = 0;
    adaptive.stepsUsed = 0;
    adaptive.failures = 0;
    adaptive.disabledForVideo = false;
    adaptive.switching = null;
    adaptive.lastActiveClean = "";
    adaptive.lastCt = -1;
    adaptive.lastSeekAt = 0;
    adaptive.lastTickAt = 0;
    adaptive.lastTickWallAt = 0;
    adaptive.consumedToasts = new WeakSet();
    adaptive.failedQns = new Set();
    adaptive.timeoutTarget = null;
    adaptive.blindYieldKey = "";
    adaptive.floorLogged = false;
    adaptiveResetSignals();
}

export function startAdaptiveQuality() {
    if (adaptive.timerId !== null) return;
    if (state.isLivePage || !state.adaptiveQualityEnabled) return;
    resetAdaptiveSession();
    adaptive.timerId = setInterval(adaptiveTick, ADAPTIVE_TICK_MS);
    console.log(`[智能降画质] 已启动，灵敏度: ${state.adaptiveQualitySensitivity}`);
}

export function stopAdaptiveQuality() {
    if (adaptive.timerId !== null) {
        clearInterval(adaptive.timerId);
        adaptive.timerId = null;
        console.log("[智能降画质] 已停止");
    }
    if (adaptive.boundPlayer && adaptive.playerLagHandler) {
        try { adaptive.boundPlayer.off!(BILI.facade.playbackLagEvent, adaptive.playerLagHandler); } catch (e) { adaptiveDebugOnce(e); }
    }
    adaptive.boundPlayer = null;
    adaptive.playerLagHandler = null;
    resetAdaptiveSession();
}

// URL 变更或设置变更后重置会话（降档次数、冷却按视频计）
export function restartAdaptiveQuality() {
    stopAdaptiveQuality();
    startAdaptiveQuality();
}

function adaptiveEnsurePlayerBinding() {
    let player: AdaptiveBoundPlayer | null | undefined;
    try { player = unsafeWindow.player; } catch (e) { adaptiveDebugOnce(e); return; }
    if (!player || typeof player.on !== "function" || typeof player.off !== "function" || adaptive.boundPlayer === player) return;
    if (adaptive.boundPlayer && adaptive.playerLagHandler) {
        try { adaptive.boundPlayer.off!(BILI.facade.playbackLagEvent, adaptive.playerLagHandler); } catch (e) { adaptiveDebugOnce(e); }
    }
    const handler = () => { adaptiveTryDowngrade("播放器上报卡顿"); };
    try {
        player.on(BILI.facade.playbackLagEvent, handler);
        adaptive.boundPlayer = player;
        adaptive.playerLagHandler = handler;
        console.log("[智能降画质] 已订阅播放器卡顿事件");
    } catch (e) {
        adaptiveWarnOnce("[智能降画质] 订阅播放器卡顿事件失败，该路信号本页不可用:", e);
    }
}

function adaptivePickNextLower(): AdaptiveLowerTarget | null {
    const qualityMenu = document.querySelector(BILI.video.qualityMenu);
    if (!qualityMenu) return null;
    const items = Array.from(qualityMenu.querySelectorAll(BILI.video.qualityMenuItem));
    const activeIndex = items.findIndex(isQualityItemActive);
    if (activeIndex === -1) return null;
    if (parseQualityMenuItem(items[activeIndex]).textName.includes(BILI.video.autoQualityKeyword)) return null;
    const skipTimedOut = adaptive.retryAt ? adaptive.timeoutTarget : null;
    for (let i = activeIndex + 1; i < items.length; i++) {
        const q = parseQualityMenuItem(items[i]);
        const name = q.textName;
        if (name.includes(BILI.video.autoQualityKeyword)) continue;
        if (isQualityFilteredByDevMode(q.name)) continue;
        if (isQualityUsableForUser(q)) {
            const qnRaw = parseInt(items[i].getAttribute(BILI.video.qnAttr) || "", 10);
            const qn = Number.isFinite(qnRaw) && qnRaw > 0 ? qnRaw : null;
            const clean = cleanQuality(name);
            // 本视频内切换失败过的档位不再尝试，继续找更低档
            if (adaptive.failedQns && ((qn && adaptive.failedQns.has(qn)) || adaptive.failedQns.has(clean))) continue;
            if (skipTimedOut && ((qn !== null && qn === skipTimedOut.qn) || (clean !== "" && clean === skipTimedOut.clean))) continue;
            return { name: name, clean: clean, qn: qn, element: items[i] };
        }
    }
    return null;
}

function adaptiveFeedbackToast(qualityName: string) {
    try {
        const player = unsafeWindow.player;
        if (player && player.toast && typeof player.toast.create === "function") {
            player.toast.create({ text: `网络波动，已自动降至 ${qualityName}`, duration: 5000 });
        }
    } catch (e) { adaptiveDebugOnce(e); }
}

function adaptiveDismissBiliToast() {
    try {
        Utils.queryAll(BILI.video.toastItem).forEach(item => {
            const textEl = item.querySelector(BILI.video.toastText);
            if (textEl && ADAPTIVE_TOAST_PATTERN.test(textEl.textContent || "")) {
                const cancel = item.querySelector(BILI.video.toastCancel);
                if (cancel) (cancel as HTMLElement).click();
            }
        });
    } catch (e) { adaptiveDebugOnce(e); }
}

function adaptiveIsPlayerSwitching() {
    try {
        const player = unsafeWindow.player;
        if (player && typeof player.getQuality === "function") {
            const q = player.getQuality();
            if (q && typeof q.nowQ === "number" && typeof q.newQ === "number" && q.nowQ !== q.newQ) return true;
        }
    } catch (e) { adaptiveDebugOnce(e); }
    return false;
}

export function adaptiveConfirmByFacade(targetQn: number | null): boolean | null {
    if (!targetQn) return null;
    try {
        const player = unsafeWindow.player;
        if (player && typeof player.getQuality === "function") {
            const q = player.getQuality();
            if (q && typeof q.realQ === "number") return q.realQ === targetQn && q.nowQ === q.newQ;
        }
    } catch (e) { adaptiveDebugOnce(e); }
    return null;
}

export function adaptiveSettledElsewhere(targetQn: number | null): boolean | null {
    if (!targetQn) return null;
    try {
        const player = unsafeWindow.player;
        if (player && typeof player.getQuality === "function") {
            const q = player.getQuality();
            if (q && typeof q.realQ === "number" && typeof q.nowQ === "number" && typeof q.newQ === "number") {
                return q.nowQ === q.newQ && q.realQ !== targetQn;
            }
        }
    } catch (e) { adaptiveDebugOnce(e); }
    return null;
}

function adaptiveReadRealQ(): number | null {
    try {
        const player = unsafeWindow.player;
        if (player && typeof player.getQuality === "function") {
            const q = player.getQuality();
            if (q && typeof q.realQ === "number") return q.realQ;
        }
    } catch (e) { adaptiveDebugOnce(e); }
    return null;
}

function adaptiveTryDowngrade(reason: string): "switching" | "floor" | null {
    if (adaptive.timerId === null || !state.adaptiveQualityEnabled) return null;
    if (adaptive.disabledForVideo || adaptive.switching) return null;
    const now = Date.now();
    const cfg = adaptiveConfig();
    if (!adaptive.flowDoneSeen || adaptiveArmPending(now)) return null;
    if (adaptiveDeadlinePending(now, adaptive.observationHoldUntil, QUALITY_FAIL_WATCH_WINDOW_MS)) return null;
    if (adaptiveDeadlinePending(now, adaptive.cooldownUntil, cfg.cooldownMs)) return null;
    if (adaptive.stepsUsed >= cfg.maxSteps) return null;
    const video = document.querySelector("video");
    if (!video || !isFinite(video.duration) || video.duration <= 0) return null;
    if (video.seeking || now - adaptive.lastSeekAt < ADAPTIVE_SEEK_GRACE_MS) return null;
    if (video.duration - video.currentTime <= ADAPTIVE_TAIL_GUARD_S) return null;
    if (adaptiveIsPlayerSwitching()) return null;
    const qualityMenu = document.querySelector(BILI.video.qualityMenu);
    if (!qualityMenu || !findActiveQualityItem(qualityMenu)) return null;
    const target = adaptivePickNextLower();
    if (!target) {
        if (!adaptive.floorLogged) {
            console.log(`[智能降画质] 触发（${reason}），但已无更低的可用画质`);
            adaptive.floorLogged = true;
        }
        adaptive.cooldownUntil = now + cfg.cooldownMs;
        return "floor";
    }
    adaptive.floorLogged = false;
    const fromQn = adaptiveReadRealQ();
    if (target.qn !== null && fromQn !== null && target.qn === fromQn) return null;
    console.log(`[智能降画质] 触发（${reason}），降档到: ${target.name}`);
    adaptiveResetSignals();
    try {
        Utils.queryAll(BILI.video.toastText).forEach(el => {
            if (ADAPTIVE_FAIL_TOAST_PATTERN.test(el.textContent || "")) adaptive.consumedToasts!.add(el);
        });
    } catch (e) { adaptiveDebugOnce(e); }
    adaptive.switching = { targetClean: target.clean, targetQn: target.qn, fromQn: fromQn, stableTicks: 0, divergedTicks: 0, deadline: now + ADAPTIVE_CONFIRM_TIMEOUT_MS };
    adaptiveExecuteSwitch(target);
    return "switching";
}

function adaptiveSwitchFailed(reason: string, evidence: "confirmed" | "timeout" = "confirmed") {
    const now = Date.now();
    const failed = adaptive.switching;
    if (failed && evidence === "timeout") {
        adaptive.timeoutTarget = { qn: failed.targetQn, clean: failed.targetClean };
    } else {
        adaptive.timeoutTarget = null;
        if (failed) {
            if (failed.targetQn) adaptive.failedQns!.add(failed.targetQn);
            if (failed.targetClean) adaptive.failedQns!.add(failed.targetClean);
        }
    }
    adaptive.switching = null;
    adaptive.failures++;
    console.warn(`[智能降画质] 降档未完成（${reason}，第 ${adaptive.failures} 次失败）`);
    if (adaptive.failures >= ADAPTIVE_MAX_FAILURES) {
        adaptive.disabledForVideo = true;
        console.warn("[智能降画质] 连续失败，本视频内不再尝试自动降档");
        return;
    }
    adaptive.retryAt = now + ADAPTIVE_FAIL_RETRY_BACKOFF_MS;
    adaptive.retryExpireAt = adaptive.retryAt + ADAPTIVE_RETRY_WINDOW_MS;
    adaptive.cooldownUntil = Math.max(adaptive.cooldownUntil, adaptive.retryAt);
}

function adaptiveExecuteSwitch(target: AdaptiveLowerTarget) {
    if (target.qn) {
        try {
            const player = unsafeWindow.player;
            if (player && typeof player.requestQuality === "function") {
                const result = player.requestQuality(target.qn);
                if (result && typeof result.catch === "function") {
                    const session = adaptive.switching;
                    void result.catch((reason: unknown) => {
                        console.warn("[智能降画质] requestQuality 被拒绝:", reason);
                        if (session && adaptive.switching === session) {
                            adaptiveSwitchFailed("requestQuality 拒绝");
                        }
                    });
                }
                return;
            }
        } catch (e) { adaptiveDebugOnce(e); }
    }
    try {
        const opts = { bubbles: true, cancelable: true, view: unsafeWindow };
        ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(type => {
            const ev = type.indexOf("pointer") === 0 ? new PointerEvent(type, opts) : new MouseEvent(type, opts);
            target.element.dispatchEvent(ev);
        });
    } catch (e) {
        (target.element as HTMLElement).click();
    }
}

function adaptiveTickSwitching(now: number, cfg: AdaptiveSensitivityPreset, video: HTMLVideoElement | null, activeClean: string) {
    const facadeConfirm = adaptiveConfirmByFacade(adaptive.switching!.targetQn);
    let confirmed = facadeConfirm === true;
    let takenOver = false;
    if (facadeConfirm === null) {
        if (activeClean && activeClean === adaptive.switching!.targetClean) {
            adaptive.switching!.stableTicks++;
            adaptive.switching!.divergedTicks = 0;
            confirmed = adaptive.switching!.stableTicks >= 4;
        } else {
            adaptive.switching!.stableTicks = 0;
            if (activeClean) {
                adaptive.switching!.divergedTicks++;
                takenOver = adaptive.switching!.divergedTicks >= 10;
            }
        }
    } else if (!confirmed) {
        if (adaptiveSettledElsewhere(adaptive.switching!.targetQn) === true) {
            adaptive.switching!.divergedTicks++;
            takenOver = adaptive.switching!.divergedTicks >= 6;
        } else {
            adaptive.switching!.divergedTicks = 0;
        }
    }
    let failToast = null;
    if (!confirmed) {
        failToast = Utils.queryAll(BILI.video.toastText).find(el =>
            ADAPTIVE_FAIL_TOAST_PATTERN.test(el.textContent || "") && !adaptive.consumedToasts!.has(el)) || null;
        if (failToast) qualityFailConsumedToasts.add(failToast);
        if (failToast && audioToggleGraceActive()) {
            adaptive.consumedToasts!.add(failToast);
            failToast = null;
        }
    }
    if (confirmed) {
        const settledName = activeClean || adaptive.switching!.targetClean;
        adaptive.switching = null;
        adaptive.stepsUsed++;
        adaptive.failures = 0;
        adaptive.retryAt = 0;
        adaptive.cooldownUntil = now + cfg.cooldownMs;
        adaptive.lastActiveClean = settledName;
        console.log(`[智能降画质] 降档成功: ${settledName}（本视频第 ${adaptive.stepsUsed} 次）`);
        adaptiveFeedbackToast(settledName);
        adaptiveDismissBiliToast();
    } else if (failToast) {
        adaptive.consumedToasts!.add(failToast);
        adaptiveSwitchFailed("B 站提示切换失败");
    } else if (takenOver) {
        const fromQn = adaptive.switching!.fromQn;
        const realQ = adaptiveReadRealQ();
        const undecidable = fromQn === null || realQ === null;
        const targetKey = `${adaptive.switching!.targetQn || ""}|${adaptive.switching!.targetClean}`;
        if (!undecidable && realQ === fromQn) {
            adaptiveSwitchFailed("切换未被受理");
        } else if (undecidable && adaptive.blindYieldKey === targetKey) {
            adaptive.blindYieldKey = "";
            adaptiveSwitchFailed("同一档位连续两次未被受理");
        } else {
            adaptive.blindYieldKey = undecidable ? targetKey : "";
            adaptive.switching = null;
            adaptive.retryAt = 0;
            adaptive.cooldownUntil = Math.max(adaptive.cooldownUntil, now + cfg.settleMs);
            adaptive.lastActiveClean = activeClean || adaptive.lastActiveClean;
            console.log("[智能降画质] 切换期间画质被外部接管，让位并进入宽限期");
        }
    } else if (!adaptiveDeadlinePending(now, adaptive.switching!.deadline, ADAPTIVE_CONFIRM_TIMEOUT_MS)) {
        adaptiveSwitchFailed("确认超时", "timeout");
    }
    if (video) adaptive.lastCt = video.currentTime;
    adaptiveResetSignals();
}

function adaptiveDetectStall(now: number, cfg: AdaptiveSensitivityPreset, frozen: boolean) {
    const inSeekGrace = now - adaptive.lastSeekAt < ADAPTIVE_SEEK_GRACE_MS;
    if (frozen) {
        if (inSeekGrace) {
            adaptive.stallStartAt = 0;
        } else if (!adaptive.stallStartAt) {
            adaptive.stallStartAt = now;
        } else if (now - adaptive.stallStartAt >= cfg.hardStallMs) {
            if (adaptiveTryDowngrade(`连续卡顿超过 ${cfg.hardStallMs / 1000} 秒`)) {
                adaptive.stallStartAt = 0;
            }
        }
        return true;
    }
    if (adaptive.stallStartAt) {
        const stallDuration = now - adaptive.stallStartAt;
        adaptive.stallStartAt = 0;
        if (stallDuration >= cfg.strikeMinMs && !adaptiveArmPending(now)) {
            adaptive.strikes.push(now);
        }
    }
    adaptive.strikes = adaptive.strikes.filter(t => now - t <= cfg.strikeWindowMs);
    if (adaptive.strikes.length >= cfg.strikesToTrigger) {
        if (adaptiveTryDowngrade(`${cfg.strikeWindowMs / 1000} 秒内发生 ${cfg.strikesToTrigger} 次卡顿`)) {
            adaptive.strikes = [];
        }
        return true;
    }
    return false;
}

function adaptiveDetectBufferDrain(now: number, cfg: AdaptiveSensitivityPreset, video: HTMLVideoElement) {
    if (!cfg.predictive || adaptiveArmPending(now) || adaptiveDeadlinePending(now, adaptive.cooldownUntil, cfg.cooldownMs)) {
        adaptive.bufferSamples = [];
        return;
    }
    let bufferAhead = -1;
    try {
        for (let i = 0; i < video.buffered.length; i++) {
            if (video.buffered.start(i) <= video.currentTime && video.currentTime <= video.buffered.end(i)) {
                bufferAhead = video.buffered.end(i) - video.currentTime;
                break;
            }
        }
    } catch (e) { adaptiveDebugOnce(e); return; }
    if (bufferAhead < 0) {
        adaptive.bufferSamples = [];
        return;
    }
    // 缓冲已覆盖到片尾时余量递减是正常现象
    if (video.currentTime + bufferAhead >= video.duration - 2) {
        adaptive.bufferSamples = [];
        return;
    }
    // 时钟未前进（后台节流合并触发等）时不重复采样，避免污染时间窗
    const lastSample = adaptive.bufferSamples[adaptive.bufferSamples.length - 1];
    if (lastSample && now - lastSample.t < ADAPTIVE_TICK_MS / 2) return;
    const monoNow = performance.now();
    if (lastSample) {
        const ctAdvance = video.currentTime - lastSample.ct;
        const clockAdvance = (monoNow - lastSample.pt) / 1000 * (video.playbackRate || 1);
        const jumped = ctAdvance < 0 || ctAdvance > clockAdvance + 1;
        if (jumped || lastSample.ahead - bufferAhead > Math.max(ctAdvance, clockAdvance) * 1.2) {
            adaptive.bufferSamples = [{ t: now, ct: video.currentTime, pt: monoNow, ahead: bufferAhead }];
            return;
        }
    }
    adaptive.bufferSamples.push({ t: now, ct: video.currentTime, pt: monoNow, ahead: bufferAhead });
    if (adaptive.bufferSamples.length > 8) adaptive.bufferSamples.shift();
    const oldest = adaptive.bufferSamples[0];
    const newest = adaptive.bufferSamples[adaptive.bufferSamples.length - 1];
    const spanS = (newest.t - oldest.t) / 1000;
    if (spanS >= 2.5 && newest.ahead < cfg.lowWaterS) {
        const drainRate = (oldest.ahead - newest.ahead) / spanS;
        if (drainRate >= cfg.drainRateS) {
            adaptive.bufferSamples = [];
            adaptiveTryDowngrade(`缓冲即将耗尽（余量 ${newest.ahead.toFixed(1)} 秒，流失 ${drainRate.toFixed(2)} 秒/秒）`);
        }
    }
}

const ADAPTIVE_ARM_OUTCOME: Record<QualityFlowOutcome, boolean> = {
    switched: true,
    settled: true,
    abandoned: true,
    delegated: true,
    pending: false,
    stalled: false,
};

function adaptiveTick() {
    const now = Date.now();
    const cfg = adaptiveConfig();
    const monoNow = performance.now();
    const sinceLastTick = adaptive.lastTickAt ? monoNow - adaptive.lastTickAt : 0;
    const sinceLastWall = adaptive.lastTickWallAt ? now - adaptive.lastTickWallAt : 0;
    const clockDrift = Math.abs(sinceLastWall - sinceLastTick);
    adaptive.lastTickAt = monoNow;
    adaptive.lastTickWallAt = now;
    if (sinceLastTick > ADAPTIVE_TICK_MS * ADAPTIVE_TICK_GAP_FACTOR
        || clockDrift > ADAPTIVE_TICK_MS * ADAPTIVE_TICK_GAP_FACTOR) {
        adaptiveResetSignals();
        adaptive.lastCt = -1;
        if (adaptive.switching) {
            adaptive.switching.deadline = Math.min(adaptive.switching.deadline + sinceLastTick, now + ADAPTIVE_CONFIRM_TIMEOUT_MS);
        }
        return;
    }
    adaptiveEnsurePlayerBinding();
    const video = document.querySelector("video");
    if (video && video.seeking) adaptive.lastSeekAt = now;

    if (adaptive.switching) {
        adaptiveTickSwitching(now, cfg, video, adaptiveReadActiveClean());
        return;
    }

    if (!ADAPTIVE_ARM_OUTCOME[state.qualityFlow]) {
        adaptive.flowDoneSeen = false;
        return;
    }
    if (!adaptive.flowDoneSeen) {
        adaptive.flowDoneSeen = true;
        const doubleCheck = getDoubleCheckConfig(false);
        adaptive.armedAt = now + Math.max(cfg.settleMs, doubleCheck.enabled ? doubleCheck.delayMs + ADAPTIVE_ARM_VERIFY_BUFFER_MS : 0);
        adaptive.lastActiveClean = adaptiveReadActiveClean();
        adaptive.lastCt = -1;
        adaptiveResetSignals();
        return;
    }

    if (!video) return;
    const activeClean = adaptiveReadActiveClean();

    if (video.readyState === 0) return;

    if (activeClean && adaptive.lastActiveClean && activeClean !== adaptive.lastActiveClean) {
        console.log(`[智能降画质] 检测到外部画质变更: ${adaptive.lastActiveClean} → ${activeClean}，进入宽限期`);
        adaptive.cooldownUntil = Math.max(adaptive.cooldownUntil, now + cfg.settleMs);
        adaptiveResetSignals();
    }
    if (activeClean) adaptive.lastActiveClean = activeClean;

    if (adaptive.retryAt && !adaptiveDeadlinePending(now, adaptive.retryAt, ADAPTIVE_FAIL_RETRY_BACKOFF_MS)) {
        const retryOutcome = adaptiveTryDowngrade("上次切换失败，改试更低一档");
        if (retryOutcome || !adaptiveDeadlinePending(now, adaptive.retryExpireAt, adaptiveRetryChainMaxMs())) {
            adaptive.retryAt = 0;
            adaptive.retryExpireAt = 0;
        }
        if (adaptive.switching) return;
    }

    const toastEl = Utils.queryAll(BILI.video.toastText).find(el =>
        ADAPTIVE_TOAST_PATTERN.test(el.textContent || "") && !adaptive.consumedToasts!.has(el));
    if (toastEl) {
        const outcome = adaptiveTryDowngrade(`B 站弱网提示"${(toastEl.textContent || "").trim()}"`);
        if (outcome) adaptive.consumedToasts!.add(toastEl);
        if (adaptive.switching) return;
    }

    // 播放状态整理（lastSeekAt 已在 tick 顶部刷新）
    const previousCt = adaptive.lastCt;
    adaptive.lastCt = video.currentTime;
    if (video.paused || video.ended || video.seeking) {
        adaptiveResetSignals();
        return;
    }
    if (previousCt < 0) return;

    const frozen = video.currentTime === previousCt;
    if (adaptiveDetectStall(now, cfg, frozen)) return;

    adaptiveDetectBufferDrain(now, cfg, video);
}
