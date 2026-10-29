import { BILI } from "./contract";
import { state, getDoubleCheckConfig, PROD_AUDIO_DELAY_MS, PROD_AUDIO_RETRIES } from "./settings";
import { Utils, runSafely } from "./utils";
import { cleanQuality, qualityNameMatches, qualitySortRank, normalizeCustomOrder, CUSTOM_HIGHEST, CUSTOM_DEFAULT, TRIAL_KEYWORDS, HDR_QUALITIES, NO_LOGIN_BLOCKED_QUALITIES, QUALITY_ORDER } from "./quality-vocab";
import { taskQueue } from "./task-queue";
import { adaptive, adaptiveConfirmByFacade, adaptiveSettledElsewhere, adaptiveReadActiveClean, adaptiveHoldObservation, ADAPTIVE_FAIL_TOAST_PATTERN } from "./adaptive";
import { selectLiveQuality } from "./live";

export function selectQualityBasedOnSetting() {
    if (state.isLivePage) {
        runSafely(selectLiveQuality(), "直播画质");
    } else {
        runSafely(selectVideoQuality(), "画质设置");
    }
}

let audioToggleGraceUntil = 0;
export function audioToggleGraceActive() {
    const remaining = audioToggleGraceUntil - Date.now();
    return remaining > 0 && remaining <= QUALITY_FAIL_WATCH_WINDOW_MS;
}

type AudioToggleAttempt = { at: number; wasActive: boolean; converged: boolean };
const audioToggleAttempts = new Map<string, AudioToggleAttempt>();
const AUDIO_TOGGLE_EFFECT_MIN_MS = 1000;

async function setAudioQuality(taskId: number, retryCount = 0) {
    if (taskQueue.isTaskCancelled(taskId)) return;

    if (!state.isVipUser) {
        console.log("[音质设置] 非会员用户，略过音质设置");
        return;
    }

    const maxRetries = state.devModeEnabled ? state.devModeAudioRetries : PROD_AUDIO_RETRIES;
    const baseDelay = state.devModeEnabled ? state.devModeAudioDelay : PROD_AUDIO_DELAY_MS;
    const retryInterval = baseDelay * Math.pow(2, retryCount);

    function tryToggle(buttonSelector: string, shouldEnable: boolean, label: string): "clicked" | "missing" | "ok" {
        if (taskQueue.isTaskCancelled(taskId)) return "ok";

        const button = document.querySelector(buttonSelector);
        if (!button) {
            if (shouldEnable) console.log(`[音质设置] ${label}按钮尚未渲染，等待重试 (第${retryCount + 1}次尝试)`);
            return shouldEnable ? "missing" : "ok";
        }
        const isActive = button.classList.contains(BILI.video.ctrlActiveClass);
        const attempt = audioToggleAttempts.get(buttonSelector);
        if (attempt) {
            if (attempt.wasActive !== isActive) {
                audioToggleAttempts.delete(buttonSelector);
            } else if (attempt.converged || Date.now() - attempt.at >= AUDIO_TOGGLE_EFFECT_MIN_MS) {
                if (!attempt.converged) {
                    attempt.converged = true;
                    console.warn(`[音质设置] ${label}点击后选中态未变化，停止重试以免音轨反复中断（站方选中类名可能已变更）`);
                }
                return "ok";
            }
        }
        if (shouldEnable !== isActive) {
            console.log(`[音质设置] 检测到需${shouldEnable ? "开启" : "关闭"}${label} (第${retryCount + 1}次尝试)`);
            audioToggleAttempts.set(buttonSelector, { at: Date.now(), wasActive: isActive, converged: false });
            (button as HTMLElement).click();
            return "clicked";
        }
        return "ok";
    }

    console.log(`[音质设置] 开始第${retryCount + 1}次设置`);
    const hiResResult = tryToggle(BILI.video.flacButton, state.hiResAudioEnabled, "Hi-Res音质");
    const dolbyResult = tryToggle(BILI.video.dolbyButton, state.dolbyAtmosEnabled, "杜比全景声");
    if (hiResResult === "clicked" || dolbyResult === "clicked") {
        audioToggleGraceUntil = Date.now() + Math.min(baseDelay, QUALITY_FAIL_WATCH_WINDOW_MS);
    }

    if ([hiResResult, dolbyResult].some(r => r !== "ok") && retryCount < maxRetries) {
        console.log(`[音质设置] 等待 ${retryInterval / 1000} 秒后验证设置`);
        await taskQueue.scheduleTask(taskId, async () => {
            if (!taskQueue.isTaskCancelled(taskId)) {
                await setAudioQuality(taskId, retryCount + 1);
            }
        }, retryInterval, "audio-quality-retry");
    } else {
        console.log("[音质设置] 设置完成或达到最大重试次数");
    }
}

export type ParsedQualityMenuItem = {
    name: string;
    textName: string;
    element: HTMLElement;
    isVipOnly: boolean;
    isFreeNow: boolean;
};

export function isQualityItemActive(item: Element): boolean {
    return item.classList.contains(BILI.video.menuActiveClass)
        || !!item.querySelector("." + BILI.video.menuActiveClass);
}

export function findActiveQualityItem(root: ParentNode = document): Element | null {
    const items = root.querySelectorAll(BILI.video.qualityMenuItem);
    for (let i = 0; i < items.length; i++) {
        if (isQualityItemActive(items[i])) return items[i];
    }
    return root.querySelector(BILI.video.activeMenuItem);
}

export function readActiveQualityText(): string {
    const activeItem = findActiveQualityItem();
    if (activeItem) return parseQualityMenuItem(activeItem).textName;
    const el = document.querySelector(BILI.video.activeQualityText);
    return el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
}

function resolveMenuItemBadge(item: Element): Element | null {
    const ownBadge = item.querySelector(BILI.video.vipBadge);
    if (ownBadge) return ownBadge;
    if (item.classList.contains(BILI.video.vipVisionGroupItemClass)) {
        const menu = item.closest(BILI.video.qualityMenu);
        const groupTitle = menu ? menu.querySelector(BILI.video.vipVisionGroupTitle) : null;
        if (groupTitle) return groupTitle.querySelector(BILI.video.vipBadge);
    }
    return null;
}

export function parseQualityMenuItem(item: Element): ParsedQualityMenuItem {
    // 只在这儿查一次子元素，避免重复 querySelector
    const badge = resolveMenuItemBadge(item);
    const badgeText = badge ? (badge.textContent || "").trim() : "";
    const text = (item.textContent || "").replace(/\s+/g, " ").trim();
    const nameEl = item.querySelector(BILI.video.qualityText);
    let textName = ((nameEl ? nameEl.textContent : text) || "").replace(/\s+/g, " ").trim();
    const qn = parseInt(item.getAttribute(BILI.video.qnAttr) || "", 10);
    if ((qn === 126 || item.querySelector(BILI.video.vipVisionDolbyIcon)) && !textName.includes("杜比视界")) {
        textName = textName ? `${textName} 杜比视界` : "杜比视界";
    } else if ((qn === 125 || item.querySelector(BILI.video.vipVisionHdrIcon)) && !textName.includes("HDR")) {
        textName = textName ? `${textName} HDR` : "HDR";
    }
    const name = badgeText && !textName.includes(badgeText) ? `${textName} ${badgeText}` : (textName || text);
    const isGroupVipItem = item.classList.contains(BILI.video.vipVisionGroupItemClass);
    return {
        name,
        textName,
        element: item as HTMLElement,
        isVipOnly: !!badge || isGroupVipItem,
        isFreeNow: TRIAL_KEYWORDS.some(k => text.includes(k)) || !!(badgeText && TRIAL_KEYWORDS.some(k => badgeText.includes(k)))
    };
}
export function isQualityFilteredByDevMode(name: string) {
    if (state.devModeEnabled && state.disableHDROption && HDR_QUALITIES.some(q => name.includes(q))) return true;
    if (state.devModeEnabled && state.devModeNoLoginStatus && NO_LOGIN_BLOCKED_QUALITIES.some(q => name.includes(q))) return true;
    return false;
}
export function isQualityUsableForUser(q: ParsedQualityMenuItem) {
    if (state.isVipUser) return true;
    const allowFreeVip = state.devModeEnabled && state.devAllowFreeVipQualities;
    return allowFreeVip ? (!q.isVipOnly || q.isFreeNow) : (!q.isVipOnly && !q.isFreeNow);
}
const QUALITY_FAIL_WATCH_TICKS = 16;
const QUALITY_FAIL_WATCH_INTERVAL_MS = 500;
export const QUALITY_FAIL_WATCH_WINDOW_MS = (QUALITY_FAIL_WATCH_TICKS + 1) * QUALITY_FAIL_WATCH_INTERVAL_MS;
let qualityFailWatchTimer: ReturnType<typeof setInterval> | null = null;
let qualityFailRetryCount = 0;
const QUALITY_WAIT_RETRY_LIMIT = 3;
const QUALITY_WAIT_RETRY_DELAY_MS = 2000;
let qualityWaitRetryCount = 0;
export const qualityFailConsumedToasts = new WeakSet();

const QUALITY_MENU_RECOVERY_LIMIT = 2;
let qualityMenuRecoveryObserver: MutationObserver | null = null;
let qualityMenuRecoveryTarget: Element | null = null;
let qualityMenuRecoveryCount = 0;
function stopQualityMenuRecovery() {
    if (qualityMenuRecoveryObserver) {
        qualityMenuRecoveryObserver.disconnect();
        qualityMenuRecoveryObserver = null;
    }
    qualityMenuRecoveryTarget = null;
}
function retargetQualityMenuRecovery(): void {
    const observer = qualityMenuRecoveryObserver;
    if (!observer) return;
    const menu = document.querySelector(BILI.video.qualityMenu);
    if (!menu || menu === qualityMenuRecoveryTarget) return;
    observer.disconnect();
    qualityMenuRecoveryTarget = menu;
    observer.observe(menu, { childList: true, subtree: true });
    if (menu.parentElement) observer.observe(menu.parentElement, { childList: true });
}
function armQualityMenuRecovery(taskId: number) {
    stopQualityMenuRecovery();
    if (qualityMenuRecoveryCount >= QUALITY_MENU_RECOVERY_LIMIT) return;
    if (!document.querySelector(BILI.video.qualityMenu)) return;
    qualityMenuRecoveryObserver = new MutationObserver(() => {
        retargetQualityMenuRecovery();
        const menu = document.querySelector(BILI.video.qualityMenu);
        if (!menu || menu.querySelectorAll(BILI.video.qualityMenuItem).length === 0) return;
        stopQualityMenuRecovery();
        if (taskQueue.isTaskCancelled(taskId)) return;
        qualityMenuRecoveryCount++;
        console.log("[画质设置] 画质菜单已出现选项，重跑一次画质设置");
        runSafely(selectVideoQuality(), "画质菜单就绪重试");
    });
    retargetQualityMenuRecovery();
}

export function resetQualityFailWatch() {
    if (qualityFailWatchTimer) {
        clearInterval(qualityFailWatchTimer);
        qualityFailWatchTimer = null;
    }
    qualityFailRetryCount = 0;
    qualityWaitRetryCount = 0;
    // 观察器绑在上一页的菜单节点上，留着只会对新页的旧节点空转
    stopQualityMenuRecovery();
    qualityMenuRecoveryCount = 0;
    audioToggleGraceUntil = 0;
    audioToggleAttempts.clear();
}
function watchQualitySwitchFailure(taskId: number, targetClean: string, targetQn: number | null) {
    if (qualityFailWatchTimer) { clearInterval(qualityFailWatchTimer); qualityFailWatchTimer = null; }
    adaptiveHoldObservation(Date.now() + QUALITY_FAIL_WATCH_WINDOW_MS);
    Utils.queryAll(BILI.video.toastText).forEach(el => {
        if (ADAPTIVE_FAIL_TOAST_PATTERN.test(el.textContent || "")) qualityFailConsumedToasts.add(el);
    });
    let ticks = 0;
    const startedAt = Date.now();
    qualityFailWatchTimer = setInterval(() => {
        if (taskQueue.isTaskCancelled(taskId)
            || Date.now() - startedAt >= QUALITY_FAIL_WATCH_WINDOW_MS
            || ++ticks > QUALITY_FAIL_WATCH_TICKS) {
            clearInterval(qualityFailWatchTimer!);
            qualityFailWatchTimer = null;
            return;
        }
        const facadeConfirmed = adaptiveConfirmByFacade(targetQn);
        const switchConfirmed = facadeConfirmed !== null
            ? facadeConfirmed
            : !!targetClean && adaptiveReadActiveClean() === targetClean;
        if (switchConfirmed) {
            clearInterval(qualityFailWatchTimer!);
            qualityFailWatchTimer = null;
            qualityFailRetryCount = 0;
            return;
        }
        if (adaptive.switching) {
            Utils.queryAll(BILI.video.toastText).forEach(el => {
                if (ADAPTIVE_FAIL_TOAST_PATTERN.test(el.textContent || "")) qualityFailConsumedToasts.add(el);
            });
            return;
        }
        const failToast = Utils.queryAll(BILI.video.toastText).find(el =>
            ADAPTIVE_FAIL_TOAST_PATTERN.test(el.textContent || "") && !qualityFailConsumedToasts.has(el));
        if (!failToast) return;
        qualityFailConsumedToasts.add(failToast);
        if (audioToggleGraceActive() && adaptiveSettledElsewhere(targetQn) !== true) return;
        clearInterval(qualityFailWatchTimer!);
        qualityFailWatchTimer = null;
        state.qualityFlow = "pending";
        qualityFailRetryCount++;
        if (qualityFailRetryCount >= 2) {
            console.warn("[画质设置] 连续切换失败已达上限，保持当前画质等待手动处理");
            state.qualityFlow = "abandoned";
            return;
        }
        console.log(`[画质设置] 检测到 B 站切换失败提示，重试画质设置（第 ${qualityFailRetryCount} 次）`);
        runSafely(taskQueue.scheduleTask(taskId, async () => {
            if (taskQueue.isTaskCancelled(taskId)) return;
            if (adaptive.switching) {
                taskQueue.cancelSlot("video-quality-double-check");
                state.qualityFlow = "delegated";
                return;
            }
            await selectVideoQuality();
        }, 1200, "video-quality-fail-retry"), "画质失败重试");
    }, QUALITY_FAIL_WATCH_INTERVAL_MS);
}
function collectAvailableQualities(): ParsedQualityMenuItem[] | null {
    const qualityMenu = document.querySelector(BILI.video.qualityMenu);
    if (!qualityMenu) return null;

    const qualityItems = Array.from(
        qualityMenu.querySelectorAll(BILI.video.qualityMenuItem)
    );

    const availableQualities = qualityItems.map(parseQualityMenuItem)
        .filter(q => !isQualityFilteredByDevMode(q.name))
        .filter(q => !q.textName.includes(BILI.video.autoQualityKeyword));
    // 未登录模式下过滤掉高于1080P的画质
    if (state.devModeEnabled && state.devModeNoLoginStatus) {
        console.log("[未登录模式] 已过滤高于1080P的画质，可用画质:", availableQualities.map(q => q.name));
    }

    console.log("[画质设置] 可用画质:", availableQualities.map(q => q.name));
    console.log("[画质设置] 会员状态:", state.isVipUser ? "是" : "否");
    return availableQualities;
}

export type VideoQualityDecision =
    | { kind: "switch"; target: ParsedQualityMenuItem }
    | { kind: "settle" }
    | { kind: "wait" };

type QualityBranchResult =
    | { decision: VideoQualityDecision }
    | { target: ParsedQualityMenuItem | null | undefined; guardDowngrade: boolean };

function keepCurrentDecision(availableQualities: ParsedQualityMenuItem[], message: string): VideoQualityDecision {
    console.log(message);
    return availableQualities.length > 0 ? { kind: "settle" } : { kind: "wait" };
}

function resolveCustomSortBranch(availableQualities: ParsedQualityMenuItem[]): QualityBranchResult {
    const order = normalizeCustomOrder(state.customQualityOrder);
    const cutoff = order.indexOf(CUSTOM_HIGHEST);
    const prefs = order.slice(0, cutoff);
    let targetQuality: ParsedQualityMenuItem | null | undefined;
    let useDefault = false;
    for (const pref of prefs) {
        if (pref === CUSTOM_DEFAULT) {
            useDefault = true;
            break;
        }
        const match = availableQualities.find(q => isQualityUsableForUser(q) && qualityNameMatches(cleanQuality(q.name), pref));
        if (match) { targetQuality = match; break; }
    }
    if (useDefault) {
        console.log("[画质设置] 自定义顺序命中“默认”，使用默认画质");
        return { decision: { kind: "settle" } };
    }
    let usedFallback = false;
    if (!targetQuality) {
        const ordered = state.isVipUser ? availableQualities : [...availableQualities].sort((a, b) => qualitySortRank(a.name) - qualitySortRank(b.name));
        targetQuality = ordered.find(isQualityUsableForUser) || null;
        usedFallback = true;
    }
    if (!targetQuality) {
        return { decision: keepCurrentDecision(availableQualities, "[画质设置] 自定义顺序未匹配到可用画质，保持当前画质") };
    }
    console.log("[画质设置] 自定义模式目标画质: " + targetQuality.name + (usedFallback ? "（兜底最高画质）" : ""));
    return { target: targetQuality, guardDowngrade: usedFallback };
}

function resolveHighestBranch(availableQualities: ParsedQualityMenuItem[]): QualityBranchResult {
    const hasFreeVip = availableQualities.some(q => q.isFreeNow);
    const allowFreeVipForNonVip = state.devModeEnabled && state.devAllowFreeVipQualities;
    let targetQuality: ParsedQualityMenuItem | null | undefined;
    if (state.isVipUser) {
        targetQuality = availableQualities[0];
    } else if (hasFreeVip && allowFreeVipForNonVip) {
        // 非会员在允许试用时，选择首个“试用/限免”或首个非会员画质
        targetQuality = availableQualities.find(q => q.isFreeNow) || availableQualities.find(q => !q.isVipOnly);
    } else {
        availableQualities.sort((a, b) => qualitySortRank(a.name) - qualitySortRank(b.name));
        targetQuality = availableQualities.find(isQualityUsableForUser);
        if (!targetQuality) {
            return { decision: keepCurrentDecision(availableQualities, "[画质设置] 未找到可用画质，保持当前画质") };
        }
    }
    return { target: targetQuality, guardDowngrade: true };
}

function resolveNamedBranch(availableQualities: ParsedQualityMenuItem[]): QualityBranchResult {
    const namedMatch = availableQualities.find(q => qualityNameMatches(cleanQuality(q.name), state.userQualitySetting));
    let targetQuality = namedMatch && isQualityUsableForUser(namedMatch) ? namedMatch : undefined;
    if (namedMatch && !targetQuality) {
        console.log("[画质设置] 目标画质为会员专属且当前不可用，转入兜底选择");
    }
    let usedFallback = false;
    if (!targetQuality) {
        usedFallback = true;
        if (!namedMatch) console.log("[画质设置] 未找到目标画质 " + state.userQualitySetting);
        if (!targetQuality && state.useHighestQualityFallback) {
            const allowFreeVipForNonVip = state.devModeEnabled && state.devAllowFreeVipQualities;
            targetQuality = state.isVipUser
                ? availableQualities[0]
                : (allowFreeVipForNonVip
                    ? (availableQualities.find(q => q.isFreeNow) || availableQualities.find(q => !q.isVipOnly))
                    : availableQualities.find(q => !q.isVipOnly && !q.isFreeNow));
        }
        if (!targetQuality) {
            return { decision: keepCurrentDecision(availableQualities, "[画质设置] 未找到可用画质，保持当前画质") };
        }
    }
    return { target: targetQuality, guardDowngrade: usedFallback };
}

function shouldPreventDowngrade(availableQualities: ParsedQualityMenuItem[], currentQuality: string, targetQuality: ParsedQualityMenuItem): boolean {
    const currentClean = cleanQuality(currentQuality);
    if (currentClean
        && !currentClean.includes(BILI.video.autoQualityKeyword)
        && qualitySortRank(currentClean) >= QUALITY_ORDER.length) {
        console.log(`[画质设置] 防护触发：当前画质 ${currentQuality} 不在档位词表内，无从判定与目标 ${targetQuality.name} 的高低，放弃切换`);
        return true;
    }
    const currentQualityItem = availableQualities.find(q => cleanQuality(q.textName || q.name) === currentClean);
    const currentQualityIndex = currentQualityItem ? availableQualities.indexOf(currentQualityItem) : -1;
    const targetQualityIndex = availableQualities.indexOf(targetQuality);
    if (currentQualityIndex !== -1 && targetQualityIndex > currentQualityIndex) {
        console.log(`[画质设置] 防护触发：当前画质 ${currentQuality} (数组索引${currentQualityIndex}) 高于目标 ${targetQuality.name} (数组索引${targetQualityIndex})，放弃切换`);
        return true;
    }
    return false;
}

export function resolveVideoQualityTarget(availableQualities: ParsedQualityMenuItem[], currentQuality: string, waitRetryAvailable = true): VideoQualityDecision {
    let branch: QualityBranchResult;
    if (state.customSortEnabled) {
        branch = resolveCustomSortBranch(availableQualities);
    } else if (state.userQualitySetting === "最高画质") {
        branch = resolveHighestBranch(availableQualities);
    } else if (state.userQualitySetting === "默认") {
        console.log("[画质设置] 使用默认画质");
        branch = { decision: { kind: "settle" } };
    } else {
        branch = resolveNamedBranch(availableQualities);
    }
    if ("decision" in branch) return branch.decision;

    const targetQuality = branch.target;
    if (!targetQuality || !targetQuality.element) {
        console.warn("[画质设置] 没有可执行的目标画质，等待下次重试");
        return { kind: "wait" };
    }
    console.log("[画质设置] 实际目标画质: " + targetQuality.name);

    // 避免将更高画质切换到更低画质
// 获取到的可用画质数组按从高到低排序，索引越大画质越低
    if (branch.guardDowngrade) {
        const currentReadable = !!(currentQuality && currentQuality.trim());
        if (!currentReadable && waitRetryAvailable) {
            console.log("[画质设置] 读不到当前画质，本轮不做兜底切换以免降档，等待下次重试");
            return { kind: "wait" };
        }
        if (!currentReadable) {
            console.warn("[画质设置] 仍读不到当前画质，防降档无法判定，按目标画质继续切换");
        } else if (shouldPreventDowngrade(availableQualities, currentQuality, targetQuality)) {
            return { kind: "settle" };
        }
    }

    return { kind: "switch", target: targetQuality };
}

function readSettledCurrentQn(): number | null {
    const activeItem = findActiveQualityItem();
    if (!activeItem) return null;
    const raw = parseInt(activeItem.getAttribute(BILI.video.qnAttr) || "", 10);
    const qn = Number.isFinite(raw) && raw > 0 ? raw : null;
    return adaptiveConfirmByFacade(qn) === true ? qn : null;
}

async function verifyQualitySwitch(taskId: number, targetQualityNameClean: string, targetQn: number | null, fromQn: number | null) {
    if (taskQueue.isTaskCancelled(taskId)) return;

    const currentQualityAfterSwitch = readActiveQualityText();
    const facadeConfirmed = adaptiveConfirmByFacade(targetQn);
    const facadeSettledElsewhere = adaptiveSettledElsewhere(targetQn);
    let verdict;
    if (facadeConfirmed === true) verdict = "ok";
    else if (facadeSettledElsewhere === true) {
        verdict = adaptiveConfirmByFacade(fromQn) === false ? "yield" : "reswitch";
    } else if (facadeConfirmed === false) verdict = "skip";
    else if (currentQualityAfterSwitch) verdict = cleanQuality(currentQualityAfterSwitch) !== cleanQuality(targetQualityNameClean) ? "reswitch" : "ok";
    else verdict = "skip";

    if (verdict === "reswitch") {
        console.log("[画质设置] 画质切换未成功，执行二次切换...");
        // 重新打开清晰度菜单并重新定位目标项，避免旧元素失效
        const qualityButton = document.querySelector(BILI.video.qualityCtrlButton + ":not(.baq-injected)");
        if (qualityButton) {
            (qualityButton as HTMLElement).click();
            await Utils.delay(80);
        }
        const qualityMenu = document.querySelector(BILI.video.qualityMenu);
        if (qualityMenu) {
            const freshItems = Array.from(qualityMenu.querySelectorAll(BILI.video.qualityMenuItem));
            const freshTarget = (targetQn && freshItems.find(item => parseInt(item.getAttribute(BILI.video.qnAttr) || "", 10) === targetQn))
                || freshItems.find(item => {
                    const text = parseQualityMenuItem(item).textName;
                    return !text.includes(BILI.video.autoQualityKeyword)
                        && qualityNameMatches(cleanQuality(text), targetQualityNameClean);
                });
            if (freshTarget && !taskQueue.isTaskCancelled(taskId)) {
                (freshTarget as HTMLElement).click();
                watchQualitySwitchFailure(taskId, targetQualityNameClean, targetQn);
            } else if (!freshTarget) {
                console.warn("[画质设置] 无法重新定位目标画质元素:", targetQualityNameClean);
                state.qualityFlow = "pending";
            }
        } else {
            console.warn("[画质设置] 画质菜单未打开，无法执行二次切换");
            state.qualityFlow = "pending";
        }
    } else if (verdict === "ok") {
        console.log("[画质设置] 画质切换验证成功，当前画质: " + (currentQualityAfterSwitch || targetQualityNameClean));
    } else if (verdict === "yield") {
        console.log("[画质设置] 画质已被改为 " + (currentQualityAfterSwitch || "其它档位") + "（非本脚本所切），不再纠正");
    } else {
        console.log("[画质设置] 二次验证暂无法定论，跳过判定");
    }
}

async function executeQualitySwitch(taskId: number, targetQuality: ParsedQualityMenuItem) {
    const targetQualityNameClean = cleanQuality(targetQuality.textName || targetQuality.name);
    const targetQnRaw = parseInt(targetQuality.element.getAttribute(BILI.video.qnAttr) || "", 10);
    const targetQn = Number.isFinite(targetQnRaw) && targetQnRaw > 0 ? targetQnRaw : null;
    const fromQn = readSettledCurrentQn();
    targetQuality.element.click();
    state.qualityFlow = "switched";
    watchQualitySwitchFailure(taskId, targetQualityNameClean, targetQn);

    // 二次验证逻辑
    const { enabled, delayMs } = getDoubleCheckConfig(false);
    if (enabled) {
        console.log(`[画质设置] 等待 ${delayMs} 毫秒后进行二次验证...`);
        runSafely(taskQueue.scheduleTask(taskId, () => verifyQualitySwitch(taskId, targetQualityNameClean, targetQn, fromQn), delayMs, "video-quality-double-check"), "画质二次验证");
    } else {
        console.log("[画质设置] 二次验证已关闭，跳过验证");
    }
}

export async function selectVideoQuality() {
    const taskId = taskQueue.currentTaskId;
    const currentQuality = readActiveQualityText();
    console.log("[画质设置] 当前画质:", currentQuality);
    console.log("[画质设置] 目标画质:", state.userQualitySetting);

    // 确保会员状态已检查
    if (!state.vipStatusChecked) {
        console.log("[画质设置] 等待会员状态检查完成");
        return;
    }

    const availableQualities = collectAvailableQualities();
    if (!availableQualities) {
        console.warn("[画质设置] 未找到画质菜单节点，终止本次切换");
        return;
    }

    const waitRetryAvailable = qualityWaitRetryCount < QUALITY_WAIT_RETRY_LIMIT;
    const decision = resolveVideoQualityTarget(availableQualities, currentQuality, waitRetryAvailable);
    if (decision.kind === "switch") {
        await executeQualitySwitch(taskId, decision.target);
    } else {
        taskQueue.cancelSlot("video-quality-double-check");
        if (decision.kind === "settle") {
            state.qualityFlow = "settled";
        } else if (waitRetryAvailable) {
            qualityWaitRetryCount++;
            console.log(`[画质设置] 暂无可执行目标，${QUALITY_WAIT_RETRY_DELAY_MS} 毫秒后重试（第 ${qualityWaitRetryCount} 次）`);
            runSafely(taskQueue.scheduleTask(taskId, async () => {
                if (taskQueue.isTaskCancelled(taskId)) return;
                await selectVideoQuality();
            }, QUALITY_WAIT_RETRY_DELAY_MS, "video-quality-wait-retry"), "画质等待重试");
        } else {
            console.warn(`[画质设置] 等待重试已达上限（${QUALITY_WAIT_RETRY_LIMIT} 次），本轮放弃，等画质菜单就绪、切回前台或换页再试`);
            state.qualityFlow = "stalled";
            armQualityMenuRecovery(taskId);
        }
    }
    runSafely(setAudioQuality(taskId), "音质设置");
}

