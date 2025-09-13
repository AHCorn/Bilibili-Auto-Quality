<div align="center">

# <img src="https://www.bilibili.com/favicon.ico" width="30" height="30" style="vertical-align: text-bottom;"> [Bilibili-Auto-Quality](https://greasyfork.org/zh-CN/scripts/486151-%E5%93%94%E5%93%A9%E5%93%94%E5%93%A9%E8%87%AA%E5%8A%A8%E7%94%BB%E8%B4%A8)

#### **简体中文** | [English](https://github.com/AHCorn/Bilibili-Auto-Quality/blob/main/README_EN.md)

自动解锁并更改哔哩哔哩视频的画质和音质及直播画质，实现自动选择最高画质、无损音频、杜比全景声。

![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![GitHub stars](https://img.shields.io/github/stars/AHCorn/Bilibili-Auto-Quality?style=for-the-badge)
![GitHub issues](https://img.shields.io/github/issues/AHCorn/Bilibili-Auto-Quality?style=for-the-badge)
![GitHub pull requests](https://img.shields.io/github/issues-pr/AHCorn/Bilibili-Auto-Quality?style=for-the-badge)
![GitHub forks](https://img.shields.io/github/forks/AHCorn/Bilibili-Auto-Quality?style=for-the-badge)

</div>

<br>

## 🗄 预览

<br>
  
<div align="center">

![image](https://github.com/user-attachments/assets/fc3af3b8-71a2-4c22-ad0d-311423944bc9)


</div>

<br>

## ⭐ 特性


1. 整合 [Bilibili 解锁杜比全景声 & 8K &开启 HDR &直播画质PRO](https://greasyfork.org/zh-TW/scripts/441403) 的解锁功能。

2. 借鉴  [Bilibili - 自动切换直播画质至最高画质](https://greasyfork.org/zh-CN/scripts/467427-bilibili-%E8%87%AA%E5%8A%A8%E5%88%87%E6%8D%A2%E7%9B%B4%E6%92%AD%E7%94%BB%E8%B4%A8%E8%87%B3%E6%9C%80%E9%AB%98%E7%94%BB%E8%B4%A8/code) 的切换逻辑，用于实现直播画质及线路选择面板。

3. 根据用户是否为大会员来自动选择当前视频的最高画质。
   
4. 在设置面板中，用户可以自定义默认的首选、备选画质。
   
5. 支持自动开关无损音频、杜比全景声。


<br>

## 📕 使用说明

> [!WARNING]
> 脚本实现的是自动选择当前用户可选的最高音画质，而不是让非会员用户使用会员选项。

如果您正在使用的是 **Chrome 浏览器**，请先在 Chrome 应用商店安装 [篡改猴](https://chromewebstore.google.com/detail/%E7%AF%A1%E6%94%B9%E7%8C%B4/dhdgffkkebhmkfjojejmpbldmpobfkfo)。  
如果是 **Firefox 浏览器**，请在 [这里](https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/) 安装插件。

第一次安装完成后，请先打开一次插件，其中会有英文提示，大意为：  
**请开启浏览器的开发者模式**（一般位于浏览器菜单项的插件/扩展程序部分，在顶部可以找到开发模式按钮，点击打开）。

<br>


![image](https://github.com/user-attachments/assets/a2d25ad2-47e9-4af1-b762-25b33ae0e9e2)


<br>

随后，打开本脚本的主页，点击 [安装此脚本](https://greasyfork.org/zh-CN/scripts/486151-%E5%93%94%E5%93%A9%E5%93%94%E5%93%A9%E8%87%AA%E5%8A%A8%E7%94%BB%E8%B4%A8)，会弹出篡改猴插件的安装面板。  
点击“安装”，安装完成后该页面会自动关闭。

安装完成后，打开哔哩哔哩的视频或直播界面，找到浏览器的顶栏插件部分（部分浏览器可能会折叠），在其中找到刚刚安装的篡改猴插件图标：  
- 插件左上角会有红色数字“1”，表明有一个脚本正在运行。

点击插件图标后，在弹出的界面中可以看到 **哔哩哔哩自动画质** 字样。  
- 下方有一个按钮 **“设置音质和画质”**。  
- 如果脚本颜色为灰色，说明并未生效，请尝试刷新当前页面后重试。  
- 点击后便会创建设置面板，可在其中设置画质和音质。

<br>

![image](https://github.com/user-attachments/assets/c5cecce0-2a9e-4ec5-8909-e6cbf6f50433)


<br>

默认情况下，脚本会自动选择最高画质和音质。如果有特殊需求，可在面板中自由调整。

<br>


## ❓ 常见问题

### 1️⃣ 脚本能否“破解”会员？

本脚本仅适用于模拟点击，没有任何所谓破解功能。

<br>

### 2️⃣ 设置面板在哪？

当您更新至 4.0 之后的版本，脚本默认会向播放器控制栏增加一个小电视图标，点击即可打开画质面板。

如果出现设置按钮消失、且其它脚本正常加载的情况，请查阅控制台是否有来自本脚本的报错，将其完整复制后反馈即可。

<br>

### 3️⃣ 大会员识别有误？

如果脚本对您账号的会员状态识别有误，切换到了非会员画质，有可能是哔哩哔哩当天的活动更改了会员标识，亦或您对页面元素有拦截/修改。

对于该问题，欢迎您随时反馈，或通过打开脚本中的开发者选项，模拟您的大会员状态以临时解决这一问题。

<br>

### 4️⃣ 自动切换未生效？

如果您处于未登录状态，在开发者模式中打开 未登录模式 即可。

如果您处于正常登录状态，并且可以正常通过插件打开本脚本的设置面板的情况下出现该问题，抱歉给您带来不便，有劳您在控制台中复制日志并进行反馈。

<br>

### 5️⃣ 解锁功能为什么没有生效？

为避免兼容性问题，脚本目前不再默认开启解锁相关功能，您可以在解锁设置面板中自行打开，或直接安装下方脚本搭配使用。

[Bilibili 解锁杜比全景声 & 8K &开启 HDR &直播画质PRO](https://greasyfork.org/zh-TW/scripts/441403)

<br>

### 6️⃣ 脚本是否影响了快捷键等脚本没有提及的内容？

您可以右键脚本、或在项目的代码部分查阅源码，本脚本不会影响您切换快捷键，您可以尝试关闭脚本后再进行尝试。

如果确实出现了因为脚本导致某功能失效的情况，您可以附上日志随时反馈，以便复现和修复问题。 

<br>


### 7️⃣ 对脚本有一些改进的建议，或者想到一些更实用的功能？



如果您愿意分享您的想法，在符合脚本定位和足够实用的前提下，脚本后续的更新便会采纳您的建议。

无论是建议还是反馈，感谢您愿意协助本脚本的不断改进，在此感谢大家  <img style="width:100px;height:100px;" src="https://github.com/user-attachments/assets/676cec52-fe5b-450b-ab54-3aefae5adde7">  (*ゝω・)ﾉThanks!




<br>

## 💻 更新计划

如果您反馈的问题或需要的功能已在下方列出，可直接等待后续更新。

[直播锁定解码策略](https://greasyfork.org/zh-CN/scripts/486151-%E5%93%94%E5%93%A9%E5%93%94%E5%93%A9%E8%87%AA%E5%8A%A8%E7%94%BB%E8%B4%A8/discussions/295478)
<br>

## ❤ 感谢 


个人之前一直在使用 [Bilibili 视频默认选择最高清晰度](https://greasyfork.org/zh-CN/scripts/374770-bilibili-%E8%A7%86%E9%A2%91%E9%BB%98%E8%AE%A4%E9%80%89%E6%8B%A9%E6%9C%80%E9%AB%98%E6%B8%85%E6%99%B0%E5%BA%A6)。

解锁相关代码来自 [Bilibili 解锁杜比全景声 & 8K &开启 HDR &直播画质PRO](https://greasyfork.org/zh-TW/scripts/441403)，若解锁功能未能生效，推荐与该脚本搭配食用～

直播画质切换逻辑来自 [Bilibili - 自动切换直播画质至最高画质](https://greasyfork.org/zh-CN/scripts/467427-bilibili-%E8%87%AA%E5%8A%A8%E5%88%87%E6%8D%A2%E7%9B%B4%E6%92%AD%E7%94%BB%E8%B4%A8%E8%87%B3%E6%9C%80%E9%AB%98%E7%94%BB%E8%B4%A8/code)。
