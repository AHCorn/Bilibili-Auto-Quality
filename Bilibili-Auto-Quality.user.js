// ==UserScript==
// @name         哔哩哔哩自动画质
// @namespace    https://github.com/AHCorn/Bilibili-Auto-Quality/
// @version      1.3
// @description  自动更改哔哩哔哩视频的画质和音质，实现自动选择最高画质及无损音频。
// @author       安和（AHCorn）
// @icon         https://www.bilibili.com/favicon.ico
// @match        *://www.bilibili.com/video/*
// @match        *://www.bilibili.com/list/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

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

    const QUALITIES = ['自动选择最高画质', '8K', '4K', '1080P 高码率', '1080P 60 帧', '1080P', '720P 60 帧', '720P', '480P', '360P'];
    let userQualitySetting = GM_getValue('qualitySetting', '自动选择最高画质');
    let hiResAudioEnabled = GM_getValue('hiResAudio', false);

    function updateQualityButtons(panel) {
        panel.querySelectorAll('button').forEach(button => {
            if (button.textContent === userQualitySetting || (button.textContent === 'Hi-Res 音质' && hiResAudioEnabled)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    function selectQualityBasedOnSetting() {
        const qualityItems = document.querySelectorAll('.bpx-player-ctrl-quality-menu .bpx-player-ctrl-quality-menu-item');
        let found = false;
        for (let item of qualityItems) {
            if (item.innerText.includes(userQualitySetting)) {
                item.click();
                found = true;
                break;
            }
        }

        if (!found && qualityItems.length > 0) {
            qualityItems[0].click();
        }

        const hiResButton = document.querySelector('.bpx-player-ctrl-flac');
        if (hiResAudioEnabled && !hiResButton.classList.contains('bpx-state-active')) {
            hiResButton?.click();
        } else if (!hiResAudioEnabled && hiResButton.classList.contains('bpx-state-active')) {
            hiResButton?.click();
        }
    }

    function createSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'bilibili-quality-selector';

        QUALITIES.forEach(quality => {
            const button = document.createElement('button');
            button.textContent = quality;
            button.onclick = () => {
                userQualitySetting = quality;
                GM_setValue('qualitySetting', quality);
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

        updateQualityButtons(panel);
        document.body.appendChild(panel);

        document.addEventListener('mousedown', function(event) {
            const isClickInsidePanel = panel.contains(event.target);
            if (!isClickInsidePanel && panel.style.display === 'block') {
                panel.style.display = 'none';
            }
        });
    }

    function toggleSettingsPanel() {
        const panel = document.getElementById('bilibili-quality-selector');
        if (!panel) {
            createSettingsPanel();
        }
        const isPanelDisplayed = panel.style.display === 'block';
        panel.style.display = isPanelDisplayed ? 'none' : 'block';
    }

    GM_registerMenuCommand("设置画质和音质", toggleSettingsPanel);

    setInterval(selectQualityBasedOnSetting, 1000);
})();
