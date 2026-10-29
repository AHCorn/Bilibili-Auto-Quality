import { BILI } from "./contract";
import { state } from "./settings";
import { findActiveQualityItem, parseQualityMenuItem } from "./video-quality";

export const VIP_EVIDENCE = { dom: 1, api: 2 };
let cachedVipPriority = 0;
// 缓存结果
export function cacheVipStatus(isVip: boolean, source: string, priority = VIP_EVIDENCE.dom) {
    if (priority < cachedVipPriority) {
        console.log("[会员状态] 忽略弱于现有依据的缓存写入:", source, "| 现有依据:", state.sessionCache.vipSource);
        return;
    }
    cachedVipPriority = priority;
    state.sessionCache.vipStatus = isVip;
    state.sessionCache.vipChecked = true;
    state.sessionCache.vipSource = source;
}
export async function checkVipStatusAsync() {
    if (state.devModeEnabled && (state.devModeNoLoginStatus || state.devModeVipStatus !== "默认")) {
        // 未登录模式下直接返回非会员状态
        if (state.devModeNoLoginStatus) {
            state.isVipUser = false;
            state.vipStatusChecked = true;
            console.log("[开发者模式] 未登录模式，用户会员状态: 否");
            return;
        }

        // 模拟大会员状态
        state.isVipUser = state.devModeVipStatus === "会员";
        state.vipStatusChecked = true;
        console.log("[开发者模式] 用户会员状态:", state.isVipUser ? "是" : "否");
        return;
    }

    // 直接使用缓存的结果
    if (state.sessionCache.vipChecked) {
        state.isVipUser = state.sessionCache.vipStatus!;
        state.vipStatusChecked = true;
        console.log("[会员状态] 用户会员状态:", state.isVipUser ? "是" : "否");
        console.log("[会员状态] 判定依据:", state.sessionCache.vipSource || "会话缓存");
        return;
    }

    // 默认状态：不干预，保持原有检测逻辑
    const reason = detectVipByDOM();
    state.isVipUser = !!reason;
    state.vipStatusChecked = true;
    if (reason) {
        cacheVipStatus(true, "DOM 检测（" + reason + "）");
    }
    console.log("[会员状态] 用户会员状态:", state.isVipUser ? "是" : "否");
    if (reason) {
        console.log("[会员状态] 判定依据:", reason);
    }
}

// API 未命中时的 DOM 回退检测：查询会员图标和画质 badge
function detectVipByDOM() {
    if (document.querySelector(BILI.header.bigVipIcon) ||
        document.querySelector(BILI.header.smallVipIcon)) {
        return "发现会员图标";
    }
    const activeItem = findActiveQualityItem();
    if (activeItem) {
        const parsed = parseQualityMenuItem(activeItem);
        if (parsed.isVipOnly && !parsed.isFreeNow) {
            return "当前使用会员画质";
        }
    }
    return null;
}

export function isLoginGateBlocking(): boolean {
    if (state.isLivePage) return false;
    if (state.devModeEnabled && state.devModeNoLoginStatus) return false;
    if (document.querySelector(BILI.header.avatarWrap)) return false;
    const entry = document.querySelector(BILI.header.loginEntry);
    return !!entry && entry.getClientRects().length > 0;
}
