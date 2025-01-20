// ==UserScript==
// @name         哔哩哔哩自动画质
// @namespace    https://github.com/AHCorn/Bilibili-Auto-Quality/
// @version      4.1
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
// @match        *://live.bilibili.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @updateURL    https://github.com/AHCorn/Bilibili-Auto-Quality/raw/main/Bilibili-Auto-Quality.user.js
// @downloadURL  https://github.com/AHCorn/Bilibili-Auto-Quality/raw/main/Bilibili-Auto-Quality.user.js
// ==/UserScript==

(function () {
  "use strict";

  if (typeof unsafeWindow === "undefined") {
    unsafeWindow = window;
  }

  window.localStorage.bilibili_player_force_hdr = 1;

  let hiResAudioEnabled = GM_getValue("hiResAudio", false);
  let dolbyAtmosEnabled = GM_getValue("dolbyAtmos", false);
  let userQualitySetting = GM_getValue("qualitySetting", "最高画质");
  let userBackupQualitySetting = GM_getValue("backupQualitySetting", "最高画质");
  let useHighestQualityFallback = GM_getValue("useHighestQualityFallback", true);
  let activeQualityTab = GM_getValue("activeQualityTab", "primary");
  let userHasChangedQuality = false;
  let takeOverQualityControl = GM_getValue("takeOverQualityControl", false);
  let isVipUser = false;
  let vipStatusChecked = false;
  let isLoading = true;
  let isLivePage = false;
  let userLiveQualitySetting = GM_getValue("liveQualitySetting", "原画");

  let devModeEnabled = GM_getValue("devModeEnabled", false);
  let devModeVipStatus = GM_getValue("devModeVipStatus", false);
  let devModeDelay = GM_getValue("devModeDelay", 4000);
  let devModeDisableUA = GM_getValue("devModeDisableUA", false);
  let devModeAudioDelay = GM_getValue("devModeAudioDelay", 4000);
  let devModeAudioRetries = GM_getValue("devModeAudioRetries", 2);
  let injectQualityButton = GM_getValue("injectQualityButton", true);
  let qualityDoubleCheck = GM_getValue("qualityDoubleCheck", true);
  let liveQualityDoubleCheck = GM_getValue("liveQualityDoubleCheck", true);

  try {
    if (!devModeDisableUA || !devModeEnabled) {
      Object.defineProperty(navigator, 'userAgent', {
        value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
        configurable: true
      });
      Object.defineProperty(navigator, 'platform', {
        value: "MacIntel",
        configurable: true
      });
      console.log('UA 和平台标识修改成功');
    } else {
      console.log('开发者模式已禁用 UA 修改');
    }
  } catch (error) {
    console.error('修改 UserAgent 失败，解锁功能可能失效，若需要使用解锁功能，请先关闭与修改 UA 相关的插件及脚本：', error);
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

  function checkIfLivePage() {
    isLivePage = window.location.href.includes("live.bilibili.com");
  }

  function checkVipStatus() {
    if (devModeEnabled) {
      isVipUser = devModeVipStatus;
      vipStatusChecked = true;
      console.log(`开发者模式：用户是否为大会员: ${isVipUser ? "是" : "否"}`);
    } else {
      const vipElement = document.querySelector(
        ".bili-avatar-icon.bili-avatar-right-icon.bili-avatar-icon-big-vip"
      );

      const currentQuality = document.querySelector(
        ".bpx-player-ctrl-quality-menu-item.bpx-state-active .bpx-player-ctrl-quality-text"
      );

      isVipUser = vipElement !== null ||
                  (currentQuality && currentQuality.textContent.includes("大会员"));

      vipStatusChecked = true;
      console.log(`用户是否为大会员: ${isVipUser ? "是" : "否"}`);
      if (isVipUser) {
        console.log('会员判定依据：',
          vipElement ? '发现会员图标' : '当前使用会员画质'
        );
      }
    }
    updateQualityButtons(document.getElementById("bilibili-quality-selector"));
  }

  function createSettingsPanel() {
    const panel = document.createElement("div");
    panel.id = "bilibili-quality-selector";

    const QUALITIES = [
      "最高画质",
      "8K",
      "杜比视界",
      "HDR",
      "4K",
      "1080P 高码率",
      "1080P 60帧",
      "1080P 高清",
      "720P",
      "480P",
      "360P",
      "默认",
    ];

    panel.innerHTML = `
            <h2>画质设置</h2>
            <a href="https://github.com/AHCorn/Bilibili-Auto-Quality/" target="_blank" class="github-link">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
            <div class="status-bar"></div>
            <div class="quality-tabs">
                <div class="quality-tab ${activeQualityTab === 'primary' ? 'active' : ''}" data-tab="primary">首选画质</div>
                <div class="quality-tab ${activeQualityTab === 'backup' ? 'active' : ''}" data-tab="backup">备选画质</div>
            </div>
            <div class="quality-section ${activeQualityTab === 'primary' ? 'active' : ''}" data-section="primary">
                <div class="quality-group">
                    ${QUALITIES.map(
                      (quality) =>
                        `<button class="quality-button" data-quality="${quality}">${quality}</button>`
                    ).join("")}
                </div>
            </div>
            <div class="quality-section ${activeQualityTab === 'backup' ? 'active' : ''}" data-section="backup">
                <div class="quality-group">
                    ${QUALITIES.map(
                      (quality) =>
                        `<button class="quality-button" data-quality="${quality}">${quality}</button>`
                    ).join("")}
                </div>
            </div>
            <div id="non-vip-warning" class="warning" style="display: none;"></div>
            <div id="quality-warning" class="warning" style="display: none;"></div>
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
            <div id="audio-warning" class="warning" style="display: none;"></div>
            <div class="toggle-switch ${userBackupQualitySetting !== "最高画质" ? 'show' : 'hide'}" id="highest-quality-fallback-container">
                <label for="highest-quality-fallback">找不到备选画质时使用最高画质</label>
                <label class="switch">
                    <input type="checkbox" id="highest-quality-fallback" ${useHighestQualityFallback ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
            <div class="toggle-switch">
                <label for="inject-quality-button">注入画质选项</label>
                <label class="switch">
                    <input type="checkbox" id="inject-quality-button" checked>
                    <span class="slider"></span>
                </label>
            </div>
        `;

    panel.querySelectorAll('.quality-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (!isLoading) {
          const tabName = tab.dataset.tab;
          activeQualityTab = tabName;
          GM_setValue("activeQualityTab", tabName);

          panel.querySelectorAll('.quality-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');

          panel.querySelectorAll('.quality-section').forEach(section => {
            section.classList.toggle('active', section.dataset.section === tabName);
          });
        }
      });
    });

    panel.querySelectorAll(".quality-button").forEach((button) => {
      button.addEventListener("click", () => {
        if (!isLoading) {
          const section = button.closest('.quality-section');
          const quality = button.dataset.quality;

          if (section.dataset.section === 'primary') {
            userQualitySetting = quality;
            GM_setValue("qualitySetting", userQualitySetting);
          } else {
            userBackupQualitySetting = quality;
            GM_setValue("backupQualitySetting", userBackupQualitySetting);
            const fallbackContainer = panel.querySelector('#highest-quality-fallback-container');
            if (fallbackContainer) {
              fallbackContainer.classList.toggle('show', quality !== "最高画质");
              fallbackContainer.classList.toggle('hide', quality === "最高画质");
            }
          }

          updateQualityButtons(panel);
          selectQualityBasedOnSetting();
        }
      });
    });

    const fallbackCheckbox = panel.querySelector("#highest-quality-fallback");
    if (fallbackCheckbox) {
      fallbackCheckbox.addEventListener("change", (e) => {
        if (!isLoading) {
          useHighestQualityFallback = e.target.checked;
          GM_setValue("useHighestQualityFallback", useHighestQualityFallback);
          selectQualityBasedOnSetting();
        }
      });
    }

    panel.querySelector("#hi-res-audio").addEventListener("change", (e) => {
      if (!isLoading) {
        hiResAudioEnabled = e.target.checked;
        GM_setValue("hiResAudio", hiResAudioEnabled);
        updateQualityButtons(panel);
        selectQualityBasedOnSetting();
      }
    });

    panel.querySelector("#dolby-atmos").addEventListener("change", (e) => {
      if (!isLoading) {
        dolbyAtmosEnabled = e.target.checked;
        GM_setValue("dolbyAtmos", dolbyAtmosEnabled);
        updateQualityButtons(panel);
        selectQualityBasedOnSetting();
      }
    });

    panel.querySelector("#inject-quality-button").addEventListener("change", (e) => {
      if (!isLoading) {
        injectQualityButton = e.target.checked;
        GM_setValue("injectQualityButton", injectQualityButton);

        const qualityControlElement = document.querySelector(
          ".bpx-player-ctrl-quality"
        );
        if (qualityControlElement) {
          const settingsButton = document.createElement('div');
          settingsButton.className = 'bpx-player-ctrl-btn quality-settings-btn';
          settingsButton.innerHTML = `
            <div class="bpx-player-ctrl-btn-icon">
              <span class="bpx-common-svg-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="4" width="20" height="15" rx="2" ry="2"></rect>
                  <polyline points="8 20 12 20 16 20"></polyline>
                </svg>
              </span>
            </div>
          `;
          settingsButton.addEventListener('click', () => {
            toggleSettingsPanel();
          });

          if (injectQualityButton) {
            if (!qualityControlElement.previousElementSibling?.classList.contains('quality-settings-btn')) {
              qualityControlElement.parentElement.insertBefore(settingsButton, qualityControlElement);
            }
          } else {
            const existingButton = qualityControlElement.previousElementSibling;
            if (existingButton?.classList.contains('quality-settings-btn')) {
              existingButton.remove();
            }
          }
        }
      }
    });

    document.body.appendChild(panel);
    updateQualityButtons(panel);
  }

  function updateQualityButtons(panel) {
    if (!panel) return;

    const statusBar = panel.querySelector(".status-bar");

    if (isLoading) {
      statusBar.textContent = "加载中，请稍候...";
      statusBar.className = "status-bar";
      panel
        .querySelectorAll(".quality-button, .toggle-switch")
        .forEach((el) => (el.style.opacity = "0.5"));
    } else {
      panel
        .querySelectorAll(".quality-button, .toggle-switch")
        .forEach((el) => (el.style.opacity = "1"));

      if (vipStatusChecked) {
        statusBar.textContent = isVipUser
          ? "您是大会员用户，可正常使用所有选项。"
          : "您不是大会员用户，部分会员选项不可用。";
        statusBar.className = `status-bar ${isVipUser ? "vip" : "non-vip"}`;
      }
    }

    panel.querySelectorAll('.quality-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === activeQualityTab);
    });

    panel.querySelectorAll('.quality-section').forEach(section => {
      section.classList.toggle('active', section.dataset.section === activeQualityTab);
    });

    panel.querySelectorAll(".quality-button").forEach((button) => {
      const section = button.closest('.quality-section');
      button.classList.remove("active", "vip-quality");

      if (section.dataset.section === 'primary' && button.dataset.quality === userQualitySetting ||
          section.dataset.section === 'backup' && button.dataset.quality === userBackupQualitySetting) {
        button.classList.add("active");
        if (
          ["8K", "杜比视界", "HDR", "4K", "1080P 高码率", "1080P 60帧"].includes(button.dataset.quality)
        ) {
          button.classList.add("vip-quality");
        }
      }
    });

    const fallbackContainer = panel.querySelector('#highest-quality-fallback-container');
    if (fallbackContainer) {
      fallbackContainer.classList.toggle('show', userBackupQualitySetting !== "最高画质");
      fallbackContainer.classList.toggle('hide', userBackupQualitySetting === "最高画质");
    }

    const hiResAudioSwitch = panel.querySelector("#hi-res-audio");
    hiResAudioSwitch.checked = hiResAudioEnabled;

    const dolbyAtmosSwitch = panel.querySelector("#dolby-atmos");
    dolbyAtmosSwitch.checked = dolbyAtmosEnabled;

    const fallbackCheckbox = panel.querySelector("#highest-quality-fallback");
    if (fallbackCheckbox) {
      fallbackCheckbox.checked = useHighestQualityFallback;
    }

    updateWarnings(panel);
  }

  function updateWarnings(panel) {
    if (!panel || isLoading || !vipStatusChecked) return;

    const nonVipWarning = panel.querySelector("#non-vip-warning");
    const qualityWarning = panel.querySelector("#quality-warning");
    const audioWarning = panel.querySelector("#audio-warning");

    if (
      !isVipUser &&
      ["8K", "杜比视界", "HDR", "4K", "1080P 高码率", "1080P 60帧"].includes(
        userQualitySetting
      )
    ) {
      nonVipWarning.textContent =
        "无法使用此会员画质。已自动选择最高可用画质。";
      nonVipWarning.style.display = "block";
    } else {
      nonVipWarning.style.display = "none";
    }

    if (!isVipUser && (hiResAudioEnabled || dolbyAtmosEnabled)) {
      audioWarning.textContent = "非大会员用户不能使用高级音频选项。";
      audioWarning.style.display = "block";
    } else {
      audioWarning.style.display = "none";
    }
  }

  function selectQualityBasedOnSetting() {
    if (isLivePage) {
      selectLiveQuality();
    } else {
      selectVideoQuality();
    }
  }

  function selectVideoQuality() {
    if (!vipStatusChecked) {
      checkVipStatus();
    }

    const setAudioQuality = (retryCount = 0) => {
      if (!isVipUser) {
        console.log('非会员用户，略过音质设置');
        return;
      }

      const maxRetries = devModeEnabled ? devModeAudioRetries : 2;
      const retryInterval = devModeEnabled ? devModeAudioDelay : 4000;

      const trySetHiRes = () => {
        const hiResButton = document.querySelector(".bpx-player-ctrl-flac");
        if (!hiResButton) {
          return true;
        }
        if (isVipUser) {
          if (hiResAudioEnabled && !hiResButton.classList.contains("bpx-state-active")) {
            console.log(`尝试开启Hi-Res音质 (第${retryCount + 1}次)`);
            hiResButton.click();
          } else if (!hiResAudioEnabled && hiResButton.classList.contains("bpx-state-active")) {
            console.log(`尝试关闭Hi-Res音质 (第${retryCount + 1}次)`);
            hiResButton.click();
          }
        }
        return true;
      };

      const trySetDolby = () => {
        const dolbyButton = document.querySelector(".bpx-player-ctrl-dolby");
        if (!dolbyButton) {
          return true;
        }
        if (isVipUser) {
          if (dolbyAtmosEnabled && !dolbyButton.classList.contains("bpx-state-active")) {
            console.log(`尝试开启杜比全景声 (第${retryCount + 1}次)`);
            dolbyButton.click();
          } else if (!dolbyAtmosEnabled && dolbyButton.classList.contains("bpx-state-active")) {
            console.log(`尝试关闭杜比全景声 (第${retryCount + 1}次)`);
            dolbyButton.click();
          }
        }
        return true;
      };

      const shouldRetry = () => {
        const hiResButton = document.querySelector(".bpx-player-ctrl-flac");
        const dolbyButton = document.querySelector(".bpx-player-ctrl-dolby");

        const needRetryHiRes = hiResButton && (
          (isVipUser && hiResAudioEnabled !== hiResButton.classList.contains("bpx-state-active")) ||
          (!isVipUser && hiResButton.classList.contains("bpx-state-active"))
        );
        const needRetryDolby = dolbyButton && (
          (isVipUser && dolbyAtmosEnabled !== dolbyButton.classList.contains("bpx-state-active")) ||
          (!isVipUser && dolbyButton.classList.contains("bpx-state-active"))
        );

        return (needRetryHiRes || needRetryDolby) && retryCount < maxRetries;
      };

      console.log(`开始第${retryCount + 1}次音质设置...`);
      trySetHiRes();
      trySetDolby();

      if (shouldRetry()) {
        console.log(`音质设置未完成，${retryInterval/1000}秒后重试...`);
        setTimeout(() => {
          setAudioQuality(retryCount + 1);
        }, retryInterval);
      } else {
        console.log("音质设置完成或达到最大重试次数");
        if (takeOverQualityControl) {
          const qualityControlElement = document.querySelector(
            ".bpx-player-ctrl-btn.bpx-player-ctrl-quality"
          );
          if (qualityControlElement) {
            qualityControlElement.classList.add('quality-button-hidden');
          }
        } else {
          const qualityControlElement = document.querySelector(
            ".bpx-player-ctrl-btn.bpx-player-ctrl-quality"
          );
          if (qualityControlElement) {
            qualityControlElement.classList.remove('quality-button-hidden');
          }
        }
        updateWarnings(document.getElementById("bilibili-quality-selector"));
      }
    };

    let currentQuality = document.querySelector(
      ".bpx-player-ctrl-quality-menu-item.bpx-state-active .bpx-player-ctrl-quality-text"
    ).textContent;
    console.log(`当前画质: ${currentQuality}`);
    console.log(`目标画质: ${userQualitySetting}`);

    const qualityItems = document.querySelectorAll(
      ".bpx-player-ctrl-quality-menu .bpx-player-ctrl-quality-menu-item"
    );
    const availableQualities = Array.from(qualityItems).map((item) => ({
      name: item.textContent.trim(),
      element: item,
      isVipOnly: !!item.querySelector(".bpx-player-ctrl-quality-badge-bigvip"),
      isFreeNow: !!item.querySelector(".bpx-player-ctrl-quality-badge-bigvip")?.textContent.includes("限免中")
    }));

    console.log(
      `当前视频可用画质:`,
      availableQualities.map((q) => q.name)
    );

    const qualityPreferences = [
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
      "默认",
    ];

    availableQualities.sort((a, b) => {
      const getQualityIndex = (name) => {
        for (let i = 0; i < qualityPreferences.length; i++) {
          if (name.includes(qualityPreferences[i])) {
            return i;
          }
        }
        return qualityPreferences.length;
      };
      return getQualityIndex(a.name) - getQualityIndex(b.name);
    });

    let targetQuality;
    const cleanQuality = (quality) => quality?.replace(/大会员|限免中/g, '').trim();
    const currentCleanQuality = cleanQuality(currentQuality);

    if (userQualitySetting === "最高画质") {
      const hasFreeVipQualities = availableQualities.some(quality => quality.isFreeNow);
      if (isVipUser || hasFreeVipQualities) {
        targetQuality = availableQualities[0];
      } else {
        targetQuality = availableQualities.find(quality =>
          cleanQuality(quality.name).includes(userBackupQualitySetting)
        );
        if (!targetQuality && useHighestQualityFallback) {
          targetQuality = availableQualities.find(quality => !quality.isVipOnly);
        }
        if (!targetQuality && !useHighestQualityFallback) {
          console.log("未找到备选画质，且未启用最高画质兜底，保持当前画质");
          const hiResButton = document.querySelector(".bpx-player-ctrl-flac");
          const dolbyButton = document.querySelector(".bpx-player-ctrl-dolby");

          console.log(`是否存在Hi-Res音质按钮：${hiResButton ? '是' : '否'}`);
          let needSetHiRes = false;
          if (hiResButton) {
            const hiResActive = hiResButton.classList.contains("bpx-state-active");
            console.log(`Hi-Res音质按钮当前状态：${hiResActive ? '已开启' : '已关闭'}`);
            needSetHiRes = (isVipUser && hiResAudioEnabled !== hiResActive) ||
                          (!isVipUser && hiResActive);
          }

          console.log(`是否存在杜比全景声按钮：${dolbyButton ? '是' : '否'}`);
          let needSetDolby = false;
          if (dolbyButton) {
            const dolbyActive = dolbyButton.classList.contains("bpx-state-active");
            console.log(`杜比全景声按钮当前状态：${dolbyActive ? '已开启' : '已关闭'}`);
            needSetDolby = (isVipUser && dolbyAtmosEnabled !== dolbyActive) ||
                          (!isVipUser && dolbyActive);
          }

          if (needSetHiRes || needSetDolby) {
            console.log("开始设置音质...");
            setAudioQuality();
          } else {
            console.log("音质按钮状态已符合设置，无需调整");
          }
          return;
        }
      }
    } else if (userQualitySetting === "默认") {
      console.log("使用默认画质");
      const hiResButton = document.querySelector(".bpx-player-ctrl-flac");
      const dolbyButton = document.querySelector(".bpx-player-ctrl-dolby");

      console.log(`是否存在Hi-Res音质按钮：${hiResButton ? '是' : '否'}`);
      let needSetHiRes = false;
      if (hiResButton) {
        const hiResActive = hiResButton.classList.contains("bpx-state-active");
        console.log(`Hi-Res音质按钮当前状态：${hiResActive ? '已开启' : '已关闭'}`);
        needSetHiRes = (isVipUser && hiResAudioEnabled !== hiResActive) ||
                      (!isVipUser && hiResActive);
      }

      console.log(`是否存在杜比全景声按钮：${dolbyButton ? '是' : '否'}`);
      let needSetDolby = false;
      if (dolbyButton) {
        const dolbyActive = dolbyButton.classList.contains("bpx-state-active");
        console.log(`杜比全景声按钮当前状态：${dolbyActive ? '已开启' : '已关闭'}`);
        needSetDolby = (isVipUser && dolbyAtmosEnabled !== dolbyActive) ||
                      (!isVipUser && dolbyActive);
      }

      if (needSetHiRes || needSetDolby) {
        console.log("开始设置音质...");
        setAudioQuality();
      } else {
        console.log("音质按钮状态已符合设置，无需调整");
      }
      return;
    } else {
      targetQuality = availableQualities.find((quality) =>
        cleanQuality(quality.name).includes(userQualitySetting)
      );
      if (!targetQuality) {
        console.log(`未找到目标画质 ${userQualitySetting}, 尝试使用备选画质`);
        targetQuality = availableQualities.find(quality =>
          cleanQuality(quality.name).includes(userBackupQualitySetting)
        );
        if (!targetQuality && useHighestQualityFallback) {
          targetQuality = isVipUser
            ? availableQualities[0]
            : availableQualities.find((quality) => !quality.isVipOnly);
        }
        if (!targetQuality && !useHighestQualityFallback) {
          console.log("未找到备选画质，且未启用最高画质兜底，保持当前画质");
          const hiResButton = document.querySelector(".bpx-player-ctrl-flac");
          const dolbyButton = document.querySelector(".bpx-player-ctrl-dolby");

          console.log(`是否存在Hi-Res音质按钮：${hiResButton ? '是' : '否'}`);
          let needSetHiRes = false;
          if (hiResButton) {
            const hiResActive = hiResButton.classList.contains("bpx-state-active");
            console.log(`Hi-Res音质按钮当前状态：${hiResActive ? '已开启' : '已关闭'}`);
            needSetHiRes = (isVipUser && hiResAudioEnabled !== hiResActive) ||
                          (!isVipUser && hiResActive);
          }

          console.log(`是否存在杜比全景声按钮：${dolbyButton ? '是' : '否'}`);
          let needSetDolby = false;
          if (dolbyButton) {
            const dolbyActive = dolbyButton.classList.contains("bpx-state-active");
            console.log(`杜比全景声按钮当前状态：${dolbyActive ? '已开启' : '已关闭'}`);
            needSetDolby = (isVipUser && dolbyAtmosEnabled !== dolbyActive) ||
                          (!isVipUser && dolbyActive);
          }

          if (needSetHiRes || needSetDolby) {
            console.log("开始设置音质...");
            setAudioQuality();
          } else {
            console.log("音质按钮状态已符合设置，无需调整");
          }
          return;
        }
      }
    }

    console.log(`实际目标画质: ${targetQuality.name}`);
    targetQuality.element.click();

    if (qualityDoubleCheck) {
      setTimeout(() => {
        const currentQualityAfterSwitch = document.querySelector(
          ".bpx-player-ctrl-quality-menu-item.bpx-state-active .bpx-player-ctrl-quality-text"
        )?.textContent;

        const cleanQuality = (quality) => quality?.replace(/大会员|限免中/g, '').trim();
        const currentCleanQuality = cleanQuality(currentQualityAfterSwitch);
        const targetCleanQuality = cleanQuality(targetQuality.name);

        if (currentQualityAfterSwitch && currentCleanQuality !== targetCleanQuality) {
          console.log(`画质切换可能未成功，当前画质: ${currentQualityAfterSwitch}，目标画质: ${targetQuality.name}，执行二次切换...`);
          targetQuality.element.click();
        } else {
          console.log(`画质切换验证成功，当前画质: ${currentQualityAfterSwitch}`);
        }

        const hiResButton = document.querySelector(".bpx-player-ctrl-flac");
        const dolbyButton = document.querySelector(".bpx-player-ctrl-dolby");

        console.log(`是否存在Hi-Res音质按钮：${hiResButton ? '是' : '否'}`);
        let needSetHiRes = false;
        if (hiResButton) {
          const hiResActive = hiResButton.classList.contains("bpx-state-active");
          console.log(`Hi-Res音质按钮当前状态：${hiResActive ? '已开启' : '已关闭'}`);
          needSetHiRes = (isVipUser && hiResAudioEnabled !== hiResActive) ||
                        (!isVipUser && hiResActive);
        }

        console.log(`是否存在杜比全景声按钮：${dolbyButton ? '是' : '否'}`);
        let needSetDolby = false;
        if (dolbyButton) {
          const dolbyActive = dolbyButton.classList.contains("bpx-state-active");
          console.log(`杜比全景声按钮当前状态：${dolbyActive ? '已开启' : '已关闭'}`);
          needSetDolby = (isVipUser && dolbyAtmosEnabled !== dolbyActive) ||
                        (!isVipUser && dolbyActive);
        }

        if (needSetHiRes || needSetDolby) {
          console.log("开始设置音质...");
          setAudioQuality();
        } else {
          console.log("音质按钮状态已符合设置，无需调整");
        }
      }, 5000);
    }
  }

  function createLiveSettingsPanel() {
    const panel = document.createElement("div");
    panel.id = "bilibili-live-quality-selector";

    const updatePanel = () => {
      const qualityCandidates =
        unsafeWindow.livePlayer.getPlayerInfo().qualityCandidates;
      const LIVE_QUALITIES = ["原画", "蓝光","超清", "高清"];

      const lineSelector = document.querySelector(".YccudlUCmLKcUTg_yzKN");
      const lines = lineSelector
        ? Array.from(lineSelector.children).map((li) => li.textContent)
        : ["加载中..."];
      const currentLineIndex = lineSelector
        ? Array.from(lineSelector.children).findIndex((li) =>
            li.classList.contains("fG2r2piYghHTQKQZF8bl")
          )
        : 0;

      panel.innerHTML = `
            <h2>直播设置</h2>
            <a href="https://github.com/AHCorn/Bilibili-Auto-Quality/" target="_blank" class="github-link">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
            <div class="quality-section-title">线路选择</div>
            <div class="line-group">
                ${lines
                  .map(
                    (line, index) =>
                      `<button class="line-button ${
                        index === currentLineIndex ? "active" : ""
                      }" data-line="${index}">${line}</button>`
                  )
                  .join("")}
            </div>
            <div class="quality-section-title">画质选择</div>
            <div class="live-quality-group">
                ${LIVE_QUALITIES.map(
                  (quality) =>
                    `<button class="live-quality-button ${
                      quality === userLiveQualitySetting ? "active" : ""
                    }" data-quality="${quality}">${quality}</button>`
                ).join("")}
            </div>
        `;

      panel.querySelectorAll(".line-button").forEach((button) => {
        button.addEventListener("click", () => {
          const lineIndex = parseInt(button.dataset.line);
          changeLine(lineIndex);
        });
      });

      panel.querySelectorAll(".live-quality-button").forEach((button) => {
        button.addEventListener("click", () => {
          userLiveQualitySetting = button.dataset.quality;
          GM_setValue("liveQualitySetting", userLiveQualitySetting);
          updatePanel();
          selectLiveQuality();
        });
      });
    };

    document.body.appendChild(panel);
    panel.updatePanel = updatePanel;
    updatePanel();
  }

  function selectLiveQuality() {
    return new Promise((resolve) => {
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
    }).then(() => {
      const qualityCandidates =
        unsafeWindow.livePlayer.getPlayerInfo().qualityCandidates;

      console.log("可用画质选项：");
      qualityCandidates.forEach((quality, index) => {
        console.log(`${index + 1}. ${quality.desc} (qn: ${quality.qn})`);
      });

      console.log(`选择的画质: ${userLiveQualitySetting}`);

      let targetQuality;

      targetQuality = qualityCandidates.find(
        (q) => q.desc === userLiveQualitySetting
      );

      if (!targetQuality) {
        const qualityPriority = ["原画", "蓝光", "超清", "高清"];
        for (let quality of qualityPriority) {
          targetQuality = qualityCandidates.find((q) => q.desc === quality);
          if (targetQuality) break;
        }
      }

      if (!targetQuality) {
        targetQuality = qualityCandidates[0];
      }

      const targetQualityNumber = targetQuality.qn;
      const targetQualityName = targetQuality.desc;

      console.log(
        `目标画质：${targetQualityName} (qn: ${targetQualityNumber})`
      );

      const switchQuality = () => {
        const currentQualityNumber =
          unsafeWindow.livePlayer.getPlayerInfo().quality;
        if (currentQualityNumber !== targetQualityNumber) {
          unsafeWindow.livePlayer.switchQuality(targetQualityNumber);
          console.log(`已切换到目标画质：${targetQualityName}`);
          userLiveQualitySetting = targetQualityName;
          GM_setValue("liveQualitySetting", userLiveQualitySetting);
          updateLiveSettingsPanel();

          if (liveQualityDoubleCheck) {
            setTimeout(() => {
              const currentQualityAfterSwitch = unsafeWindow.livePlayer.getPlayerInfo().quality;
              if (currentQualityAfterSwitch !== targetQualityNumber) {
                console.log(`直播画质切换可能未成功，当前画质: ${currentQualityAfterSwitch}，目标画质: ${targetQualityNumber}，执行二次切换...`);
                unsafeWindow.livePlayer.switchQuality(targetQualityNumber);
              } else {
                console.log(`直播画质切换验证成功，当前画质: ${targetQualityName}`);
              }
            }, 5000);
          }
        } else {
          console.log(`已经是目标画质：${targetQualityName}`);
        }
      };

      switchQuality();
    });
  }

  function changeLine(lineIndex) {
    const lineSelector = document.querySelector(".YccudlUCmLKcUTg_yzKN");
    if (lineSelector && lineSelector.children[lineIndex]) {
      lineSelector.children[lineIndex].click();
      console.log(
        `已切换到线路：${lineSelector.children[lineIndex].textContent}`
      );
      const panel = document.getElementById("bilibili-live-quality-selector");
      if (panel) {
        panel.querySelectorAll(".line-button").forEach((button, index) => {
          if (index === lineIndex) {
            button.classList.add("active");
          } else {
            button.classList.remove("active");
          }
        });
      }
    } else {
      console.log("无法切换线路");
    }
  }

  function observeLineChanges() {
    const lineSelector = document.querySelector(".YccudlUCmLKcUTg_yzKN");
    if (lineSelector) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "class"
          ) {
            const currentLineIndex = Array.from(
              lineSelector.children
            ).findIndex((li) => li.classList.contains("fG2r2piYghHTQKQZF8bl"));
            updateLiveSettingsPanel();
          }
        });
      });

      observer.observe(lineSelector, {
        attributes: true,
        subtree: true,
        attributeFilter: ["class"],
      });
    }
  }

  function updateLiveSettingsPanel() {
    const panel = document.getElementById("bilibili-live-quality-selector");
    if (panel && typeof panel.updatePanel === "function") {
      panel.updatePanel();
    }
  }

  function togglePanel(panelId, createPanelFunc, updateFunc) {
    let panel = document.getElementById(panelId);
    if (!panel) {
      createPanelFunc();
      panel = document.getElementById(panelId);
    }

    const handleOutsideClick = (event) => {
      if (panel && !panel.contains(event.target)) {
        panel.classList.remove("show");
        document.removeEventListener("mousedown", handleOutsideClick);
      }
    };

    if (!panel.classList.contains("show")) {
      ["bilibili-quality-selector", "bilibili-live-quality-selector", "bilibili-dev-settings"].forEach(id => {
        if (id !== panelId) {
          const otherPanel = document.getElementById(id);
          if (otherPanel?.classList.contains("show")) {
            otherPanel.classList.remove("show");
          }
        }
      });

      panel.classList.add("show");
      document.addEventListener("mousedown", handleOutsideClick);
    } else {
      panel.classList.remove("show");
      document.removeEventListener("mousedown", handleOutsideClick);
    }

    if (updateFunc) {
      updateFunc(panel);
    }
  }

  function toggleSettingsPanel() {
    togglePanel("bilibili-quality-selector", createSettingsPanel, updateQualityButtons);
  }

  function toggleLiveSettingsPanel() {
    togglePanel("bilibili-live-quality-selector", createLiveSettingsPanel, updateLiveSettingsPanel);
  }

  function toggleDevSettingsPanel() {
    togglePanel("bilibili-dev-settings", createDevSettingsPanel, panel => {
      const removeQualityButton = panel.querySelector('#remove-quality-button');
      if (removeQualityButton) {
        removeQualityButton.checked = takeOverQualityControl;
      }
    });
  }

  GM_registerMenuCommand("设置面板", () => {
    checkIfLivePage();
    if (isLivePage) {
      toggleLiveSettingsPanel();
    } else {
      toggleSettingsPanel();
    }
  });

  GM_registerMenuCommand("开发者选项", toggleDevSettingsPanel);

  window.addEventListener("load", () => {
    if (isLivePage) {
      observeLineChanges();
    }
  });

  window.onload = function () {
    checkIfLivePage();
    if (isLivePage) {
      selectLiveQuality().then(() => {
        createLiveSettingsPanel();
      });
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
        elements: {
          qualitySelector: null,
          playerControls: null,
          headerAvatar: null,
          controlBottomRight: null
        },
        get: function(key) {
          if (!this.elements[key]) {
            this.elements[key] = document.querySelector(this.selectors[key]);
          }
          return this.elements[key];
        },
        refresh: function(key) {
          this.elements[key] = document.querySelector(this.selectors[key]);
          return this.elements[key];
        },
        clear: function() {
          this.elements = {
            qualitySelector: null,
            playerControls: null,
            headerAvatar: null,
            controlBottomRight: null
          };
        }
      };

      const hideQualityButton = () => {
        const qualityControl = DOM.get('qualityButton');
        if (qualityControl && takeOverQualityControl) {
          qualityControl.classList.add('quality-button-hidden');
        }
      };

      const initQualitySettingsButton = () => {
        const controlBottomRight = DOM.get('controlBottomRight');
        const qualityControl = DOM.get('qualityControl');

        if (controlBottomRight && qualityControl && injectQualityButton) {
          const existingSettingsBtn = controlBottomRight.querySelector('.quality-settings-btn');
          if (!existingSettingsBtn) {
            const settingsButton = document.createElement('div');
            settingsButton.className = 'bpx-player-ctrl-btn quality-settings-btn';
            settingsButton.innerHTML = `
              <div class="bpx-player-ctrl-btn-icon">
                <span class="bpx-common-svg-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="4" width="20" height="15" rx="2" ry="2"></rect>
                    <polyline points="8 20 12 20 16 20"></polyline>
                  </svg>
                </span>
              </div>
            `;
            settingsButton.addEventListener('click', toggleSettingsPanel);
            qualityControl.parentElement.insertBefore(settingsButton, qualityControl);

            if (playerControlsObserver) {
              playerControlsObserver.disconnect();
            }
          }
        }
      };

      hideQualityButton();
      initQualitySettingsButton();

      const playerControlsObserver = new MutationObserver((mutations) => {
        const qualityControl = DOM.refresh('qualityControl');
        if (qualityControl) {
          hideQualityButton();
          initQualitySettingsButton();
        }
      });

      const playerControls = DOM.get('playerControls');
      if (playerControls) {
        playerControlsObserver.observe(playerControls, {
          childList: true,
          subtree: true
        });
      }

      let hasElementAppeared = false;
      const vipCheckObserver = new MutationObserver(function (mutations, me) {
        const headerElement = DOM.get('headerAvatar');
        if (headerElement) {
          hasElementAppeared = true;
          console.log("正在判断用户是否为会员...");

          me.disconnect();

          setTimeout(() => {
            initializeQualitySettings();
            console.log(`脚本开始运行，${devModeEnabled ? devModeDelay/1000 : 2.5}秒后切换画质`);
          }, devModeEnabled ? devModeDelay : 2500);
        }
      });

      vipCheckObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });

      window.addEventListener('popstate', () => DOM.clear());
      window.addEventListener('beforeunload', () => DOM.clear());
    }
  };

  const parentElement = document.body;

  let initialTitle = '';
  let isFirstLoad = true;

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  const initTitleObserver = setInterval(() => {
    const titleElement = document.querySelector('.video-title');
    if (titleElement) {
      if (!document.hidden) {
        if (isFirstLoad) {
          initialTitle = titleElement.textContent.trim();
          console.log('记录初始标题:', initialTitle);
          isFirstLoad = false;
        }

        titleObserver.observe(titleElement, {
          childList: true,
          subtree: true,
          characterData: true
        });
        console.log('已启动标题监听器');
      }
      clearInterval(initTitleObserver);
    }
  }, 3000);

  const handleTitleChange = debounce((title) => {
    if (title === initialTitle) {
      console.log('标题未发生变化');
      return;
    }

    console.log('视频标题发生变化:', title);
    initialTitle = title;
    isLoading = true;
    updateQualityButtons(document.getElementById("bilibili-quality-selector"));
    setTimeout(() => {
      isLoading = false;
      checkVipStatus();
      selectQualityBasedOnSetting();
      updateQualityButtons(document.getElementById("bilibili-quality-selector"));
    }, 3500);
  }, 100);

  const titleObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.target.classList.contains('video-title')) {
        handleTitleChange(mutation.target.textContent.trim());
      }
    });
  });

  function handleVisibilityChange() {
    const titleElement = document.querySelector('.video-title');
    if (document.hidden) {
      console.log('页面不可见，暂停标题监听');
      titleObserver.disconnect();
    } else {
      console.log('页面可见，恢复标题监听');
      if (titleElement) {
        titleObserver.observe(titleElement, {
          childList: true,
          subtree: true,
          characterData: true
        });
      }
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);

  window.addEventListener('unload', () => {
    clearInterval(initTitleObserver);
    titleObserver.disconnect();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

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
                <input type="checkbox" id="dev-mode" ${devModeEnabled ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
        </div>
        <div class="toggle-switch">
            <label for="quality-double-check">
              视频画质二次验证
              <div class="description">启用后将在视频画质切换5秒后进行验证</div>
            </label>
            <label class="switch">
                <input type="checkbox" id="quality-double-check" ${qualityDoubleCheck ? 'checked' : ''} ${!devModeEnabled ? 'disabled' : ''}>
                <span class="slider"></span>
            </label>
        </div>
        <div class="toggle-switch">
            <label for="live-quality-double-check">
              直播画质二次验证
              <div class="description">启用后将在直播画质切换5秒后进行验证</div>
            </label>
            <label class="switch">
                <input type="checkbox" id="live-quality-double-check" ${liveQualityDoubleCheck ? 'checked' : ''} ${!devModeEnabled ? 'disabled' : ''}>
                <span class="slider"></span>
            </label>
        </div>
        <div class="toggle-switch">
            <label for="dev-vip">
              模拟大会员状态
              <div class="description">模拟脚本所识别到的大会员状态，<b>并非破解</b></div>
            </label>
            <label class="switch">
                <input type="checkbox" id="dev-vip" ${devModeVipStatus ? 'checked' : ''} ${!devModeEnabled ? 'disabled' : ''}>
                <span class="slider"></span>
            </label>
        </div>
        <div class="toggle-switch">
            <label for="dev-ua">
              禁用 UA 修改
              <div class="description">禁用后部分旧版本浏览器可能无法解锁画质</div>
            </label>
            <label class="switch">
                <input type="checkbox" id="dev-ua" ${devModeDisableUA ? 'checked' : ''} ${!devModeEnabled ? 'disabled' : ''}>
                <span class="slider"></span>
            </label>
        </div>
        <div class="toggle-switch">
            <label for="remove-quality-button">
              移除清晰度按钮
              <div class="description">启用后将隐藏播放器的清晰度按钮</div>
            </label>
            <label class="switch">
                <input type="checkbox" id="remove-quality-button" ${takeOverQualityControl ? 'checked' : ''} ${!devModeEnabled ? 'disabled' : ''}>
                <span class="slider"></span>
            </label>
        </div>
        <div class="input-group ${!devModeEnabled ? 'disabled' : ''}">
            <label for="dev-delay">
              画质切换延迟
              <div class="description">画质切换的等待时间</div>
            </label>
            <input type="number" id="dev-delay" value="${devModeDelay}" min="0" max="10000" step="100" ${!devModeEnabled ? 'disabled' : ''}>
            <span class="unit">毫秒</span>
        </div>
        <div class="input-group ${!devModeEnabled ? 'disabled' : ''}">
            <label for="dev-audio-delay">
              音质切换延迟
              <div class="description">音质切换的等待时间</div>
            </label>
            <input type="number" id="dev-audio-delay" value="${devModeAudioDelay}" min="0" max="10000" step="100" ${!devModeEnabled ? 'disabled' : ''}>
            <span class="unit">毫秒</span>
        </div>
        <div class="input-group ${!devModeEnabled ? 'disabled' : ''}">
            <label for="dev-audio-retries">
              音质切换重试次数
              <div class="description">音质切换失败后的重试次数</div>
            </label>
            <input type="number" id="dev-audio-retries" value="${devModeAudioRetries}" min="0" max="5" step="1" ${!devModeEnabled ? 'disabled' : ''}>
            <span class="unit" style="margin-left: 15px;">次</span>
        </div>
        <div id="dev-warning" class="warning" style="display: none;"></div>
        <button class="refresh-button" ${!devModeEnabled ? 'disabled' : ''}>确认并刷新页面</button>
    `;

    document.body.appendChild(panel);

    panel.querySelector('#dev-mode').addEventListener('change', (e) => {
        devModeEnabled = e.target.checked;
        GM_setValue("devModeEnabled", devModeEnabled);

        const vipSwitch = panel.querySelector('#dev-vip');
        const uaSwitch = panel.querySelector('#dev-ua');
        const delayInput = panel.querySelector('#dev-delay');
        const audioDelayInput = panel.querySelector('#dev-audio-delay');
        const audioRetriesInput = panel.querySelector('#dev-audio-retries');
        const qualityDoubleCheckSwitch = panel.querySelector('#quality-double-check');
        const removeQualityButton = panel.querySelector('#remove-quality-button');
        const refreshButton = panel.querySelector('.refresh-button');
        const warning = panel.querySelector('#dev-warning');
        const inputGroups = panel.querySelectorAll('.input-group');

        [vipSwitch, uaSwitch, delayInput, audioDelayInput, audioRetriesInput,
         qualityDoubleCheckSwitch, removeQualityButton].forEach(control => {
            if (control) {
                control.disabled = !devModeEnabled;
            }
        });

        if (refreshButton) {
            refreshButton.disabled = !devModeEnabled;
        }

        inputGroups.forEach(group => {
            group.classList.toggle('disabled', !devModeEnabled);
        });

        if (!devModeEnabled) {
            vipStatusChecked = false;
            checkVipStatus();
            if (devModeDisableUA) {
                warning.textContent = "开发者模式已关闭，UA 修改将在刷新页面后恢复";
                warning.style.display = "block";
            }
        } else {
            warning.style.display = "none";
        }
    });

    panel.querySelector('#dev-vip').addEventListener('change', (e) => {
        devModeVipStatus = e.target.checked;
        GM_setValue("devModeVipStatus", devModeVipStatus);
        if (devModeEnabled) {
            isVipUser = devModeVipStatus;
            vipStatusChecked = true;
            updateQualityButtons(document.getElementById("bilibili-quality-selector"));
        }
    });

    panel.querySelector('#dev-ua').addEventListener('change', (e) => {
        devModeDisableUA = e.target.checked;
        GM_setValue("devModeDisableUA", devModeDisableUA);
        const warning = panel.querySelector('#dev-warning');
        warning.textContent = devModeDisableUA ?
            "UA 修改已禁用，请刷新页面生效" :
            "UA 修改已启用，请刷新页面生效";
        warning.style.display = "block";
    });

    panel.querySelector('#remove-quality-button').addEventListener('change', (e) => {
        takeOverQualityControl = e.target.checked;
        GM_setValue("takeOverQualityControl", takeOverQualityControl);
        const qualityControlElement = document.querySelector(
            ".bpx-player-ctrl-btn.bpx-player-ctrl-quality"
        );
        if (qualityControlElement) {
            qualityControlElement.classList.toggle('quality-button-hidden', takeOverQualityControl);
        }
        const warning = panel.querySelector('#dev-warning');
        warning.textContent = "清晰度按钮设置已更改，请刷新页面生效";
        warning.style.display = "block";
    });

    panel.querySelector('#dev-delay').addEventListener('change', (e) => {
        devModeDelay = parseInt(e.target.value);
        GM_setValue("devModeDelay", devModeDelay);
    });

    panel.querySelector('#dev-audio-delay').addEventListener('change', (e) => {
        devModeAudioDelay = parseInt(e.target.value);
        GM_setValue("devModeAudioDelay", devModeAudioDelay);
    });

    panel.querySelector('#dev-audio-retries').addEventListener('change', (e) => {
        devModeAudioRetries = parseInt(e.target.value);
        GM_setValue("devModeAudioRetries", devModeAudioRetries);
    });

    panel.querySelector('.refresh-button').addEventListener('click', () => {
        location.reload();
    });

    panel.querySelector('#quality-double-check').addEventListener('change', (e) => {
        qualityDoubleCheck = e.target.checked;
        GM_setValue("qualityDoubleCheck", qualityDoubleCheck);
    });

    panel.querySelector('#live-quality-double-check').addEventListener('change', (e) => {
        liveQualityDoubleCheck = e.target.checked;
        GM_setValue("liveQualityDoubleCheck", liveQualityDoubleCheck);
    });

    return panel;
  }

  const initializeQualitySettings = () => {
    isLoading = false;
    checkVipStatus();
    selectVideoQuality();
    updateQualityButtons(document.getElementById("bilibili-quality-selector"));
  };
})();
