// ==UserScript==
// @name         哔哩哔哩自动画质
// @namespace    https://github.com/AHCorn/Bilibili-Auto-Quality/
// @version      6.2.1-Beta
// @license      GPL-3.0
// @description  自动解锁并更改哔哩哔哩视频的画质和音质及直播画质，实现自动选择最高画质、无损音频、杜比全景声。
// @author       安和（AHCorn）
// @icon         https://www.bilibili.com/favicon.ico
// @match        *://www.bilibili.com/video/*
// @match        *://www.bilibili.com/list/*
// @match        *://www.bilibili.com/blackboard/*
// @match        *://www.bilibili.com/watchlater/*
// @match        *://www.bilibili.com/bangumi/*
// @match        *://www.bilibili.com/watchroom/*
// @match        *://www.bilibili.com/medialist/*
// @match        *://bangumi.bilibili.com/*
// @match        *://live.bilibili.com/*
// @exclude      *://live.bilibili.com/
// @exclude      *://live.bilibili.com/p/*
// @noframes
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @updateURL    https://github.com/AHCorn/Bilibili-Auto-Quality/raw/main/Bilibili-Auto-Quality-Beta.user.js
// @downloadURL  https://github.com/AHCorn/Bilibili-Auto-Quality/raw/main/Bilibili-Auto-Quality-Beta.user.js
// ==/UserScript==

(async function () {
    "use strict";
    if (typeof unsafeWindow === "undefined") { unsafeWindow = window; }

    // 防后台降画质：劫持 Page Visibility 四个属性为恒定可见
    // 只改属性不拦截事件，避免破坏弹幕时间同步等依赖 visibilitychange 的功能
    // 保存原 descriptor 以支持运行时切换（关闭时完全还原）
    const VISIBILITY_PROPS = ["visibilityState", "hidden", "webkitVisibilityState", "webkitHidden"];
    let originalVisibilityDescriptors = null;
    function applyVisibilityHijack(enable) {
        try {
            const proto = unsafeWindow.Document.prototype;
            if (enable) {
                if (!originalVisibilityDescriptors) {
                    originalVisibilityDescriptors = {};
                    for (const p of VISIBILITY_PROPS) originalVisibilityDescriptors[p] = Object.getOwnPropertyDescriptor(proto, p);
                }
                const visibleDesc = { configurable: true, enumerable: true, get: () => "visible" };
                const hiddenDesc = { configurable: true, enumerable: true, get: () => false };
                Object.defineProperty(proto, "visibilityState", visibleDesc);
                Object.defineProperty(proto, "hidden", hiddenDesc);
                Object.defineProperty(proto, "webkitVisibilityState", visibleDesc);
                Object.defineProperty(proto, "webkitHidden", hiddenDesc);
                console.log("[防后台降画质] 已启用");
            } else if (originalVisibilityDescriptors) {
                for (const p of VISIBILITY_PROPS) {
                    if (originalVisibilityDescriptors[p]) Object.defineProperty(proto, p, originalVisibilityDescriptors[p]);
                    else delete proto[p];
                }
                console.log("[防后台降画质] 已关闭");
            }
        } catch (e) {
            console.warn("[防后台降画质] 切换失败:", e);
        }
    }
    applyVisibilityHijack(GM_getValue("preventBackgroundDegrade", true));

    const state = {
        hiResAudioEnabled: GM_getValue("hiResAudio", false),
        dolbyAtmosEnabled: GM_getValue("dolbyAtmos", false),
        userQualitySetting: GM_getValue("qualitySetting", "最高画质"),
        useHighestQualityFallback: GM_getValue("useHighestQualityFallback", true),
        customSortEnabled: GM_getValue("customSortEnabled", false),
        customQualityOrder: null,
        takeOverQualityControl: GM_getValue("takeOverQualityControl", false),
        // 解锁相关设置
        unlockUA: GM_getValue("unlockUA", false),
        unlockHDR: GM_getValue("unlockHDR", false),
        unlockMarker: GM_getValue("unlockMarker", true),
        disableHDROption: GM_getValue("disableHDR", false),
        isVipUser: false,
        vipStatusChecked: false,
        isLoading: true,
        isLivePage: false,
        liveEntryForceHighest: false,
        // 防后台降画质相关
        preventBackgroundDegrade: GM_getValue("preventBackgroundDegrade", true),
        liveAutoRecoverOnVisible: GM_getValue("liveAutoRecoverOnVisible", false),
        userLiveQualitySetting: GM_getValue("liveQualitySetting", "最高画质"),
        userLiveDecodeSetting: GM_getValue("liveDecodeSetting", "默认"),
        userVideoDecodeSetting: GM_getValue("videoDecodeSetting", "默认"),
        decodeSettingEnabled: GM_getValue("decodeSettingEnabled", false),
        devModeEnabled: GM_getValue("devModeEnabled", false),
        devModeVipStatus: GM_getValue("devModeVipStatus", "默认"),
        devModeNoLoginStatus: GM_getValue("devModeNoLoginStatus", false),
        preserveTouchPoints: GM_getValue("preserveTouchPoints", false),
        devModeAudioRetries: GM_getValue("devModeAudioRetries", 2),
        devModeAudioDelay: GM_getValue("devModeAudioDelay", 5000),
        devDoubleCheckDelay: GM_getValue("devDoubleCheckDelay", 10000),
        devAllowFreeVipQualities: GM_getValue("devAllowFreeVipQualities", false),
        injectQualityButton: GM_getValue("injectQualityButton", true),
        qualityDoubleCheck: GM_getValue("qualityDoubleCheck", true),
        liveQualityDoubleCheck: GM_getValue("liveQualityDoubleCheck", true),
        liveQualityPollingEnabled: GM_getValue("liveQualityPollingEnabled", false),
        livePollingInterval: GM_getValue("livePollingInterval", 60),
        livePollingTimerId: null,
        liveKeepAliveEnabled: GM_getValue("liveKeepAliveEnabled", false),
        liveKeepAliveInterval: GM_getValue("liveKeepAliveInterval", 60),
        liveKeepAliveTimerId: null,
        qualitySetSuccessfully: false,
        autoWidescreen: GM_getValue("autoWidescreen", false),
        liveDanmakuSync: GM_getValue("liveDanmakuSync", false),
        sessionCache: {
            vipStatus: null,
            vipChecked: false
        }
    };
    // 应用解锁相关本地标记
    try {
        if (state.unlockHDR) {
            window.localStorage.bilibili_player_force_hdr = 1;
        }
        if (state.unlockMarker) {
            const baseKey = 'bilibili_player_force_DolbyAtmos&8K';
            const hdrKey = baseKey + '&HDR';
            const finalKey = state.unlockHDR ? hdrKey : baseKey;
            window.localStorage[finalKey] = 1;
        }
    } catch (e) {
        console.warn('[解锁设置] 写入本地标记失败:', e);
    }
    function detectPointerType() {
        try {
            const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
            const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
            const anyHover = window.matchMedia('(any-hover: hover)').matches;
            const supportsTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
            console.log(`[解锁设置] 设备检测 Pointer: fine=${hasFinePointer}, coarse=${hasCoarsePointer}`);
            console.log(`[解锁设置] 设备检测 Hover: ${anyHover}`);
            console.log(`[解锁设置] 设备检测 Touch: ${supportsTouch}`);
            return {
                isMouseDevice: hasFinePointer && anyHover,
                isTouchDevice: hasCoarsePointer && supportsTouch
            };
        } catch (error) {
            console.error("[解锁设置] 设备检测失败，返回默认桌面模式");
            return { isMouseDevice: true, isTouchDevice: false };
        }
    }
    try {
        if (state.unlockUA) {
            Object.defineProperty(navigator, 'userAgent', {
                value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15",
                configurable: true
            });
            Object.defineProperty(navigator, 'platform', {
                value: "MacIntel",
                configurable: true
            });
            console.log("[解锁设置] UA 和平台标识修改成功");
        } else {
            console.log("[解锁设置] 未开启 UA 修改");
        }
        if (state.unlockUA && state.devModeEnabled && state.preserveTouchPoints) {
            console.log("[解锁设置] 已启用保留触控点，跳过 maxTouchPoints 修改");
        } else if (state.unlockUA) {
            const pointerType = detectPointerType();
            console.log(`[解锁设置] 设备检测结果: 鼠标=${pointerType.isMouseDevice}, 触控=${pointerType.isTouchDevice}`);
            if (pointerType.isMouseDevice && !pointerType.isTouchDevice) {
                Object.defineProperty(navigator, 'maxTouchPoints', {
                    value: 0,
                    configurable: true
                });
                console.log("[解锁设置] 纯鼠标设备，已设置 maxTouchPoints 为 0");
            } else {
                console.log(`[解锁设置] 保留 maxTouchPoints 原值: ${navigator.maxTouchPoints}，原因: ` +
                            `${pointerType.isTouchDevice ? "检测到触控设备" : "无精确鼠标指针"}`);
            }
        }
    } catch (error) {
        console.error("[解锁设置] 修改 UA 或 maxTouchPoints 失败:", error);
    }
    GM_addStyle(`
    #bilibili-quality-selector, #bilibili-live-quality-selector, #bilibili-dev-settings, #bilibili-unlock-settings, #bilibili-decode-settings {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #f6f8fa, #e9ecef);
        border-radius: 24px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.14), 0 8px 24px rgba(0, 0, 0, 0.10);
        padding: 30px;
        width: 90%;
        max-width: 400px;
        max-height: 85vh;
        overflow-y: auto;
        overflow-x: hidden;
        display: none;
        z-index: 10000;
        font-family: 'Segoe UI', 'Roboto', sans-serif;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    .vip-status-section {
        background: #ffffff;
        border-radius: 16px;
        padding: 15px;
        margin-bottom: 16px;
        border: 1px solid #e5e7eb;
        transition: all 0.2s ease;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.02);
    }

    .vip-status-title {
        font-size: 16px;
        color: #3c4043;
        font-weight: 600;
        margin-bottom: 4px;
    }
    .vip-status-description {
        font-size: 13px;
        color: #666;
        margin-bottom: 12px;
        line-height: 1.4;
    }
    .vip-status-tabs {
        display: flex;
        border-radius: 12px;
        background: #eef0f3;
        padding: 4px;
        position: relative;
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
    }
    .vip-status-tabs.disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }
    .vip-tab-indicator {
        position: absolute;
        top: 4px;
        left: 4px;
        width: calc((100% - 8px) / 3);
        height: calc(100% - 8px);
        border-radius: 9px;
        background: #00a1d6;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.10);
        transition: transform 0.28s cubic-bezier(0.2, 0, 0, 1), background-color 0.28s ease, box-shadow 0.28s ease;
        z-index: 0;
    }
    .vip-status-tab {
        flex: 1;
        padding: 8px;
        text-align: center;
        cursor: pointer;
        border-radius: 9px;
        transition: color 0.2s ease;
        color: #5f6368;
        font-weight: 600;
        font-size: 15px;
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        -webkit-user-select: none;
        user-select: none;
    }
    .vip-status-tabs:not(.disabled) .vip-status-tab:not(.active):hover {
        color: #3c4043;
    }
    .vip-status-tabs.disabled .vip-status-tab {
        cursor: not-allowed;
    }
    .vip-status-tabs[data-active="默认"] .vip-tab-indicator { transform: translateX(0); background: #00a1d6; box-shadow: 0 1px 2px rgba(0, 161, 214, 0.30), 0 2px 8px rgba(0, 161, 214, 0.22); }
    .vip-status-tabs[data-active="普通"] .vip-tab-indicator { transform: translateX(100%); background: #6b7280; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.20), 0 2px 8px rgba(0, 0, 0, 0.12); }
    .vip-status-tabs[data-active="会员"] .vip-tab-indicator { transform: translateX(200%); background: #f25d8e; box-shadow: 0 1px 2px rgba(242, 93, 142, 0.30), 0 2px 8px rgba(242, 93, 142, 0.24); }
    .vip-status-tabs[data-active="默认"] .vip-status-tab[data-status="默认"],
    .vip-status-tabs[data-active="普通"] .vip-status-tab[data-status="普通"],
    .vip-status-tabs[data-active="会员"] .vip-status-tab[data-status="会员"] { color: #fff; }
    .quality-button-hidden {
        display: none !important;
    }
    .toggle-switch.hide {
        display: none;
    }
    .toggle-switch.show {
        display: flex;
    }
    #bilibili-quality-selector h2, #bilibili-live-quality-selector h2, #bilibili-decode-settings h2 {
        margin: 0 0 20px;
        color: #00a1d6;
        font-size: 28px;
        text-align: center;
        font-weight: 700;
    }
    .quality-group {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
        gap: 12px;
        margin-bottom: 25px;
    }
    .quality-button {
        background-color: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 10px 8px;
        font-size: 14px;
        color: #3c4043;
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: 600;
        text-align: center;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.02);
    }
    .quality-button:hover {
        background-color: #f7f9fb;
        transform: translateY(-2px);
        box-shadow: 0 3px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.035);
    }
    .quality-button.active {
        background-color: #00a1d6;
        color: white;
        border-color: #00a1d6;
        box-shadow: 0 6px 12px rgba(0, 161, 214, 0.3);
    }
    .quality-button.active.vip-quality {
        background-color: #f25d8e;
        color: white;
        border-color: #f25d8e;
        box-shadow: 0 6px 12px rgba(242, 93, 142, 0.3);
    }
    .quality-button.cq-grid-item {
        position: relative;
        will-change: transform;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
    }
    .quality-button.cq-grid-item:hover { transform: none; }
    .cq-grid-item .cq-rank {
        position: absolute;
        top: 4px;
        left: 7px;
        color: #00a1d6;
        font-size: 12px;
        font-weight: 800;
        opacity: 0;
        transform: scale(0.6);
        transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.2, 0, 0, 1);
        pointer-events: none;
        z-index: 2;
    }
    .quality-group.cq-dragging .cq-grid-item .cq-rank { opacity: 1; transform: scale(1); }
    .cq-grid-item.cq-vip .cq-rank { color: #f25d8e; }
    .cq-grid-item.cq-fallback {
        background: #f0f9ff;
        border-color: #38bdf8;
        color: #0284c7;
        box-shadow: inset 0 0 0 1.5px #38bdf8;
    }
    .cq-grid-item .cq-tag {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #0ea5e9;
        font-size: 0;
        overflow: hidden;
        z-index: 2;
    }
    .cq-grid-item.cq-dimmed {
        opacity: 0.5;
        filter: grayscale(1);
    }
    .cq-grid-item.cq-dimmed .cq-rank { color: #aeb4bb; }
    .cq-grid-item.cq-press { transform: scale(0.94); }
    .cq-grid-item.dragging {
        cursor: grabbing;
        z-index: 30;
        opacity: 1 !important;
        filter: none !important;
        box-shadow: 0 16px 32px rgba(0,0,0,0.20), 0 6px 16px rgba(0,0,0,0.12);
        transition: box-shadow 0.2s ease, background-color 0.2s ease, color 0.2s ease;
    }
    .cq-hint {
        font-size: 12px;
        color: #8a9099;
        line-height: 1.5;
        margin: 2px 2px 18px;
        text-align: center;
    }
    .cq-collapse {
        display: grid;
        grid-template-rows: 1fr;
        transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .cq-collapse > .cq-collapse-inner {
        overflow: hidden;
        min-height: 0;
        opacity: 1;
        transition: opacity 0.24s ease;
    }
    .cq-collapse.collapsed { grid-template-rows: 0fr; }
    .cq-collapse.collapsed > .cq-collapse-inner { opacity: 0; }
    .toggle-switch {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding: 10px 15px;
        border-radius: 12px;
        transition: background-color 0.2s ease, box-shadow 0.2s ease;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.02);
    }
    .toggle-switch:hover {
        background-color: #f7f9fb;
        box-shadow: 0 3px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.035);
    }
    .toggle-switch label {
        font-size: 16px;
        color: #3c4043;
        font-weight: 600;
        cursor: pointer;
    }
    .switch {
        position: relative;
        display: inline-block;
        width: 52px;
        height: 28px;
        flex-shrink: 0;
    }
    .switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    .slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background-color: #d1d5db;
        transition: background-color 0.25s ease, box-shadow 0.2s ease;
        border-radius: 999px;
    }
    .slider:before {
        position: absolute;
        content: "";
        height: 22px;
        width: 22px;
        left: 3px;
        top: 3px;
        background-color: #fff;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.08);
        transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1);
        border-radius: 50%;
    }
    input:checked + .slider {
        background-color: #00a1d6;
    }
    input:checked + .slider.vip-audio {
        background-color: #f25d8e;
    }
    input:checked + .slider:before {
        transform: translateX(24px);
    }
    input:focus-visible + .slider {
        box-shadow: 0 0 0 3px rgba(0, 161, 214, 0.35);
    }
    input:focus-visible + .slider.vip-audio {
        box-shadow: 0 0 0 3px rgba(242, 93, 142, 0.35);
    }
    input:disabled + .slider {
        opacity: 0.5;
        cursor: not-allowed;
    }
    input:disabled + .slider:before {
        box-shadow: none;
    }
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes slideIn {
        from { transform: translate(-50%, -60%); }
        to { transform: translate(-50%, -50%); }
    }
    #bilibili-quality-selector.show, #bilibili-live-quality-selector.show, #bilibili-decode-settings.show {
        display: block;
        animation: fadeIn 0.3s ease-out, slideIn 0.3s ease-out;
    }
    @media (max-width: 480px) {
        #bilibili-quality-selector, #bilibili-live-quality-selector, #bilibili-dev-settings, #bilibili-unlock-settings, #bilibili-decode-settings {
            width: 95%;
            padding: 20px;
            max-height: 80vh;
        }
        .quality-group {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }
        .quality-button {
            padding: 8px 6px;
            font-size: 13px;
        }
        .live-quality-button {
            padding: 10px 6px;
            font-size: 14px;
        }
        .toggle-switch {
            padding: 8px 12px;
            margin-bottom: 8px;
        }
        .toggle-switch label {
            font-size: 14px;
        }
        .toggle-switch .description {
            font-size: 12px;
        }
        .input-group {
            padding: 12px;
            margin-bottom: 12px;
        }
        .input-group label {
            font-size: 14px;
        }
        .input-group .description {
            font-size: 12px;
        }
        .github-link {
            top: 20px;
            right: 20px;
            width: 20px;
            height: 20px;
        }
        #bilibili-decode-settings .quality-group {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }
        #bilibili-decode-settings .quality-button {
            padding: 10px 8px;
            font-size: 14px;
        }
        h2 {
            font-size: 24px !important;
            margin-bottom: 15px !important;
        }
        .dev-warning {
            font-size: 13px;
            padding: 12px;
            margin-bottom: 15px;
        }
        .warning {
            font-size: 13px;
            padding: 8px;
            margin: 8px 0;
        }
        .status-bar {
            font-size: 13px;
            padding: 8px;
            margin-bottom: 12px;
        }
        .quality-section-title {
            font-size: 15px;
            margin: 15px 0 12px;
        }
    }
    @media (max-height: 600px) {
        #bilibili-quality-selector, #bilibili-live-quality-selector, #bilibili-dev-settings, #bilibili-unlock-settings {
            max-height: 90vh;
            padding: 15px;
        }
        .quality-group {
            margin-bottom: 15px;
        }
        .toggle-switch {
            margin-bottom: 6px;
        }
        .input-group {
            margin-bottom: 10px;
        }
    }
    .status-bar {
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 15px;
        text-align: center;
        font-weight: bold;
        transition: all 0.5s ease;
    }
    .status-bar.non-vip {
        background-color: #f0f0f0;
        color: #666666;
    }
    .status-bar.vip {
        background-color: #fff1f5;
        color: #f25d8e;
    }
    .warning {
        background-color: #fce8e6;
        color: #d93025;
        padding: 10px;
        border-radius: 8px;
        margin-top: 12px;
        margin-bottom: 12px;
        text-align: center;
        font-weight: bold;
        transition: all 0.3s ease;
    }
    .warning::before {
        content: "";
        margin-right: 10px;
    }
    /* 只改和基础面板不一样的部分 */
    #bilibili-dev-settings {
        background: linear-gradient(135deg, #ffffff, #f8f9fa);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.16), 0 10px 28px rgba(0, 0, 0, 0.10);
        padding: 32px;
        max-width: 440px;
    }
    #bilibili-dev-settings.show, #bilibili-unlock-settings.show {
        display: block;
        animation: fadeIn 0.3s ease-out, slideIn 0.3s ease-out;
    }
    #bilibili-dev-settings h2 {
        margin: 0 0 24px;
        color: #f25d8e;
        font-size: 28px;
        text-align: center;
        font-weight: 700;
        letter-spacing: -0.5px;
        text-shadow: 0 2px 4px rgba(242, 93, 142, 0.1);
    }
    #bilibili-dev-settings .dev-warning {
        background: linear-gradient(135deg, #fff1f5, #fce8e6);
        color: #d93025;
        padding: 14px 18px;
        border-radius: 16px;
        margin-bottom: 24px;
        text-align: center;
        font-weight: 600;
        font-size: 14px;
        border: 2px solid rgba(217, 48, 37, 0.1);
        box-shadow: 0 4px 12px rgba(217, 48, 37, 0.05);
    }
    #bilibili-dev-settings .toggle-switch, #bilibili-unlock-settings .toggle-switch {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding: 10px 15px;
        background-color: #ffffff;
        border-radius: 12px;
        transition: all 0.2s ease;
        border: 1px solid #e5e7eb;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.02);
    }
    #bilibili-dev-settings .toggle-switch .description, #bilibili-unlock-settings .toggle-switch .description {
        font-size: 13px;
        color: #666;
        margin-top: 4px;
    }
    #bilibili-dev-settings .toggle-switch label, #bilibili-unlock-settings .toggle-switch label, #bilibili-live-quality-selector .toggle-switch label {
        display: flex;
        flex-direction: column;
        font-size: 16px;
        color: #3c4043;
        font-weight: 600;
    }
    #bilibili-dev-settings .input-group, #bilibili-unlock-settings .input-group, #bilibili-live-quality-selector .input-group {
        background: #ffffff;
        border-radius: 16px;
        padding: 15px;
        margin-bottom: 16px;
        border: 1px solid #e5e7eb;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.02);
    }
    #bilibili-dev-settings .input-group.disabled, #bilibili-unlock-settings .input-group.disabled, #bilibili-live-quality-selector .input-group.disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    #bilibili-dev-settings .input-group:hover, #bilibili-unlock-settings .input-group:hover, #bilibili-live-quality-selector .input-group:hover {
        background: #f9fafb;
        border-color: #e1e7ef;
        box-shadow: 0 3px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.035);
    }
    #bilibili-dev-settings .input-group label, #bilibili-unlock-settings .input-group label, #bilibili-live-quality-selector .input-group label {
        flex: 1;
        display: flex;
        flex-direction: column;
        color: #3c4043;
        font-weight: 600;
        font-size: 15px;
    }
    #bilibili-dev-settings .input-group .description, #bilibili-unlock-settings .input-group .description {
        font-size: 13px;
        color: #666;
        margin-top: 4px;
        font-weight: normal;
    }
    #bilibili-dev-settings .num-stepper,
    #bilibili-unlock-settings .num-stepper,
    #bilibili-live-quality-selector .num-stepper {
        flex-shrink: 0;
        display: inline-flex;
        align-items: stretch;
        width: 168px;
        height: 40px;
        border: 1.5px solid #dadce0;
        border-radius: 10px;
        background: #ffffff;
        overflow: hidden;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    #bilibili-dev-settings .num-stepper:focus-within,
    #bilibili-unlock-settings .num-stepper:focus-within,
    #bilibili-live-quality-selector .num-stepper:focus-within {
        border-color: #00a1d6;
        box-shadow: 0 0 0 3px rgba(0, 161, 214, 0.18);
    }
    #bilibili-dev-settings .num-stepper:focus-within {
        border-color: #f25d8e;
        box-shadow: 0 0 0 3px rgba(242, 93, 142, 0.18);
    }
    #bilibili-dev-settings .ns-btn,
    #bilibili-unlock-settings .ns-btn,
    #bilibili-live-quality-selector .ns-btn {
        flex-shrink: 0;
        width: 38px;
        padding: 0;
        border: none;
        background: transparent;
        color: #5f6368;
        font-size: 20px;
        font-weight: 500;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s ease, color 0.15s ease;
        -webkit-user-select: none;
        user-select: none;
        touch-action: manipulation;
    }
    #bilibili-dev-settings .ns-btn:hover,
    #bilibili-unlock-settings .ns-btn:hover,
    #bilibili-live-quality-selector .ns-btn:hover {
        background: #f1f3f4;
        color: #202124;
    }
    #bilibili-dev-settings .ns-btn:active,
    #bilibili-unlock-settings .ns-btn:active,
    #bilibili-live-quality-selector .ns-btn:active {
        background: #e8eaed;
    }
    #bilibili-dev-settings .ns-btn:hover {
        background: #fdeef3;
        color: #f25d8e;
    }
    #bilibili-dev-settings .ns-btn:active {
        background: #f9d9e5;
    }
    #bilibili-dev-settings .ns-btn:disabled,
    #bilibili-unlock-settings .ns-btn:disabled,
    #bilibili-live-quality-selector .ns-btn:disabled {
        color: #c8ccd1;
        background: transparent;
        cursor: default;
    }
    #bilibili-dev-settings .input-group.disabled .ns-btn,
    #bilibili-unlock-settings .input-group.disabled .ns-btn,
    #bilibili-live-quality-selector .input-group.disabled .ns-btn {
        pointer-events: none;
        color: #c8ccd1;
    }
    #bilibili-dev-settings .ns-field,
    #bilibili-unlock-settings .ns-field,
    #bilibili-live-quality-selector .ns-field {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        padding: 0 6px;
        border-left: 1px solid #eceef1;
        border-right: 1px solid #eceef1;
    }
    #bilibili-dev-settings .ns-field input[type="number"],
    #bilibili-unlock-settings .ns-field input[type="number"],
    #bilibili-live-quality-selector .ns-field input[type="number"] {
        width: 1ch;
        min-width: 1ch;
        max-width: 100%;
        border: none;
        outline: none;
        background: transparent;
        padding: 0;
        margin: 0;
        text-align: center;
        font-size: 14px;
        font-weight: 600;
        color: #3c4043;
        -moz-appearance: textfield;
        appearance: textfield;
    }
    #bilibili-dev-settings .ns-field input[type="number"]::-webkit-inner-spin-button,
    #bilibili-dev-settings .ns-field input[type="number"]::-webkit-outer-spin-button,
    #bilibili-unlock-settings .ns-field input[type="number"]::-webkit-inner-spin-button,
    #bilibili-unlock-settings .ns-field input[type="number"]::-webkit-outer-spin-button,
    #bilibili-live-quality-selector .ns-field input[type="number"]::-webkit-inner-spin-button,
    #bilibili-live-quality-selector .ns-field input[type="number"]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    #bilibili-dev-settings .ns-field .unit,
    #bilibili-unlock-settings .ns-field .unit,
    #bilibili-live-quality-selector .ns-field .unit {
        flex-shrink: 0;
        color: #9aa0a6;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
    }
    #bilibili-dev-settings .refresh-button {
        width: 100%;
        padding: 12px;
        background: #f25d8e;
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-top: 20px;
    }
    #bilibili-dev-settings .refresh-button:hover {
        background: #e74d7b;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(242, 93, 142, 0.2);
    }
    #bilibili-dev-settings .refresh-button:disabled {
        background: #ccc;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
    }
    #bilibili-dev-settings input:checked + .slider {
        background-color: #f25d8e;
    }
    #bilibili-dev-settings input:focus-visible + .slider {
        box-shadow: 0 0 0 3px rgba(242, 93, 142, 0.35);
    }
    #bilibili-unlock-settings h2 {
        margin: 0 0 24px;
        color: #00a1d6;
        font-size: 28px;
        text-align: center;
        font-weight: 700;
        letter-spacing: -0.5px;
        text-shadow: 0 2px 4px rgba(0, 161, 214, 0.1);
    }
    #bilibili-unlock-settings .refresh-button {
        width: 100%;
        padding: 12px;
        background: #00a1d6;
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-top: 20px;
    }
    #bilibili-unlock-settings .refresh-button:hover {
        background: #0090bd;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 161, 214, 0.2);
    }
    #bilibili-unlock-settings .refresh-button:disabled {
        background: #ccc;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
    }
    @media (max-width: 480px) {
        #bilibili-dev-settings, #bilibili-unlock-settings {
            width: 95%;
            padding: 24px;
        }
        #bilibili-dev-settings .toggle-switch,
        #bilibili-dev-settings .input-group,
        #bilibili-unlock-settings .toggle-switch,
        #bilibili-unlock-settings .input-group {
            padding: 14px 16px;
        }
    }
    .bpx-player-ctrl-quality.quality-button-hidden {
        display: none !important;
    }
    .auto-quality-injected::after {
        content: "自动画质面板";
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(21, 21, 21, 0.9);
        color: #fff;
        padding: 5px 8px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
        margin-bottom: 5px;
    }
    .auto-quality-injected:hover::after {
        opacity: 1;
    }
    .github-link {
        position: absolute;
        top: 30px;
        right: 30px;
        width: 24px;
        height: 24px;
        cursor: pointer;
        transition: transform 0.3s ease;
    }
    .github-link:hover {
        transform: scale(1.1);
    }
    .github-link svg {
        width: 100%;
        height: 100%;
        fill: #00a1d6;
    }
    #bilibili-dev-settings .github-link svg { fill: #f25d8e; }
    #bilibili-unlock-settings .github-link svg { fill: #00a1d6; }
    .quality-section-title {
        font-size: 16px;
        color: #00a1d6;
        font-weight: 600;
        margin: 20px 0 15px;
        padding-bottom: 8px;
        border-bottom: 2px solid rgba(0, 161, 214, 0.1);
    }
    .live-quality-group {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-bottom: 25px;
    }
    .live-quality-button {
        background-color: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 12px 8px;
        font-size: 15px;
        color: #3c4043;
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: 600;
        text-align: center;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.02);
    }
    .live-quality-button:hover {
        background-color: #f7f9fb;
        transform: translateY(-2px);
        box-shadow: 0 3px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.035);
    }

    .status-bar, .warning { box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.02); }
    .live-quality-button.active {
        background-color: #00a1d6;
        color: white;
        border-color: #00a1d6;
        box-shadow: 0 6px 12px rgba(0, 161, 214, 0.3);
    }
    #bilibili-live-quality-selector .toggle-switch .description,
    #bilibili-live-quality-selector .input-group .description {
        font-size: 13px;
        color: #666;
        margin-top: 4px;
        font-weight: normal;
    }
    .beta-tag {
        display: inline-block;
        padding: 1px 6px;
        margin-left: 8px;
        font-size: 10px;
        font-weight: 600;
        color: #8a94a6;
        background: #eef1f5;
        border-radius: 4px;
        vertical-align: middle;
        letter-spacing: 0.5px;
    }
    #bilibili-decode-settings .quality-group {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        margin-bottom: 0;
    }
    #bilibili-decode-settings .quality-button {
        padding: 12px 10px;
        font-size: 15px;
    }
    /* 没启用时整块禁用 */
    #bilibili-decode-settings .decode-strategy {
        margin-top: 20px;
        transition: opacity 0.25s ease;
    }
    #bilibili-decode-settings .decode-strategy.disabled {
        opacity: 0.45;
        pointer-events: none;
    }
    #bilibili-quality-selector,
    #bilibili-live-quality-selector,
    #bilibili-dev-settings,
    #bilibili-unlock-settings,
    #bilibili-decode-settings {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
    `);
    const Utils = {
        debounce(fn, wait) {
            let timeout;
            return function (...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => fn.apply(this, args), wait);
            };
        },
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        query(selector, parent = document) {
            return parent.querySelector(selector);
        },
        queryAll(selector, parent = document) {
            return Array.from(parent.querySelectorAll(selector));
        }
    };
    const PANEL_IDS = [
        "bilibili-quality-selector",
        "bilibili-live-quality-selector",
        "bilibili-dev-settings",
        "bilibili-unlock-settings",
        "bilibili-decode-settings"
    ];
    const QUALITY_ORDER = [
        "8K",
        "杜比视界",
        "HDR",
        "4K",
        "1080P 高码率",
        "1080P 60帧",
        "1080P 高清",
        "720P 60帧",
        "720P",
        "480P",
        "360P",
        "默认"
    ];
    const TRIAL_KEYWORDS = ["限免中", "试用中", "可试用", "试用"];
    const CLEAN_KEYWORDS = ["大会员", ...TRIAL_KEYWORDS];
    const CUSTOM_HIGHEST = "最高画质";
    const CUSTOM_DEFAULT = "默认";
    const CUSTOM_QUALITY_ITEMS = ["8K", "杜比视界", "HDR", "4K", "1080P 高码率", "1080P 60帧", "1080P 高清", "720P", "480P", "360P"];
    const VIP_QUALITIES = ["8K", "杜比视界", "HDR", "4K", "1080P 高码率", "1080P 60帧"];
    const DEFAULT_CUSTOM_ORDER = [CUSTOM_HIGHEST, ...CUSTOM_QUALITY_ITEMS, CUSTOM_DEFAULT];
    function normalizeCustomOrder(order) {
        const known = new Set(DEFAULT_CUSTOM_ORDER);
        const seen = new Set();
        const result = [];
        if (Array.isArray(order)) {
            order.forEach(q => {
                if (known.has(q) && !seen.has(q)) { result.push(q); seen.add(q); }
            });
        }
        DEFAULT_CUSTOM_ORDER.forEach(q => { if (!seen.has(q)) { result.push(q); seen.add(q); } });
        return result;
    }
    function customEffectiveCutoff(qualities) {
        const hi = qualities.indexOf(CUSTOM_HIGHEST);
        const def = qualities.indexOf(CUSTOM_DEFAULT);
        if (hi === -1) return def;
        if (def === -1) return hi;
        return Math.min(hi, def);
    }
    function loadCustomOrder() {
        let raw = GM_getValue("customQualityOrder", null);
        if (typeof raw === "string") {
            try { raw = JSON.parse(raw); } catch (e) { raw = null; }
        }
        return normalizeCustomOrder(raw);
    }
    function saveCustomOrder(order) {
        const normalized = normalizeCustomOrder(order);
        state.customQualityOrder = normalized;
        GM_setValue("customQualityOrder", JSON.stringify(normalized));
        return normalized;
    }
    state.customQualityOrder = loadCustomOrder();
    function setSetting(stateKey, gmKey, value) {
        state[stateKey] = value;
        GM_setValue(gmKey, value);
    }
    function getDoubleCheckConfig(isLive) {
        const enabled = state.devModeEnabled ? (isLive ? state.liveQualityDoubleCheck : state.qualityDoubleCheck) : true;
        const delayMs = state.devModeEnabled ? state.devDoubleCheckDelay : 5000;
        return { enabled, delayMs };
    }
    function setDevPanelEnabled(panel, enabled) {
        panel.querySelectorAll('input[type="checkbox"]:not(#dev-mode), input[type="number"]').forEach(option => {
            option.disabled = !enabled;
        });
        panel.querySelectorAll('.input-group').forEach(group => {
            if (enabled) {
                group.classList.remove('disabled');
            } else {
                group.classList.add('disabled');
            }
        });
        const vipTabs = panel.querySelector('.vip-status-tabs');
        if (vipTabs) vipTabs.classList.toggle('disabled', !enabled);
    }
    function closeAllPanels() {
        PANEL_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove("show");
        });
    }
    ['fullscreenchange','webkitfullscreenchange'].forEach(e => document.addEventListener(e, closeAllPanels));
    const GITHUB_SVG = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>`;
    function renderGithubLink() {
        return `<a href="https://github.com/AHCorn/Bilibili-Auto-Quality/" target="_blank" class="github-link">${GITHUB_SVG}</a>`;
    }
    function checkIfLivePage() {
        state.isLivePage = window.location.href.includes("live.bilibili.com");
    }
    function updateWarnings(panel) {
        if (!panel || state.isLoading || !state.vipStatusChecked) return;
        const nonVipWarning = panel.querySelector("#non-vip-warning");
        const audioWarning = panel.querySelector("#audio-warning");
        if (!state.isVipUser && VIP_QUALITIES.includes(state.userQualitySetting)) {
            nonVipWarning.textContent = "无法使用此会员画质。已自动选择最高可用画质。";
            nonVipWarning.style.display = "block";
        } else {
            nonVipWarning.style.display = "none";
        }
        if (!state.isVipUser && (state.hiResAudioEnabled || state.dolbyAtmosEnabled)) {
            audioWarning.textContent = "非大会员用户不能使用高级音频选项。";
            audioWarning.style.display = "block";
        } else {
            audioWarning.style.display = "none";
        }
    }
    function updateQualityButtons(panel) {
        if (!panel) return;
        const statusBar = panel.querySelector(".status-bar");
        if (state.isLoading) {
            statusBar.textContent = "加载中，请稍候...";
            statusBar.className = "status-bar";
            Utils.queryAll(".quality-button, .toggle-switch", panel).forEach(el => {
                el.style.opacity = "0.5";
            });
        } else {
            Utils.queryAll(".quality-button, .toggle-switch", panel).forEach(el => {
                el.style.opacity = "1";
            });
            if (state.vipStatusChecked) {
                statusBar.textContent = state.isVipUser
                    ? "您是大会员用户，可正常使用所有选项。"
                    : "您不是大会员用户，部分会员选项不可用。";
                statusBar.className = "status-bar " + (state.isVipUser ? "vip" : "non-vip");
            }
        }
        Utils.queryAll("#quality-grid .quality-button", panel).forEach(button => {
            button.classList.remove("active", "vip-quality");
            if (!state.customSortEnabled && button.getAttribute("data-quality") === state.userQualitySetting) {
                button.classList.add("active");
                if (VIP_QUALITIES.includes(button.getAttribute("data-quality"))) {
                    button.classList.add("vip-quality");
                }
            }
        });
        if (state.customSortEnabled) refreshCustomGridDecorations(panel);
        const hintCollapse = panel.querySelector("#custom-sort-hint-collapse");
        if (hintCollapse) hintCollapse.classList.toggle("collapsed", !state.customSortEnabled);
        const fallbackCollapse = panel.querySelector("#highest-quality-fallback-collapse");
        if (fallbackCollapse) fallbackCollapse.classList.toggle("collapsed", state.customSortEnabled);
        const customSortCheckbox = panel.querySelector("#custom-sort");
        if (customSortCheckbox) customSortCheckbox.checked = state.customSortEnabled;
        const hiResAudioSwitch = panel.querySelector("#hi-res-audio");
        if (hiResAudioSwitch) hiResAudioSwitch.checked = state.hiResAudioEnabled;
        const dolbyAtmosSwitch = panel.querySelector("#dolby-atmos");
        if (dolbyAtmosSwitch) dolbyAtmosSwitch.checked = state.dolbyAtmosEnabled;
        const fallbackCheckbox = panel.querySelector("#highest-quality-fallback");
        if (fallbackCheckbox) fallbackCheckbox.checked = state.useHighestQualityFallback;
        const autoWidescreenCheckbox = panel.querySelector("#auto-widescreen");
        if (autoWidescreenCheckbox) autoWidescreenCheckbox.checked = state.autoWidescreen;
        updateWarnings(panel);
    }
    function createSettingsPanel() {
        const panel = document.createElement("div");
        panel.id = "bilibili-quality-selector";
        const QUALITIES = DEFAULT_CUSTOM_ORDER;
        function buildDefaultItemsHTML() {
            return QUALITIES.map(q => `<button class="quality-button" data-quality="${q}">${q}</button>`).join('');
        }
        function buildCustomItemsHTML() {
            const order = normalizeCustomOrder(state.customQualityOrder);
            const cutoff = customEffectiveCutoff(order);
            return order.map((q, i) => {
                const isFallback = q === CUSTOM_HIGHEST;
                const dimmed = cutoff !== -1 && i > cutoff;
                const cls = ["quality-button", "cq-grid-item"];
                if (isFallback) cls.push("cq-fallback");
                if (dimmed) cls.push("cq-dimmed");
                if (VIP_QUALITIES.includes(q)) cls.push("cq-vip");
                const tag = isFallback ? `<span class="cq-tag">兜底</span>` : "";
                const title = isFallback ? ` title="兜底：找不到上方偏好画质时，选当前可用的最高画质"` : "";
                return `<button class="${cls.join(' ')}" data-quality="${q}" draggable="false"${title}><span class="cq-rank">${i + 1}</span>${q}${tag}</button>`;
            }).join('');
        }
        function gridHTML() {
            return state.customSortEnabled ? buildCustomItemsHTML() : buildDefaultItemsHTML();
        }
        function renderGrid() {
            const grid = panel.querySelector("#quality-grid");
            if (!grid) return;
            grid.classList.toggle("cq-grid", state.customSortEnabled);
            grid.classList.toggle("cq-sortable", state.customSortEnabled);
            grid.innerHTML = gridHTML();
        }
        panel.innerHTML = `
          <h2>画质设置</h2>
          ${renderGithubLink()}
          <div class="status-bar"></div>
          <div class="quality-group${state.customSortEnabled ? ' cq-grid cq-sortable' : ''}" id="quality-grid">
            ${gridHTML()}
          </div>
          <div class="cq-collapse ${state.customSortEnabled ? '' : 'collapsed'}" id="custom-sort-hint-collapse"><div class="cq-collapse-inner">
            <div class="cq-hint">长按拖动卡片排列选择优先级，最高画质及默认后的选项不会生效。</div>
          </div></div>
          <div id="non-vip-warning" class="warning" style="display:none;"></div>
          <div class="toggle-switch" id="custom-sort-container">
            <label for="custom-sort">自定义排序</label>
            <label class="switch">
              <input type="checkbox" id="custom-sort" ${state.customSortEnabled ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          <div class="toggle-switch">
            <label for="hi-res-audio">Hi-Res 音质</label>
            <label class="switch">
              <input type="checkbox" id="hi-res-audio">
              <span class="slider vip-audio"></span>
            </label>
          </div>
          <div class="toggle-switch">
            <label for="dolby-atmos">杜比全景声</label>
            <label class="switch">
              <input type="checkbox" id="dolby-atmos">
              <span class="slider vip-audio"></span>
            </label>
          </div>
          <div id="audio-warning" class="warning" style="display:none;"></div>
          <div class="cq-collapse ${state.customSortEnabled ? 'collapsed' : ''}" id="highest-quality-fallback-collapse"><div class="cq-collapse-inner">
            <div class="toggle-switch" id="highest-quality-fallback-container">
              <label for="highest-quality-fallback">找不到目标画质时使用最高画质</label>
              <label class="switch">
                <input type="checkbox" id="highest-quality-fallback" ${state.useHighestQualityFallback ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>
          </div></div>
          <div class="toggle-switch">
            <label for="inject-quality-button">注入画质选项</label>
            <label class="switch">
              <input type="checkbox" id="inject-quality-button" ${state.injectQualityButton ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          <div class="toggle-switch">
            <label for="auto-widescreen">自动宽屏</label>
            <label class="switch">
              <input type="checkbox" id="auto-widescreen" ${state.autoWidescreen ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
        `;
        panel.addEventListener("click", function (e) {
            const btn = e.target.closest(".quality-button");
            if (btn && !state.customSortEnabled && !state.isLoading) {
                const quality = btn.getAttribute("data-quality");
                state.userQualitySetting = quality;
                GM_setValue("qualitySetting", quality);
                updateQualityButtons(panel);
                selectQualityBasedOnSetting();
            }
        });
        panel.querySelector("#custom-sort").addEventListener("change", function (e) {
            if (state.isLoading) return;
            state.customSortEnabled = e.target.checked;
            GM_setValue("customSortEnabled", state.customSortEnabled);
            renderGrid();
            updateQualityButtons(panel);
            selectQualityBasedOnSetting();
        });
        panel.querySelector("#highest-quality-fallback").addEventListener("change", function (e) {
            if (!state.isLoading) {
                state.useHighestQualityFallback = e.target.checked;
                GM_setValue("useHighestQualityFallback", state.useHighestQualityFallback);
                selectQualityBasedOnSetting();
            }
        });
        panel.querySelector("#hi-res-audio").addEventListener("change", function (e) {
            if (!state.isLoading) {
                state.hiResAudioEnabled = e.target.checked;
                GM_setValue("hiResAudio", state.hiResAudioEnabled);
                updateQualityButtons(panel);
                selectQualityBasedOnSetting();
            }
        });
        panel.querySelector("#dolby-atmos").addEventListener("change", function (e) {
            if (!state.isLoading) {
                state.dolbyAtmosEnabled = e.target.checked;
                GM_setValue("dolbyAtmos", state.dolbyAtmosEnabled);
                updateQualityButtons(panel);
                selectQualityBasedOnSetting();
            }
        });
        panel.querySelector("#inject-quality-button").addEventListener("change", function (e) {
            if (!state.isLoading) {
                state.injectQualityButton = e.target.checked;
                GM_setValue("injectQualityButton", state.injectQualityButton);
                ensureQualitySettingsButton(state.injectQualityButton);
            }
        });
        panel.querySelector("#auto-widescreen").addEventListener("change", function (e) {
            if (!state.isLoading) {
                state.autoWidescreen = e.target.checked;
                GM_setValue("autoWidescreen", state.autoWidescreen);
                if (state.autoWidescreen) applyAutoWidescreen();
            }
        });
        document.body.appendChild(panel);
        setupCustomGridDrag(panel);
        updateQualityButtons(panel);
    }
    function refreshCustomGridDecorations(panel) {
        const grid = panel.querySelector("#quality-grid");
        if (!grid) return;
        const items = Utils.queryAll(".cq-grid-item", grid);
        const cutoff = customEffectiveCutoff(items.map(it => it.getAttribute("data-quality")));
        items.forEach((it, i) => {
            const rank = it.querySelector(".cq-rank");
            if (rank) rank.textContent = String(i + 1);
            it.classList.toggle("cq-dimmed", cutoff !== -1 && i > cutoff);
            it.classList.toggle("cq-fallback", it.getAttribute("data-quality") === CUSTOM_HIGHEST);
        });
    }
    function setupCustomGridDrag(panel) {
        const grid = panel.querySelector("#quality-grid");
        if (!grid || grid.dataset.dragBound === "1") return;
        grid.dataset.dragBound = "1";

        const LONG_PRESS_MS = 260;
        const MOVE_CANCEL_PX = 10;
        const EDGE = 48;
        const SCROLL_SPEED = 14;

        let pressTimer = null;
        let pressEl = null;
        let activePointerId = null;
        let activated = false;
        let committed = false;
        let dragging = null;
        let items = [];          // 拖拽开始时的顺序
        let slots = [];          // 各格子的中心坐标
        let startIndex = -1;
        let currentIndex = -1;
        let pointerStartClientX = 0;
        let pointerStartClientY = 0;
        let lastClientX = 0;
        let lastClientY = 0;
        let moveRAF = null;
        let autoScrollRAF = null;

        function clearPress() {
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
            if (pressEl) { pressEl.classList.remove("cq-press"); pressEl = null; }
        }
        function captureSlots() {
            const gridRect = grid.getBoundingClientRect();
            slots = items.map(it => {
                const r = it.getBoundingClientRect();
                return { x: r.left - gridRect.left + r.width / 2, y: r.top - gridRect.top + r.height / 2 };
            });
        }
        function pointerRel() {
            const gridRect = grid.getBoundingClientRect();
            return { x: lastClientX - gridRect.left, y: lastClientY - gridRect.top };
        }
        function nearestIndex(p) {
            let best = 0, bestD = Infinity;
            for (let i = 0; i < slots.length; i++) {
                const dx = slots[i].x - p.x, dy = slots[i].y - p.y;
                const d = dx * dx + dy * dy;
                if (d < bestD) { bestD = d; best = i; }
            }
            return best;
        }
        function workingOrder() {
            const arr = items.slice();
            arr.splice(startIndex, 1);
            arr.splice(currentIndex, 0, dragging);
            return arr;
        }
        function applyLayout() {
            const order = workingOrder();
            const cutoff = customEffectiveCutoff(order.map(it => it.getAttribute("data-quality")));
            order.forEach((it, newIdx) => {
                const oldIdx = items.indexOf(it);
                const rank = it.querySelector(".cq-rank");
                if (rank) rank.textContent = String(newIdx + 1);
                if (it === dragging) return;
                it.classList.toggle("cq-dimmed", cutoff !== -1 && newIdx > cutoff);
                const dx = slots[newIdx].x - slots[oldIdx].x;
                const dy = slots[newIdx].y - slots[oldIdx].y;
                it.style.transform = `translate(${dx}px, ${dy}px)`;
            });
        }
        function updateDrag() {
            moveRAF = null;
            if (!activated || !dragging) return;
            const p = pointerRel();
            const dx = p.x - slots[startIndex].x;
            const dy = p.y - slots[startIndex].y;
            dragging.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
            const idx = nearestIndex(p);
            if (idx !== currentIndex) {
                currentIndex = idx;
                applyLayout();
            }
        }
        function stopAutoScroll() {
            if (autoScrollRAF) { cancelAnimationFrame(autoScrollRAF); autoScrollRAF = null; }
        }
        function handleAutoScroll() {
            const rect = panel.getBoundingClientRect();
            let dir = 0;
            if (lastClientY < rect.top + EDGE) dir = -1;
            else if (lastClientY > rect.bottom - EDGE) dir = 1;
            if (dir === 0) { stopAutoScroll(); return; }
            if (autoScrollRAF) return;
            const tick = () => {
                if (!activated) { stopAutoScroll(); return; }
                const before = panel.scrollTop;
                panel.scrollTop += dir * SCROLL_SPEED;
                if (panel.scrollTop !== before) updateDrag();
                autoScrollRAF = requestAnimationFrame(tick);
            };
            autoScrollRAF = requestAnimationFrame(tick);
        }
        function activateDrag(item) {
            activated = true;
            committed = false;
            dragging = item;
            items = Utils.queryAll(".cq-grid-item", grid);
            startIndex = items.indexOf(item);
            currentIndex = startIndex;
            captureSlots();
            grid.classList.add("cq-dragging");
            item.classList.remove("cq-press");
            item.classList.add("dragging");
            items.forEach(it => { it.style.transform = ""; });
        }
        function commitOrder() {
            if (committed) return;
            committed = true;
            const order = workingOrder();
            order.forEach(n => {
                n.style.transition = "none";
                n.style.transform = "";
                grid.appendChild(n);
            });
            // 先强制回流再恢复过渡，不然会闪
            void grid.offsetHeight;
            order.forEach(n => { n.style.transition = ""; });
            grid.classList.remove("cq-dragging");
            dragging = null;
            activated = false;
            const newOrder = order.map(n => n.getAttribute("data-quality"));
            saveCustomOrder(newOrder);
            refreshCustomGridDecorations(panel);
            selectQualityBasedOnSetting();
        }
        function finishDrag() {
            stopAutoScroll();
            if (moveRAF) { cancelAnimationFrame(moveRAF); moveRAF = null; }
            if (!dragging) { activated = false; grid.classList.remove("cq-dragging"); return; }
            const item = dragging;
            const dx = slots[currentIndex].x - slots[startIndex].x;
            const dy = slots[currentIndex].y - slots[startIndex].y;
            item.classList.remove("dragging");
            requestAnimationFrame(() => {
                item.style.transform = `translate(${dx}px, ${dy}px)`;
            });
            let done = false;
            const onEnd = (ev) => {
                if (ev && ev.propertyName && ev.propertyName !== "transform") return;
                if (done) return;
                done = true;
                item.removeEventListener("transitionend", onEnd);
                commitOrder();
            };
            item.addEventListener("transitionend", onEnd);
            setTimeout(onEnd, 300);
        }
        function onPointerDown(e) {
            if (!state.customSortEnabled || state.isLoading) return;
            if (e.pointerType === "mouse" && e.button !== 0) return;
            if (activated || pressTimer || activePointerId !== null) return;
            const item = e.target.closest(".cq-grid-item");
            if (!item || !grid.contains(item)) return;
            pressEl = item;
            activePointerId = e.pointerId;
            pointerStartClientX = e.clientX;
            pointerStartClientY = e.clientY;
            lastClientX = e.clientX;
            lastClientY = e.clientY;
            item.classList.add("cq-press");
            pressTimer = setTimeout(() => {
                pressTimer = null;
                try { grid.setPointerCapture(activePointerId); } catch (err) {}
                activateDrag(item);
            }, LONG_PRESS_MS);
        }
        function onPointerMove(e) {
            if (e.pointerId !== activePointerId) return;
            if (!activated) {
                if (pressTimer && (Math.abs(e.clientY - pointerStartClientY) > MOVE_CANCEL_PX || Math.abs(e.clientX - pointerStartClientX) > MOVE_CANCEL_PX)) {
                    clearPress();
                }
                return;
            }
            e.preventDefault();
            lastClientX = e.clientX;
            lastClientY = e.clientY;
            if (!moveRAF) moveRAF = requestAnimationFrame(updateDrag);
            handleAutoScroll();
        }
        function onPointerUp(e) {
            if (e.pointerId !== activePointerId) return;
            clearPress();
            try { grid.releasePointerCapture(activePointerId); } catch (err) {}
            activePointerId = null;
            if (activated) finishDrag();
        }
        grid.addEventListener("pointerdown", onPointerDown);
        grid.addEventListener("pointermove", onPointerMove);
        grid.addEventListener("pointerup", onPointerUp);
        grid.addEventListener("pointercancel", onPointerUp);
        grid.addEventListener("dragstart", (e) => e.preventDefault());
        grid.addEventListener("contextmenu", (e) => { if (activated || pressTimer) e.preventDefault(); });
    }
    function selectQualityBasedOnSetting() {
        if (state.isLivePage) {
            selectLiveQuality();
        } else {
            selectVideoQuality();
        }
    }
    class TaskQueue {
        constructor() {
            this.currentTaskId = 0;
            this.activeTimeouts = new Map();
            this.activeTask = null;
        }

        generateTaskId() {
            return ++this.currentTaskId;
        }

        clearPreviousTasks() {
            this.activeTimeouts.forEach((timeout, taskId) => {
                clearTimeout(timeout);
                console.log(`[任务管理] 取消等待任务 #${taskId}`);
            });
            this.activeTimeouts.clear();

            if (this.activeTask) {
                console.log(`[任务管理] 标记运行中任务 #${this.activeTask} 为已取消`);
                this.activeTask = null;
            }
        }

        isTaskCancelled(taskId) {
            // 检查任务是否过期
            if (taskId !== this.currentTaskId) {
                console.log(`[任务管理] 任务 #${taskId} 已过期，当前任务 #${this.currentTaskId}`);
                return true;
            }
            
            // 统一检测登录状态：未登录且未开启未登录模式时取消任务
            const loginButton = document.querySelector(".go-login-btn, .header-login-entry");
            const headerAvatar = document.querySelector(".v-popover-wrap.header-avatar-wrap");
            const noLoginMode = state.devModeEnabled && state.devModeNoLoginStatus;
            
            if (loginButton && !headerAvatar && !noLoginMode) {
                console.log(`[任务管理] 任务 #${taskId} 取消：检测到未登录且未开启未登录模式`);
                return true;
            }
            
            return false;
        }

        async scheduleTask(taskId, task, delay = 0) {
            if (this.isTaskCancelled(taskId)) return;

            // 设置当前活动任务
            this.activeTask = taskId;

            try {
                if (delay > 0) {
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(async () => {
                            this.activeTimeouts.delete(taskId);
                            if (!this.isTaskCancelled(taskId)) {
                                try {
                                    await task();
                                    resolve();
                                } catch (error) {
                                    reject(error);
                                }
                            } else {
                                console.log(`[任务管理] 延迟任务 #${taskId} 已取消`);
                                resolve();
                            }
                        }, delay);
                        this.activeTimeouts.set(taskId, timeout);
                    });
                } else {
                    await task();
                }
            } finally {
                if (this.activeTask === taskId) {
                    this.activeTask = null;
                }
            }
        }
    }

    const taskQueue = new TaskQueue();

    async function setAudioQuality(retryCount = 0) {
        const taskId = taskQueue.currentTaskId;
        if (taskQueue.isTaskCancelled(taskId)) return;

        if (!state.isVipUser) {
            console.log("[音质设置] 非会员用户，略过音质设置");
            return;
        }

        const maxRetries = state.devModeEnabled ? state.devModeAudioRetries : 2;
        const baseDelay = state.devModeEnabled ? state.devModeAudioDelay : 4000;
        const retryInterval = baseDelay * Math.pow(2, retryCount);

        function tryToggle(buttonSelector, shouldEnable, label) {
            if (taskQueue.isTaskCancelled(taskId)) return false;

            const button = document.querySelector(buttonSelector);
            if (!button) return false;
            const isActive = button.classList.contains("bpx-state-active");
            if (shouldEnable && !isActive) {
                console.log(`[音质设置] 检测到需开启${label} (第${retryCount + 1}次尝试)`);
                button.click();
                return true;
            } else if (!shouldEnable && isActive) {
                console.log(`[音质设置] 检测到需关闭${label} (第${retryCount + 1}次尝试)`);
                button.click();
                return true;
            }
            return false;
        }

        console.log(`[音质设置] 开始第${retryCount + 1}次设置`);
        const hiResChanged = tryToggle(".bpx-player-ctrl-flac", state.hiResAudioEnabled, "Hi-Res音质");
        const dolbyChanged = tryToggle(".bpx-player-ctrl-dolby", state.dolbyAtmosEnabled, "杜比全景声");

        if ((hiResChanged || dolbyChanged) && retryCount < maxRetries) {
            console.log(`[音质设置] 等待 ${retryInterval / 1000} 秒后验证设置`);
            await taskQueue.scheduleTask(taskId, async () => {
                if (!taskQueue.isTaskCancelled(taskId)) {
                    await setAudioQuality(retryCount + 1);
                }
            }, retryInterval);
        } else {
            console.log("[音质设置] 设置完成或达到最大重试次数");
        }
    }

    async function selectVideoQuality() {
        const taskId = taskQueue.currentTaskId;
        const currentQualityEl = document.querySelector(".bpx-player-ctrl-quality-menu-item.bpx-state-active .bpx-player-ctrl-quality-text");
        const currentQuality = currentQualityEl ? currentQualityEl.textContent : "";
        console.log("[画质设置] 当前画质:", currentQuality);
        console.log("[画质设置] 目标画质:", state.userQualitySetting);

        // 确保会员状态已检查
        if (!state.vipStatusChecked) {
            console.log("[画质设置] 等待会员状态检查完成");
            return;
        }

        const qualityMenu = document.querySelector(".bpx-player-ctrl-quality-menu");
        if (!qualityMenu) {
            console.warn("[画质设置] 未找到画质菜单节点，终止本次切换");
            return;
        }

        const qualityItems = Array.from(
            qualityMenu.querySelectorAll(".bpx-player-ctrl-quality-menu-item")
        );

        let availableQualities = qualityItems.map(item => {
            // 只在这儿查一次子元素，避免重复 querySelector
            const badge = item.querySelector(".bpx-player-ctrl-quality-badge-bigvip");
            const badgeText = badge ? badge.textContent : "";
            const text = (item.textContent || "").trim();
            const nameHasTrial = TRIAL_KEYWORDS.some(k => text.includes(k));
            const badgeHasTrial = !!(badgeText && TRIAL_KEYWORDS.some(k => badgeText.includes(k)));
            return {
                name: text,
                element: item,
                isVipOnly: !!badge,
                isFreeNow: nameHasTrial || badgeHasTrial
            };
        });

        // 开发者设置：禁用 HDR 选项时，过滤掉 HDR 和杜比视界画质
        if (state.devModeEnabled && state.disableHDROption) {
            availableQualities = availableQualities.filter(q => q.name.indexOf("HDR") === -1 && q.name.indexOf("杜比视界") === -1);
        }

        // 未登录模式下过滤掉高于1080P的画质
        if (state.devModeEnabled && state.devModeNoLoginStatus) {
            availableQualities = availableQualities.filter(q => {
                const name = q.name.trim();
                return !name.includes("8K") && !name.includes("杜比视界") && !name.includes("HDR") && !name.includes("4K");
            });
            console.log("[未登录模式] 已过滤高于1080P的画质，可用画质:", availableQualities.map(q => q.name));
        }

        console.log("[画质设置] 可用画质:", availableQualities.map(q => q.name));
        console.log("[画质设置] 会员状态:", state.isVipUser ? "是" : "否");

        const qualityPreferences = QUALITY_ORDER;
        let targetQuality;
        function cleanQuality(q) {
            if (!q) return "";
            let result = q;
            CLEAN_KEYWORDS.forEach(k => { result = result.replace(new RegExp(k, 'g'), ''); });
            return result.trim();
        }
        const allowFreeVipForNonVipBase = state.devModeEnabled && state.devAllowFreeVipQualities;
        const isUsableQuality = (q) => state.isVipUser ? true : (allowFreeVipForNonVipBase ? (!q.isVipOnly || q.isFreeNow) : (!q.isVipOnly && !q.isFreeNow));
        let customUsedFallback = false;
        if (state.customSortEnabled) {
            const order = normalizeCustomOrder(state.customQualityOrder);
            const cutoff = order.indexOf(CUSTOM_HIGHEST);
            const prefs = cutoff === -1 ? order : order.slice(0, cutoff);
            let useDefault = false;
            for (const pref of prefs) {
                if (pref === CUSTOM_DEFAULT) {
                    useDefault = true;
                    break;
                }
                const match = availableQualities.find(q => isUsableQuality(q) && cleanQuality(q.name).includes(pref));
                if (match) { targetQuality = match; break; }
            }
            if (useDefault) {
                console.log("[画质设置] 自定义顺序命中“默认”，使用默认画质");
                state.qualitySetSuccessfully = true;
                await setAudioQuality();
                return;
            }
            if (!targetQuality && cutoff !== -1) {
                const ordered = state.isVipUser ? availableQualities : [...availableQualities].sort((a, b) => {
                    function gi(name) {
                        for (let i = 0; i < qualityPreferences.length; i++) {
                            if (name.includes(qualityPreferences[i])) return i;
                        }
                        return qualityPreferences.length;
                    }
                    return gi(a.name) - gi(b.name);
                });
                targetQuality = ordered.find(isUsableQuality) || null;
                customUsedFallback = true;
            }
            if (!targetQuality) {
                console.log("[画质设置] 自定义顺序未匹配到可用画质，保持当前画质");
                await setAudioQuality();
                return;
            }
            console.log("[画质设置] 自定义模式目标画质: " + targetQuality.name + (customUsedFallback ? "（兜底最高画质）" : ""));
        } else if (state.userQualitySetting === "最高画质") {
            const hasFreeVip = availableQualities.some(q => q.isFreeNow);
            const allowFreeVipForNonVip = state.devModeEnabled && state.devAllowFreeVipQualities;
            if (state.isVipUser) {
                targetQuality = availableQualities[0];
            } else if (hasFreeVip && allowFreeVipForNonVip) {
                // 非会员在允许试用时，选择首个“试用/限免”或首个非会员画质
                targetQuality = availableQualities.find(q => q.isFreeNow) || availableQualities.find(q => !q.isVipOnly);
            } else {
                availableQualities.sort((a, b) => {
                    function getQualityIndex(name) {
                        for (let i = 0; i < qualityPreferences.length; i++) {
                            if (name.includes(qualityPreferences[i])) return i;
                        }
                        return qualityPreferences.length;
                    }
                    return getQualityIndex(a.name) - getQualityIndex(b.name);
                });
                if (!targetQuality && state.useHighestQualityFallback)
                    targetQuality = (state.isVipUser || allowFreeVipForNonVip)
                        ? availableQualities.find(q => !q.isVipOnly || q.isFreeNow)
                        : availableQualities.find(q => !q.isVipOnly && !q.isFreeNow);
                if (!targetQuality && !state.useHighestQualityFallback) {
                    console.log("[画质设置] 未找到可用画质，保持当前画质");
                    await setAudioQuality();
                    return;
                }
            }
        } else if (state.userQualitySetting === "默认") {
            console.log("[画质设置] 使用默认画质");
            state.qualitySetSuccessfully = true;
            await setAudioQuality();
            return;
        } else {
            targetQuality = availableQualities.find(q => cleanQuality(q.name).includes(state.userQualitySetting));
            if (!targetQuality) {
                console.log("[画质设置] 未找到目标画质 " + state.userQualitySetting);
                if (!targetQuality && state.useHighestQualityFallback) {
                    const allowFreeVipForNonVip = state.devModeEnabled && state.devAllowFreeVipQualities;
                    targetQuality = state.isVipUser
                        ? availableQualities[0]
                        : (allowFreeVipForNonVip
                            ? (availableQualities.find(q => q.isFreeNow) || availableQualities.find(q => !q.isVipOnly))
                            : availableQualities.find(q => !q.isVipOnly && !q.isFreeNow));
                }
                if (!targetQuality && !state.useHighestQualityFallback) {
                    console.log("[画质设置] 未找到可用画质，保持当前画质");
                    await setAudioQuality();
                    return;
                }
            }
        }
        console.log("[画质设置] 实际目标画质: " + targetQuality.name);
        
        // 避免将更高画质切换到更低画质
        if (customUsedFallback || (!state.customSortEnabled && state.userQualitySetting === "最高画质")) {
            const currentQualityItem = availableQualities.find(q => cleanQuality(q.name) === cleanQuality(currentQuality));
            const currentQualityIndex = currentQualityItem ? availableQualities.indexOf(currentQualityItem) : -1;
            const targetQualityIndex = availableQualities.indexOf(targetQuality);
            
            // 获取到的可用画质数组按从高到低排序，索引越大画质越低
            if (currentQualityIndex !== -1 && targetQualityIndex > currentQualityIndex) {
                console.log(`[画质设置] 防护触发：当前画质 ${currentQuality} (数组索引${currentQualityIndex}) 高于目标 ${targetQuality.name} (数组索引${targetQualityIndex})，放弃切换`);
                state.qualitySetSuccessfully = true;
                await setAudioQuality();
                return;
            }
        }
        
        const targetQualityNameClean = cleanQuality(targetQuality.name);
        targetQuality.element.click();
        state.qualitySetSuccessfully = true;

        // 二次验证逻辑
        const { enabled, delayMs } = getDoubleCheckConfig(false);
        if (enabled) {
            console.log(`[画质设置] 等待 ${delayMs} 毫秒后进行二次验证...`);
            await taskQueue.scheduleTask(taskId, async () => {
                if (taskQueue.isTaskCancelled(taskId)) return;

                const currentQualityAfterSwitchEl = document.querySelector(".bpx-player-ctrl-quality-menu-item.bpx-state-active .bpx-player-ctrl-quality-text");
                const currentQualityAfterSwitch = currentQualityAfterSwitchEl ? currentQualityAfterSwitchEl.textContent : "";
                if (currentQualityAfterSwitch && cleanQuality(currentQualityAfterSwitch) !== cleanQuality(targetQualityNameClean)) {
                    console.log("[画质设置] 画质切换未成功，执行二次切换...");
                    // 重新打开清晰度菜单并重新定位目标项，避免旧元素失效
                    const qualityButton = document.querySelector('.bpx-player-ctrl-btn.bpx-player-ctrl-quality:not(.auto-quality-injected)');
                    if (qualityButton) {
                        qualityButton.click();
                        await Utils.delay(80);
                    }
                    const qualityMenu = document.querySelector('.bpx-player-ctrl-quality-menu');
                    if (qualityMenu) {
                        const freshItems = Array.from(qualityMenu.querySelectorAll('.bpx-player-ctrl-quality-menu-item'));
                        const freshTarget = freshItems.find(item => cleanQuality((item.textContent || '').trim()).includes(targetQualityNameClean));
                        if (freshTarget && !taskQueue.isTaskCancelled(taskId)) {
                            freshTarget.click();
                        } else if (!freshTarget) {
                            console.warn("[画质设置] 无法重新定位目标画质元素:", targetQualityNameClean);
                        }
                    } else {
                        console.warn("[画质设置] 画质菜单未打开，无法执行二次切换");
                    }
                } else {
                    console.log("[画质设置] 画质切换验证成功，当前画质: " + currentQualityAfterSwitch);
                }
            }, delayMs);
        } else {
            console.log("[画质设置] 二次验证已关闭，跳过验证");
        }

        await setAudioQuality();
    }
    function getNumberMirror() {
        let m = document.getElementById("aq-num-mirror");
        if (!m) {
            m = document.createElement("span");
            m.id = "aq-num-mirror";
            m.style.cssText = "position:absolute;left:-9999px;top:-9999px;visibility:hidden;white-space:pre;pointer-events:none;";
            document.body.appendChild(m);
        }
        return m;
    }
    function setupSteppers(panel) {
        Utils.queryAll(".num-stepper", panel).forEach(stepper => {
            if (stepper.dataset.stepperBound === "1") return;
            stepper.dataset.stepperBound = "1";
            const input = stepper.querySelector('input[type="number"]');
            const dec = stepper.querySelector(".ns-dec");
            const inc = stepper.querySelector(".ns-inc");
            if (!input || !dec || !inc) return;
            const step = parseFloat(input.step) || 1;
            const min = input.min !== "" ? parseFloat(input.min) : -Infinity;
            const max = input.max !== "" ? parseFloat(input.max) : Infinity;
            function clampSnap(v) {
                if (isNaN(v)) v = (min !== -Infinity ? min : 0);
                if (min !== -Infinity) v = Math.round((v - min) / step) * step + min;
                v = Math.min(max, Math.max(min, v));
                return Math.round(v * 1000) / 1000;
            }
            function fitWidth() {
                // 用镜像量出真实宽度，免得数字被裁
                const cs = getComputedStyle(input);
                const m = getNumberMirror();
                m.style.fontSize = cs.fontSize;
                m.style.fontFamily = cs.fontFamily;
                m.style.fontWeight = cs.fontWeight;
                m.style.letterSpacing = cs.letterSpacing;
                m.textContent = input.value === "" ? "0" : input.value;
                input.style.width = Math.max(12, m.offsetWidth + 2) + "px";
            }
            function refreshButtons() {
                const v = parseFloat(input.value);
                const cur = isNaN(v) ? null : clampSnap(v);
                dec.disabled = cur !== null && cur <= min;
                inc.disabled = cur !== null && cur >= max;
            }
            function applyDelta(dir) {
                if (input.disabled) return;
                let v = parseFloat(input.value);
                if (isNaN(v)) v = (min !== -Infinity ? min : 0);
                v = clampSnap(v + dir * step);
                if (String(v) !== input.value) {
                    input.value = String(v);
                    input.dispatchEvent(new Event("input", { bubbles: true }));
                    fitWidth();
                }
                refreshButtons();
            }
            // 长按连续步进，松手时只提交一次
            function bindHold(btn, dir) {
                let delayTimer = null, repeatTimer = null, held = false;
                function stop() {
                    if (delayTimer) { clearTimeout(delayTimer); delayTimer = null; }
                    if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; }
                    if (held) { held = false; input.dispatchEvent(new Event("change", { bubbles: true })); }
                }
                btn.addEventListener("pointerdown", function (e) {
                    if (e.button != null && e.button !== 0) return;
                    if (btn.disabled || input.disabled) return;
                    e.preventDefault();
                    held = true;
                    applyDelta(dir);
                    try { btn.setPointerCapture(e.pointerId); } catch (err) {}
                    delayTimer = setTimeout(function () {
                        repeatTimer = setInterval(function () {
                            if (btn.disabled || input.disabled) { stop(); return; }
                            applyDelta(dir);
                        }, 90);
                    }, 350);
                });
                ["pointerup", "pointercancel", "lostpointercapture"].forEach(ev => btn.addEventListener(ev, stop));
                // 键盘触发的 click，detail 是 0
                btn.addEventListener("click", function (e) {
                    if (e.detail === 0 && !btn.disabled && !input.disabled) {
                        applyDelta(dir);
                        input.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                });
            }
            bindHold(dec, -1);
            bindHold(inc, 1);
            input.addEventListener("input", function () { fitWidth(); refreshButtons(); });
            // 失焦时把越界值夹回来再保存
            input.addEventListener("change", function () {
                if (!input.disabled) {
                    const raw = parseFloat(input.value);
                    const snapped = clampSnap(isNaN(raw) ? (min !== -Infinity ? min : 0) : raw);
                    if (String(snapped) !== input.value) {
                        input.value = String(snapped);
                        input.dispatchEvent(new Event("input", { bubbles: true }));
                    }
                }
                fitWidth();
                refreshButtons();
            });
            fitWidth();
            refreshButtons();
        });
    }
    function createLiveSettingsPanel() {
        const panel = document.createElement("div");
        panel.id = "bilibili-live-quality-selector";
        function updatePanel() {
            const LIVE_QUALITIES = [
                { value: "最高画质", label: "最高画质" },
                { value: "1080P 原画", label: "1080P 原画 / 高码率" },
                { value: "1080P 蓝光", label: "1080P 蓝光" },
                { value: "720P 超清", label: "720P 超清" },
            ];
            const pollingActive = state.liveQualityPollingEnabled && state.livePollingTimerId !== null;
            const keepAliveActive = state.liveKeepAliveEnabled && state.liveKeepAliveTimerId !== null;
            panel.innerHTML = `
            <h2>直播设置</h2>
            ${renderGithubLink()}
            <div class="quality-section-title">画质选择</div>
            <div class="live-quality-group">
              ${LIVE_QUALITIES.map(q => `<button class="live-quality-button ${q.value === state.userLiveQualitySetting ? 'active' : ''}" data-quality="${q.value}">${q.label}</button>`).join('')}
            </div>
            <div class="quality-section-title">画质稳定<span class="beta-tag">BETA</span></div>
            <div class="toggle-switch">
              <label for="prevent-bg-degrade">
                防后台降画质
                <div class="description">切到其他标签时不降画质</div>
              </label>
              <label class="switch">
                <input type="checkbox" id="prevent-bg-degrade" ${state.preventBackgroundDegrade ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>
            <div class="toggle-switch">
              <label for="live-auto-recover">
                切回前台时自动纠正画质
                <div class="description">发现画质与目标不符时自动重切</div>
              </label>
              <label class="switch">
                <input type="checkbox" id="live-auto-recover" ${state.liveAutoRecoverOnVisible ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>
            <div class="toggle-switch">
              <label for="live-danmaku-sync">
                切回前台时刷新弹幕
                <div class="description">自动开关弹幕以同步弹幕状态</div>
              </label>
              <label class="switch">
                <input type="checkbox" id="live-danmaku-sync" ${state.liveDanmakuSync ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>
            <div class="quality-section-title">画质锁定<span class="beta-tag">BETA</span></div>
            <div class="toggle-switch">
              <label for="live-quality-polling">
                画质轮询锁定
                <div class="description" id="live-polling-status">${pollingActive ? '运行中，每 ' + state.livePollingInterval + ' 秒检查一次' : '未启用'}</div>
              </label>
              <label class="switch">
                <input type="checkbox" id="live-quality-polling" ${state.liveQualityPollingEnabled ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>
            <div class="input-group ${!state.liveQualityPollingEnabled ? 'disabled' : ''}" id="live-polling-interval-group">
              <label for="live-polling-interval">
                轮询间隔
                <div class="description">检查并切换画质的间隔时间</div>
              </label>
              <div class="num-stepper">
                <button class="ns-btn ns-dec" type="button" aria-label="减少">−</button>
                <div class="ns-field">
                  <input type="number" id="live-polling-interval" value="${state.livePollingInterval}" min="5" max="3600" step="1" ${!state.liveQualityPollingEnabled ? 'disabled' : ''}>
                  <span class="unit">秒</span>
                </div>
                <button class="ns-btn ns-inc" type="button" aria-label="增加">+</button>
              </div>
            </div>
            <div class="quality-section-title">页面保活<span class="beta-tag">BETA</span></div>
            <div class="toggle-switch">
              <label for="live-keep-alive">
                模拟用户活跃
                <div class="description" id="live-keepalive-status">${keepAliveActive ? '运行中，每 ' + state.liveKeepAliveInterval + ' 分钟模拟一次' : '未启用'}</div>
              </label>
              <label class="switch">
                <input type="checkbox" id="live-keep-alive" ${state.liveKeepAliveEnabled ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>
            <div class="input-group ${!state.liveKeepAliveEnabled ? 'disabled' : ''}" id="live-keepalive-interval-group">
              <label for="live-keepalive-interval">
                保活间隔
                <div class="description">模拟鼠标移动的间隔时间</div>
              </label>
              <div class="num-stepper">
                <button class="ns-btn ns-dec" type="button" aria-label="减少">−</button>
                <div class="ns-field">
                  <input type="number" id="live-keepalive-interval" value="${state.liveKeepAliveInterval}" min="1" max="1440" step="1" ${!state.liveKeepAliveEnabled ? 'disabled' : ''}>
                  <span class="unit">分钟</span>
                </div>
                <button class="ns-btn ns-inc" type="button" aria-label="增加">+</button>
              </div>
            </div>
          `;
            panel.querySelectorAll(".live-quality-button").forEach(button => {
                button.addEventListener("click", () => {
                    state.userLiveQualitySetting = button.getAttribute("data-quality");
                    GM_setValue("liveQualitySetting", state.userLiveQualitySetting);
                    updatePanel();
                    selectLiveQuality();
                    restartLivePollingIfNeeded();
                });
            });
            const pollingSwitch = panel.querySelector("#live-quality-polling");
            if (pollingSwitch) {
                pollingSwitch.addEventListener("change", function (e) {
                    state.liveQualityPollingEnabled = e.target.checked;
                    GM_setValue("liveQualityPollingEnabled", state.liveQualityPollingEnabled);
                    const intervalGroup = panel.querySelector("#live-polling-interval-group");
                    const intervalInputEl = panel.querySelector("#live-polling-interval");
                    if (intervalGroup) intervalGroup.classList.toggle("disabled", !state.liveQualityPollingEnabled);
                    if (intervalInputEl) intervalInputEl.disabled = !state.liveQualityPollingEnabled;
                    if (state.liveQualityPollingEnabled) {
                        startLivePolling();
                    } else {
                        stopLivePolling();
                    }
                });
            }
            const intervalInput = panel.querySelector("#live-polling-interval");
            if (intervalInput) {
                intervalInput.addEventListener("change", function (e) {
                    let value = parseInt(e.target.value, 10);
                    if (isNaN(value) || value < 5) value = 5;
                    if (value > 3600) value = 3600;
                    e.target.value = value;
                    state.livePollingInterval = value;
                    GM_setValue("livePollingInterval", value);
                    restartLivePollingIfNeeded();
                    updatePollingStatusIndicator();
                });
            }
            const keepAliveSwitch = panel.querySelector("#live-keep-alive");
            if (keepAliveSwitch) {
                keepAliveSwitch.addEventListener("change", function (e) {
                    state.liveKeepAliveEnabled = e.target.checked;
                    GM_setValue("liveKeepAliveEnabled", state.liveKeepAliveEnabled);
                    const kaGroup = panel.querySelector("#live-keepalive-interval-group");
                    const kaInput = panel.querySelector("#live-keepalive-interval");
                    if (kaGroup) kaGroup.classList.toggle("disabled", !state.liveKeepAliveEnabled);
                    if (kaInput) kaInput.disabled = !state.liveKeepAliveEnabled;
                    if (state.liveKeepAliveEnabled) {
                        startLiveKeepAlive();
                    } else {
                        stopLiveKeepAlive();
                    }
                });
            }
            const keepAliveIntervalInput = panel.querySelector("#live-keepalive-interval");
            if (keepAliveIntervalInput) {
                keepAliveIntervalInput.addEventListener("change", function (e) {
                    let value = parseInt(e.target.value, 10);
                    if (isNaN(value) || value < 1) value = 1;
                    if (value > 1440) value = 1440;
                    e.target.value = value;
                    state.liveKeepAliveInterval = value;
                    GM_setValue("liveKeepAliveInterval", value);
                    if (state.liveKeepAliveEnabled) startLiveKeepAlive();
                    updateKeepAliveStatusIndicator();
                });
            }
            const preventBgSwitch = panel.querySelector("#prevent-bg-degrade");
            if (preventBgSwitch) {
                preventBgSwitch.addEventListener("change", function (e) {
                    state.preventBackgroundDegrade = e.target.checked;
                    GM_setValue("preventBackgroundDegrade", state.preventBackgroundDegrade);
                    applyVisibilityHijack(state.preventBackgroundDegrade);
                });
            }
            const liveAutoRecoverSwitch = panel.querySelector("#live-auto-recover");
            if (liveAutoRecoverSwitch) {
                liveAutoRecoverSwitch.addEventListener("change", function (e) {
                    state.liveAutoRecoverOnVisible = e.target.checked;
                    GM_setValue("liveAutoRecoverOnVisible", state.liveAutoRecoverOnVisible);
                });
            }
            const liveDanmakuSyncSwitch = panel.querySelector("#live-danmaku-sync");
            if (liveDanmakuSyncSwitch) {
                liveDanmakuSyncSwitch.addEventListener("change", function (e) {
                    state.liveDanmakuSync = e.target.checked;
                    GM_setValue("liveDanmakuSync", state.liveDanmakuSync);
                });
            }
            setupSteppers(panel);
        }
        document.body.appendChild(panel);
        panel.updatePanel = updatePanel;
        updatePanel();
    }
    const LIVE_QUALITY_QN_MAP = {
        "1080P 原画": 10000,
        "1080P 蓝光": 400,
        "720P 超清": 250,
    };
    function resolveLiveTargetQuality(qualityCandidates) {
        if (!qualityCandidates || qualityCandidates.length === 0) return null;
        if (state.userLiveQualitySetting === "最高画质") {
            return qualityCandidates[0];
        }
        const targetQn = LIVE_QUALITY_QN_MAP[state.userLiveQualitySetting];
        if (typeof targetQn === "number") {
            const byQn = qualityCandidates.find(q => Number(q.qn) === targetQn);
            if (byQn) return byQn;
        }
        return qualityCandidates.find(q => q.desc.includes(state.userLiveQualitySetting)) || null;
    }
    async function selectLiveQuality() {
        const taskId = taskQueue.currentTaskId;
        const readyResult = await new Promise(resolve => {
            let attempts = 0;
            const timer = setInterval(() => {
                if (taskQueue.isTaskCancelled(taskId)) {
                    clearInterval(timer);
                    resolve("cancelled");
                    return;
                }
                if (
                    unsafeWindow.livePlayer &&
                    unsafeWindow.livePlayer.getPlayerInfo &&
                    unsafeWindow.livePlayer.getPlayerInfo().playurl &&
                    unsafeWindow.livePlayer.switchQuality
                ) {
                    clearInterval(timer);
                    resolve("ready");
                    return;
                }
                if (++attempts >= 30) {
                    clearInterval(timer);
                    resolve("timeout");
                }
            }, 1000);
        });
        if (readyResult !== "ready") {
            console.log(readyResult === "cancelled"
                ? "[直播画质] 任务已取消，停止后续操作"
                : "[直播画质] 等待播放器就绪超时，停止后续操作");
            return;
        }
        const qualityCandidates = unsafeWindow.livePlayer.getPlayerInfo().qualityCandidates;
        console.log("[直播画质] 可用画质选项:", qualityCandidates.map((q, i) => `${i + 1}. ${q.desc} (qn: ${q.qn})`));
        console.log("[直播画质] 选择的画质:", state.userLiveQualitySetting);

        const targetQuality = resolveLiveTargetQuality(qualityCandidates);

        if (!targetQuality) {
            if (!qualityCandidates || qualityCandidates.length === 0) {
                console.log("[直播画质] 画质切换失败 (候选列表为空)，跳过切换。");
            } else {
                console.log(`[直播画质] 画质切换失败 (未找到匹配项: ${state.userLiveQualitySetting})，跳过切换。`);
            }
            return;
        }

        console.log("[直播画质] 目标画质:", targetQuality.desc, "(qn:", targetQuality.qn, ")");
        function switchQuality() {
            const shouldForceHighestOnce = state.liveEntryForceHighest && state.userLiveQualitySetting === "最高画质";
            const currentQualityNumber = unsafeWindow.livePlayer.getPlayerInfo().quality;
            if (currentQualityNumber !== targetQuality.qn || shouldForceHighestOnce) {
                unsafeWindow.livePlayer.switchQuality(targetQuality.qn);
                if (shouldForceHighestOnce) state.liveEntryForceHighest = false;
                state.qualitySetSuccessfully = true;
                console.log("[直播画质] 已切换到目标画质:", targetQuality.desc);
                updateLiveSettingsPanel();

                // 轮询锁定运行时由轮询接管验证，跳过二次验证
                if (state.liveQualityPollingEnabled && state.livePollingTimerId !== null) {
                    console.log("[直播画质] 轮询锁定运行中，跳过二次验证");
                } else {
                    const { enabled, delayMs } = getDoubleCheckConfig(true);
                    if (enabled) {
                        console.log(`[直播画质] 等待 ${delayMs} 毫秒后进行二次验证...`);
                        taskQueue.scheduleTask(taskId, async () => {
                            if (taskQueue.isTaskCancelled(taskId)) return;
                            const currentQualityAfterSwitch = unsafeWindow.livePlayer.getPlayerInfo().quality;
                            if (currentQualityAfterSwitch !== targetQuality.qn) {
                                console.log("[直播画质] 画质切换可能未成功，执行二次切换...");
                                unsafeWindow.livePlayer.switchQuality(targetQuality.qn);
                            } else {
                                console.log("[直播画质] 画质切换验证成功，当前画质:", targetQuality.desc);
                            }
                        }, delayMs);
                    } else {
                        console.log("[直播画质] 二次验证已关闭，跳过验证");
                    }
                }
            } else {
                state.qualitySetSuccessfully = true;
                console.log("[直播画质] 已经是目标画质:", targetQuality.desc);
            }
        }
        switchQuality();
    }
    function updateLiveSettingsPanel() {
        const panel = document.getElementById("bilibili-live-quality-selector");
        if (panel && typeof panel.updatePanel === "function") panel.updatePanel();
    }
    function updatePollingStatusIndicator() {
        const statusEl = document.getElementById("live-polling-status");
        if (!statusEl) return;
        const pollingActive = state.liveQualityPollingEnabled && state.livePollingTimerId !== null;
        statusEl.textContent = pollingActive
            ? '运行中，每 ' + state.livePollingInterval + ' 秒检查一次'
            : '未启用';
    }
    function startLivePolling() {
        stopLivePolling();
        if (!state.liveQualityPollingEnabled) return;
        const intervalMs = state.livePollingInterval * 1000;
        console.log(`[直播轮询] 启动画质轮询锁定，间隔 ${state.livePollingInterval} 秒`);
        state.livePollingTimerId = setInterval(() => {
            try {
                if (!unsafeWindow.livePlayer || !unsafeWindow.livePlayer.getPlayerInfo || !unsafeWindow.livePlayer.switchQuality) {
                    console.log("[直播轮询] 播放器尚未就绪，跳过本次轮询");
                    return;
                }
                const playerInfo = unsafeWindow.livePlayer.getPlayerInfo();
                const targetQuality = resolveLiveTargetQuality(playerInfo.qualityCandidates);
                if (!targetQuality) return;
                const currentQn = playerInfo.quality;
                if (currentQn !== targetQuality.qn) {
                    console.log(`[直播轮询] 画质偏离：当前 qn=${currentQn}，目标 ${targetQuality.desc} (qn=${targetQuality.qn})，执行切换`);
                    unsafeWindow.livePlayer.switchQuality(targetQuality.qn);
                } else {
                    console.log(`[直播轮询] 画质正常：${targetQuality.desc} (qn=${targetQuality.qn})`);
                }
            } catch (e) {
                console.warn("[直播轮询] 轮询执行出错:", e);
            }
        }, intervalMs);
        updatePollingStatusIndicator();
    }
    function stopLivePolling() {
        if (state.livePollingTimerId !== null) {
            clearInterval(state.livePollingTimerId);
            state.livePollingTimerId = null;
            console.log("[直播轮询] 已停止画质轮询锁定");
        }
        updatePollingStatusIndicator();
    }
    function restartLivePollingIfNeeded() {
        if (state.liveQualityPollingEnabled) {
            startLivePolling();
        }
    }
    function startLiveKeepAlive() {
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
                document.dispatchEvent(evt);
                console.log("[直播保活] 已模拟鼠标移动");
            } catch (e) {
                console.warn("[直播保活] 模拟操作失败:", e);
            }
        }, intervalMs);
        updateKeepAliveStatusIndicator();
    }
    function stopLiveKeepAlive() {
        if (state.liveKeepAliveTimerId !== null) {
            clearInterval(state.liveKeepAliveTimerId);
            state.liveKeepAliveTimerId = null;
            console.log("[直播保活] 已停止模拟活跃");
        }
        updateKeepAliveStatusIndicator();
    }
    function updateKeepAliveStatusIndicator() {
        const statusEl = document.getElementById("live-keepalive-status");
        if (!statusEl) return;
        const active = state.liveKeepAliveEnabled && state.liveKeepAliveTimerId !== null;
        statusEl.textContent = active
            ? '运行中，每 ' + state.liveKeepAliveInterval + ' 分钟模拟一次'
            : '未启用';
    }
    function createDecodeSettingsPanel() {
        const panel = document.createElement("div");
        panel.id = "bilibili-decode-settings";
        const OPTIONS = ["默认", "AV1", "HEVC", "AVC"];
        panel.innerHTML = `
          <h2>解码设置</h2>
          ${renderGithubLink()}
          <div class="toggle-switch">
            <label for="decode-setting-enabled">启用解码设置</label>
            <label class="switch">
              <input type="checkbox" id="decode-setting-enabled" ${state.decodeSettingEnabled ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          <div class="decode-strategy${state.decodeSettingEnabled ? '' : ' disabled'}" id="decode-strategy">
            <div class="quality-group">
              ${OPTIONS.map(o => `<button class="quality-button ${(state.isLivePage ? state.userLiveDecodeSetting : state.userVideoDecodeSetting) === o ? 'active' : ''}" data-decode="${o}">${o}</button>`).join('')}
            </div>
          </div>
        `;
        panel.querySelector("#decode-setting-enabled").addEventListener("change", function (e) {
            state.decodeSettingEnabled = e.target.checked;
            GM_setValue("decodeSettingEnabled", state.decodeSettingEnabled);
            console.log(`[解码设置] 解码设置已${state.decodeSettingEnabled ? '启用' : '关闭'}`);
            const strategy = panel.querySelector("#decode-strategy");
            if (strategy) strategy.classList.toggle("disabled", !state.decodeSettingEnabled);
            if (state.decodeSettingEnabled) {
                applyDecodeSetting();
            }
        });
        panel.addEventListener("click", function (e) {
            const target = e.target;
            if (target.classList.contains("quality-button")) {
                const value = target.getAttribute("data-decode");
                if (state.isLivePage) {
                    state.userLiveDecodeSetting = value;
                    GM_setValue("liveDecodeSetting", value);
                } else {
                    state.userVideoDecodeSetting = value;
                    GM_setValue("videoDecodeSetting", value);
                }
                Utils.queryAll(".quality-button", panel).forEach(btn => {
                    btn.classList.toggle("active", btn === target);
                });
                if (state.decodeSettingEnabled) {
                    applyDecodeSetting();
                }
            }
        });
        document.body.appendChild(panel);
    }
    function updateDecodeButtons(panel) {
        if (!panel) return;
        const enableSwitch = panel.querySelector('#decode-setting-enabled');
        if (enableSwitch) {
            enableSwitch.checked = state.decodeSettingEnabled;
        }
        const strategy = panel.querySelector('#decode-strategy');
        if (strategy) strategy.classList.toggle('disabled', !state.decodeSettingEnabled);
        Utils.queryAll('.quality-button', panel).forEach(btn => {
            const wanted = state.isLivePage ? state.userLiveDecodeSetting : state.userVideoDecodeSetting;
            btn.classList.toggle('active', btn.getAttribute('data-decode') === (wanted || '默认'));
        });
    }
    function toggleDecodeSettingsPanel() {
        togglePanel("bilibili-decode-settings", createDecodeSettingsPanel, updateDecodeButtons);
    }
    function applyDecodeSetting(retryCount = 0) {
        if (!state.decodeSettingEnabled) {
            console.log('[解码设置] 解码设置未启用，跳过');
            return;
        }
        const maxRetries = 8;
        const wanted = state.isLivePage ? (state.userLiveDecodeSetting || '默认') : (state.userVideoDecodeSetting || '默认');
        // 直播页：点击 UL 列表项
        if (state.isLivePage) {
            const decodeList = document.querySelector('.YccudlUCmLKcUTg_yzKN');
            if (!decodeList) {
                if (retryCount < maxRetries) {
                    setTimeout(() => applyDecodeSetting(retryCount + 1), 1000);
                } else {
                    console.log('[解码设置] 未找到直播解码列表');
                }
                return;
            }
            const items = Array.from(decodeList.querySelectorAll('li.HfodaIBaRC9NaglgykBX'));
            if (items.length === 0) {
                if (retryCount < maxRetries) {
                    setTimeout(() => applyDecodeSetting(retryCount + 1), 1000);
                } else {
                    console.log('[解码设置] 直播解码选项为空');
                }
                return;
            }
            const selectedClass = 'fG2r2piYghHTQKQZF8bl';
            let target = items.find(li => (li.textContent || '').trim().includes(wanted)) || items[0];
            if (!target) return;
            if (target.classList.contains(selectedClass)) {
                console.log('[解码设置] 直播页已是目标解码:', (target.textContent || '').trim());
            } else {
                console.log('[解码设置] 直播页切换解码为:', (target.textContent || '').trim());
                target.click();
            }
        } else {
            // 视频页：点击 bui-radio 按钮
            const radioItems = Array.from(document.querySelectorAll('.bui-radio-wrap.bui-radio-button .bui-radio-item'));
            if (radioItems.length === 0) {
                if (retryCount < maxRetries) {
                    setTimeout(() => applyDecodeSetting(retryCount + 1), 1000);
                } else {
                    console.log('[解码设置] 未找到视频页编码单选项');
                }
                return;
            }
            function getText(el) {
                const t = el.querySelector('.bui-radio-text');
                return (t && t.textContent ? t.textContent : el.textContent || '').trim();
            }
            let target = radioItems.find(el => getText(el).includes(wanted));
            if (!target) {
                // 兜底：若未匹配到，优先第一个
                target = radioItems[0];
            }
            if (!target) return;
            // 若已选中则跳过
            const input = target.querySelector('input.bui-radio-input');
            if (input && (input.checked || input.getAttribute('checked') !== null)) {
                console.log('[解码设置] 视频页已是目标解码:', getText(target));
            } else {
                console.log('[解码设置] 视频页切换解码为:', getText(target));
                (input || target).click();
            }
        }
        const panel = document.getElementById('bilibili-decode-settings');
        if (panel) updateDecodeButtons(panel);
    }
    function createUnlockSettingsPanel() {
        const panel = document.createElement("div");
        panel.id = "bilibili-unlock-settings";
        panel.innerHTML = `
          <h2>解锁设置</h2>
          ${renderGithubLink()}
          <div class="toggle-switch">
            <label for="unlock-ua">
              开启 UA 修改
              <div class="description">启用后将模拟 Safari UA 并调整触控点</div>
            </label>
            <label class="switch">
              <input type="checkbox" id="unlock-ua" ${state.unlockUA ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          <div class="toggle-switch">
            <label for="unlock-hdr">
              开启 HDR 修改
              <div class="description">写入本地标记以尝试显示 HDR 相关选项</div>
            </label>
            <label class="switch">
              <input type="checkbox" id="unlock-hdr" ${state.unlockHDR ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          <div class="toggle-switch">
            <label for="unlock-marker">
              开启标记解锁
              <div class="description">写入本地标记以尝试解锁 杜比全景声/8K</div>
            </label>
            <label class="switch">
              <input type="checkbox" id="unlock-marker" ${state.unlockMarker ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          <button class="refresh-button">确认并刷新页面</button>
        `;
        document.body.appendChild(panel);
        panel.querySelector('#unlock-ua').addEventListener('change', function (e) {
            state.unlockUA = e.target.checked;
            GM_setValue("unlockUA", state.unlockUA);
            console.log(`[解锁设置] 开启 UA 修改: ${state.unlockUA}`);
        });
        panel.querySelector('#unlock-hdr').addEventListener('change', function (e) {
            state.unlockHDR = e.target.checked;
            GM_setValue("unlockHDR", state.unlockHDR);
            console.log(`[解锁设置] 开启 HDR 修改: ${state.unlockHDR}`);
        });
        panel.querySelector('#unlock-marker').addEventListener('change', function (e) {
            state.unlockMarker = e.target.checked;
            GM_setValue("unlockMarker", state.unlockMarker);
            console.log(`[解锁设置] 开启标记解锁: ${state.unlockMarker}`);
        });
        panel.querySelector('.refresh-button').addEventListener('click', function () {
            console.log('[解锁设置] 已确认，准备刷新页面以应用设置');
            location.reload();
        });
        return panel;
    }
    function createDevSettingsPanel() {
        const panel = document.createElement("div");
        panel.id = "bilibili-dev-settings";
        panel.innerHTML = `
          <h2>开发者设置</h2>
          ${renderGithubLink()}
          <div class="dev-warning">以下选项的错误配置可能会影响脚本正常工作</div>
          <div class="toggle-switch">
            <label for="dev-mode">
              开发者模式
              <div class="description">启用后可以使用开发者选项</div>
            </label>
            <label class="switch">
              <input type="checkbox" id="dev-mode" ${state.devModeEnabled ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          <div class="vip-status-section">
            <div class="vip-status-title">模拟会员状态</div>
            <div class="vip-status-description">模拟脚本所识别到的大会员状态，<b>并非破解</b></div>
            <div class="vip-status-tabs ${!state.devModeEnabled ? 'disabled' : ''}" data-active="${state.devModeVipStatus}">
              <div class="vip-tab-indicator"></div>
              <div class="vip-status-tab ${state.devModeVipStatus === '默认' ? 'active' : ''}" data-status="默认">默认</div>
              <div class="vip-status-tab ${state.devModeVipStatus === '普通' ? 'active' : ''}" data-status="普通">普通</div>
              <div class="vip-status-tab ${state.devModeVipStatus === '会员' ? 'active' : ''}" data-status="会员">会员</div>
            </div>
          </div>
          <div class="toggle-switch">
            <label for="quality-double-check">
              视频画质二次验证
              <div class="description">启用后将在视频画质切换后等待指定时间后进行验证</div>
            </label>
            <label class="switch">
              <input type="checkbox" id="quality-double-check" ${state.qualityDoubleCheck ? 'checked' : ''} ${!state.devModeEnabled ? 'disabled' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          <div class="toggle-switch">
            <label for="live-quality-double-check">
              直播画质二次验证
              <div class="description">启用后将在直播画质切换后等待指定时间后进行验证</div>
            </label>
            <label class="switch">
              <input type="checkbox" id="live-quality-double-check" ${state.liveQualityDoubleCheck ? 'checked' : ''} ${!state.devModeEnabled ? 'disabled' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          <div class="toggle-switch">
            <label for="dev-allow-freevip">
              非会员允许限免画质
              <div class="description">默认关闭，避免可能出现的会员推广</div>
            </label>
            <label class="switch">
              <input type="checkbox" id="dev-allow-freevip" ${state.devAllowFreeVipQualities ? 'checked' : ''} ${!state.devModeEnabled ? 'disabled' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          <div class="toggle-switch">
            <label for="dev-no-login">
              未登录模式
              <div class="description">启用后不等待头像加载，默认最高画质1080P</div>
            </label>
            <label class="switch">
              <input type="checkbox" id="dev-no-login" ${state.devModeNoLoginStatus ? 'checked' : ''} ${!state.devModeEnabled ? 'disabled' : ''}>
              <span class="slider"></span>
            </label>
          </div>

          <div class="toggle-switch">
            <label for="preserve-touch-points">
              保留触控点
              <div class="description">启用后保留 maxTouchPoints 原值，确保触屏功能正常</div>
            </label>
            <label class="switch">
              <input type="checkbox" id="preserve-touch-points" ${state.preserveTouchPoints ? 'checked' : ''} ${!state.devModeEnabled ? 'disabled' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          <div class="toggle-switch">
            <label for="disable-hdr">
              禁用 HDR 和杜比视界
              <div class="description">开启后选择 HDR 和杜比视界以外的最高画质</div>
            </label>
            <label class="switch">
              <input type="checkbox" id="disable-hdr" ${state.disableHDROption ? 'checked' : ''} ${!state.devModeEnabled ? 'disabled' : ''}>
              <span class="slider"></span>
            </label>
          </div>

          <div class="toggle-switch">
            <label for="remove-quality-button">
              移除清晰度按钮
              <div class="description">启用后将隐藏播放器的清晰度按钮</div>
            </label>
            <label class="switch">
              <input type="checkbox" id="remove-quality-button" ${state.takeOverQualityControl ? 'checked' : ''} ${!state.devModeEnabled ? 'disabled' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          <div class="input-group ${!state.devModeEnabled ? 'disabled' : ''}">
            <label for="dev-double-check-delay">
              二次验证等待时间
              <div class="description">画质切换后等待验证的时间</div>
            </label>
            <div class="num-stepper">
              <button class="ns-btn ns-dec" type="button" aria-label="减少">−</button>
              <div class="ns-field">
                <input type="number" id="dev-double-check-delay" value="${state.devDoubleCheckDelay}" min="0" max="20000" step="100" ${!state.devModeEnabled ? 'disabled' : ''}>
                <span class="unit">毫秒</span>
              </div>
              <button class="ns-btn ns-inc" type="button" aria-label="增加">+</button>
            </div>
          </div>
          <div class="input-group ${!state.devModeEnabled ? 'disabled' : ''}">
            <label for="dev-audio-delay">
              音质切换初始延迟
              <div class="description">音质切换重试的初始等待时间，后续等待时间将以此为基数进行指数退避</div>
            </label>
            <div class="num-stepper">
              <button class="ns-btn ns-dec" type="button" aria-label="减少">−</button>
              <div class="ns-field">
                <input type="number" id="dev-audio-delay" value="${state.devModeAudioDelay}" min="0" max="10000" step="100" ${!state.devModeEnabled ? 'disabled' : ''}>
                <span class="unit">毫秒</span>
              </div>
              <button class="ns-btn ns-inc" type="button" aria-label="增加">+</button>
            </div>
          </div>
          <div class="input-group ${!state.devModeEnabled ? 'disabled' : ''}">
            <label for="dev-audio-retries">
              音质切换重试次数
              <div class="description">音质切换失败后的重试次数</div>
            </label>
            <div class="num-stepper">
              <button class="ns-btn ns-dec" type="button" aria-label="减少">−</button>
              <div class="ns-field">
                <input type="number" id="dev-audio-retries" value="${state.devModeAudioRetries}" min="0" max="5" step="1" ${!state.devModeEnabled ? 'disabled' : ''}>
                <span class="unit">次</span>
              </div>
              <button class="ns-btn ns-inc" type="button" aria-label="增加">+</button>
            </div>
          </div>
          <div id="dev-warning" class="warning" style="display: none;"></div>
          <button class="refresh-button">确认并刷新页面</button>
        `;
        document.body.appendChild(panel);
        setupSteppers(panel);
        panel.querySelector('#dev-mode').addEventListener('change', function (e) {
            setSetting("devModeEnabled", "devModeEnabled", e.target.checked);
            setDevPanelEnabled(panel, state.devModeEnabled);
        });
        panel.querySelector('#quality-double-check').addEventListener('change', function (e) {
            setSetting("qualityDoubleCheck", "qualityDoubleCheck", e.target.checked);
        });
        panel.querySelector('#live-quality-double-check').addEventListener('change', function (e) {
            setSetting("liveQualityDoubleCheck", "liveQualityDoubleCheck", e.target.checked);
        });
        // 会员状态按钮点击事件
        const vipStatusTabs = panel.querySelector('.vip-status-tabs');
        if (vipStatusTabs) {
            vipStatusTabs.addEventListener('click', function (e) {
                if (!state.devModeEnabled) return;
                const target = e.target;
                if (target.classList.contains('vip-status-tab')) {
                    const status = target.getAttribute('data-status');
                    setSetting("devModeVipStatus", "devModeVipStatus", status);

                    // 更新UI状态
                    vipStatusTabs.setAttribute('data-active', status);
                    vipStatusTabs.querySelectorAll('.vip-status-tab').forEach(tab => {
                        tab.classList.toggle('active', tab.getAttribute('data-status') === status);
                    });

                    console.log(`[开发者模式] 会员状态设置为: ${status}`);
                }
            });
        }
        panel.querySelector('#dev-no-login').addEventListener('change', function (e) {
            setSetting("devModeNoLoginStatus", "devModeNoLoginStatus", e.target.checked);
        });

        panel.querySelector('#dev-allow-freevip').addEventListener('change', function (e) {
            setSetting("devAllowFreeVipQualities", "devAllowFreeVipQualities", e.target.checked);
        });

        panel.querySelector('#preserve-touch-points').addEventListener('change', function(e) {
            setSetting("preserveTouchPoints", "preserveTouchPoints", e.target.checked);
        });
        panel.querySelector('#disable-hdr').addEventListener('change', function (e) {
            setSetting("disableHDROption", "disableHDR", e.target.checked);
        });

        panel.querySelector('#remove-quality-button').addEventListener('change', function (e) {
            setSetting("takeOverQualityControl", "takeOverQualityControl", e.target.checked);
        });
        // 绑定三个数字输入框的事件
        panel.querySelector('#dev-double-check-delay').addEventListener('input', function (e) {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value)) {
                setSetting("devDoubleCheckDelay", "devDoubleCheckDelay", value);
            }
        });
        panel.querySelector('#dev-audio-delay').addEventListener('input', function (e) {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value)) {
                setSetting("devModeAudioDelay", "devModeAudioDelay", value);
            }
        });
        panel.querySelector('#dev-audio-retries').addEventListener('input', function (e) {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value)) {
                setSetting("devModeAudioRetries", "devModeAudioRetries", value);
            }
        });
        panel.querySelector('.refresh-button').addEventListener('click', function () {
            location.reload();
        });
        return panel;
    }
    function togglePanel(panelId, createPanelFunc, updateFunc) {
        let panel = document.getElementById(panelId);
        if (!panel) {
            createPanelFunc();
            panel = document.getElementById(panelId);
        }
        // 打开时按需挂载到当前全屏根，避免全屏下不可见
        const root = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || document.body;
        if (panel && panel.parentElement !== root) root.appendChild(panel);
        // 起点在面板里就不关，避免拖拽合成的外部 mousedown 误关
        let pressStartedInside = false;
        function handlePointerDownOrigin(event) {
            pressStartedInside = !!(panel && panel.contains(event.target));
        }
        function handleOutsideClick(event) {
            if (pressStartedInside) return;
            if (panel && !panel.contains(event.target)) {
                panel.classList.remove("show");
                document.removeEventListener("pointerdown", handlePointerDownOrigin, true);
                document.removeEventListener("mousedown", handleOutsideClick);
            }
        }
        if (!panel.classList.contains("show")) {
            PANEL_IDS.forEach(id => {
                if (id !== panelId) {
                    const otherPanel = document.getElementById(id);
                    if (otherPanel && otherPanel.classList.contains("show")) otherPanel.classList.remove("show");
                }
            });
            panel.classList.add("show");
            document.addEventListener("pointerdown", handlePointerDownOrigin, true);
            document.addEventListener("mousedown", handleOutsideClick);
        } else {
            panel.classList.remove("show");
            document.removeEventListener("pointerdown", handlePointerDownOrigin, true);
            document.removeEventListener("mousedown", handleOutsideClick);
        }
        if (updateFunc) updateFunc(panel);
    }
    function toggleSettingsPanel() {
        togglePanel("bilibili-quality-selector", createSettingsPanel, updateQualityButtons);
    }
    function toggleLiveSettingsPanel() {
        togglePanel("bilibili-live-quality-selector", createLiveSettingsPanel, updateLiveSettingsPanel);
    }
    function toggleDevSettingsPanel() {
        togglePanel("bilibili-dev-settings", createDevSettingsPanel, function (panel) {
            const removeQualityButton = panel.querySelector('#remove-quality-button');
            if (removeQualityButton) removeQualityButton.checked = state.takeOverQualityControl;

            // 更新会员状态UI
            const vipStatusTabs = panel.querySelector('.vip-status-tabs');
            if (vipStatusTabs) {
                vipStatusTabs.setAttribute('data-active', state.devModeVipStatus);
                vipStatusTabs.querySelectorAll('.vip-status-tab').forEach(tab => {
                    tab.classList.toggle('active', tab.getAttribute('data-status') === state.devModeVipStatus);
                });
            }
        });
    }
    function toggleUnlockSettingsPanel() {
        togglePanel("bilibili-unlock-settings", createUnlockSettingsPanel);
    }

    let _wsObserver = null;
    let _wsTimeout = null;
    function applyAutoWidescreen() {
        if (_wsObserver) { _wsObserver.disconnect(); _wsObserver = null; }
        if (_wsTimeout) { clearTimeout(_wsTimeout); _wsTimeout = null; }
        if (!state.autoWidescreen || state.isLivePage) return;
        function clickWide() {
            const btn = document.querySelector('.bpx-player-ctrl-wide');
            if (!btn) return false;
            const enter = btn.querySelector('.bpx-player-ctrl-wide-enter');
            if (enter && getComputedStyle(enter).display !== 'none') {
                btn.click();
                console.log("[自动宽屏] 已自动切换到宽屏模式");
            }
            return true;
        }
        if (clickWide()) return;
        const root = document.getElementById('bilibili-player') || document.body;
        _wsObserver = new MutationObserver(() => {
            if (clickWide()) {
                _wsObserver.disconnect(); _wsObserver = null;
                if (_wsTimeout) { clearTimeout(_wsTimeout); _wsTimeout = null; }
            }
        });
        _wsObserver.observe(root, { childList: true, subtree: true });
        _wsTimeout = setTimeout(() => {
            if (_wsObserver) { _wsObserver.disconnect(); _wsObserver = null; }
            _wsTimeout = null;
        }, 15000);
    }

    let _danmakuSyncing = false;
    function syncLiveDanmaku() {
        if (_danmakuSyncing) return;
        try {
            const lp = unsafeWindow.livePlayer;
            if (!lp?.getPlayerInfo || !lp?.updateDMSetting) return;
            if (!lp.getPlayerInfo()?.danmaku?.display) return;
            _danmakuSyncing = true;
            lp.updateDMSetting({ display: false });
            setTimeout(() => {
                try { lp.updateDMSetting({ display: true }); } catch (e) {}
                _danmakuSyncing = false;
                console.log("[弹幕同步] 已刷新直播弹幕");
            }, 500);
        } catch (e) {
            _danmakuSyncing = false;
            console.warn("[弹幕同步] 执行失败:", e);
        }
    }

    // 注入设置按钮相关操作
    function ensureQualitySettingsButton(shouldInject) {
        const qualityControl = document.querySelector('.bpx-player-ctrl-quality:not(.auto-quality-injected)');
        if (!qualityControl) return;
        const parent = qualityControl.parentElement;
        if (!parent) return;

        const existing = parent.querySelector('.auto-quality-injected');
        if (shouldInject) {
            if (!existing) {
                const settingsButton = document.createElement('div');
                settingsButton.className = 'bpx-player-ctrl-btn bpx-player-ctrl-quality auto-quality-injected';
                settingsButton.innerHTML = '<div class="bpx-player-ctrl-btn-icon"><span class="bpx-common-svg-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="15" rx="2" ry="2"></rect><polyline points="8 20 12 20 16 20"></polyline></svg></span></div>';
                settingsButton.addEventListener('click', toggleSettingsPanel);
                parent.insertBefore(settingsButton, qualityControl);
            }
        } else if (existing) {
            existing.remove();
        }
    }
    GM_registerMenuCommand("画质设置", function () {
        checkIfLivePage();
        if (state.isLivePage) toggleLiveSettingsPanel();
        else toggleSettingsPanel();
    });
    GM_registerMenuCommand("解码设置", function () {
        checkIfLivePage();
        toggleDecodeSettingsPanel();
    });
    GM_registerMenuCommand("解锁设置", toggleUnlockSettingsPanel);
    GM_registerMenuCommand("开发者设置", toggleDevSettingsPanel);
    function initPlayerScripts() {
        checkIfLivePage();
        if (state.isLivePage) {
            state.liveEntryForceHighest = state.userLiveQualitySetting === "最高画质";
            selectLiveQuality().then(() => {
                createLiveSettingsPanel();
                applyDecodeSetting();
                if (state.liveQualityPollingEnabled) startLivePolling();
                if (state.liveKeepAliveEnabled) startLiveKeepAlive();
            });
        } else {
            const DOM = {
                selectors: {
                    qualityControl: '.bpx-player-ctrl-quality:not(.auto-quality-injected)',
                    qualityButton: '.bpx-player-ctrl-btn.bpx-player-ctrl-quality:not(.auto-quality-injected)',
                    playerControls: '.bpx-player-control-wrap',
                    headerAvatar: '.v-popover-wrap.header-avatar-wrap',
                    vipIcon: '.bili-avatar-icon.bili-avatar-right-icon.bili-avatar-icon-big-vip',
                    qualityMenu: '.bpx-player-ctrl-quality-menu',
                    qualityMenuItem: '.bpx-player-ctrl-quality-menu-item',
                    activeQuality: '.bpx-player-ctrl-quality-menu-item.bpx-state-active .bpx-player-ctrl-quality-text'
                },
                elements: {},
                get(key) {
                    if (!this.elements[key]) this.elements[key] = document.querySelector(this.selectors[key]);
                    return this.elements[key];
                },
                refresh(key) {
                    this.elements[key] = document.querySelector(this.selectors[key]);
                    return this.elements[key];
                },
                clear() { this.elements = {}; }
            };

            function hideQualityButton() {
                const qualityControl = DOM.get('qualityButton');
                if (qualityControl && state.devModeEnabled && state.takeOverQualityControl && !qualityControl.classList.contains('auto-quality-injected')) {
                    qualityControl.classList.add('quality-button-hidden');
                }
            }

            function initQualitySettingsButton() { ensureQualitySettingsButton(state.injectQualityButton); }

            hideQualityButton();
            initQualitySettingsButton();
            applyAutoWidescreen();

            window.playerControlsObserver = new MutationObserver(function () {
                const qualityControl = DOM.refresh('qualityControl');
                if (qualityControl) {
                    hideQualityButton();
                    initQualitySettingsButton();
                }
            });

            const playerControls = DOM.get('playerControls');
            if (playerControls) {
                window.playerControlsObserver.observe(playerControls, { childList: true, subtree: true });
            }

            const vipCheckObserver = new MutationObserver((mutations, observer) => {
                // 未登录模式：跳过等待头像
                if (state.devModeEnabled && state.devModeNoLoginStatus) {
                    observer.disconnect();
                    console.log("[未登录模式] 跳过等待头像元素，直接执行画质设置");
                    waitForPlayerWithBackoff(async () => {
                        state.isLoading = false;
                        await checkVipStatusAsync();
                        await selectVideoQuality();
                        updateQualityButtons(Utils.query("#bilibili-quality-selector"));
                        applyDecodeSetting();
                    }, 5, 1000, 0);
                    return;
                }

                // 已登录：检测到头像
                const headerAvatar = document.querySelector(".v-popover-wrap.header-avatar-wrap");
                if (headerAvatar) {
                    observer.disconnect();

                    let timeoutId = null;
                    let hasExecuted = false;
                    let vipIconObserver = null;

                    const executeQualitySettings = () => {
                        if (hasExecuted) return;
                        hasExecuted = true;
                        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
                        if (vipIconObserver) { vipIconObserver.disconnect(); vipIconObserver = null; }
                        waitForPlayerWithBackoff(async () => {
                            state.isLoading = false;
                            await checkVipStatusAsync();
                            await selectVideoQuality();
                            updateQualityButtons(Utils.query("#bilibili-quality-selector"));
                            applyDecodeSetting();
                        }, 5, 1000, 0);
                    };

                    fetch("https://api.bilibili.com/x/vip/web/user/info", { credentials: "include" })
                        .then(r => r.json())
                        .then(d => {
                            if (d.code === 0 && d.data) {
                                state.sessionCache.vipStatus = d.data.vip_type > 0 && d.data.vip_status === 1;
                                state.sessionCache.vipChecked = true;
                            }
                            executeQualitySettings();
                        })
                        .catch(() => {});

                    // 等待会员图标加载完成
                    vipIconObserver = new MutationObserver((mutations, obs) => {
                        const vipElement = document.querySelector(".bili-avatar-icon.bili-avatar-right-icon.bili-avatar-icon-big-vip") ||
                            document.querySelector(".bili-avatar-icon.bili-avatar-right-icon.bili-avatar-icon-small-vip");
                        if (vipElement || mutations.some(m => m.target.classList && (m.target.classList.contains('bili-avatar-icon-big-vip') || m.target.classList.contains('bili-avatar-icon-small-vip')))) {
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
            });

            vipCheckObserver.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => vipCheckObserver.disconnect(), 20000);

            window.addEventListener('popstate', () => { DOM.clear(); });
            window.addEventListener('beforeunload', () => { DOM.clear(); });
        }
    }
    window.addEventListener("DOMContentLoaded", initPlayerScripts, { once: true });

    let _hadBlur = false;
    window.addEventListener("blur", () => { _hadBlur = true; });
    window.addEventListener("focus", () => {
        if (!_hadBlur || !state.isLivePage) return;
        if (state.liveDanmakuSync) syncLiveDanmaku();
        if (state.liveAutoRecoverOnVisible) {
            console.log("[可见性恢复] 直播页切回前台，重新切换画质");
            setTimeout(async () => {
                if (unsafeWindow.livePlayer?.getPlayerInfo && unsafeWindow.livePlayer?.switchQuality) {
                    state.liveEntryForceHighest = state.userLiveQualitySetting === "最高画质";
                    await selectLiveQuality();
                }
            }, 800);
        }
    });

    // 后台标签页切回前台时的画质补救（仅视频页）
    document.addEventListener("visibilitychange", () => {
        if (state.preventBackgroundDegrade) return;
        if (document.visibilityState !== "visible") return;

        checkIfLivePage();
        if (state.isLivePage) return;

        if (state.qualitySetSuccessfully) return;

        console.log("[可见性恢复] 标签页变为可见，画质尚未成功设置，尝试重新触发");

        setTimeout(async () => {
            if (state.qualitySetSuccessfully) return;

            const taskId = taskQueue.generateTaskId();
            state.isLoading = !state.vipStatusChecked;

            await waitForPlayerWithBackoff(async () => {
                if (taskQueue.isTaskCancelled(taskId) || state.qualitySetSuccessfully) return;
                state.isLoading = false;
                await checkVipStatusAsync();
                await selectVideoQuality();
                updateQualityButtons(Utils.query("#bilibili-quality-selector"));
                applyDecodeSetting();
            }, 5, 1000, 0);
        }, 800);
    });

    function isPlayerReady() {
        const qualityMenu = document.querySelector('.bpx-player-ctrl-quality-menu');
        const qualityItems = qualityMenu ? qualityMenu.querySelectorAll('.bpx-player-ctrl-quality-menu-item') : null;
        const headerAvatar = document.querySelector(".v-popover-wrap.header-avatar-wrap");

        // 未登录模式下不检查头像元素
        const isReady = qualityItems && qualityItems.length > 0 && 
            (state.devModeEnabled && state.devModeNoLoginStatus ? true : headerAvatar);

        console.log(`[播放器状态]
        - 画质菜单: ${qualityMenu ? '已加载' : '未加载'}
        - 画质选项: ${qualityItems ? `${qualityItems.length}个选项` : '未加载'}
        - 用户头像: ${headerAvatar ? '已加载' : (state.devModeEnabled && state.devModeNoLoginStatus ? '未登录模式，跳过检查' : '未加载')}`);

        return isReady;
    }

    async function waitForPlayerWithBackoff(callback, maxRetries = 5, initialDelay = 1000, retryCount = 0) {
        const taskId = taskQueue.currentTaskId;

        if (taskQueue.isTaskCancelled(taskId)) {
            console.log(`[任务管理] 任务 #${taskId} 已取消，停止等待播放器`);
            return;
        }

        if (isPlayerReady()) {
            console.log(`[任务管理] 任务 #${taskId}: 播放器和用户信息已就绪`);
            await callback();
            return;
        }

        if (retryCount >= maxRetries) {
            console.log(`[任务管理] 任务 #${taskId}: 达到最大重试次数(${maxRetries})，强制执行回调`);
            await callback();
            return;
        }

        const delayTime = initialDelay * Math.pow(2, retryCount);
        console.log(`[任务管理] 任务 #${taskId}: 等待播放器加载中 (第${retryCount + 1}次尝试，等待${delayTime}ms)`);

        await taskQueue.scheduleTask(taskId, async () => {
            if (!taskQueue.isTaskCancelled(taskId)) {
                await waitForPlayerWithBackoff(callback, maxRetries, initialDelay, retryCount + 1);
            }
        }, delayTime);
    }

    async function checkVipStatusAsync() {
        // 直接使用缓存的结果
        if (state.sessionCache.vipChecked) {
            state.isVipUser = state.sessionCache.vipStatus;
            state.vipStatusChecked = true;
            console.log("[会员状态] 用户会员状态:", state.isVipUser ? "是" : "否");
            console.log("[会员状态] 判定依据: API 接口");
            return;
        }

        if (state.devModeEnabled) {
            // 未登录模式下直接返回非会员状态
            if (state.devModeNoLoginStatus) {
                state.isVipUser = false;
                state.vipStatusChecked = true;
                state.sessionCache.vipStatus = false;
                state.sessionCache.vipChecked = true;
                console.log("[开发者模式] 未登录模式，用户会员状态: 否");
                return;
            }

            // 模拟大会员状态
            if (state.devModeVipStatus === "会员") {
                state.isVipUser = true;
            } else if (state.devModeVipStatus === "普通") {
                state.isVipUser = false;
            } else {
                // 默认状态：不干预，保持原有检测逻辑
                state.isVipUser = !!detectVipByDOM();
            }
            state.vipStatusChecked = true;
            // 缓存结果
            state.sessionCache.vipStatus = state.isVipUser;
            state.sessionCache.vipChecked = true;
            console.log("[开发者模式] 用户会员状态:", state.isVipUser ? "是" : "否");
            return;
        }

        const reason = detectVipByDOM();
        state.isVipUser = !!reason;
        state.vipStatusChecked = true;
        // 缓存结果
        state.sessionCache.vipStatus = state.isVipUser;
        state.sessionCache.vipChecked = true;
        console.log("[会员状态] 用户会员状态:", state.isVipUser ? "是" : "否");
        if (reason) {
            console.log("[会员状态] 判定依据:", reason);
        }
    }

    // API 未命中时的 DOM 回退检测：查询会员图标和画质 badge
    function detectVipByDOM() {
        if (document.querySelector(".bili-avatar-icon.bili-avatar-right-icon.bili-avatar-icon-big-vip") ||
            document.querySelector(".bili-avatar-icon.bili-avatar-right-icon.bili-avatar-icon-small-vip")) {
            return "发现会员图标";
        }
        const activeItem = document.querySelector(".bpx-player-ctrl-quality-menu-item.bpx-state-active");
        if (activeItem && activeItem.querySelector(".bpx-player-ctrl-quality-badge-bigvip")) {
            return "当前使用会员画质";
        }
        return null;
    }
    function canonicalUrl(rawUrl) {
        try {
            const urlObj = new URL(rawUrl);
            urlObj.pathname = urlObj.pathname.replace(/\/+$/, '');
            const p = urlObj.searchParams.get("p");
            urlObj.search = "";
            if (p !== null) urlObj.searchParams.set("p", p);
            return urlObj.toString();
        } catch (e) { return rawUrl; }
    }
    let lastCanonicalUrl = canonicalUrl(location.href);
    (function (history) {
        const pushState = history.pushState;
        const replaceState = history.replaceState;
        history.pushState = function () {
            const result = pushState.apply(history, arguments);
            window.dispatchEvent(new Event('locationchange'));
            return result;
        };
        history.replaceState = function () {
            const result = replaceState.apply(history, arguments);
            window.dispatchEvent(new Event('locationchange'));
            return result;
        };
    })(window.history);
    async function onUrlChange() {
        const newUrl = canonicalUrl(location.href);
        if (newUrl === lastCanonicalUrl) return;

        lastCanonicalUrl = newUrl;
        const taskId = taskQueue.generateTaskId();
        console.log(`[URL变更] 开始新任务 #${taskId}, URL: ${newUrl}`);

        taskQueue.clearPreviousTasks();
        // 会员状态已知时不再进入加载锁定，避免连播切换时面板闪烁“加载中”
        state.isLoading = !state.vipStatusChecked;
        state.qualitySetSuccessfully = false;

        const panel = document.getElementById("bilibili-quality-selector");
        if (panel) updateQualityButtons(panel);

        try {
            await taskQueue.scheduleTask(taskId, async () => {
                if (!taskQueue.isTaskCancelled(taskId)) {
                    console.log(`[任务管理] 任务 #${taskId}: 开始检查播放器状态`);
                    await waitForPlayerWithBackoff(async () => {
                        if (!taskQueue.isTaskCancelled(taskId)) {
                            console.log(`[任务管理] 任务 #${taskId}: 播放器就绪，开始初始化画质设置`);
                            state.isLoading = false;

                            await checkVipStatusAsync();

                            checkIfLivePage();
                            if (state.isLivePage) {
                                state.liveEntryForceHighest = state.userLiveQualitySetting === "最高画质";
                                await selectLiveQuality();
                                applyDecodeSetting();
                            } else {
                                await selectVideoQuality();
                                applyDecodeSetting();
                                applyAutoWidescreen();
                            }
                            if (panel) updateQualityButtons(panel);
                            console.log(`[任务管理] 任务 #${taskId}: 画质设置完成`);
                        }
                    });
                }
            }, 1000);
        } catch (error) {
            console.error(`[任务管理] 任务 #${taskId}: 执行出错:`, error);
        }
    }
    const urlChangeEvents = ['popstate', 'hashchange', 'locationchange'];
    urlChangeEvents.forEach(eventName => {
        window.addEventListener(eventName, onUrlChange);
    });
    window.addEventListener('beforeunload', () => {
        stopLivePolling();
        stopLiveKeepAlive();
        urlChangeEvents.forEach(eventName => {
            window.removeEventListener(eventName, onUrlChange);
        });
    });
})();
