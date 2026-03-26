<div align="center">

# <img src="https://www.bilibili.com/favicon.ico" width="30" height="30" style="vertical-align: text-bottom;"> [Bilibili-Auto-Quality](https://greasyfork.org/zh-CN/scripts/486151-%E5%93%94%E5%93%A9%E5%93%94%E5%93%A9%E8%87%AA%E5%8A%A8%E7%94%BB%E8%B4%A8)

#### [简体中文](https://github.com/AHCorn/Bilibili-Auto-Quality/blob/main/README.md) | **English**

Automatically unlock and change the quality of Bilibili video, audio, and live stream, enabling automatic selection of the highest video quality, lossless audio, and Dolby Atmos.

> **Note:** Multi-language support for the script UI is not yet available. However, the script's functionality is quite intuitive, and you can use a translation tool to assist with usage.

![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![GitHub stars](https://img.shields.io/github/stars/AHCorn/Bilibili-Auto-Quality?style=for-the-badge)
![GitHub issues](https://img.shields.io/github/issues/AHCorn/Bilibili-Auto-Quality?style=for-the-badge)
![GitHub pull requests](https://img.shields.io/github/issues-pr/AHCorn/Bilibili-Auto-Quality?style=for-the-badge)
![GitHub forks](https://img.shields.io/github/forks/AHCorn/Bilibili-Auto-Quality?style=for-the-badge)

</div>

<br>

## Preview

<br>
  
<div align="center">

![image](https://github.com/user-attachments/assets/fc3af3b8-71a2-4c22-ad0d-311423944bc9)


</div>

<br>

## Features


1. Integrates the unlocking features of [Bilibili Unlock Dolby Atmos & 8K & Enable HDR & Live Quality PRO](https://greasyfork.org/zh-TW/scripts/441403).

2. Draws on the switching logic of [Bilibili - Auto Switch Live Quality to Highest](https://greasyfork.org/zh-CN/scripts/467427-bilibili-%E8%87%AA%E5%8A%A8%E5%88%87%E6%8D%A2%E7%9B%B4%E6%92%AD%E7%94%BB%E8%B4%A8%E8%87%B3%E6%9C%80%E9%AB%98%E7%94%BB%E8%B4%A8/code) for implementing the live quality and route selection panel.

3. Automatically selects the highest available video quality based on whether the user is a VIP member.
   
4. Users can customize default primary and backup quality preferences in the settings panel.
   
5. Supports automatic toggling of lossless audio and Dolby Atmos.


<br>

## Usage Guide

> [!WARNING]
> The script automatically selects the highest audio-visual quality available to the current user. It does NOT allow non-members to use member-only options.

If you are using **Google Chrome**, first install [Tampermonkey](https://chromewebstore.google.com/detail/%E7%AF%A1%E6%94%B9%E7%8C%B4/dhdgffkkebhmkfjojejmpbldmpobfkfo) from the Chrome Web Store.  
If you are using **Firefox**, install the extension [here](https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/).

After the first installation, please open the extension once. You will see a prompt asking you to:  
**Enable Developer Mode** in your browser (usually found in the Extensions/Add-ons section of the browser menu, with a Developer Mode toggle at the top).

<br>


![image](https://github.com/user-attachments/assets/a2d25ad2-47e9-4af1-b762-25b33ae0e9e2)


<br>

Then, visit the script's homepage and click [Install this script](https://greasyfork.org/zh-CN/scripts/486151-%E5%93%94%E5%93%A9%E5%93%94%E5%93%A9%E8%87%AA%E5%8A%A8%E7%94%BB%E8%B4%A8). The Tampermonkey installation panel will pop up.  
Click "Install", and the page will close automatically after installation.

After installation, open a Bilibili video or live stream page, and find the extension area in your browser's toolbar (some browsers may collapse it). Locate the Tampermonkey icon you just installed:  
- A red number "1" in the top-left corner of the icon indicates a script is running.

Click the extension icon, and in the popup you will see **Bilibili Auto Quality**.  
- Below it is a button **"Set Audio and Video Quality"**.  
- If the script text appears grayed out, it has not taken effect. Try refreshing the page.  
- Clicking the button will open the settings panel where you can configure quality and audio settings.

<br>

![image](https://github.com/user-attachments/assets/c5cecce0-2a9e-4ec5-8909-e6cbf6f50433)


<br>

By default, the script automatically selects the highest available quality for both video and audio. If you have specific preferences, you can adjust them in the settings panel.

<br>


## FAQ

### Can the script "crack" VIP membership?

This script only simulates clicks. It has no cracking functionality whatsoever.

<br>

### 1. Where is the settings panel?

After updating to version 4.0 or later, the script adds a small TV icon to the player control bar by default. Click it to open the quality settings panel.

If the settings button disappears while other scripts load normally, please check the browser console for any errors from this script and include the full error message when reporting.

<br>

### 2. VIP status detected incorrectly?

If the script incorrectly identifies your account's VIP status and switches to non-VIP quality, it might be because Bilibili's current event changed the VIP badge, or you have ad-blockers/extensions that modify page elements.

Feel free to report this issue anytime, or use the Developer Options in the script to manually override your VIP status as a temporary workaround.

<br>

### 3. Auto-switching not working?

If you are not logged in, enable "Not Logged In Mode" in Developer Settings.

If you are logged in normally and can open the script's settings panel but auto-switching still doesn't work, we apologize for the inconvenience. Please copy the console logs and submit feedback.

<br>

### 4. Why aren't the unlock features working?

To avoid compatibility issues, the script no longer enables unlock features by default. You can enable them manually in the Unlock Settings panel.

Since unlock features are not the primary focus, you may also use the original script directly. The unlock-related code in this script comes from:

[Bilibili Unlock Dolby Atmos & 8K & Enable HDR & Live Quality PRO](https://greasyfork.org/zh-TW/scripts/441403)

Please do not enable the unlock features in both scripts simultaneously.

<br>

### 5. Does the script affect keyboard shortcuts or other unrelated features?

You can right-click the script or view the source code in the project's code section. This script does not affect keyboard shortcuts. Please try disabling the script first to test.

If a feature does stop working because of this script, please include the console logs when reporting so we can reproduce and fix the issue.

<br>


### 6. Have suggestions for improvements or ideas for useful features?

If you are willing to share your ideas, the script will incorporate your suggestions in future updates, provided they align with the script's purpose and are practical enough.

Whether it's a suggestion or a bug report, thank you for helping improve this script. Much appreciated! <img style="width:100px;height:100px;" src="https://github.com/user-attachments/assets/676cec52-fe5b-450b-ab54-3aefae5adde7"> Thanks!

<br>

## Roadmap

If the issue you reported or the feature you need is listed below, you can wait for an upcoming update.

[Lock Live Stream Decode Strategy](https://greasyfork.org/zh-CN/scripts/486151-%E5%93%94%E5%93%A9%E5%93%94%E5%93%A9%E8%87%AA%E5%8A%A8%E7%94%BB%E8%B4%A8/discussions/295478)

<br>

## Acknowledgements

Thanks to all the contributors for their PRs!

<a href="https://github.com/AHCorn/Bilibili-Auto-Quality/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=AHCorn/Bilibili-Auto-Quality" />
</a>

<br>
<br>

I had been using [Bilibili Default Highest Quality](https://greasyfork.org/zh-CN/scripts/374770-bilibili-%E8%A7%86%E9%A2%91%E9%BB%98%E8%AE%A4%E9%80%89%E6%8B%A9%E6%9C%80%E9%AB%98%E6%B8%85%E6%99%B0%E5%BA%A6) before developing this script.

Unlock-related code from [Bilibili Unlock Dolby Atmos & 8K & Enable HDR & Live Quality PRO](https://greasyfork.org/zh-TW/scripts/441403)

Live quality switching logic from [Bilibili - Auto Switch Live Quality to Highest](https://greasyfork.org/zh-CN/scripts/467427-bilibili-%E8%87%AA%E5%8A%A8%E5%88%87%E6%8D%A2%E7%9B%B4%E6%92%AD%E7%94%BB%E8%B4%A8%E8%87%B3%E6%9C%80%E9%AB%98%E7%94%BB%E8%B4%A8/code)
