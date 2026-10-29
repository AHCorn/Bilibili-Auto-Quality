
const UNKNOWN_IDENTITY = "未知";
function readScriptEnv() {
    try {
        if (typeof GM_info !== "undefined" && GM_info) {
            return {
                handler: typeof GM_info.scriptHandler === "string" && GM_info.scriptHandler
                    ? GM_info.scriptHandler
                    : UNKNOWN_IDENTITY,
                handlerVersion: typeof GM_info.version === "string" ? GM_info.version : "",
                scriptVersion: GM_info.script && typeof GM_info.script.version === "string"
                    ? GM_info.script.version
                    : UNKNOWN_IDENTITY,
            };
        }
    } catch (e) { /* 忽略读取异常 */ }
    return {
        handler: UNKNOWN_IDENTITY,
        handlerVersion: "",
        scriptVersion: UNKNOWN_IDENTITY,
    };
}
export const SCRIPT_ENV = readScriptEnv();
export function scriptEnvLabel(): string {
    return SCRIPT_ENV.handlerVersion ? `${SCRIPT_ENV.handler} ${SCRIPT_ENV.handlerVersion}` : SCRIPT_ENV.handler;
}

// 检查同步 GM 存储与样式 API
const missingStorageApis = ([
    ["GM_getValue", typeof GM_getValue === "function"],
    ["GM_setValue", typeof GM_setValue === "function"],
    ["GM_addStyle", typeof GM_addStyle === "function"],
] as Array<[string, boolean]>).filter(([, available]) => !available).map(([name]) => name);
if (missingStorageApis.length > 0) {
    console.error(
        `[环境检查] 当前脚本管理器未提供同步 GM 存储 API，缺少：${missingStorageApis.join("、")}。请使用 Tampermonkey 或 Violentmonkey。`
    );
}

export interface PageWindowBridge {
    bridged: boolean | null;
    fellBack: boolean;
    detail: string;
}
const fellBack = typeof unsafeWindow === "undefined";
if (fellBack) {
    globalThis.unsafeWindow = window as BiliWindow;
}
export const pageWindowBridge: PageWindowBridge = {
    bridged: fellBack ? false : (unsafeWindow === window ? null : true),
    fellBack,
    detail: fellBack
        ? "未取得（脚本管理器未提供 unsafeWindow，已回退脚本自身 window）"
        : unsafeWindow === window
            ? "unsafeWindow 与脚本 window 是同一对象"
            : "已取得页面真实 window",
};
if (pageWindowBridge.bridged === false) {
    console.warn(
        "[环境检查] 未取得页面真实 window，已回退到脚本自身 window；在隔离上下文中播放器接口、防后台降画质与 UA 修改可能无法生效。"
    );
}
