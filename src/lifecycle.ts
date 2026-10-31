import { BILI } from "./contract";
import { state, checkIfLivePage, type QualityFlowOutcome } from "./settings";
import { Utils, runSafely } from "./utils";
import { getRealVisibilityState } from "./visibility";
import { taskQueue } from "./task-queue";
import { selectVideoQuality, resetQualityFailWatch } from "./video-quality";
import { selectLiveQuality, startLivePolling, stopLivePolling, startLiveKeepAlive, stopLiveKeepAlive, syncLiveDanmaku, liveFacadeInfo } from "./live";
import { applyDecodeSetting, cancelDecodeRetry } from "./decode";
import { applyAutoWidescreen } from "./features";
import { startAdaptiveQuality, stopAdaptiveQuality, restartAdaptiveQuality, adaptive, adaptiveReadActiveClean } from "./adaptive";
import { ensurePlayerControlsBinding, releasePlayerControlsBinding } from "./controls-button";
import { updateQualityButtons, createLiveSettingsPanel } from "./panels";
import { checkVipStatusAsync, cacheVipStatus, VIP_EVIDENCE, isLoginGateBlocking } from "./vip";
import { runContractSelfCheck, qualityFlowLabel } from "./diagnostics";

interface VipInfoResponse {
    code?: number;
    data?: { vip_type?: number; vip_status?: number } | null;
}
function readVipFromResponse(raw: unknown): boolean | null {
    const d = raw as VipInfoResponse | null;
    if (!d || d.code !== 0 || !d.data) return null;
    if (typeof d.data.vip_type !== "number" || typeof d.data.vip_status !== "number") return null;
    return d.data.vip_type > 0 && d.data.vip_status === 1;
}
const VIP_BACKFILL_MAX_AGE_MS = 10000;
const VIP_GATE_COALESCE_MS = 150;
const NO_LOGIN_SETTLE_MS = 5000;
const AVATAR_PROBE_INTERVAL_MS = 1000;
const VIP_GATE_FALLBACK_MS = 8000;

let pageGeneration = 0;
function pageChangedSince(generation: number): boolean {
    return generation !== pageGeneration;
}

type QualityFlowSnapshot = { outcome: QualityFlowOutcome; activeClean: string };
let qualityFlowSnapshot: QualityFlowSnapshot | null = null;
let qualityFlowSnapshotGeneration = -1;
function recordQualityFlowSnapshot(): void {
    qualityFlowSnapshot = { outcome: state.qualityFlow, activeClean: adaptiveReadActiveClean() };
    qualityFlowSnapshotGeneration = pageGeneration;
}

const CONTRACT_SELF_CHECK_DELAY_MS = 3000;
const CONTRACT_SELF_CHECK_SLOT = "contract-self-check";
let contractSelfCheckGeneration = -1;
function scheduleContractSelfCheck(taskId: number): void {
    const generation = pageGeneration;
    if (contractSelfCheckGeneration === generation) return;
    runSafely(taskQueue.scheduleTask(taskId, () => {
        if (getRealVisibilityState() !== "visible") return;
        if (pageChangedSince(generation)) return;
        contractSelfCheckGeneration = generation;
        runContractSelfCheck();
    }, CONTRACT_SELF_CHECK_DELAY_MS, CONTRACT_SELF_CHECK_SLOT), "契约自检");
}
const VIP_BACKFILL_SAFE_OUTCOME: Record<QualityFlowOutcome, boolean> = {
    switched: true,
    settled: true,
    stalled: true,
    abandoned: true,
    pending: false,
    delegated: false,
};
function vipBackfillBlockReason(initGeneration: number, gateOpenedAt: number): string | null {
    if (pageChangedSince(initGeneration)) return "本轮任务已被换页作废";
    const ageMs = Date.now() - gateOpenedAt;
    if (ageMs > VIP_BACKFILL_MAX_AGE_MS) return `接口迟到 ${Math.round(ageMs / 1000)} 秒`;
    const snapshot = qualityFlowSnapshotGeneration === initGeneration ? qualityFlowSnapshot : null;
    if (!snapshot) return "本轮画质流程尚未跑完";
    if (state.qualityFlow !== snapshot.outcome) {
        return `画质流程结论已从「${qualityFlowLabel(snapshot.outcome)}」变为「${qualityFlowLabel(state.qualityFlow)}」`;
    }
    if (!VIP_BACKFILL_SAFE_OUTCOME[state.qualityFlow]) return `本轮画质流程仍有人接手（${qualityFlowLabel(state.qualityFlow)}）`;
    if (adaptive.switching) return "降档引擎正在切换";
    const activeClean = adaptiveReadActiveClean();
    if (activeClean && activeClean !== snapshot.activeClean) {
        return `画质已被改为「${activeClean}」（本轮设定为「${snapshot.activeClean}」）`;
    }
    return null;
}

function refreshQualityPanel(): void {
    const panel = Utils.query("#bilibili-quality-selector");
    if (panel) updateQualityButtons(panel);
}
function settleLoadingLock(taskId: number, stage: string): void {
    if (taskId !== taskQueue.currentTaskId) return;
    if (!state.isLoading) {
        refreshQualityPanel();
        return;
    }
    state.isLoading = false;
    if (!isLoginGateBlocking()) {
        console.log(`[任务管理] ${stage}：本轮流程未跑到解锁点，解除面板加载锁定`);
        refreshQualityPanel();
        return;
    }
    console.log(`[会员状态] ${stage}：未登录且未开启未登录模式，本页按设计不自动设置画质；面板已解除锁定，画质偏好仍可自行修改`);
    if (!document.getElementById(BILI.video.playerRoot)) {
        releasePlayerControlsBinding();
        stopAdaptiveQuality();
    }
    runSafely(checkVipStatusAsync().then(refreshQualityPanel), "登录门收尾");
}

function isLiveNonRoomPage(): boolean {
    if (window.location.protocol === "file:") return false;
    const path = window.location.pathname;
    return path === "/" || path.startsWith("/p/");
}

function initPlayerScripts() {
    checkIfLivePage();
    if (state.isLivePage) {
        state.isLoading = false;
        if (isLiveNonRoomPage()) return;
        state.liveEntryForceHighest = state.userLiveQualitySetting === "最高画质";
        const initTaskId = taskQueue.currentTaskId;
        runSafely((async () => {
            createLiveSettingsPanel();
            await selectLiveQuality();
            if (taskQueue.isTaskCancelled(initTaskId)) return;
            applyDecodeSetting();
            if (state.liveQualityPollingEnabled) startLivePolling();
            if (state.liveKeepAliveEnabled) startLiveKeepAlive();
            scheduleContractSelfCheck(initTaskId);
        })(), "直播初始化");
    } else {
        applyAutoWidescreen();
        startAdaptiveQuality();
        ensurePlayerControlsBinding();

        const initTaskId = taskQueue.currentTaskId;
        const initGeneration = pageGeneration;
        let vipGateOpened = false;
        let vipCheckObserver: MutationObserver | null = null;
        let vipGateCoalesceTimer: ReturnType<typeof setTimeout> | null = null;
        let avatarProbeTimer: ReturnType<typeof setInterval> | null = null;
        const stopVipGateWatch = () => {
            if (vipCheckObserver) { vipCheckObserver.disconnect(); vipCheckObserver = null; }
            if (vipGateCoalesceTimer !== null) { clearTimeout(vipGateCoalesceTimer); vipGateCoalesceTimer = null; }
            if (avatarProbeTimer !== null) { clearInterval(avatarProbeTimer); avatarProbeTimer = null; }
        };
        const runQualityInit = () => {
            runSafely((async () => {
                try {
                    const outcome = await waitForPlayerWithBackoff(initTaskId, async () => {
                        state.isLoading = false;
                        await checkVipStatusAsync();
                        await selectVideoQuality();
                        recordQualityFlowSnapshot();
                        refreshQualityPanel();
                        applyDecodeSetting();
                    }, 5, 1000, 0);
                    settlePlayerWait(initTaskId, outcome);
                } finally {
                    settleLoadingLock(initTaskId, "画质初始化");
                }
            })(), "画质初始化");
        };
        const runVipGate = () => {
            // 未登录模式：跳过等待头像
            if (state.devModeEnabled && state.devModeNoLoginStatus) {
                stopVipGateWatch();
                vipGateOpened = true;
                console.log("[未登录模式] 跳过等待头像元素，直接执行画质设置");
                runQualityInit();
                return;
            }

            // 已登录：检测到头像
            const headerAvatar = document.querySelector(BILI.header.avatarWrap);
            if (headerAvatar) {
                stopVipGateWatch();
                // 头像已在则 3.5 秒超时必定放行，此处即可视为门已开
                vipGateOpened = true;
                const gateOpenedAt = Date.now();

                let timeoutId: ReturnType<typeof setTimeout> | null = null;
                let hasExecuted = false;
                let vipIconObserver: MutationObserver | null = null;

                const executeQualitySettings = () => {
                    if (hasExecuted) return;
                    hasExecuted = true;
                    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
                    if (vipIconObserver) { vipIconObserver.disconnect(); vipIconObserver = null; }
                    runQualityInit();
                };

                if (state.devModeEnabled && state.devModeVipStatus !== "默认") {
                    console.log("[会员状态] 开发者模式已模拟会员状态，跳过接口查询");
                } else {
                    fetch(BILI.api.vipInfo, { credentials: "include" })
                        .then(r => r.json() as Promise<unknown>)
                        .catch((e) => {
                            console.debug("[会员状态] VIP 接口请求失败，回退 DOM 检测:", e);
                            return null;
                        })
                        .then(raw => {
                            if (raw === null) return;
                            const isVip = readVipFromResponse(raw);
                            if (isVip === null) {
                                console.debug("[会员状态] VIP 接口未返回可用数据，回退 DOM 检测");
                                return;
                            }
                            cacheVipStatus(isVip, "API 接口", VIP_EVIDENCE.api);
                            if (!hasExecuted) {
                                executeQualitySettings();
                                return;
                            }
                            if (state.isVipUser === isVip) return;
                            const blockReason = vipBackfillBlockReason(initGeneration, gateOpenedAt);
                            if (blockReason) {
                                console.log(`[会员状态] 接口结果与当前页判定不一致，但${blockReason}，本页不回灌（缓存已更新，下个视频生效）`);
                                return;
                            }
                            console.log("[会员状态] 接口结果与当前页判定不一致，重新执行画质设置");
                            runSafely((async () => {
                                await checkVipStatusAsync();
                                if (pageChangedSince(initGeneration)) return;
                                await selectVideoQuality();
                                refreshQualityPanel();
                            })(), "会员状态回灌");
                        });
                }

                // 等待会员图标加载完成
                vipIconObserver = new MutationObserver((mutations, obs) => {
                    const vipElement = document.querySelector(BILI.header.bigVipIcon) ||
                        document.querySelector(BILI.header.smallVipIcon);
                    if (vipElement || mutations.some(m => (m.target as Element).classList && ((m.target as Element).classList.contains(BILI.header.bigVipIconClass) || (m.target as Element).classList.contains(BILI.header.smallVipIconClass)))) {
                        obs.disconnect();
                        console.log("[会员状态] 会员图标已加载，开始执行画质设置");
                        executeQualitySettings();
                    }
                });

                vipIconObserver.observe(headerAvatar, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class']
                });

                // 优先保证会员切换速度，因为非会员用户 1080P 的切换频率并不高，并且 3.5 秒其实与之前版本体验一致。
                    timeoutId = setTimeout(() => {
                    if (vipIconObserver) { vipIconObserver.disconnect(); vipIconObserver = null; }
                    console.log("[会员状态] 会员图标检测超时，继续执行画质设置");
                    executeQualitySettings();
                }, 3500);
            }
        };

        vipCheckObserver = new MutationObserver(() => {
            if (vipGateCoalesceTimer !== null) return;
            vipGateCoalesceTimer = setTimeout(() => {
                vipGateCoalesceTimer = null;
                runVipGate();
            }, VIP_GATE_COALESCE_MS);
        });
        vipCheckObserver.observe(document.body, { childList: true, subtree: true });
        runVipGate();
        setTimeout(() => {
            const observer = vipCheckObserver;
            if (vipGateOpened || !observer || !isLoginGateBlocking()) return;
            console.log("[会员状态] 登录入口在场且始终未见头像，判定为未登录，停止头部变更观察，改用轻量探测");
            observer.disconnect();
            vipCheckObserver = null;
            if (vipGateCoalesceTimer !== null) { clearTimeout(vipGateCoalesceTimer); vipGateCoalesceTimer = null; }
            settleLoadingLock(initTaskId, "会员门");
            avatarProbeTimer = setInterval(runVipGate, AVATAR_PROBE_INTERVAL_MS);
        }, NO_LOGIN_SETTLE_MS);
        setTimeout(() => {
            stopVipGateWatch();
            if (vipGateOpened) return;
            console.log("[会员状态] 等待头像元素超时，兜底执行画质设置");
            runQualityInit();
        }, VIP_GATE_FALLBACK_MS);
    }
}
export function installLifecycle(): void {
    if (document.readyState === "loading") {
        const bootGeneration = pageGeneration;
        window.addEventListener("DOMContentLoaded", () => {
            if (pageGeneration !== bootGeneration) {
                console.log("[生命周期] 启动期地址已变化，初始化交由换页流程接管");
                return;
            }
            initPlayerScripts();
        }, { once: true });
    } else {
        initPlayerScripts();
    }
}

const VISIBILITY_RETRY_OUTCOME: Record<QualityFlowOutcome, boolean> = {
    pending: true,
    stalled: true,
    switched: false,
    settled: false,
    abandoned: false,
    delegated: false,
};
let visibilityRecoverTimer: ReturnType<typeof setTimeout> | null = null;
// 切回前台兜底。劫持只改属性读取、不拦截事件，visibilitychange 仍照常触发
    document.addEventListener("visibilitychange", () => {
    if (getRealVisibilityState() !== "visible") return;

    checkIfLivePage();

    // 直播页：弹幕同步与画质纠正
    if (state.isLivePage) {
        if (state.liveDanmakuSync) syncLiveDanmaku();
        if (state.liveAutoRecoverOnVisible) {
            console.log("[可见性恢复] 直播页切回前台，重新切换画质");
            if (visibilityRecoverTimer) clearTimeout(visibilityRecoverTimer);
            visibilityRecoverTimer = setTimeout(() => runSafely((async () => {
                visibilityRecoverTimer = null;
                if (liveFacadeInfo()) {
                    await selectLiveQuality();
                }
            })(), "可见性恢复"), 800);
        }
        return;
    }

    // 视频页：画质尚未成功设置时重试
    if (!VISIBILITY_RETRY_OUTCOME[state.qualityFlow]) return;

    console.log(`[可见性恢复] 标签页变为可见，画质流程「${qualityFlowLabel(state.qualityFlow)}」，尝试重新触发`);

    if (visibilityRecoverTimer) clearTimeout(visibilityRecoverTimer);
    visibilityRecoverTimer = setTimeout(() => runSafely((async () => {
        visibilityRecoverTimer = null;
        if (!VISIBILITY_RETRY_OUTCOME[state.qualityFlow]) return;

        const taskId = taskQueue.generateTaskId();
        state.isLoading = !state.vipStatusChecked;

        try {
            const outcome = await waitForPlayerWithBackoff(taskId, async () => {
                if (taskQueue.isTaskCancelled(taskId)) return;
                state.isLoading = false;
                if (!VISIBILITY_RETRY_OUTCOME[state.qualityFlow]) { refreshQualityPanel(); return; }
                await checkVipStatusAsync();
                await selectVideoQuality();
                recordQualityFlowSnapshot();
                refreshQualityPanel();
                applyDecodeSetting();
            }, 5, 1000, 0);
            settlePlayerWait(taskId, outcome);
        } finally {
            settleLoadingLock(taskId, "可见性恢复");
        }
    })(), "可见性恢复"), 800);
});

function isPlayerReady() {
    const qualityMenu = document.querySelector(BILI.video.qualityMenu);
    const qualityItems = qualityMenu ? qualityMenu.querySelectorAll(BILI.video.qualityMenuItem) : null;
    const headerAvatar = document.querySelector(BILI.header.avatarWrap);

    const isReady = !!qualityItems && qualityItems.length > 0;

    console.log(`[播放器状态]
    - 画质菜单: ${qualityMenu ? '已加载' : '未加载'}
    - 画质选项: ${qualityItems ? `${qualityItems.length}个选项` : '未加载'}
    - 用户头像: ${headerAvatar ? '已加载' : '未加载（仅影响会员门，不影响就绪）'}`);

    return isReady;
}

function releasePlayerBindingsIfNotPlayerPage(taskId: number): boolean {
    if (state.isLivePage) return false;
    if (taskId !== taskQueue.currentTaskId || isLoginGateBlocking()) return false;
    if (document.getElementById(BILI.video.playerRoot)) return false;
    console.log("[生命周期] 当前地址没有播放器容器，释放控制栏观察器与降档引擎");
    releasePlayerControlsBinding();
    stopAdaptiveQuality();
    return true;
}

type PlayerWaitOutcome = "ready" | "exhausted" | "cancelled";
function settlePlayerWait(taskId: number, outcome: PlayerWaitOutcome): void {
    if (outcome === "cancelled") return;
    if (outcome === "exhausted" && releasePlayerBindingsIfNotPlayerPage(taskId)) return;
    scheduleContractSelfCheck(taskId);
}

async function waitForPlayerWithBackoff(taskId: number, callback: () => Promise<void>, maxRetries = 5, initialDelay = 1000, retryCount = 0): Promise<PlayerWaitOutcome> {
    if (taskQueue.isTaskCancelled(taskId)) {
        console.log(`[任务管理] 任务 #${taskId} 已取消，停止等待播放器`);
        return "cancelled";
    }

    if (isPlayerReady()) {
        console.log(`[任务管理] 任务 #${taskId}: 播放器和用户信息已就绪`);
        await callback();
        return "ready";
    }

    if (retryCount >= maxRetries) {
        console.log(`[任务管理] 任务 #${taskId}: 达到最大重试次数(${maxRetries})，强制执行回调`);
        await callback();
        return "exhausted";
    }

    const delayTime = initialDelay * Math.pow(2, retryCount);
    console.log(`[任务管理] 任务 #${taskId}: 等待播放器加载中 (第${retryCount + 1}次尝试，等待${delayTime}ms)`);

    let outcome: PlayerWaitOutcome = "cancelled";
    await taskQueue.scheduleTask(taskId, async () => {
        if (!taskQueue.isTaskCancelled(taskId)) {
            outcome = await waitForPlayerWithBackoff(taskId, callback, maxRetries, initialDelay, retryCount + 1);
        }
    }, delayTime);
    return outcome;
}

const CONTENT_URL_PARAMS = ["p", "bvid", "oid"];
function canonicalUrl(rawUrl: string) {
    try {
        const urlObj = new URL(rawUrl);
        const path = urlObj.pathname;
        let end = path.length;
        while (end > 0 && path.charCodeAt(end - 1) === 47 /* / */) end--;
        urlObj.pathname = end === path.length ? path : path.slice(0, end);
        urlObj.hash = "";
        const kept = CONTENT_URL_PARAMS.map(k => [k, urlObj.searchParams.get(k)]).filter(([, v]) => v !== null) as [string, string][];
        urlObj.search = "";
        kept.forEach(([k, v]) => urlObj.searchParams.set(k, v));
        return urlObj.toString();
    } catch (e) { return rawUrl; }
}
let lastCanonicalUrl = canonicalUrl(location.href);
type PatchedHistoryMethod = typeof history.pushState & { __baqLocationPatched?: boolean };
(function (history) {
    const pushState = history.pushState as PatchedHistoryMethod;
    if (pushState.__baqLocationPatched) return;
    const replaceState = history.replaceState;
    history.pushState = function (...args: Parameters<typeof history.pushState>) {
        const result = pushState.apply(history, args);
        window.dispatchEvent(new Event('baq:locationchange'));
        return result;
    };
    history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
        const result = replaceState.apply(history, args);
        window.dispatchEvent(new Event('baq:locationchange'));
        return result;
    };
    (history.pushState as PatchedHistoryMethod).__baqLocationPatched = true;
})(window.history);
async function onUrlChange() {
    const newUrl = canonicalUrl(location.href);
    if (newUrl === lastCanonicalUrl) return;

    lastCanonicalUrl = newUrl;
    pageGeneration++;
    const taskId = taskQueue.generateTaskId();
    console.log(`[URL变更] 开始新任务 #${taskId}, URL: ${newUrl}`);

    taskQueue.clearPreviousTasks();
    cancelDecodeRetry();
    // 换页作废挂起的前台恢复回调，避免与新任务并行
    if (visibilityRecoverTimer) {
        clearTimeout(visibilityRecoverTimer);
        visibilityRecoverTimer = null;
    }
    // 失败监听窗口与重试计数随页重置
    resetQualityFailWatch();
    // 会员状态已知时不再进入加载锁定，避免连播切换时面板闪烁“加载中”
    state.isLoading = !state.vipStatusChecked;
    state.qualityFlow = "pending";

    checkIfLivePage();
    // 不依赖画质流程，URL 变更后立即执行
    applyAutoWidescreen();
    restartAdaptiveQuality();
    stopLivePolling();
    stopLiveKeepAlive();
    // 播放器可能整体重建：把控制栏观察器换到新节点上；进直播页则释放
    if (state.isLivePage) {
        releasePlayerControlsBinding();
    } else {
        ensurePlayerControlsBinding();
    }

    refreshQualityPanel();

    try {
        await taskQueue.scheduleTask(taskId, async () => {
            if (taskQueue.isTaskCancelled(taskId)) return;
            if (state.isLivePage) {
                state.isLoading = false;
                if (isLiveNonRoomPage()) return;
                console.log(`[任务管理] 任务 #${taskId}: 直播页跳过视频版就绪等待`);
                state.liveEntryForceHighest = state.userLiveQualitySetting === "最高画质";
                createLiveSettingsPanel();
                await selectLiveQuality();
                if (taskQueue.isTaskCancelled(taskId)) return;
                applyDecodeSetting();
                if (state.liveQualityPollingEnabled) startLivePolling();
                if (state.liveKeepAliveEnabled) startLiveKeepAlive();
                refreshQualityPanel();
                scheduleContractSelfCheck(taskId);
                console.log(`[任务管理] 任务 #${taskId}: 画质设置完成`);
                return;
            }
            console.log(`[任务管理] 任务 #${taskId}: 开始检查播放器状态`);
            const outcome = await waitForPlayerWithBackoff(taskId, async () => {
                if (taskQueue.isTaskCancelled(taskId)) return;
                console.log(`[任务管理] 任务 #${taskId}: 播放器就绪，开始初始化画质设置`);
                state.isLoading = false;

                await checkVipStatusAsync();

                await selectVideoQuality();
                recordQualityFlowSnapshot();
                applyDecodeSetting();
                applyAutoWidescreen();
                refreshQualityPanel();
                console.log(`[任务管理] 任务 #${taskId}: 画质设置完成`);
            });
            settlePlayerWait(taskId, outcome);
        }, 1000);
    } catch (error) {
        console.error(`[任务管理] 任务 #${taskId}: 执行出错:`, error);
    } finally {
        settleLoadingLock(taskId, "URL变更");
    }
}
const urlChangeEvents = ['popstate', 'hashchange', 'baq:locationchange'];
const handleUrlChange = () => runSafely(onUrlChange(), "URL变更");
function bindUrlChangeListeners() {
    urlChangeEvents.forEach(eventName => {
        window.addEventListener(eventName, handleUrlChange);
    });
}
bindUrlChangeListeners();
window.addEventListener('pagehide', () => {
    stopLivePolling();
    stopLiveKeepAlive();
    stopAdaptiveQuality();
    releasePlayerControlsBinding();
    resetQualityFailWatch();
    urlChangeEvents.forEach(eventName => {
        window.removeEventListener(eventName, handleUrlChange);
    });
});
window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    bindUrlChangeListeners();
    console.log("[生命周期] 页面自 bfcache 恢复，重挂 URL 监听并重整当前页");
    checkIfLivePage();
    if (canonicalUrl(location.href) !== lastCanonicalUrl) {
        handleUrlChange();
        return;
    }
    if (state.isLivePage) {
        if (state.liveQualityPollingEnabled) startLivePolling();
        if (state.liveKeepAliveEnabled) startLiveKeepAlive();
        return;
    }
    ensurePlayerControlsBinding();
    restartAdaptiveQuality();
});
