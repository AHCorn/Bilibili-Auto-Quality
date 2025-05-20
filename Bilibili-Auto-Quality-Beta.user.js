// ==UserScript==
// @name         哔哩哔哩自动画质
// @namespace    https://github.com/AHCorn/Bilibili-Auto-Quality/
// @version      4.7.3-Beta
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
// @exclude      *://live.bilibili.com/
// @exclude      *://live.bilibili.com/*/*
// @include      *://live.bilibili.com/blanc/*
// @match        *://live.bilibili.com/*
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
    window.localStorage.bilibili_player_force_hdr = 1;
    const state = {
        hiResAudioEnabled: GM_getValue("hiResAudio", false),
        dolbyAtmosEnabled: GM_getValue("dolbyAtmos", false),
        userQualitySetting: GM_getValue("qualitySetting", "最高画质"),
        userBackupQualitySetting: GM_getValue("backupQualitySetting", "最高画质"),
        useHighestQualityFallback: GM_getValue("useHighestQualityFallback", true),
        activeQualityTab: GM_getValue("activeQualityTab", "primary"),
        userHasChangedQuality: false,
        takeOverQualityControl: GM_getValue("takeOverQualityControl", false),
        isVipUser: false,
        vipStatusChecked: false,
        isLoading: true,
        isLivePage: false,
        userLiveQualitySetting: GM_getValue("liveQualitySetting", "原画"),
        devModeEnabled: GM_getValue("devModeEnabled", false),
        devModeVipStatus: GM_getValue("devModeVipStatus", false),
        devModeNoLoginStatus: GM_getValue("devModeNoLoginStatus", false),
        devModeDisableUA: GM_getValue("devModeDisableUA", false),
        devModeAudioRetries: GM_getValue("devModeAudioRetries", 2),
        devModeAudioDelay: GM_getValue("devModeAudioDelay", 4000),
        devDoubleCheckDelay: GM_getValue("devDoubleCheckDelay", 5000),
        injectQualityButton: GM_getValue("injectQualityButton", true),
        qualityDoubleCheck: GM_getValue("qualityDoubleCheck", true),
        liveQualityDoubleCheck: GM_getValue("liveQualityDoubleCheck", true),
        disableHDROption: GM_getValue("disableHDR", false),
        sessionCache: {
            vipStatus: null,
            vipChecked: false
        }
    };
    try {
        if (!state.devModeDisableUA || !state.devModeEnabled) {
            Object.defineProperty(navigator, 'userAgent', {
                value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
                configurable: true
            });
            Object.defineProperty(navigator, 'platform', {
                value: "MacIntel",
                configurable: true
            });
            console.log("[系统设置] UA 和平台标识修改成功");
        } else {
            console.log("[开发者模式] 已禁用 UA 修改");
        }
    } catch (error) {
        console.error("[系统设置] 修改 UserAgent 失败，解锁功能可能失效:", error);
    }
    GM_addStyle(`
    #bilibili-quality-selector, #bilibili-live-quality-selector, #bilibili-dev-settings {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #f6f8fa, #e9ecef);
        border-radius: 24px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1), 0 1px 8px rgba(0, 0, 0, 0.06);
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
        scrollbar-width: thin;
        scrollbar-color: rgba(0, 161, 214, 0.3) transparent;
    }
    .quality-tabs {
        display: flex;
        margin-bottom: 20px;
        border-radius: 12px;
        background: #e8eaed;
        padding: 4px;
    }
    .quality-tab {
        flex: 1;
        padding: 8px;
        text-align: center;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.3s ease;
        color: #666;
        font-weight: 600;
    }
    .quality-tab.active {
        background: #00a1d6;
        color: white;
    }
    .quality-section {
        display: none;
    }
    .quality-section.active {
        display: block;
    }
    .quality-button-hidden {
        display: none !important;
    }
    .toggle-switch.hide {
        display: none;
    }
    .toggle-switch.show {
        display: flex;
    }
    #bilibili-quality-selector h2, #bilibili-live-quality-selector h2,
    #bilibili-live-quality-selector h3 {
        margin: 0 0 20px;
        color: #00a1d6;
        font-size: 28px;
        text-align: center;
        font-weight: 700;
    }
    #bilibili-live-quality-selector h3 {
        font-size: 24px;
        margin-top: 20px;
    }
    #bilibili-quality-selector p, #bilibili-live-quality-selector p {
        margin: 0 0 25px;
        color: #5f6368;
        font-size: 14px;
        text-align: center;
    }
    .quality-group {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
        gap: 12px;
        margin-bottom: 25px;
    }
    .line-group {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 25px;
    }
    .quality-button, .line-button {
        background-color: #ffffff;
        border: 2px solid #dadce0;
        border-radius: 12px;
        padding: 10px 8px;
        font-size: 14px;
        color: #3c4043;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        font-weight: 600;
        text-align: center;
    }
    .line-button {
        font-size: 12px;
        padding: 8px 4px;
    }
    .quality-button:hover, .line-button:hover {
        background-color: #f1f3f4;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
    .quality-button.active, .line-button.active {
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
    .quality-button.unavailable {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .toggle-switch {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding: 10px 15px;
        border-radius: 12px;
        transition: all 0.3s ease;
    }
    .toggle-switch:hover {
        background-color: #e8eaed;
    }
    .toggle-switch label {
        font-size: 16px;
        color: #3c4043;
        font-weight: 600;
    }
    .switch {
        position: relative;
        display: inline-block;
        width: 52px;
        height: 28px;
    }
    .switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        transition: .4s;
        border-radius: 34px;
    }
    .slider:before {
        position: absolute;
        content: "";
        height: 20px;
        width: 20px;
        left: 4px;
        bottom: 4px;
        background-color: white;
        transition: .4s;
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
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes slideIn {
        from { transform: translate(-50%, -60%); }
        to { transform: translate(-50%, -50%); }
    }
    #bilibili-quality-selector.show, #bilibili-live-quality-selector.show {
        display: block;
        animation: fadeIn 0.3s ease-out, slideIn 0.3s ease-out;
    }
    @media (max-width: 480px) {
        #bilibili-quality-selector, #bilibili-live-quality-selector, #bilibili-dev-settings {
            width: 95%;
            padding: 20px;
            max-height: 80vh;
        }
        .quality-group {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }
        .line-group {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }
        .quality-button, .line-button {
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
        .input-group input[type="number"] {
            width: 70px;
            padding: 6px;
            font-size: 13px;
        }
        .github-link {
            top: 20px;
            right: 20px;
            width: 20px;
            height: 20px;
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
        .quality-section-description {
            font-size: 12px;
            margin: -3px 0 12px;
        }
    }
    @media (max-height: 600px) {
        #bilibili-quality-selector, #bilibili-live-quality-selector, #bilibili-dev-settings {
            max-height: 90vh;
            padding: 15px;
        }
        .quality-group, .line-group {
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
    #bilibili-dev-settings {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #ffffff, #f8f9fa);
        border-radius: 24px;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08);
        padding: 32px;
        width: 90%;
        max-width: 420px;
        max-height: 85vh;
        overflow-y: auto;
        overflow-x: hidden;
        display: none;
        z-index: 10000;
        font-family: 'Segoe UI', 'Roboto', sans-serif;
        scrollbar-width: thin;
        scrollbar-color: rgba(0, 161, 214, 0.3) transparent;
    }
    #bilibili-dev-settings.show {
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
    #bilibili-dev-settings .toggle-switch {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding: 10px 15px;
        background-color: #f1f3f4;
        border-radius: 12px;
        transition: all 0.3s ease;
    }
    #bilibili-dev-settings .toggle-switch .description {
        font-size: 13px;
        color: #666;
        margin-top: 4px;
    }
    #bilibili-dev-settings .toggle-switch label {
        display: flex;
        flex-direction: column;
        font-size: 16px;
        color: #3c4043;
        font-weight: 600;
    }
    #bilibili-dev-settings .input-group {
        background: #f8f9fa;
        border-radius: 16px;
        padding: 15px;
        margin-bottom: 16px;
        border: 2px solid transparent;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 12px;
    }
    #bilibili-dev-settings .input-group.disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    #bilibili-dev-settings .input-group:hover {
        background: #f1f3f4;
        border-color: rgba(242, 93, 142, 0.1);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    #bilibili-dev-settings .input-group label {
        flex: 1;
        display: flex;
        flex-direction: column;
        color: #3c4043;
        font-weight: 600;
        font-size: 15px;
    }
    #bilibili-dev-settings .input-group .description {
        font-size: 13px;
        color: #666;
        margin-top: 4px;
        font-weight: normal;
    }
    #bilibili-dev-settings .input-group input[type="number"] {
        width: 80px;
        padding: 8px;
        border: 2px solid #dadce0;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        color: #3c4043;
        transition: all 0.3s ease;
        background: #ffffff;
        -moz-appearance: textfield;
    }
    #bilibili-dev-settings .input-group .unit {
        color: #666;
        font-size: 14px;
        font-weight: normal;
        margin-left: 4px;
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
    #bilibili-dev-settings input:checked + .slider:before {
        transform: translateX(26px);
        box-shadow: 0 2px 4px rgba(242, 93, 142, 0.2);
    }
    #bilibili-dev-settings input:disabled + .slider {
        opacity: 0.5;
        cursor: not-allowed;
    }
    #bilibili-dev-settings input:disabled + .slider:before {
        box-shadow: none;
    }
    @media (max-width: 480px) {
        #bilibili-dev-settings {
            width: 95%;
            padding: 24px;
        }
        #bilibili-dev-settings .toggle-switch,
        #bilibili-dev-settings .input-group {
            padding: 14px 16px;
        }
    }
    .bpx-player-ctrl-quality.quality-button-hidden {
        display: none !important;
    }
    .quality-section {
        margin-bottom: 20px;
    }
    .quality-label {
        font-size: 14px;
        color: #666;
        margin-bottom: 10px;
        text-align: left;
    }
    .quality-group.backup-quality .quality-button {
        font-size: 12px;
        padding: 8px 6px;
    }
    .quality-settings-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        width: 40px;
        height: 100%;
        opacity: 0.9;
        transition: opacity 0.3s ease;
        position: relative;
    }
    .quality-settings-btn:hover {
        opacity: 1;
    }
    .quality-settings-btn .bpx-player-ctrl-btn-icon {
        width: 22px;
        height: 22px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .quality-settings-btn svg {
        width: 100%;
        height: 100%;
        stroke: #ffffff;
    }
    .quality-settings-btn::after {
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
    .quality-settings-btn:hover::after {
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
    .quality-section-title {
        font-size: 16px;
        color: #00a1d6;
        font-weight: 600;
        margin: 20px 0 15px;
        padding-bottom: 8px;
        border-bottom: 2px solid rgba(0, 161, 214, 0.1);
    }
    .quality-section-description {
        font-size: 13px;
        color: #666;
        margin: -5px 0 15px;
        line-height: 1.4;
    }
    .live-quality-group {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-bottom: 25px;
    }
    .live-quality-button {
        background-color: #ffffff;
        border: 2px solid #dadce0;
        border-radius: 12px;
        padding: 12px 8px;
        font-size: 15px;
        color: #3c4043;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        font-weight: 600;
        text-align: center;
    }
    .live-quality-button:hover {
        background-color: #f1f3f4;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
    .live-quality-button.active {
        background-color: #00a1d6;
        color: white;
        border-color: #00a1d6;
        box-shadow: 0 6px 12px rgba(0, 161, 214, 0.3);
    }
    #bilibili-quality-selector,
    #bilibili-live-quality-selector,
    #bilibili-dev-settings {
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
    function checkIfLivePage() {
        state.isLivePage = window.location.href.includes("live.bilibili.com");
    }
    function checkVipStatus() {
        if (state.devModeEnabled) {
            state.isVipUser = state.devModeVipStatus;
            state.vipStatusChecked = true;
            // 缓存会员状态
            state.sessionCache.vipStatus = state.isVipUser;
            state.sessionCache.vipChecked = true;
            console.log("[开发者模式] 用户会员状态:", state.isVipUser ? "是" : "否");
            return;
        }

        const vipElement = document.querySelector(".bili-avatar-icon.bili-avatar-right-icon.bili-avatar-icon-big-vip");
        const currentQualityEl = document.querySelector(".bpx-player-ctrl-quality-menu-item.bpx-state-active .bpx-player-ctrl-quality-text");

        state.isVipUser = vipElement !== null || (currentQualityEl && currentQualityEl.textContent.includes("大会员"));
        state.vipStatusChecked = true;
        // 缓存会员状态
        state.sessionCache.vipStatus = state.isVipUser;
        state.sessionCache.vipChecked = true;

        console.log("[会员状态] 用户会员状态:", state.isVipUser ? "是" : "否");
        if (state.isVipUser) {
            console.log("[会员状态] 判定依据:", vipElement ? "发现会员图标" : "当前使用会员画质");
        }
    }
    function updateWarnings(panel) {
        if (!panel || state.isLoading || !state.vipStatusChecked) return;
        const nonVipWarning = panel.querySelector("#non-vip-warning");
        const audioWarning = panel.querySelector("#audio-warning");
        if (!state.isVipUser && ["8K", "杜比视界", "HDR", "4K", "1080P 高码率", "1080P 60帧"].includes(state.userQualitySetting)) {
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
        Utils.queryAll(".quality-tab", panel).forEach(tab => {
            tab.classList.toggle("active", tab.getAttribute("data-tab") === state.activeQualityTab);
        });
        Utils.queryAll(".quality-section", panel).forEach(section => {
            section.classList.toggle("active", section.getAttribute("data-section") === state.activeQualityTab);
        });
        Utils.queryAll(".quality-button", panel).forEach(button => {
            const section = button.closest(".quality-section");
            button.classList.remove("active", "vip-quality");
            if (
                (section.getAttribute("data-section") === "primary" && button.getAttribute("data-quality") === state.userQualitySetting) ||
                (section.getAttribute("data-section") === "backup" && button.getAttribute("data-quality") === state.userBackupQualitySetting)
            ) {
                button.classList.add("active");
                if (["8K", "杜比视界", "HDR", "4K", "1080P 高码率", "1080P 60帧"].includes(button.getAttribute("data-quality"))) {
                    button.classList.add("vip-quality");
                }
            }
        });
        const fallbackContainer = panel.querySelector("#highest-quality-fallback-container");
        if (fallbackContainer) {
            fallbackContainer.classList.toggle("show", state.userBackupQualitySetting !== "最高画质");
            fallbackContainer.classList.toggle("hide", state.userBackupQualitySetting === "最高画质");
        }
        const hiResAudioSwitch = panel.querySelector("#hi-res-audio");
        if (hiResAudioSwitch) hiResAudioSwitch.checked = state.hiResAudioEnabled;
        const dolbyAtmosSwitch = panel.querySelector("#dolby-atmos");
        if (dolbyAtmosSwitch) dolbyAtmosSwitch.checked = state.dolbyAtmosEnabled;
        const fallbackCheckbox = panel.querySelector("#highest-quality-fallback");
        if (fallbackCheckbox) fallbackCheckbox.checked = state.useHighestQualityFallback;
        updateWarnings(panel);
    }
    function createSettingsPanel() {
        const panel = document.createElement("div");
        panel.id = "bilibili-quality-selector";
        const QUALITIES = ["最高画质", "8K", "杜比视界", "HDR", "4K", "1080P 高码率", "1080P 60帧", "1080P 高清", "720P", "480P", "360P", "默认"];
        panel.innerHTML = `
          <h2>画质设置</h2>
          <a href="https://github.com/AHCorn/Bilibili-Auto-Quality/" target="_blank" class="github-link">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
          <div class="status-bar"></div>
          <div class="quality-tabs">
            <div class="quality-tab ${state.activeQualityTab === 'primary' ? 'active' : ''}" data-tab="primary">首选画质</div>
            <div class="quality-tab ${state.activeQualityTab === 'backup' ? 'active' : ''}" data-tab="backup">备选画质</div>
          </div>
          <div class="quality-section ${state.activeQualityTab === 'primary' ? 'active' : ''}" data-section="primary">
            <div class="quality-group">
              ${QUALITIES.map(q => `<button class="quality-button" data-quality="${q}">${q}</button>`).join('')}
            </div>
          </div>
          <div class="quality-section ${state.activeQualityTab === 'backup' ? 'active' : ''}" data-section="backup">
            <div class="quality-group">
              ${QUALITIES.map(q => `<button class="quality-button" data-quality="${q}">${q}</button>`).join('')}
            </div>
          </div>
          <div id="non-vip-warning" class="warning" style="display:none;"></div>
          <div id="quality-warning" class="warning" style="display:none;"></div>
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
          <div class="toggle-switch ${state.userBackupQualitySetting !== "最高画质" ? 'show' : 'hide'}" id="highest-quality-fallback-container">
            <label for="highest-quality-fallback">找不到备选画质时使用最高画质</label>
            <label class="switch">
              <input type="checkbox" id="highest-quality-fallback" ${state.useHighestQualityFallback ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          <div class="toggle-switch">
            <label for="inject-quality-button">注入画质选项</label>
            <label class="switch">
              <input type="checkbox" id="inject-quality-button" ${state.injectQualityButton ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
        `;
        panel.addEventListener("click", function (e) {
            const target = e.target;
            if (target.classList.contains("quality-tab") && !state.isLoading) {
                const tabName = target.getAttribute("data-tab");
                state.activeQualityTab = tabName;
                GM_setValue("activeQualityTab", tabName);
                Utils.queryAll(".quality-tab", panel).forEach(tab =>
                    tab.classList.toggle("active", tab.getAttribute("data-tab") === tabName)
                );
                Utils.queryAll(".quality-section", panel).forEach(section =>
                    section.classList.toggle("active", section.getAttribute("data-section") === tabName)
                );
            } else if (target.classList.contains("quality-button") && !state.isLoading) {
                const section = target.closest(".quality-section");
                const quality = target.getAttribute("data-quality");
                if (section.getAttribute("data-section") === "primary") {
                    state.userQualitySetting = quality;
                    GM_setValue("qualitySetting", quality);
                } else {
                    state.userBackupQualitySetting = quality;
                    GM_setValue("backupQualitySetting", quality);
                    const fallbackContainer = Utils.query("#highest-quality-fallback-container", panel);
                    if (fallbackContainer) {
                        fallbackContainer.classList.toggle("show", quality !== "最高画质");
                        fallbackContainer.classList.toggle("hide", quality === "最高画质");
                    }
                }
                updateQualityButtons(panel);
                selectQualityBasedOnSetting();
            }
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
                const qualityControlElement = document.querySelector(".bpx-player-ctrl-quality");
                if (qualityControlElement) {
                    if (state.injectQualityButton) {
                        let settingsButton = qualityControlElement.previousElementSibling;
                        if (!settingsButton || !settingsButton.classList.contains("quality-settings-btn")) {
                            settingsButton = document.createElement("div");
                            settingsButton.className = "bpx-player-ctrl-btn quality-settings-btn";
                            settingsButton.innerHTML = '<div class="bpx-player-ctrl-btn-icon"><span class="bpx-common-svg-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="15" rx="2" ry="2"></rect><polyline points="8 20 12 20 16 20"></polyline></svg></span></div>';
                            settingsButton.addEventListener("click", toggleSettingsPanel);
                            qualityControlElement.parentElement.insertBefore(settingsButton, qualityControlElement);
                        }
                    } else {
                        const existingButton = qualityControlElement.previousElementSibling;
                        if (existingButton && existingButton.classList.contains("quality-settings-btn")) {
                            existingButton.remove();
                        }
                    }
                }
            }
        });
        document.body.appendChild(panel);
        updateQualityButtons(panel);
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
            // 只检查是否是当前最新任务
            if (taskId !== this.currentTaskId) {
                console.log(`[任务管理] 任务 #${taskId} 已过期，当前任务 #${this.currentTaskId}`);
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
            return {
                name: item.textContent.trim(),
                element: item,
                isVipOnly: !!badge,
                isFreeNow: !!(badge && badgeText.includes("限免中"))
            };
        });

        if (state.disableHDROption) {
            availableQualities = availableQualities.filter(q => q.name.indexOf("HDR") === -1);
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

        const qualityPreferences = ["8K", "杜比视界", "HDR", "4K", "1080P 高码率", "1080P 60帧", "1080P 高清", "720P 60帧", "720P", "480P", "360P", "默认"];
        let targetQuality;
        function cleanQuality(q) { return q ? q.replace(/大会员|限免中/g, '').trim() : ""; }
        if (state.userQualitySetting === "最高画质") {
            const hasFreeVip = availableQualities.some(q => q.isFreeNow);
            if (state.isVipUser || hasFreeVip) {
                targetQuality = availableQualities[0];
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
                targetQuality = availableQualities.find(q => cleanQuality(q.name).includes(state.userBackupQualitySetting));
                if (!targetQuality && state.useHighestQualityFallback)
                    targetQuality = availableQualities.find(q => !q.isVipOnly);
                if (!targetQuality && !state.useHighestQualityFallback) {
                    console.log("[画质设置] 未找到备选画质，保持当前画质");
                    await setAudioQuality();
                    return;
                }
            }
        } else if (state.userQualitySetting === "默认") {
            console.log("[画质设置] 使用默认画质");
            await setAudioQuality();
            return;
        } else {
            targetQuality = availableQualities.find(q => cleanQuality(q.name).includes(state.userQualitySetting));
            if (!targetQuality) {
                console.log("[画质设置] 未找到目标画质 " + state.userQualitySetting + ", 尝试使用备选画质");
                targetQuality = availableQualities.find(q => cleanQuality(q.name).includes(state.userBackupQualitySetting));
                if (!targetQuality && state.useHighestQualityFallback)
                    targetQuality = state.isVipUser ? availableQualities[0] : availableQualities.find(q => !q.isVipOnly);
                if (!targetQuality && !state.useHighestQualityFallback) {
                    console.log("[画质设置] 未找到备选画质，保持当前画质");
                    await setAudioQuality();
                    return;
                }
            }
        }
        console.log("[画质设置] 实际目标画质: " + targetQuality.name);
        targetQuality.element.click();
        if (state.qualityDoubleCheck) {
            await Utils.delay(state.devDoubleCheckDelay);
            const currentQualityAfterSwitchEl = document.querySelector(".bpx-player-ctrl-quality-menu-item.bpx-state-active .bpx-player-ctrl-quality-text");
            const currentQualityAfterSwitch = currentQualityAfterSwitchEl ? currentQualityAfterSwitchEl.textContent : "";
            if (currentQualityAfterSwitch && cleanQuality(currentQualityAfterSwitch) !== cleanQuality(targetQuality.name)) {
                console.log("[画质设置] 画质切换未成功，执行二次切换...");
                targetQuality.element.click();
            } else {
                console.log("[画质设置] 画质切换验证成功，当前画质: " + currentQualityAfterSwitch);
            }
            await setAudioQuality();
        }
    }
    function createLiveSettingsPanel() {
        const panel = document.createElement("div");
        panel.id = "bilibili-live-quality-selector";
        function updatePanel() {
            const qualityCandidates = unsafeWindow.livePlayer.getPlayerInfo().qualityCandidates;
            const LIVE_QUALITIES = ["1080P 原画", "1080P 蓝光", "720P 超清", "720P 高清"];
            const lineSelector = document.querySelector(".YccudlUCmLKcUTg_yzKN");
            const lines = lineSelector ? Array.from(lineSelector.children).map(li => li.textContent) : ["加载中..."];
            const currentLineIndex = lineSelector ? Array.from(lineSelector.children).findIndex(li => li.classList.contains("fG2r2piYghHTQKQZF8bl")) : 0;
            panel.innerHTML = `
            <h2>直播设置</h2>
            <a href="https://github.com/AHCorn/Bilibili-Auto-Quality/" target="_blank" class="github-link">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
            <div class="quality-section-title">线路选择</div>
            <div class="line-group">
              ${lines.map((line, index) => `<button class="line-button ${index === currentLineIndex ? 'active' : ''}" data-line="${index}">${line}</button>`).join('')}
            </div>
            <div class="quality-section-title">画质选择</div>
            <div class="live-quality-group">
              ${LIVE_QUALITIES.map(quality => `<button class="live-quality-button ${quality === state.userLiveQualitySetting ? 'active' : ''}" data-quality="${quality}">${quality}</button>`).join('')}
            </div>
          `;
            panel.querySelectorAll(".line-button").forEach(button => {
                button.addEventListener("click", () => {
                    const lineIndex = parseInt(button.getAttribute("data-line"), 10);
                    changeLine(lineIndex);
                });
            });
            panel.querySelectorAll(".live-quality-button").forEach(button => {
                button.addEventListener("click", () => {
                    state.userLiveQualitySetting = button.getAttribute("data-quality");
                    GM_setValue("liveQualitySetting", state.userLiveQualitySetting);
                    updatePanel();
                    selectLiveQuality();
                });
            });
        }
        document.body.appendChild(panel);
        panel.updatePanel = updatePanel;
        updatePanel();
    }
    async function selectLiveQuality() {
        await new Promise(resolve => {
            const timer = setInterval(() => {
                if (
                    unsafeWindow.livePlayer &&
                    unsafeWindow.livePlayer.getPlayerInfo &&
                    unsafeWindow.livePlayer.getPlayerInfo().playurl &&
                    unsafeWindow.livePlayer.switchQuality
                ) {
                    clearInterval(timer);
                    resolve();
                }
            }, 1000);
        });
        const qualityCandidates = unsafeWindow.livePlayer.getPlayerInfo().qualityCandidates;
        console.log("[直播画质] 可用画质选项:", qualityCandidates.map((q, i) => `${i + 1}. ${q.desc} (qn: ${q.qn})`));
        console.log("[直播画质] 选择的画质:", state.userLiveQualitySetting);
        let targetQuality = qualityCandidates.find(q => q.desc === state.userLiveQualitySetting);
        if (!targetQuality) {
            const qualityPriority = ["1080P 原画", "1080P 蓝光", "720P 超清", "720P 高清"];
            for (let quality of qualityPriority) {
                targetQuality = qualityCandidates.find(q => q.desc === quality);
                if (targetQuality) break;
            }
        }
        if (!targetQuality) targetQuality = qualityCandidates[0];
        console.log("[直播画质] 目标画质:", targetQuality.desc, "(qn:", targetQuality.qn, ")");
        function switchQuality() {
            const currentQualityNumber = unsafeWindow.livePlayer.getPlayerInfo().quality;
            if (currentQualityNumber !== targetQuality.qn) {
                unsafeWindow.livePlayer.switchQuality(targetQuality.qn);
                console.log("[直播画质] 已切换到目标画质:", targetQuality.desc);
                state.userLiveQualitySetting = targetQuality.desc;
                GM_setValue("liveQualitySetting", state.userLiveQualitySetting);
                updateLiveSettingsPanel();
                if (state.liveQualityDoubleCheck) {
                    setTimeout(() => {
                        const currentQualityAfterSwitch = unsafeWindow.livePlayer.getPlayerInfo().quality;
                        if (currentQualityAfterSwitch !== targetQuality.qn) {
                            console.log("[直播画质] 画质切换可能未成功，执行二次切换...");
                            unsafeWindow.livePlayer.switchQuality(targetQuality.qn);
                        } else {
                            console.log("[直播画质] 画质切换验证成功，当前画质:", targetQuality.desc);
                        }
                    }, 5000);
                }
            } else {
                console.log("[直播画质] 已经是目标画质:", targetQuality.desc);
            }
        }
        switchQuality();
    }
    function changeLine(lineIndex) {
        const lineSelector = document.querySelector(".YccudlUCmLKcUTg_yzKN");
        if (lineSelector && lineSelector.children[lineIndex]) {
            lineSelector.children[lineIndex].click();
            console.log("[直播线路] 已切换到线路:", lineSelector.children[lineIndex].textContent);
            const panel = document.getElementById("bilibili-live-quality-selector");
            if (panel) {
                Utils.queryAll(".line-button", panel).forEach((button, index) => {
                    button.classList.toggle("active", index === lineIndex);
                });
            }
        } else {
            console.log("[直播线路] 无法切换线路");
        }
    }
    function observeLineChanges() {
        const lineSelector = document.querySelector(".YccudlUCmLKcUTg_yzKN");
        if (lineSelector) {
            const observer = new MutationObserver(Utils.debounce(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.type === "attributes" && mutation.attributeName === "class") {
                        Array.from(lineSelector.children).forEach(li => {
                            if (li.classList.contains("fG2r2piYghHTQKQZF8bl")) updateLiveSettingsPanel();
                        });
                    }
                });
            }, 300));
            observer.observe(lineSelector, { attributes: true, subtree: true, attributeFilter: ["class"] });
        }
    }
    function updateLiveSettingsPanel() {
        const panel = document.getElementById("bilibili-live-quality-selector");
        if (panel && typeof panel.updatePanel === "function") panel.updatePanel();
    }
    function createDevSettingsPanel() {
        const panel = document.createElement("div");
        panel.id = "bilibili-dev-settings";
        panel.innerHTML = `
          <h2>开发者设置</h2>
          <a href="https://github.com/AHCorn/Bilibili-Auto-Quality/" target="_blank" class="github-link">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
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
            <label for="dev-vip">
              模拟大会员状态
              <div class="description">模拟脚本所识别到的大会员状态，<b>并非破解</b></div>
            </label>
            <label class="switch">
              <input type="checkbox" id="dev-vip" ${state.devModeVipStatus ? 'checked' : ''} ${!state.devModeEnabled ? 'disabled' : ''}>
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
            <label for="dev-ua">
              禁用 UA 修改
              <div class="description">禁用后部分旧版本浏览器可能无法解锁画质</div>
            </label>
            <label class="switch">
              <input type="checkbox" id="dev-ua" ${state.devModeDisableUA ? 'checked' : ''} ${!state.devModeEnabled ? 'disabled' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          <div class="toggle-switch">
            <label for="disable-hdr">
              禁用 HDR 选项
              <div class="description">为没有 HDR 设备的用户屏蔽该画质</div>
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
            <input type="number" id="dev-double-check-delay" value="${state.devDoubleCheckDelay}" min="0" max="20000" step="100" ${!state.devModeEnabled ? 'disabled' : ''}>
            <span class="unit">毫秒</span>
          </div>
          <div class="input-group ${!state.devModeEnabled ? 'disabled' : ''}">
            <label for="dev-audio-delay">
              音质切换初始延迟
              <div class="description">音质切换重试的初始等待时间，后续等待时间将以此为基数进行指数退避</div>
            </label>
            <input type="number" id="dev-audio-delay" value="${state.devModeAudioDelay}" min="0" max="10000" step="100" ${!state.devModeEnabled ? 'disabled' : ''}>
            <span class="unit">毫秒</span>
          </div>
          <div class="input-group ${!state.devModeEnabled ? 'disabled' : ''}">
            <label for="dev-audio-retries">
              音质切换重试次数
              <div class="description">音质切换失败后的重试次数</div>
            </label>
            <input type="number" id="dev-audio-retries" value="${state.devModeAudioRetries}" min="0" max="5" step="1" ${!state.devModeEnabled ? 'disabled' : ''}>
            <span class="unit" style="margin-left: 15px;">次</span>
          </div>
          <div id="dev-warning" class="warning" style="display: none;"></div>
          <button class="refresh-button">确认并刷新页面</button>
        `;
        document.body.appendChild(panel);
        panel.querySelector('#dev-mode').addEventListener('change', function (e) {
            state.devModeEnabled = e.target.checked;
            GM_setValue("devModeEnabled", state.devModeEnabled);
            
            const devOptions = panel.querySelectorAll('input[type="checkbox"]:not(#dev-mode), input[type="number"]');
            devOptions.forEach(option => {
                option.disabled = !state.devModeEnabled;
            });
            
            const inputGroups = panel.querySelectorAll('.input-group');
            inputGroups.forEach(group => {
                if (state.devModeEnabled) {
                    group.classList.remove('disabled');
                } else {
                    group.classList.add('disabled');
                }
            });
        });
        panel.querySelector('#quality-double-check').addEventListener('change', function (e) {
            state.qualityDoubleCheck = e.target.checked;
            GM_setValue("qualityDoubleCheck", state.qualityDoubleCheck);
        });
        panel.querySelector('#live-quality-double-check').addEventListener('change', function (e) {
            state.liveQualityDoubleCheck = e.target.checked;
            GM_setValue("liveQualityDoubleCheck", state.liveQualityDoubleCheck);
        });
        panel.querySelector('#dev-vip').addEventListener('change', function (e) {
            state.devModeVipStatus = e.target.checked;
            GM_setValue("devModeVipStatus", state.devModeVipStatus);
        });
        panel.querySelector('#dev-no-login').addEventListener('change', function (e) {
            state.devModeNoLoginStatus = e.target.checked;
            GM_setValue("devModeNoLoginStatus", state.devModeNoLoginStatus);
        });
        panel.querySelector('#dev-ua').addEventListener('change', function (e) {
            state.devModeDisableUA = e.target.checked;
            GM_setValue("devModeDisableUA", state.devModeDisableUA);
        });
        panel.querySelector('#disable-hdr').addEventListener('change', function (e) {
            state.disableHDROption = e.target.checked;
            GM_setValue("disableHDR", state.disableHDROption);
        });
        panel.querySelector('#remove-quality-button').addEventListener('change', function (e) {
            state.takeOverQualityControl = e.target.checked;
            GM_setValue("takeOverQualityControl", state.takeOverQualityControl);
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
        function handleOutsideClick(event) {
            if (panel && !panel.contains(event.target)) {
                panel.classList.remove("show");
                document.removeEventListener("mousedown", handleOutsideClick);
            }
        }
        if (!panel.classList.contains("show")) {
            ["bilibili-quality-selector", "bilibili-live-quality-selector", "bilibili-dev-settings"].forEach(id => {
                if (id !== panelId) {
                    const otherPanel = document.getElementById(id);
                    if (otherPanel && otherPanel.classList.contains("show")) otherPanel.classList.remove("show");
                }
            });
            panel.classList.add("show");
            document.addEventListener("mousedown", handleOutsideClick);
        } else {
            panel.classList.remove("show");
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
        });
    }
    GM_registerMenuCommand("设置面板", function () {
        checkIfLivePage();
        if (state.isLivePage) toggleLiveSettingsPanel();
        else toggleSettingsPanel();
    });
    GM_registerMenuCommand("开发者选项", toggleDevSettingsPanel);
    function initPlayerScripts() {
        checkIfLivePage();
        if (state.isLivePage) {
            observeLineChanges();
            selectLiveQuality().then(createLiveSettingsPanel);
        } else {
            const DOM = {
                selectors: {
                    qualityControl: '.bpx-player-ctrl-quality',
                    qualityButton: '.bpx-player-ctrl-btn.bpx-player-ctrl-quality',
                    playerControls: '.bpx-player-control-wrap',
                    headerAvatar: '.v-popover-wrap.header-avatar-wrap',
                    vipIcon: '.bili-avatar-icon.bili-avatar-right-icon.bili-avatar-icon-big-vip',
                    qualityMenu: '.bpx-player-ctrl-quality-menu',
                    qualityMenuItem: '.bpx-player-ctrl-quality-menu-item',
                    activeQuality: '.bpx-player-ctrl-quality-menu-item.bpx-state-active .bpx-player-ctrl-quality-text',
                    controlBottomRight: '.bpx-player-control-bottom-right'
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
                if (qualityControl && state.takeOverQualityControl) qualityControl.classList.add('quality-button-hidden');
            }

            function initQualitySettingsButton() {
                const controlBottomRight = DOM.get('controlBottomRight');
                const qualityControl = DOM.get('qualityControl');
                if (controlBottomRight && qualityControl && state.injectQualityButton) {
                    let existingSettingsBtn = controlBottomRight.querySelector('.quality-settings-btn');
                    if (!existingSettingsBtn) {
                        const settingsButton = document.createElement('div');
                        settingsButton.className = 'bpx-player-ctrl-btn quality-settings-btn';
                        settingsButton.innerHTML = '<div class="bpx-player-ctrl-btn-icon"><span class="bpx-common-svg-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="15" rx="2" ry="2"></rect><polyline points="8 20 12 20 16 20"></polyline></svg></span></div>';
                        settingsButton.addEventListener("click", toggleSettingsPanel);
                        qualityControl.parentElement.insertBefore(settingsButton, qualityControl);
                    }
                }
            }

            hideQualityButton();
            initQualitySettingsButton();

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
                // 未登录模式不等待头像元素
                if (state.devModeEnabled && state.devModeNoLoginStatus) {
                    observer.disconnect();
                    console.log("[未登录模式] 跳过等待头像元素，直接执行画质设置");
                    waitForPlayerWithBackoff(async () => {
                        state.isLoading = false;
                        await checkVipStatusAsync();
                        await selectVideoQuality();
                        updateQualityButtons(Utils.query("#bilibili-quality-selector"));
                    }, 5, 1000, 0);
                    return;
                }
                
                const headerAvatar = document.querySelector(".v-popover-wrap.header-avatar-wrap");
                if (headerAvatar) {
                    observer.disconnect();

                    let timeoutId = null;
                    let hasExecuted = false;

                    const executeQualitySettings = () => {
                        if (hasExecuted) return;
                        hasExecuted = true;
                        if (timeoutId) {
                            clearTimeout(timeoutId);
                            timeoutId = null;
                        }
                        waitForPlayerWithBackoff(async () => {
                            state.isLoading = false;
                            await checkVipStatusAsync();
                            await selectVideoQuality();
                            updateQualityButtons(Utils.query("#bilibili-quality-selector"));
                        }, 5, 1000, 0);
                    };

                    // 等待会员图标加载完成
                    const vipIconObserver = new MutationObserver((mutations, observer) => {
                        const vipElement = document.querySelector(".bili-avatar-icon.bili-avatar-right-icon.bili-avatar-icon-big-vip");
                        if (vipElement || mutations.some(m => m.target.classList.contains('bili-avatar-icon-big-vip'))) {
                            observer.disconnect();
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
                        vipIconObserver.disconnect();
                        console.log("[会员状态] 会员图标检测超时，继续执行画质设置");
                        executeQualitySettings();
                    }, 3500);
                }
            });

            vipCheckObserver.observe(document.body, { childList: true, subtree: true });

            window.addEventListener('popstate', () => { DOM.clear(); });
            window.addEventListener('beforeunload', () => { DOM.clear(); });
        }
    }
    window.addEventListener("DOMContentLoaded", initPlayerScripts, { once: true });

    function isPlayerReady() {
        const qualityMenu = document.querySelector('.bpx-player-ctrl-quality-menu');
        const qualityItems = qualityMenu ? qualityMenu.querySelectorAll('.bpx-player-ctrl-quality-menu-item') : null;
        const headerAvatar = document.querySelector(".v-popover-wrap.header-avatar-wrap");
        
        // 未登录模式下不检查头像元素
        const isReady = qualityItems && qualityItems.length > 0 && (state.devModeEnabled && state.devModeNoLoginStatus ? true : headerAvatar);

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
            console.log("[会员状态] 使用缓存状态:", state.isVipUser ? "是" : "否");
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
            state.isVipUser = state.devModeVipStatus;
            state.vipStatusChecked = true;
            state.sessionCache.vipStatus = state.isVipUser;
            state.sessionCache.vipChecked = true;
            console.log("[开发者模式] 用户会员状态:", state.isVipUser ? "是" : "否");
            return;
        }

        try {
            const [vipElement, currentQualityEl] = await Promise.all([
                waitForElement(() => document.querySelector(".bili-avatar-icon.bili-avatar-right-icon.bili-avatar-icon-big-vip"), 3000),
                waitForElement(() => document.querySelector(".bpx-player-ctrl-quality-menu-item.bpx-state-active .bpx-player-ctrl-quality-text"), 3000)
            ]);

            state.isVipUser = vipElement !== null || (currentQualityEl && currentQualityEl.textContent.includes("大会员"));
            state.vipStatusChecked = true;
            // 缓存结果
            state.sessionCache.vipStatus = state.isVipUser;
            state.sessionCache.vipChecked = true;

            console.log("[会员状态] 用户会员状态:", state.isVipUser ? "是" : "否");
            if (state.isVipUser) {
                console.log("[会员状态] 判定依据:", vipElement ? "发现会员图标" : "当前使用会员画质");
            }
        } catch (error) {
            console.log("[会员状态] 检查超时，默认为非会员用户");
            state.isVipUser = false;
            state.vipStatusChecked = true;
            // 缓存结果
            state.sessionCache.vipStatus = state.isVipUser;
            state.sessionCache.vipChecked = true;
        }
    }

    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = selector();
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const element = selector();
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });

            if (timeout) {
                setTimeout(() => {
                    observer.disconnect();
                    resolve(null);
                }, timeout);
            }
        });
    }

    function createCleanupFunction() {
        const observers = new Set();
        const eventListeners = new Set();
        const timeouts = new Set();
        const intervals = new Set();

        return {
            addObserver: (observer) => observers.add(observer),
            addEventListener: (element, type, listener) => {
                element.addEventListener(type, listener);
                eventListeners.add({ element, type, listener });
            },
            setTimeout: (callback, delay) => {
                const id = setTimeout(callback, delay);
                timeouts.add(id);
                return id;
            },
            setInterval: (callback, delay) => {
                const id = setInterval(callback, delay);
                intervals.add(id);
                return id;
            },
            cleanup: () => {
                observers.forEach(observer => observer.disconnect());
                observers.clear();

                eventListeners.forEach(({ element, type, listener }) => {
                    element.removeEventListener(type, listener);
                });
                eventListeners.clear();

                timeouts.forEach(clearTimeout);
                timeouts.clear();

                intervals.forEach(clearInterval);
                intervals.clear();
            }
        };
    }

    const cleanup = createCleanupFunction();

    function initQualitySettingsButton() {
        const controlBottomRight = DOM.get('controlBottomRight');
        const qualityControl = DOM.get('qualityControl');

        if (controlBottomRight && qualityControl && state.injectQualityButton) {
            const existingSettingsBtn = controlBottomRight.querySelector('.quality-settings-btn');
            if (!existingSettingsBtn) {
                const settingsButton = document.createElement('div');
                settingsButton.className = 'bpx-player-ctrl-btn quality-settings-btn';
                settingsButton.innerHTML = '<div class="bpx-player-ctrl-btn-icon"><span class="bpx-common-svg-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="15" rx="2" ry="2"></rect><polyline points="8 20 12 20 16 20"></polyline></svg></span></div>';

                const handleClick = () => toggleSettingsPanel();
                settingsButton.addEventListener('click', handleClick);
                cleanup.addEventListener(settingsButton, 'click', handleClick);

                qualityControl.parentElement.insertBefore(settingsButton, qualityControl);
            }
        }
    }

    function observePlayerControls() {
        const playerControls = DOM.get('playerControls');
        if (playerControls) {
            const observer = new MutationObserver(() => {
                const qualityControl = DOM.refresh('qualityControl');
                if (qualityControl) {
                    hideQualityButton();
                    initQualitySettingsButton();
                }
            });

            observer.observe(playerControls, {
                childList: true,
                subtree: true,
                attributes: false
            });

            cleanup.addObserver(observer);
        }
    }

    // 清理资源
    window.addEventListener('beforeunload', () => {
        cleanup.cleanup();
    });

    let currentUrlChangeTaskId = 0;
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
        state.isLoading = true;

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

                            if (state.devModeEnabled && state.devModeNoLoginStatus) {
                                state.isVipUser = false;
                                state.vipStatusChecked = true;
                                state.sessionCache.vipStatus = false;
                                state.sessionCache.vipChecked = true;
                                console.log("[未登录模式] 非会员状态");
                            }
                            // 第二次切换就用缓存
                            else if (!state.sessionCache.vipChecked) {
                                console.log("[会员状态] 首次检查会员状态");
                                await checkVipStatusAsync();
                            } else {
                                state.isVipUser = state.sessionCache.vipStatus;
                                state.vipStatusChecked = true;
                                console.log("[会员状态] 使用缓存状态:", state.isVipUser ? "是" : "否");
                            }

                            checkIfLivePage();
                            if (state.isLivePage) {
                                await selectLiveQuality();
                            } else {
                                await selectVideoQuality();
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
        urlChangeEvents.forEach(eventName => {
            window.removeEventListener(eventName, onUrlChange);
        });
    });
})();
