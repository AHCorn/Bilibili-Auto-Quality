import { BILI } from "./contract";
import { SETTINGS, loadSetting, state, briefValue } from "./settings";

// 画质档位表（由高到低）
export const QUALITY_ORDER = [
    "8K",
    "杜比视界",
    "HDR",
    "4K",
    "SDR增强",
    "1080P 高码率",
    "1080P 60帧",
    "AI修复",
    "智能修复",
    "1080P 高清",
    "1080P",
    "720P 60帧",
    "720P",
    "480P",
    "360P",
    "默认"
];
export const HDR_QUALITIES = ["HDR", "杜比视界"];
export const NO_LOGIN_BLOCKED_QUALITIES = ["8K", "杜比视界", "HDR", "4K", "SDR增强"];
export const TRIAL_KEYWORDS = BILI.badge.trialKeywords;
const CLEAN_KEYWORDS = [BILI.badge.vipKeyword, ...TRIAL_KEYWORDS];

function escapeForRegExp(literal: string): string {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CLEAN_PATTERN = new RegExp(CLEAN_KEYWORDS.map(escapeForRegExp).join("|"), "g");
export function cleanQuality(q: string | null | undefined) {
    if (!q) return "";
    return q.replace(CLEAN_PATTERN, "").replace(/\s+/g, " ").trim();
}

function qualityTierIndex(name: string) {
    for (let i = 0; i < QUALITY_ORDER.length; i++) {
        if (name.includes(QUALITY_ORDER[i])) return i;
    }
    return -1;
}

export function qualityNameMatches(menuNameClean: string, target: string) {
    const targetTier = qualityTierIndex(target);
    if (targetTier === -1) return menuNameClean.includes(target);
    return qualityTierIndex(menuNameClean) === targetTier;
}

export function qualitySortRank(name: string) {
    const tier = qualityTierIndex(name);
    return tier === -1 ? QUALITY_ORDER.length : tier;
}

export const CUSTOM_HIGHEST = "最高画质";
export const CUSTOM_DEFAULT = "默认";
const CUSTOM_QUALITY_ITEMS = ["8K", "杜比视界", "HDR", "4K", "1080P 高码率", "1080P 60帧", "1080P 高清", "720P", "480P", "360P"];
export const VIP_QUALITIES = ["8K", "杜比视界", "HDR", "4K", "SDR增强", "1080P 高码率", "1080P 60帧"];
export const DEFAULT_CUSTOM_ORDER = [CUSTOM_HIGHEST, ...CUSTOM_QUALITY_ITEMS, CUSTOM_DEFAULT];

export function normalizeCustomOrder(order: unknown) {
    const known = new Set(DEFAULT_CUSTOM_ORDER);
    const seen = new Set<string>();
    const result: string[] = [];
    if (Array.isArray(order)) {
        order.forEach((q: unknown) => {
            if (known.has(q as string) && !seen.has(q as string)) { result.push(q as string); seen.add(q as string); }
        });
    }
    DEFAULT_CUSTOM_ORDER.forEach(q => { if (!seen.has(q)) { result.push(q); seen.add(q); } });
    return result;
}

export function customEffectiveCutoff(qualities: string[]) {
    const hi = qualities.indexOf(CUSTOM_HIGHEST);
    const def = qualities.indexOf(CUSTOM_DEFAULT);
    if (hi === -1) return def;
    if (def === -1) return hi;
    return Math.min(hi, def);
}

function loadCustomOrder() {
    let raw = loadSetting("customQualityOrder");
    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        } catch (e) {
            console.warn(`[设置] 自定义画质顺序解析失败（${briefValue(raw)}），已回退为默认顺序:`, e);
            raw = null;
        }
    }
    return normalizeCustomOrder(raw);
}

// state 存数组、GM 存 JSON 串，故不走 setSetting
export function writeCustomOrder(order: unknown): { order: string[]; saved: boolean } {
    const normalized = normalizeCustomOrder(order);
    const previous = state.customQualityOrder;
    state.customQualityOrder = normalized;
    try {
        GM_setValue(SETTINGS.customQualityOrder.key, JSON.stringify(normalized));
    } catch (e) {
        console.error("[设置] 自定义画质顺序写入存储失败:", e);
        state.customQualityOrder = previous;
        return { order: previous || normalizeCustomOrder(previous), saved: false };
    }
    return { order: normalized, saved: true };
}

export function saveCustomOrder(order: unknown) {
    return writeCustomOrder(order).order;
}

state.customQualityOrder = loadCustomOrder();
