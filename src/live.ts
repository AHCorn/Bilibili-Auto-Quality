import { BILI } from "./contract";
import { state, getDoubleCheckConfig, debugTransient } from "./settings";
import { runSafely } from "./utils";
import { taskQueue } from "./task-queue";

type LiveQualityOption = { qn: number; desc: string };
type LiveFacadeInfoShape = {
    playurl?: unknown;
    quality?: number;
    qualityCandidates: LiveQualityOption[];
    // 仅在「站方给了候选、净化后一个不剩」时填充，供日志区分两种「空」
    candidatesDigest?: string;
    danmaku?: { display?: boolean };
};
function normalizeLiveCandidates(raw: unknown): LiveQualityOption[] {
    if (!Array.isArray(raw)) return [];
    const options: LiveQualityOption[] = [];
    raw.forEach((item: unknown) => {
        const q = item as BiliLiveQualityCandidate | null;
        if (!q || typeof q !== "object") return;
        const qn = Number(q.qn);
        if (!Number.isFinite(qn) || qn <= 0) return;
        options.push({ qn, desc: typeof q.desc === "string" ? q.desc : "" });
    });
    return options;
}
function describeDroppedCandidates(raw: unknown, kept: number): string | undefined {
    if (kept > 0 || !Array.isArray(raw) || raw.length === 0) return undefined;
    const first = raw[0] as unknown;
    const keys = first && typeof first === "object"
        ? Object.keys(first as Record<string, unknown>).join("/")
        : typeof first;
    return `原始 ${raw.length} 项全部无效，首项字段: ${keys}`;
}
function liveQualityLabel(q: LiveQualityOption) {
    return q.desc || `qn ${q.qn}`;
}

type LiveSwitchRecord = {
    targetQn: number;
    fromQn: number | undefined;
    at: number;
    confirmed: boolean;
};
type LiveSession = {
    roomKey: string;
    lastSwitch: LiveSwitchRecord | null;
    consecutiveFailures: Map<number, number>;
    blockedQns: Set<number>;
    yieldedSetting: string | null;
    yieldedAt: number;
    yieldCount: number;
    lastPollNormal: boolean;
    announcedDowngradeQn: number | null;
    blindSwitchQn: number | null;
};
let liveSession: LiveSession | null = null;
function liveRoomKey(): string {
    try { return window.location.pathname; } catch (e) { debugTransient(e); return ""; }
}
function liveSessionState(): LiveSession {
    const roomKey = liveRoomKey();
    if (!liveSession || liveSession.roomKey !== roomKey) {
        _liveUserInputAt = 0;
        liveSession = {
            roomKey,
            lastSwitch: null,
            consecutiveFailures: new Map(),
            blockedQns: new Set(),
            yieldedSetting: null,
            yieldedAt: 0,
            yieldCount: 0,
            lastPollNormal: false,
            announcedDowngradeQn: null,
            blindSwitchQn: null,
        };
    }
    return liveSession;
}

function liveInputInTextEntry(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : "";
    return tag === "INPUT" || tag === "TEXTAREA";
}
let _liveUserInputAt = 0;
let _liveUserInputBound = false;
function bindLiveUserInputWatch() {
    if (_liveUserInputBound) return;
    _liveUserInputBound = true;
    const mark = (e: Event) => {
        if (!e.isTrusted) return;
        if (liveInputInTextEntry(e.target)) return;
        _liveUserInputAt = Date.now();
    };
    ["pointerdown", "keydown"].forEach(name =>
        document.addEventListener(name, mark, { capture: true, passive: true }));
}
const LIVE_MANUAL_INPUT_SETTLE_MS = 15000;
function liveRecentUserInput(intervalMs: number): boolean {
    if (_liveUserInputAt === 0) return false;
    const elapsed = Date.now() - _liveUserInputAt;
    return elapsed >= 0 && elapsed <= Math.min(intervalMs, 60000) + LIVE_MANUAL_INPUT_SETTLE_MS;
}
const LIVE_YIELD_TTL_MS = 5 * 60 * 1000;
const LIVE_YIELD_STICKY_COUNT = 2;
function liveYieldHolds(yieldedAt: number, yieldCount: number, now: number): boolean {
    if (yieldCount >= LIVE_YIELD_STICKY_COUNT) return true;
    const elapsed = now - yieldedAt;
    return elapsed >= 0 && elapsed < LIVE_YIELD_TTL_MS;
}
function liveResetYield(session: LiveSession) {
    session.yieldedSetting = null;
    session.yieldedAt = 0;
    session.yieldCount = 0;
}
function liveLockYielded(): boolean {
    const session = liveSessionState();
    if (session.yieldedSetting === null) return false;
    if (session.yieldedSetting !== state.userLiveQualitySetting) {
        liveResetYield(session);
        return false;
    }
    if (liveYieldHolds(session.yieldedAt, session.yieldCount, Date.now())) return true;
    session.yieldedSetting = null;
    session.yieldedAt = 0;
    console.log("[直播画质] 手动切换让位已到期，恢复画质锁定；若当前画质就是你要的，再改一次即可长期保留");
    return false;
}

function liveNameMatches(a: string, b: string): boolean {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length < 2 || b.length < 2) return false;
    return a.includes(b) || b.includes(a);
}
function liveDesiredQn(setting: string): number | undefined {
    const direct = BILI.live.qnMap[setting];
    if (typeof direct === "number") return direct;
    const key = Object.keys(BILI.live.qnMap).find(k => liveNameMatches(k, setting));
    if (key === undefined) return undefined;
    const mapped = BILI.live.qnMap[key];
    return typeof mapped === "number" ? mapped : undefined;
}
function describeTargetMiss(info: LiveFacadeInfoShape | null) {
    if (!info) return "播放器信息不可用";
    if (info.qualityCandidates.length > 0) {
        const blocked = liveSessionState().blockedQns;
        const usable = info.qualityCandidates.filter(q => !blocked.has(q.qn));
        if (usable.length === 0) return "本直播间的候选档位已全部切换失败并拉黑";
        return `未找到匹配项: ${state.userLiveQualitySetting}；本直播间可用: ${usable.map(liveQualityLabel).join("、")}`;
    }
    return info.candidatesDigest ? `候选全部无效，${info.candidatesDigest}` : "候选列表为空";
}
type LiveTarget = { option: LiveQualityOption; downgradedFrom?: string };
function pickHighest(candidates: LiveQualityOption[]): LiveQualityOption {
    return candidates.reduce((best: LiveQualityOption, q: LiveQualityOption) => (q.qn > best.qn ? q : best), candidates[0]);
}
function resolveLiveTargetQuality(qualityCandidates: LiveQualityOption[] | undefined | null): LiveTarget | null {
    const blocked = liveSessionState().blockedQns;
    const candidates = (qualityCandidates || []).filter(q => !blocked.has(q.qn));
    if (candidates.length === 0) return null;
    const setting = state.userLiveQualitySetting;
    let resolution: LiveTarget | null = null;
    if (setting === "最高画质") resolution = { option: pickHighest(candidates) };
    else {
        const desiredQn = liveDesiredQn(setting);
        if (desiredQn !== undefined) {
            const byQn = candidates.find((q: LiveQualityOption) => q.qn === desiredQn);
            if (byQn) resolution = { option: byQn };
        }
        if (!resolution) {
            const byName = candidates.find((q: LiveQualityOption) =>
                (desiredQn === undefined || q.qn <= desiredQn) && liveNameMatches(q.desc, setting));
            if (byName) resolution = { option: byName };
        }
        if (!resolution && desiredQn !== undefined) {
            const lower = candidates.filter((q: LiveQualityOption) => q.qn < desiredQn);
            if (lower.length > 0) resolution = { option: pickHighest(lower), downgradedFrom: setting };
        }
    }
    if (!resolution) return null;
    return resolution;
}
function announceLiveDowngrade(resolution: LiveTarget) {
    if (!resolution.downgradedFrom) return;
    const session = liveSessionState();
    if (session.announcedDowngradeQn === resolution.option.qn) return;
    session.announcedDowngradeQn = resolution.option.qn;
    console.log(`[直播画质] 本直播间没有「${resolution.downgradedFrom}」，已就近降到「${liveQualityLabel(resolution.option)}」(qn: ${resolution.option.qn})`);
}
export function liveFacadeInfo(): LiveFacadeInfoShape | null {
    try {
        const lp = unsafeWindow.livePlayer;
        if (lp && typeof lp.getPlayerInfo === "function") {
            const info = lp.getPlayerInfo();
            if (!info) return null;
            const quality = Number(info.quality);
            const qualityCandidates = normalizeLiveCandidates(info.qualityCandidates);
            return {
                playurl: info.playurl,
                quality: Number.isFinite(quality) ? quality : undefined,
                qualityCandidates,
                candidatesDigest: describeDroppedCandidates(info.qualityCandidates, qualityCandidates.length),
                danmaku: info.danmaku,
            };
        }
    } catch (e) { debugTransient(e); /* 实例重建瞬间可能抛错 */ }
    return null;
}
let liveSwitchSeq = 0;
const LIVE_SWITCH_DEDUPE_MS = 1000;
function liveSwitchQuality(qn: number, options: { fromQn?: number; force?: boolean } = {}) {
    const session = liveSessionState();
    const last = session.lastSwitch;
    const sinceLast = last ? Date.now() - last.at : Infinity;
    if (!options.force && last && last.targetQn === qn && sinceLast >= 0 && sinceLast < LIVE_SWITCH_DEDUPE_MS) {
        debugTransient(`[直播画质] ${LIVE_SWITCH_DEDUPE_MS} 毫秒内重复请求 qn=${qn}，已去重`);
        return true;
    }
    try {
        const lp = unsafeWindow.livePlayer;
        if (lp && typeof lp.switchQuality === "function") {
            const seq = ++liveSwitchSeq;
            session.lastSwitch = { targetQn: qn, fromQn: options.fromQn, at: Date.now(), confirmed: false };
            const result = lp.switchQuality(qn) as { catch?: (fn: (reason?: unknown) => void) => unknown } | null | undefined;
            if (result && typeof result.catch === "function") {
                result.catch((reason: unknown) => {
                    if (seq !== liveSwitchSeq) { debugTransient(reason); return; }
                    console.warn("[直播画质] 切换调用被拒绝:", reason);
                });
            }
            return true;
        }
    } catch (e) { debugTransient(e); /* 同上 */ }
    return false;
}
const LIVE_SWITCH_MAX_FAILURES = 2;
function liveNoteSwitchFailure(target: LiveQualityOption): boolean {
    const session = liveSessionState();
    const count = (session.consecutiveFailures.get(target.qn) || 0) + 1;
    session.consecutiveFailures.set(target.qn, count);
    if (count < LIVE_SWITCH_MAX_FAILURES) {
        console.log(`[直播画质] 「${liveQualityLabel(target)}」第 ${count} 次未切换成功，稍后重试`);
        return false;
    }
    session.consecutiveFailures.delete(target.qn);
    session.blockedQns.add(target.qn);
    console.warn(`[直播画质] 「${liveQualityLabel(target)}」连续 ${count} 次切不过去（付费直播、舰长专属、大会员专属档常见此现象），本直播间内不再尝试该档，改用可用的次高档；换直播间后重置`);
    updatePollingStatusIndicator();
    return true;
}
function liveNoteSwitchSettled(qn: number) {
    const session = liveSessionState();
    session.consecutiveFailures.delete(qn);
    if (session.lastSwitch && session.lastSwitch.targetQn === qn) session.lastSwitch.confirmed = true;
}
const LIVE_VERIFY_MAX_ROUNDS = 2;
function scheduleLiveVerify(taskId: number, target: LiveQualityOption, delayMs: number, waitMs: number, round: number) {
    runSafely(taskQueue.scheduleTask(taskId, async () => {
        if (taskQueue.isTaskCancelled(taskId)) return;
        const nextRound = (next: LiveQualityOption) => {
            if (round >= LIVE_VERIFY_MAX_ROUNDS) {
                console.log(`[直播画质] 已验证 ${round} 轮仍未落地，停止自动重试（重选画质或开启轮询锁定可继续纠正）`);
                return;
            }
            scheduleLiveVerify(taskId, next, delayMs, delayMs, round + 1);
        };
        const afterInfo = liveFacadeInfo();
        if (!afterInfo) return;
        if (afterInfo.quality === target.qn) {
            liveNoteSwitchSettled(target.qn);
            console.log("[直播画质] 画质切换验证成功，当前画质:", liveQualityLabel(target));
            return;
        }
        const sw = liveSessionState().lastSwitch;
        if (sw && sw.targetQn === target.qn && !sw.confirmed) {
            const remainMs = sw.at + LIVE_SWITCH_INFLIGHT_MS - Date.now();
            if (remainMs > 0 && remainMs <= LIVE_SWITCH_INFLIGHT_MS) {
                debugTransient(`[直播画质] 切换仍在在途宽限内，${remainMs} 毫秒后再验`);
                scheduleLiveVerify(taskId, target, delayMs, remainMs, round);
                return;
            }
        }
        const after = afterInfo.quality;
        if (sw && after !== undefined && after !== sw.fromQn && after !== sw.targetQn) {
            console.log(`[直播画质] 画质已被改为 qn=${after}（非本脚本所切），不再纠正`);
            return;
        }
        if (after === undefined) {
            console.log("[直播画质] 读不到当前画质，无法验证本次切换，不做重切");
            return;
        }
        const stuck = !sw || after === sw.fromQn;
        if (stuck && liveNoteSwitchFailure(target)) {
            const retry = resolveLiveTargetQuality(afterInfo.qualityCandidates);
            if (!retry) {
                console.warn(`[直播画质] 已无可用的替代档位 (${describeTargetMiss(afterInfo)})，停止切换`);
                return;
            }
            announceLiveDowngrade(retry);
            console.log("[直播画质] 改切可用档位:", liveQualityLabel(retry.option), "(qn:", retry.option.qn, ")");
            const issued = liveSwitchQuality(retry.option.qn, { fromQn: after, force: true });
            if (!issued) console.log("[直播画质] 改切调用失败，播放器可能正在重建");
            updateLiveSettingsPanel();
            updatePollingStatusIndicator();
            if (issued) nextRound(retry.option);
            return;
        }
        console.log("[直播画质] 画质切换可能未成功，执行二次切换...");
        if (!liveSwitchQuality(target.qn, { fromQn: after, force: true })) {
            console.log("[直播画质] 二次切换调用失败，播放器可能正在重建");
            return;
        }
        nextRound(target);
    }, waitMs, "live-quality-double-check"), "直播二次验证");
}
const LIVE_READY_PROBE_ATTEMPTS = 30;
const LIVE_READY_PROBE_INTERVAL_MS = 1000;
export async function selectLiveQuality() {
    const taskId = taskQueue.currentTaskId;
    const waitKey = `live-wait-${taskId}`;
    const previousWait = taskQueue.activeTimeouts.get(waitKey);
    if (previousWait) {
        clearTimeout(previousWait.timeout);
        previousWait.resolve();
        taskQueue.activeTimeouts.delete(waitKey);
    }
    const readyResult = await new Promise(resolve => {
        let attempts = 0;
        const finish = (result: string) => {
            taskQueue.activeTimeouts.delete(waitKey);
            resolve(result);
        };
        const probe = () => {
            if (taskQueue.isTaskCancelled(taskId)) return finish("cancelled");
            const info = liveFacadeInfo();
            let switchable = false;
            try {
                const lp = unsafeWindow.livePlayer;
                switchable = !!(lp && typeof lp.switchQuality === "function");
            } catch (e) { debugTransient(e); /* 实例重建瞬间可能抛错 */ }
            if (info && info.playurl && switchable) return finish("ready");
            if (++attempts >= LIVE_READY_PROBE_ATTEMPTS) return finish("timeout");
            const timeout: ReturnType<typeof setTimeout> = setTimeout(probe, LIVE_READY_PROBE_INTERVAL_MS);
            taskQueue.activeTimeouts.set(waitKey, { timeout, resolve: () => resolve("cancelled") });
        };
        probe();
    });
    if (readyResult !== "ready") {
        console.log(readyResult === "cancelled"
            ? "[直播画质] 任务已取消，停止后续操作"
            : `[直播画质] 等待播放器就绪超时（约 ${LIVE_READY_PROBE_ATTEMPTS * LIVE_READY_PROBE_INTERVAL_MS / 1000} 秒；直播间未开播时必然跑满），停止后续操作`);
        return;
    }
    const entryInfo = liveFacadeInfo();
    const qualityCandidates = entryInfo?.qualityCandidates || [];
    console.log("[直播画质] 可用画质选项:", qualityCandidates.map((q, i) => `${i + 1}. ${liveQualityLabel(q)} (qn: ${q.qn})`));
    console.log("[直播画质] 选择的画质:", state.userLiveQualitySetting);

    const resolution = resolveLiveTargetQuality(qualityCandidates);

    if (!resolution) {
        console.log(`[直播画质] 画质切换失败 (${describeTargetMiss(entryInfo)})，跳过切换。`);
        return;
    }
    announceLiveDowngrade(resolution);
    const targetQuality = resolution.option;

    console.log("[直播画质] 目标画质:", liveQualityLabel(targetQuality), "(qn:", targetQuality.qn, ")");
    function switchQuality() {
        if (liveLockYielded()) {
            console.log("[直播画质] 已让位于你的手动切换，跳过本次自动纠正（换直播间、重新选择画质或重开轮询锁定后恢复）");
            return;
        }
        const shouldForceHighestOnce = state.liveEntryForceHighest && state.userLiveQualitySetting === "最高画质";
        const info = liveFacadeInfo();
        if (!info) {
            console.log("[直播画质] 播放器暂不可用，跳过本次切换");
            return;
        }
        const currentQualityNumber = info.quality;
        if (currentQualityNumber !== targetQuality.qn || shouldForceHighestOnce) {
            if (!liveSwitchQuality(targetQuality.qn, { fromQn: currentQualityNumber })) {
                console.log("[直播画质] 切换调用失败，播放器可能正在重建");
                return;
            }
            if (shouldForceHighestOnce) state.liveEntryForceHighest = false;
            state.qualityFlow = "switched";
            console.log("[直播画质] 已切换到目标画质:", liveQualityLabel(targetQuality));
            updateLiveSettingsPanel();

            // 轮询锁定运行时由轮询接管验证，跳过二次验证
            if (state.liveQualityPollingEnabled && state.livePollingTimerId !== null) {
                console.log("[直播画质] 轮询锁定运行中，跳过二次验证");
            } else {
                const { enabled, delayMs } = getDoubleCheckConfig(true);
                if (enabled) {
                    console.log(`[直播画质] 等待 ${delayMs} 毫秒后进行二次验证...`);
                    scheduleLiveVerify(taskId, targetQuality, delayMs, delayMs, 1);
                } else {
                    console.log("[直播画质] 二次验证已关闭，跳过验证");
                }
            }
        } else {
            liveNoteSwitchSettled(targetQuality.qn);
            state.qualityFlow = "settled";
            console.log("[直播画质] 已经是目标画质:", liveQualityLabel(targetQuality));
            updateLiveSettingsPanel();
        }
    }
    switchQuality();
}
export function updateLiveSettingsPanel() {
    const panel = document.getElementById("bilibili-live-quality-selector") as BaqPanelElement | null;
    if (panel && typeof panel.updatePanel === "function") panel.updatePanel();
}
export function updatePollingStatusIndicator() {
    const statusEl = document.getElementById("live-polling-status");
    if (!statusEl) return;
    const pollingActive = state.liveQualityPollingEnabled && state.livePollingTimerId !== null;
    if (!pollingActive) {
        statusEl.textContent = '未启用';
        return;
    }
    const session = liveSessionState();
    const yielded = session.yieldedSetting !== null
        && session.yieldedSetting === state.userLiveQualitySetting
        && liveYieldHolds(session.yieldedAt, session.yieldCount, Date.now());
    if (yielded) {
        if (session.yieldCount >= LIVE_YIELD_STICKY_COUNT) {
            statusEl.textContent = '已暂停：多次检测到你手动切换画质，重选画质或换直播间后恢复';
            return;
        }
        const remainMin = Math.max(1, Math.ceil((LIVE_YIELD_TTL_MS - (Date.now() - session.yieldedAt)) / 60000));
        statusEl.textContent = '已暂停：检测到你手动切换了画质，约 ' + remainMin + ' 分钟后自动恢复锁定';
        return;
    }
    const base = '运行中，每 ' + state.livePollingInterval + ' 秒检查一次';
    statusEl.textContent = session.blockedQns.size > 0
        ? base + '（已跳过 ' + session.blockedQns.size + ' 个切不过去的档位）'
        : base;
}
const LIVE_SWITCH_INFLIGHT_MS = 8000;
export function startLivePolling() {
    stopLivePolling();
    if (!state.liveQualityPollingEnabled) return;
    const intervalMs = state.livePollingInterval * 1000;
    liveResetYield(liveSessionState());
    bindLiveUserInputWatch();
    console.log(`[直播轮询] 启动画质轮询锁定，间隔 ${state.livePollingInterval} 秒`);
    state.livePollingTimerId = setInterval(() => {
        try {
            updatePollingStatusIndicator();
            if (liveLockYielded()) {
                debugTransient("[直播轮询] 已让位于手动切换，跳过本次轮询");
                return;
            }
            const session = liveSessionState();
            const playerInfo = liveFacadeInfo();
            if (!playerInfo) {
                console.log("[直播轮询] 播放器尚未就绪，跳过本次轮询");
                return;
            }
            const resolution = resolveLiveTargetQuality(playerInfo.qualityCandidates);
            if (!resolution) {
                console.log(`[直播轮询] 未定出目标画质 (${describeTargetMiss(playerInfo)})，跳过本次轮询`);
                return;
            }
            announceLiveDowngrade(resolution);
            const targetQuality = resolution.option;
            const currentQn = playerInfo.quality;
            if (currentQn === targetQuality.qn) {
                liveNoteSwitchSettled(targetQuality.qn);
                if (!session.lastPollNormal) {
                    console.log(`[直播轮询] 画质正常：${liveQualityLabel(targetQuality)} (qn=${targetQuality.qn})`);
                } else {
                    debugTransient(`[直播轮询] 画质正常：qn=${currentQn}`);
                }
                session.lastPollNormal = true;
                return;
            }
            session.lastPollNormal = false;
            if (currentQn !== undefined) session.blindSwitchQn = null;
            const sw = session.lastSwitch;
            const atStart = !!sw && !sw.confirmed && currentQn !== undefined
                && currentQn === sw.fromQn && sw.targetQn !== currentQn;
            const sinceSwitch = sw ? Date.now() - sw.at : 0;
            if (atStart && sw && sinceSwitch >= 0 && sinceSwitch < LIVE_SWITCH_INFLIGHT_MS) {
                debugTransient(`[直播轮询] 上次切换仍在途（qn=${currentQn} → ${sw.targetQn}），本次不动作`);
                return;
            }
            if (currentQn !== undefined && (!sw || currentQn !== sw.targetQn) && liveRecentUserInput(intervalMs)) {
                session.yieldCount += 1;
                session.yieldedAt = Date.now();
                session.yieldedSetting = state.userLiveQualitySetting;
                const recovery = session.yieldCount >= LIVE_YIELD_STICKY_COUNT
                    ? "本直播间内不再自动恢复"
                    : `约 ${Math.round(LIVE_YIELD_TTL_MS / 60000)} 分钟后自动恢复`;
                console.log(`[直播轮询] 画质被改动且这段时间页面有真实操作，判定为手动切换（当前 qn=${currentQn}，目标 ${liveQualityLabel(targetQuality)}），已暂停画质锁定让位；${recovery}，换直播间、重新选择画质或重开锁定可立即恢复`);
                updatePollingStatusIndicator();
                return;
            }
            if (atStart && liveNoteSwitchFailure(targetQuality)) {
                const retry = resolveLiveTargetQuality(playerInfo.qualityCandidates);
                if (!retry) {
                    console.warn(`[直播轮询] 已无可用的替代档位 (${describeTargetMiss(playerInfo)})，本次跳过`);
                    return;
                }
                announceLiveDowngrade(retry);
                console.log(`[直播轮询] 改切可用档位：${liveQualityLabel(retry.option)} (qn=${retry.option.qn})`);
                liveSwitchQuality(retry.option.qn, { fromQn: currentQn, force: true });
                updateLiveSettingsPanel();
                updatePollingStatusIndicator();
                return;
            }
            if (currentQn === undefined) {
                if (session.blindSwitchQn === targetQuality.qn) {
                    debugTransient(`[直播轮询] 仍读不到当前画质，已按 qn=${targetQuality.qn} 切过一次，本次不动作`);
                    return;
                }
                console.log(`[直播轮询] 读不到当前画质，先按目标 ${liveQualityLabel(targetQuality)} (qn=${targetQuality.qn}) 切一次；在读到有效画质前不再重切`);
                if (liveSwitchQuality(targetQuality.qn, { fromQn: currentQn })) {
                    session.blindSwitchQn = targetQuality.qn;
                }
                return;
            }
            console.log(`[直播轮询] 画质偏离：当前 qn=${currentQn}，目标 ${liveQualityLabel(targetQuality)} (qn=${targetQuality.qn})，执行切换`);
            liveSwitchQuality(targetQuality.qn, { fromQn: currentQn });
        } catch (e) {
            console.warn("[直播轮询] 轮询执行出错:", e);
        }
    }, intervalMs);
    updatePollingStatusIndicator();
}
export function stopLivePolling() {
    if (state.livePollingTimerId !== null) {
        clearInterval(state.livePollingTimerId);
        state.livePollingTimerId = null;
        console.log("[直播轮询] 已停止画质轮询锁定");
    }
    liveResetYield(liveSessionState());
    updatePollingStatusIndicator();
}
export function restartLivePollingIfNeeded() {
    if (state.liveQualityPollingEnabled) {
        startLivePolling();
    }
}
export function startLiveKeepAlive() {
    stopLiveKeepAlive();
    if (!state.liveKeepAliveEnabled) return;
    const intervalMs = state.liveKeepAliveInterval * 60 * 1000;
    console.log(`[直播保活] 启动模拟活跃，间隔 ${state.liveKeepAliveInterval} 分钟`);
    state.liveKeepAliveTimerId = setInterval(() => {
        try {
            const evt = new MouseEvent("mousemove", {
                bubbles: true,
                cancelable: true,
                clientX: Math.floor(Math.random() * window.innerWidth),
                clientY: Math.floor(Math.random() * window.innerHeight)
            });
            const target: EventTarget = document.querySelector("video") || document.body || document;
            target.dispatchEvent(evt);
            console.log("[直播保活] 已模拟鼠标移动");
        } catch (e) {
            console.warn("[直播保活] 模拟操作失败:", e);
        }
    }, intervalMs);
    updateKeepAliveStatusIndicator();
}
export function stopLiveKeepAlive() {
    if (state.liveKeepAliveTimerId !== null) {
        clearInterval(state.liveKeepAliveTimerId);
        state.liveKeepAliveTimerId = null;
        console.log("[直播保活] 已停止模拟活跃");
    }
    updateKeepAliveStatusIndicator();
}
export function updateKeepAliveStatusIndicator() {
    const statusEl = document.getElementById("live-keepalive-status");
    if (!statusEl) return;
    const active = state.liveKeepAliveEnabled && state.liveKeepAliveTimerId !== null;
    statusEl.textContent = active
        ? '运行中，每 ' + state.liveKeepAliveInterval + ' 分钟模拟一次'
        : '未启用';
}

let _danmakuSyncing = false;
let _danmakuForcedOff = false;
let _danmakuPagehideBound = false;
function bindDanmakuRestoreOnPagehide() {
    if (_danmakuPagehideBound) return;
    _danmakuPagehideBound = true;
    window.addEventListener("pagehide", () => {
        if (!_danmakuForcedOff) return;
        if (liveSetDanmakuDisplay(true)) _danmakuForcedOff = false;
    });
}
function liveSetDanmakuDisplay(display: boolean) {
    try {
        const lp = unsafeWindow.livePlayer;
        if (lp && typeof lp.updateDMSetting === "function") {
            lp.updateDMSetting({ display });
            return true;
        }
    } catch (e) { debugTransient(e); /* 实例重建瞬间可能抛错 */ }
    return false;
}
export function syncLiveDanmaku() {
    if (_danmakuSyncing) return;
    try {
        const lp = unsafeWindow.livePlayer;
        if (!lp?.getPlayerInfo || !lp?.updateDMSetting) return;
        if (!lp.getPlayerInfo()?.danmaku?.display) {
            if (_danmakuForcedOff && liveSetDanmakuDisplay(true)) {
                _danmakuForcedOff = false;
                console.log("[弹幕同步] 已补开上次未恢复的弹幕");
            }
            return;
        }
        _danmakuSyncing = true;
        _danmakuForcedOff = true;
        bindDanmakuRestoreOnPagehide();
        if (!liveSetDanmakuDisplay(false)) {
            _danmakuSyncing = false;
            _danmakuForcedOff = false;
            return;
        }
        setTimeout(() => {
            if (liveSetDanmakuDisplay(true)) {
                _danmakuForcedOff = false;
                console.log("[弹幕同步] 已刷新直播弹幕");
            } else {
                console.warn("[弹幕同步] 恢复弹幕显示失败，将在下次同步或离开页面时补开");
            }
            _danmakuSyncing = false;
        }, 500);
    } catch (e) {
        _danmakuSyncing = false;
        console.warn("[弹幕同步] 执行失败:", e);
    }
}
