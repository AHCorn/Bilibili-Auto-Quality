// ==UserScript==
// @name         哔哩哔哩自动画质
// @namespace    https://github.com/AHCorn/Bilibili-Auto-Quality/
// @version      2.3.4
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
// ==/UserScript==

(function () {
    'use strict';

    Object.defineProperty(navigator, 'userAgent', {
        value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15"
    });

    window.localStorage['bilibili_player_force_DolbyAtmos&8K&HDR'] = 1;

    GM_addStyle(`
        #bilibili-quality-selector {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: #f8f8f8;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
            display: none;
            z-index: 10000;
            width: 300px;
            text-align: center;
            border: 1px solid #ddd;
        }
        #bilibili-quality-selector button {
            display: block;
            width: 90%;
            margin: 5px auto;
            padding: 10px;
            border: 1px solid #007bff;
            border-radius: 5px;
            background-color: white;
            color: #007bff;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s ease;
        }
        #bilibili-quality-selector button.active {
            background-color: #007bff;
            color: white;
        }
        #bilibili-quality-selector button:hover {
            background-color: #0056b3;
            color: white;
        }
        #bilibili-quality-selector button.active:hover {
            background-color: #003f7f;
        }
    `);

    let hiResAudioEnabled = GM_getValue('hiResAudio', false);
    let dolbyAtmosEnabled = GM_getValue('dolbyAtmos', false);
    let userQualitySetting = GM_getValue('qualitySetting', ' 自动选择最高画质 ');
    let userHasChangedQuality = false;

    function isVipUser() {
        const vipElement = document.querySelector('.bili-avatar-icon.bili-avatar-right-icon.bili-avatar-icon-big-vip');
        const currentQuality = document.querySelector('.bpx-player-ctrl-quality-menu-item.bpx-state-active .bpx-player-ctrl-quality-text');
        return vipElement !== null || (currentQuality && currentQuality.textContent.includes('大会员'));
    }

    function selectQualityBasedOnSetting() {
    if (userHasChangedQuality) return;

    const isVip = isVipUser();
    console.log(`用户是否为大会员：${isVip ? '是' : '否'}`);
    let currentQuality = document.querySelector('.bpx-player-ctrl-quality-menu-item.bpx-state-active .bpx-player-ctrl-quality-text').textContent;
    console.log(`当前画质：${currentQuality}`);
    console.log(`目标画质：${userQualitySetting}`);
    console.log(`HiRes高音质自动开关：${hiResAudioEnabled ? '开启' : '关闭'}`);
    console.log(`杜比全景声自动开关：${dolbyAtmosEnabled ? '开启' : '关闭'}`);
    const qualityItems = document.querySelectorAll('.bpx-player-ctrl-quality-menu .bpx-player-ctrl-quality-menu-item');
    let preferredQuality = null;
    let autoSelectedQuality = null; 

    const qualityPreferences = ['8K', '杜比视界', 'HDR', '4K', '1080P 高码率', '1080P 60 帧', '1080P', '720P 60 帧', '720P', '480P', '360P'];
    if (userQualitySetting === ' 自动选择最高画质 ') {
        for (let pref of qualityPreferences) {
            let item = Array.from(qualityItems).find(i => i.textContent.trim().startsWith(pref) && (isVip || !i.querySelector('.bpx-player-ctrl-quality-badge-bigvip')));
            if (item) {
                preferredQuality = item;
                autoSelectedQuality = item.textContent.trim(); 
                break;
            }
        }
    } else {
        for (let pref of qualityPreferences) {
            if (userQualitySetting.includes(pref)) {
                let foundItem = Array.from(qualityItems).find(item => item.textContent.trim().includes(pref) && (isVip || !item.querySelector('.bpx-player-ctrl-quality-badge-bigvip')));
                if (foundItem) {
                    preferredQuality = foundItem;
                    autoSelectedQuality = foundItem.textContent.trim(); 
                    break;
                }
            }
        }

        if (!preferredQuality) {
            console.log("未找到指定的目标画质，将自动选择最高可用画质");
            for (let pref of qualityPreferences) {
                let item = Array.from(qualityItems).find(i => i.textContent.trim().startsWith(pref) && (isVip || !i.querySelector('.bpx-player-ctrl-quality-badge-bigvip')));
                if (item) {
                    preferredQuality = item;
                    autoSelectedQuality = item.textContent.trim();
                    break; 
                }
            }
        }
    }

    preferredQuality?.click();

    setTimeout(() => {
        currentQuality = document.querySelector('.bpx-player-ctrl-quality-menu-item.bpx-state-active .bpx-player-ctrl-quality-text').textContent;

        if (autoSelectedQuality && !currentQuality.includes(autoSelectedQuality)) {
            console.log("再次尝试切换到目标画质");
            preferredQuality?.click();
        }
    }, 6000);

        const hiResButton = document.querySelector('.bpx-player-ctrl-flac');
        if (hiResButton) {
            if (isVip) {
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
            if (isVip) {
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
    }

    function createSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'bilibili-quality-selector';

        const QUALITIES = [' 自动选择最高画质 ', '8K', '杜比视界','HDR', '4K', '1080P 高码率', '1080P 60 帧', '1080P', '720P', '480P', '360P']; // 本次更新：移除 720P 60帧选项，该画质似乎已被B站移除
        QUALITIES.forEach(quality => {
            const button = document.createElement('button');
            button.textContent = quality;
            button.onclick = () => {
                userQualitySetting = quality;
                GM_setValue('qualitySetting', quality);
                userHasChangedQuality = true;
                updateQualityButtons(panel);
                selectQualityBasedOnSetting();
            };
            panel.appendChild(button);
        });

        const hiResButton = document.createElement('button');
        hiResButton.textContent = 'Hi-Res 音质';
        hiResButton.onclick = () => {
            hiResAudioEnabled = !hiResAudioEnabled;
            GM_setValue('hiResAudio', hiResAudioEnabled);
            updateQualityButtons(panel);
            selectQualityBasedOnSetting();
        };
        panel.appendChild(hiResButton);

        const dolbyAtmosButton = document.createElement('button');
        dolbyAtmosButton.textContent = '杜比全景声';
        dolbyAtmosButton.onclick = () => {
            dolbyAtmosEnabled = !dolbyAtmosEnabled;
            GM_setValue('dolbyAtmos', dolbyAtmosEnabled);
            updateQualityButtons(panel);
            selectQualityBasedOnSetting();
        };
        panel.appendChild(dolbyAtmosButton);

        updateQualityButtons(panel);
        document.body.appendChild(panel);
    }

    function updateQualityButtons(panel) {
        panel.querySelectorAll('button').forEach(button => {
            button.classList.remove('active');
            if (button.textContent === userQualitySetting ||
                (button.textContent === 'Hi-Res 音质' && hiResAudioEnabled) ||
                (button.textContent === '杜比全景声' && dolbyAtmosEnabled)) {
                button.classList.add('active');
            }
        });
    }

    function toggleSettingsPanel() {
        let panel = document.getElementById('bilibili-quality-selector');
        if (!panel) {
            createSettingsPanel();
            panel = document.getElementById('bilibili-quality-selector');
        }
        panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    }

    document.addEventListener('mousedown', function (event) {
        const panel = document.getElementById('bilibili-quality-selector');
        if (panel && !panel.contains(event.target)) {
            panel.style.display = 'none';
        }
    });

    GM_registerMenuCommand("设置画质和音质", toggleSettingsPanel);

window.onload = function () {
    let hasElementAppeared = false;
    const observer = new MutationObserver(function (mutations, me) {
        const element = document.querySelector('.v-popover-wrap.header-avatar-wrap');
        if (element) {
            hasElementAppeared = true; 
            setTimeout(selectQualityBasedOnSetting, 6000); 
            console.log(`脚本开始运行，6秒后切换画质`); // 根据反馈，延后执行时间以免判断错误
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
            selectQualityBasedOnSetting(); 
        }
    }, 15000); 
};


    const parentElement = document.body;

    parentElement.addEventListener('click', function(event) {
        const targetElement = event.target;

        if (targetElement.tagName === 'DIV' || targetElement.tagName === 'P') {
            if (targetElement.hasAttribute('title') || targetElement.classList.contains('title')) {
                setTimeout(selectQualityBasedOnSetting, 6000);
                console.log('页面发生切换:', targetElement.textContent.trim());
            }
        }
    });

})();
