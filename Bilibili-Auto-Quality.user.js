// ==UserScript==
// @name         哔哩哔哩自动画质
// @namespace    https://github.com/AHCorn/Bilibili-Auto-Quality/
// @version      3.0.3
// @license      GPL-3.0
// @description  自动解锁并更改哔哩哔哩视频的画质和音质，实现自动选择最高画质、无损音频及杜比全景声。
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
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @updateURL    https://github.com/AHCorn/Bilibili-Auto-Quality/raw/main/Bilibili-Auto-Quality.user.js
// @downloadURL  https://github.com/AHCorn/Bilibili-Auto-Quality/raw/main/Bilibili-Auto-Quality.user.js
// ==/UserScript==

(function () {
    'use strict';

    Object.defineProperty(navigator, 'userAgent', {
        value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
    });

    window.localStorage['bilibili_player_force_DolbyAtmos&8K&HDR'] = 1;

    GM_addStyle(`
        #bilibili-quality-selector {
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
            display: none;
            z-index: 10000;
            font-family: 'Segoe UI', 'Roboto', sans-serif;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        #bilibili-quality-selector h2 {
            margin: 0 0 20px;
            color: #00a1d6;
            font-size: 28px;
            text-align: center;
            font-weight: 700;
        }

        #bilibili-quality-selector p {
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

        .quality-button {
            background-color: #ffffff;
            border: 2px solid #dadce0;
            border-radius: 12px;
            padding: 12px 8px;
            font-size: 14px;
            color: #3c4043;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            font-weight: 600;
        }

        .quality-button:hover {
            background-color: #f1f3f4;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
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
            background-color: #f1f3f4;
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

        #bilibili-quality-selector.show {
            display: block;
            animation: fadeIn 0.3s ease-out, slideIn 0.3s ease-out;
        }

        @media (max-width: 480px) {
            #bilibili-quality-selector {
                width: 95%;
                padding: 25px;
            }

            .quality-group {
                grid-template-columns: repeat(2, 1fr);
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
    `);

    let hiResAudioEnabled = GM_getValue('hiResAudio', false);
    let dolbyAtmosEnabled = GM_getValue('dolbyAtmos', false);
    let userQualitySetting = GM_getValue('qualitySetting', '最高画质');
    let userHasChangedQuality = false;
    let takeOverQualityControl = GM_getValue('takeOverQualityControl', false);
    let isVipUser = false;
    let vipStatusChecked = false;
    let isLoading = true;

    function checkVipStatus() {
        const vipElement = document.querySelector('.bili-avatar-icon.bili-avatar-right-icon.bili-avatar-icon-big-vip');
        const currentQuality = document.querySelector('.bpx-player-ctrl-quality-menu-item.bpx-state-active .bpx-player-ctrl-quality-text');
        isVipUser = vipElement !== null || (currentQuality && currentQuality.textContent.includes('大会员'));
        vipStatusChecked = true;
        console.log(`用户是否为大会员: ${isVipUser ? '是' : '否'}`);
        updateQualityButtons(document.getElementById('bilibili-quality-selector'));
    }

    function selectQualityBasedOnSetting() {
        if (!vipStatusChecked) {
            checkVipStatus();
        }

        let currentQuality = document.querySelector('.bpx-player-ctrl-quality-menu-item.bpx-state-active .bpx-player-ctrl-quality-text').textContent;
        console.log(`当前画质: ${currentQuality}`);
        console.log(`目标画质: ${userQualitySetting}`);

        const qualityItems = document.querySelectorAll('.bpx-player-ctrl-quality-menu .bpx-player-ctrl-quality-menu-item');
        const availableQualities = Array.from(qualityItems)
            .map(item => ({
                name: item.textContent.trim(),
                element: item,
                isVipOnly: !!item.querySelector('.bpx-player-ctrl-quality-badge-bigvip')
            }));

        console.log(`当前视频可用画质:`, availableQualities.map(q => q.name));

        const qualityPreferences = ['8K', '杜比视界', 'HDR', '4K', '1080P 高码率', '1080P 60 帧', '1080P 高清', '720P 60 帧', '720P', '480P', '360P', '默认'];

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
        if (userQualitySetting === '最高画质') {
            if (isVipUser) {
                targetQuality = availableQualities.find(quality => quality.isVipOnly) || availableQualities[0];
            } else {
                targetQuality = availableQualities.find(quality => !quality.isVipOnly);
            }
        } else if (userQualitySetting === '默认') {
            console.log('使用默认画质');
            return;
        } else {
            targetQuality = availableQualities.find(quality => quality.name.includes(userQualitySetting));
            if (!targetQuality) {
                console.log(`未找到目标画质 ${userQualitySetting}, 将选择最高可用画质`);
                targetQuality = isVipUser ? (availableQualities.find(quality => quality.isVipOnly) || availableQualities[0]) : availableQualities.find(quality => !quality.isVipOnly);
            }
        }

        console.log(`实际目标画质: ${targetQuality.name}`);
        targetQuality.element.click();

        const hiResButton = document.querySelector('.bpx-player-ctrl-flac');
        if (hiResButton) {
            if (isVipUser) {
                if (hiResAudioEnabled && !hiResButton.classList.contains('bpx-state-active')) {
                    hiResButton.click();
                } else if (!hiResAudioEnabled && hiResButton.classList.contains('bpx-state-active')) {
                    hiResButton.click();
                }
            } else {
                if (hiResButton.classList.contains('bpx-state-active')) {
                    hiResButton.click();
                }
            }
        }

        const dolbyButton = document.querySelector('.bpx-player-ctrl-dolby');
        if (dolbyButton) {
            if (isVipUser) {
                if (dolbyAtmosEnabled && !dolbyButton.classList.contains('bpx-state-active')) {
                    dolbyButton.click();
                } else if (!dolbyAtmosEnabled && dolbyButton.classList.contains('bpx-state-active')) {
                    dolbyButton.click();
                }
            } else {
                if (dolbyButton.classList.contains('bpx-state-active')) {
                    dolbyButton.click();
                }
            }
        }

        if (takeOverQualityControl) {
            const qualityControlElement = document.querySelector('.bpx-player-ctrl-btn.bpx-player-ctrl-quality');
            if (qualityControlElement) {
                qualityControlElement.style.display = 'none';
            }
        } else {
            const qualityControlElement = document.querySelector('.bpx-player-ctrl-btn.bpx-player-ctrl-quality');
            if (qualityControlElement) {
                qualityControlElement.style.display = '';
            }
        }

        updateWarnings();
    }

function createSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'bilibili-quality-selector';

        const QUALITIES = ['最高画质', '8K', '杜比视界', 'HDR', '4K', '1080P 高码率', '1080P 60 帧', '1080P 高清', '720P', '480P', '360P', '默认'];

        panel.innerHTML = `
            <h2>画质设置</h2>
            <div class="status-bar"></div>
            <div id="non-vip-warning" class="warning" style="display: none;"></div>
            <div class="quality-group">
                ${QUALITIES.map(quality =>
                    `<button class="quality-button" data-quality="${quality}">${quality}</button>`
                ).join('')}
            </div>
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
            <div class="toggle-switch">
                <label for="remove-quality-button">移除清晰度按钮（Beta）</label>
                <label class="switch">
                    <input type="checkbox" id="remove-quality-button">
                    <span class="slider"></span>
                </label>
            </div>
        `;

        panel.querySelectorAll('.quality-button').forEach(button => {
            button.addEventListener('click', () => {
                if (!isLoading) {
                    userQualitySetting = button.dataset.quality;
                    GM_setValue('qualitySetting', userQualitySetting);
                    userHasChangedQuality = true;
                    updateQualityButtons(panel);
                    selectQualityBasedOnSetting();
                }
            });
        });

        panel.querySelector('#hi-res-audio').addEventListener('change', (e) => {
            if (!isLoading) {
                hiResAudioEnabled = e.target.checked;
                GM_setValue('hiResAudio', hiResAudioEnabled);
                updateQualityButtons(panel);
                selectQualityBasedOnSetting();
            }
        });

        panel.querySelector('#dolby-atmos').addEventListener('change', (e) => {
            if (!isLoading) {
                dolbyAtmosEnabled = e.target.checked;
                GM_setValue('dolbyAtmos', dolbyAtmosEnabled);
                updateQualityButtons(panel);
                selectQualityBasedOnSetting();
            }
        });

        panel.querySelector('#remove-quality-button').addEventListener('change', (e) => {
            if (!isLoading) {
                takeOverQualityControl = e.target.checked;
                GM_setValue('takeOverQualityControl', takeOverQualityControl);
                selectQualityBasedOnSetting();

                const warningElement = panel.querySelector('#quality-warning');
                if (takeOverQualityControl) {
                    warningElement.textContent = '若启用该选项，画质设置将由本脚本接管。';
                    warningElement.style.display = 'block';
                } else {
                    warningElement.style.display = 'none';
                }
            }
        });

        document.body.appendChild(panel);
        updateQualityButtons(panel);
    }

    function updateQualityButtons(panel) {
        if (!panel) return;

        const statusBar = panel.querySelector('.status-bar');

        if (isLoading) {
            statusBar.textContent = '加载中，请稍候...';
            statusBar.className = 'status-bar';
            panel.querySelectorAll('.quality-button, .toggle-switch').forEach(el => el.style.opacity = '0.5');
        } else {
            panel.querySelectorAll('.quality-button, .toggle-switch').forEach(el => el.style.opacity = '1');

            if (vipStatusChecked) {
                statusBar.textContent = isVipUser ? '您是大会员用户，可正常使用所有选项。' : '您不是大会员用户，部分会员选项不可用。';
                statusBar.className = `status-bar ${isVipUser ? 'vip' : 'non-vip'}`;
            }
        }

        panel.querySelectorAll('.quality-button').forEach(button => {
            button.classList.remove('active', 'vip-quality');
            if (button.dataset.quality === userQualitySetting) {
                button.classList.add('active');
                if (['8K', '杜比视界', 'HDR', '4K', '1080P 高码率', '1080P 60 帧'].includes(userQualitySetting)) {
                    button.classList.add('vip-quality');
                }
            }
        });

        const hiResAudioSwitch = panel.querySelector('#hi-res-audio');
        hiResAudioSwitch.checked = hiResAudioEnabled;

        const dolbyAtmosSwitch = panel.querySelector('#dolby-atmos');
        dolbyAtmosSwitch.checked = dolbyAtmosEnabled;

        panel.querySelector('#remove-quality-button').checked = takeOverQualityControl;

        updateWarnings(panel);
    }

    function updateWarnings(panel) {
        if (!panel || isLoading || !vipStatusChecked) return;

        const nonVipWarning = panel.querySelector('#non-vip-warning');
        const qualityWarning = panel.querySelector('#quality-warning');
        const audioWarning = panel.querySelector('#audio-warning');

        if (!isVipUser && ['8K', '杜比视界', 'HDR', '4K', '1080P 高码率', '1080P 60 帧'].includes(userQualitySetting)) {
            nonVipWarning.textContent = '无法使用此会员画质。已自动选择最高可用画质。';
            nonVipWarning.style.display = 'block';
        } else {
            nonVipWarning.style.display = 'none';
        }

        if (takeOverQualityControl) {
            qualityWarning.textContent = '若启用该选项，画质设置将由本脚本接管。';
            qualityWarning.style.display = 'block';
        } else {
            qualityWarning.style.display = 'none';
        }

        if (!isVipUser && (hiResAudioEnabled || dolbyAtmosEnabled)) {
            audioWarning.textContent = '非大会员用户不能使用高级音频选项。';
            audioWarning.style.display = 'block';
        } else {
            audioWarning.style.display = 'none';
        }
    }

    function toggleSettingsPanel() {
        let panel = document.getElementById('bilibili-quality-selector');
        if (!panel) {
            createSettingsPanel();
            panel = document.getElementById('bilibili-quality-selector');
        }
        panel.classList.toggle('show');
        updateQualityButtons(panel);
    }

    document.addEventListener('mousedown', function (event) {
        const panel = document.getElementById('bilibili-quality-selector');
        if (panel && !panel.contains(event.target) && panel.classList.contains('show')) {
            panel.classList.remove('show');
        }
    });

    GM_registerMenuCommand("设置画质和音质", toggleSettingsPanel);

    window.onload = function () {
        let hasElementAppeared = false;
        isLoading = true;
        const observer = new MutationObserver(function (mutations, me) {
            const element = document.querySelector('.v-popover-wrap.header-avatar-wrap');
            if (element) {
                hasElementAppeared = true;
                console.log("正在判断用户是否为会员...");
                setTimeout(() => {
                    isLoading = false;
                    checkVipStatus();
                    selectQualityBasedOnSetting();
                    updateQualityButtons(document.getElementById('bilibili-quality-selector'));
                }, 4000);
                console.log("脚本开始运行，4秒后切换画质");
                me.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(function() {
            observer.disconnect();
            if (!hasElementAppeared) {
                console.error("等待超时，尝试执行中...");
                isLoading = false;
                checkVipStatus();
                selectQualityBasedOnSetting();
                updateQualityButtons(document.getElementById('bilibili-quality-selector'));
            }
        }, 12000);
    };

    const parentElement = document.body;

    parentElement.addEventListener('click', function(event) {
        const targetElement = event.target;

        if (targetElement.tagName === 'DIV' || targetElement.tagName === 'P') {
            if (targetElement.hasAttribute('title') || targetElement.classList.contains('title')) {
                isLoading = true;
                updateQualityButtons(document.getElementById('bilibili-quality-selector'));
                setTimeout(() => {
                    isLoading = false;
                    checkVipStatus();
                    selectQualityBasedOnSetting();
                    updateQualityButtons(document.getElementById('bilibili-quality-selector'));
                }, 5000);
                console.log('视频标题点击事件，页面发生切换:', targetElement.textContent.trim());
            }
        }

        if (targetElement.classList.contains('b-img')) {
            isLoading = true;
            updateQualityButtons(document.getElementById('bilibili-quality-selector'));
            setTimeout(() => {
                isLoading = false;
                checkVipStatus();
                selectQualityBasedOnSetting();
                updateQualityButtons(document.getElementById('bilibili-quality-selector'));
            }, 5000);
            console.log('封面点击事件，页面发生切换');
        }
    });

})();
