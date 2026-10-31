import { BILI } from "./contract";
import { state, debugTransient } from "./settings";
import { updateDecodeButtons } from "./panels";

let decodeRetryTimer: ReturnType<typeof setTimeout> | null = null;
let decodeVerifyTimer: ReturnType<typeof setTimeout> | null = null;
export function cancelDecodeRetry() {
    if (decodeRetryTimer) {
        clearTimeout(decodeRetryTimer);
        decodeRetryTimer = null;
    }
    if (decodeVerifyTimer) {
        clearTimeout(decodeVerifyTimer);
        decodeVerifyTimer = null;
    }
}
const DECODE_RETRY_BUDGET_MS = 60000;
const DECODE_RETRY_MIN_DELAY_MS = 1000;
const DECODE_RETRY_MAX_DELAY_MS = 5000;
let decodeRetryDeadline = 0;
// 每档重复两次再翻倍：1,1,2,2,4,4,5,5…
function decodeRetryDelay(retryCount: number) {
    return Math.min(DECODE_RETRY_MIN_DELAY_MS * Math.pow(2, Math.floor(retryCount / 2)), DECODE_RETRY_MAX_DELAY_MS);
}
function decodeRetryExhausted() {
    return Date.now() >= decodeRetryDeadline;
}
function scheduleDecodeRetry(retryCount: number) {
    cancelDecodeRetry();
    decodeRetryTimer = setTimeout(() => {
        decodeRetryTimer = null;
        applyDecodeSetting(retryCount + 1);
    }, decodeRetryDelay(retryCount));
}
let decodeMissReported = false;
const DECODE_MAX_CLICK_ATTEMPTS = 3;
let decodeClickAttempts = 0;
const DECODE_LIVE_VERIFY_DELAY_MS = 1200;
function queryLiveDecodeList(): Element | null {
    const direct = document.querySelector(BILI.live.decodeList);
    if (direct) return direct;
    if (typeof document.querySelectorAll === "function") {
        const frames = document.querySelectorAll<HTMLIFrameElement>('iframe[src*="/blanc/"], iframe');
        for (const frame of Array.from(frames)) {
            try {
                const found = frame.contentDocument?.querySelector(BILI.live.decodeList);
                if (found) return found;
            } catch (e) { debugTransient(e); }
        }
    }
    return null;
}
export function applyDecodeSetting(retryCount = 0) {
    if (retryCount === 0) {
        cancelDecodeRetry();
        decodeRetryDeadline = Date.now() + DECODE_RETRY_BUDGET_MS;
        decodeMissReported = false;
        decodeClickAttempts = 0;
    }
    if (!state.decodeSettingEnabled) {
        console.log('[解码设置] 解码设置未启用，跳过');
        return;
    }
    const wanted = state.isLivePage ? (state.userLiveDecodeSetting || '默认') : (state.userVideoDecodeSetting || '默认');
    // 直播页：点击 UL 列表项
    if (state.isLivePage) {
        const decodeList = queryLiveDecodeList();
        if (!decodeList) {
            if (!decodeRetryExhausted()) {
                scheduleDecodeRetry(retryCount);
            } else {
                console.log("[解码设置] 未找到直播解码列表");
            }
            return;
        }
        const items = Array.from(decodeList.querySelectorAll(BILI.live.decodeItem));
        if (items.length === 0) {
            if (!decodeRetryExhausted()) {
                scheduleDecodeRetry(retryCount);
            } else {
                console.log('[解码设置] 直播解码选项为空');
            }
            return;
        }
        const selectedClass = BILI.live.decodeSelectedClass;
        const itemText = (li: Element) => (li.textContent || '').trim();
        let target = items.find(li => itemText(li).includes(wanted));
        if (!target && wanted === '默认') {
            target = items.find(li => BILI.decode.defaultTextPattern.test(itemText(li)));
        }
        if (!target) {
            if (!decodeMissReported) {
                decodeMissReported = true;
                const rendered = items.map(itemText).filter(Boolean);
                console.warn(`[解码设置] 直播页未匹配到「${wanted}」，当前可选项：${rendered.length ? rendered.join(' / ') : '空'}`);
            }
            if (!decodeRetryExhausted()) {
                scheduleDecodeRetry(retryCount);
            } else {
                console.log(`[解码设置] 直播页未找到目标编码「${wanted}」，保持当前设置`);
            }
            return;
        }
        const selectedCount = items.filter(li => li.classList.contains(selectedClass)).length;
        if (selectedCount !== 1) {
            console.warn(`[解码设置] 直播页选中状态异常（匹配 ${selectedCount} 项），跳过切换`);
        } else if (target.classList.contains(selectedClass)) {
            console.log('[解码设置] 直播页已是目标解码:', itemText(target));
        } else {
            console.log('[解码设置] 直播页切换解码为:', itemText(target));
            const clicked = target as HTMLElement;
            decodeClickAttempts++;
            clicked.click();
            decodeVerifyTimer = setTimeout(() => {
                decodeVerifyTimer = null;
                if (clicked.classList.contains(selectedClass)) {
                    debugTransient('[解码设置] 直播页解码点击已生效');
                    return;
                }
                console.warn(`[解码设置] 直播页解码切换可能未生效：${itemText(clicked)}`);
            }, DECODE_LIVE_VERIFY_DELAY_MS);
        }
    } else {
        // 视频页：点击 bui-radio 按钮
        const radioItems = Array.from(document.querySelectorAll(BILI.decode.radioItem));
        if (radioItems.length === 0) {
            if (!decodeRetryExhausted()) {
                scheduleDecodeRetry(retryCount);
            } else {
                console.log("[解码设置] 未找到视频页编码单选项");
            }
            return;
        }
        function getText(el: Element) {
            const t = el.querySelector(BILI.decode.radioText);
            return (t && t.textContent ? t.textContent : el.textContent || '').trim();
        }
        let target = radioItems.find(el => getText(el).includes(wanted));
        if (!target && wanted === '默认') {
            target = radioItems.find(el => BILI.decode.defaultTextPattern.test(getText(el)));
        }
        if (!target) {
            if (!decodeMissReported) {
                decodeMissReported = true;
                const rendered = radioItems.map(getText).filter(Boolean);
                console.warn(`[解码设置] 视频页未匹配到「${wanted}」，当前可选项：${rendered.length ? rendered.join(' / ') : '空'}`);
            }
            // 单选项非空不代表目标那一档已渲染，未命中计入重试
            if (!decodeRetryExhausted()) {
                scheduleDecodeRetry(retryCount);
            } else {
                console.log(`[解码设置] 视频页未找到目标编码「${wanted}」，保持当前设置`);
            }
            return;
        }
        // 若已选中则跳过
        const input = target.querySelector(BILI.decode.radioInput) as HTMLInputElement | null;
        if (!input) {
            console.warn('[解码设置] 视频页编码项内未找到单选框，跳过切换');
        } else if (input.checked) {
            console.log('[解码设置] 视频页已是目标解码:', getText(target));
        } else {
            console.log('[解码设置] 视频页切换解码为:', getText(target));
            decodeClickAttempts++;
            input.click();
            decodeVerifyTimer = setTimeout(() => {
                decodeVerifyTimer = null;
                if (input.checked) return;
                if (decodeClickAttempts >= DECODE_MAX_CLICK_ATTEMPTS) {
                    console.warn(`[解码设置] 视频页解码点击 ${decodeClickAttempts} 次仍未生效，站方可能拒绝了该编码，不再重试`);
                } else if (!decodeRetryExhausted()) {
                    console.log('[解码设置] 视频页解码点击未生效，稍后重试');
                    scheduleDecodeRetry(retryCount);
                } else {
                    console.warn('[解码设置] 视频页解码点击未生效，且已超过重试时限');
                }
            }, 0);
        }
    }
    const panel = document.getElementById('bilibili-decode-settings');
    if (panel) updateDecodeButtons(panel);
}
