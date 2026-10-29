import "./env";
import { debugTransient } from "./settings";

// 防后台降画质：劫持 Page Visibility 四个属性为恒定可见
// 只改属性不拦截事件，避免破坏弹幕时间同步等依赖 visibilitychange 的功能
// 保存原 descriptor 以支持运行时切换（关闭时完全还原）
const VISIBILITY_PROPS = ["visibilityState", "hidden", "webkitVisibilityState", "webkitHidden"];
const HIJACKED_VALUES: Record<string, string | boolean> = {
    visibilityState: "visible",
    hidden: false,
    webkitVisibilityState: "visible",
    webkitHidden: false,
};

// 劫持后 visibilityState 恒为 "visible"，真实值须经劫持前捕获的原生 getter 读取
const nativeVisibilityStateGetter: ((this: Document) => string) | null = (() => {
    try {
        const desc = Object.getOwnPropertyDescriptor(unsafeWindow.Document.prototype, "visibilityState");
        return desc && desc.get ? desc.get as (this: Document) => string : null;
    } catch (e) {
        console.warn("[防后台降画质] 原生 visibilityState getter 捕获失败:", e);
        return null;
    }
})();

let hijackEnabled = false;
export function getRealVisibilityState(): string | null {
    try {
        if (nativeVisibilityStateGetter) return nativeVisibilityStateGetter.call(unsafeWindow.document);
    } catch (e) { debugTransient(e); }
    return hijackEnabled ? null : document.visibilityState;
}

let originalVisibilityDescriptors: Record<string, PropertyDescriptor | undefined> | null = null;

function consequenceOf(): string {
    if (!hijackEnabled) return "真实可见性可正常读取。";
    return nativeVisibilityStateGetter
        ? "真实可见性仍可经原生 getter 读取。"
        : "真实可见性已不可读，切回前台的相关逻辑将不再触发。";
}

export function applyVisibilityHijack(enable: boolean) {
    try {
        const proto = unsafeWindow.Document.prototype;
        if (enable) {
            hijackEnabled = true;
            if (!originalVisibilityDescriptors) {
                originalVisibilityDescriptors = {};
                for (const p of VISIBILITY_PROPS) originalVisibilityDescriptors[p] = Object.getOwnPropertyDescriptor(proto, p);
            }
            for (const p of VISIBILITY_PROPS) {
                if (!originalVisibilityDescriptors[p]) continue;
                const lie = HIJACKED_VALUES[p];
                Object.defineProperty(proto, p, { configurable: true, enumerable: true, get: () => lie });
            }
            console.log("[防后台降画质] 已启用");
        } else if (originalVisibilityDescriptors) {
            const failed: string[] = [];
            for (const p of VISIBILITY_PROPS) {
                try {
                    if (originalVisibilityDescriptors[p]) Object.defineProperty(proto, p, originalVisibilityDescriptors[p]);
                    else delete (proto as Document & Record<string, PropertyDescriptor | undefined>)[p];
                } catch (e) {
                    failed.push(p);
                    debugTransient(e);
                }
            }
            const nowDesc = Object.getOwnPropertyDescriptor(proto, "visibilityState");
            const nativeDesc = originalVisibilityDescriptors["visibilityState"];
            hijackEnabled = !!(nowDesc && nowDesc.get && nowDesc.get !== (nativeDesc && nativeDesc.get));
            const unrestored = failed.length > 0 ? failed : (hijackEnabled ? ["visibilityState"] : []);
            if (unrestored.length === 0) console.log("[防后台降画质] 已关闭");
            else console.warn(`[防后台降画质] 已关闭，但 ${unrestored.join("、")} 未能还原。${consequenceOf()}`);
        }
    } catch (e) {
        console.warn("[防后台降画质] 切换失败:", e, consequenceOf());
    }
}
