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

![image](https://github.com/user-attachments/assets/54300c77-3c21-47bf-8483-680f4f9462b5)

</div>

<br>

## ⭐ 特性

1. 整合 [Bilibili 解锁杜比全景声 & 8K &开启 HDR &直播画质PRO](https://greasyfork.org/zh-TW/scripts/441403) 的解锁功能。

2. 根据用户是否为大会员来选择当前视频的最高画质。
   
3. 拥有独立的设置面板，用户可自定义默认画质。
   
4. 支持自动开关无损音频、杜比全景声。

<br>

## 📕 使用说明

#### 脚本实现的是自动选择当前用户可选的最高音画质，而不是让非会员用户使用会员选项。

如果您正在使用的是 Chrome 浏览器，请先在 Chrome 应用商店安装 [篡改猴](https://chromewebstore.google.com/detail/%E7%AF%A1%E6%94%B9%E7%8C%B4/dhdgffkkebhmkfjojejmpbldmpobfkfo)，如果是 FireFox，请在 [这里](https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/) 安装插件。

第一次安装完成后，请先打开一次插件，其中有英文提示，大意为请开启浏览器的开发者模式，一般位于浏览器菜单项的插件/扩展程序部分，在顶部有开发模式按钮，点击打开。

<br>
<div align="center">

![image](https://github.com/user-attachments/assets/a2d25ad2-47e9-4af1-b762-25b33ae0e9e2)

</div>
<br>

随后打开本脚本的主页，点击 [安装此脚本](https://greasyfork.org/zh-CN/scripts/486151-%E5%93%94%E5%93%A9%E5%93%94%E5%93%A9%E8%87%AA%E5%8A%A8%E7%94%BB%E8%B4%A8) 后会弹出篡改猴插件的安装面板，此时点击安装，安装完成后该页面会自动关闭。

安装完成后，打开哔哩哔哩的视频/直播界面，找到浏览器的顶栏插件部分（部分浏览器会折叠），在其中找到刚刚安装的篡改猴插件图标，此时插件左上角会有红色数字1，表明有一个脚本正在运行。

点击插件图标，在弹出的界面中可以看到哔哩哔哩自动画质字样，下方有一个按钮 “设置音质和画质”（如果脚本颜色为灰色，说明并未生效，请尝试再次刷新当前页面后重试），点击后便会创建设置面板，可以在其中设置画质和音质。

<br>

<div align="center">

![image](https://github.com/user-attachments/assets/c5cecce0-2a9e-4ec5-8909-e6cbf6f50433)


</div>

<br>

默认情况下，脚本会自动选择最高画质和音质，如果有特殊需求，可以在面板中进行自由调整。

<br>

## 💻 更新计划

如果您反馈的问题或需要的功能已在下方列出，可直接等待后续更新。

1. 修复音质选择不能和自动画质同时工作的问题

2. [增加备选画质选项](https://greasyfork.org/zh-CN/scripts/486151-%E5%93%94%E5%93%A9%E5%93%94%E5%93%A9%E8%87%AA%E5%8A%A8%E7%94%BB%E8%B4%A8/discussions/272464)

3. [实现在播放工具栏注入设置按钮 / 修改原先的画质选单](https://greasyfork.org/zh-CN/scripts/486151-%E5%93%94%E5%93%A9%E5%93%94%E5%93%A9%E8%87%AA%E5%8A%A8%E7%94%BB%E8%B4%A8/discussions/240713)

4. [为首次安装用户增加使用说明](https://greasyfork.org/zh-CN/scripts/486151-%E5%93%94%E5%93%A9%E5%93%94%E5%93%A9%E8%87%AA%E5%8A%A8%E7%94%BB%E8%B4%A8/discussions/273251)

<br>

## ❤ 感谢

个人之前一直在使用 [Bilibili 视频默认选择最高清晰度](https://greasyfork.org/zh-CN/scripts/374770-bilibili-%E8%A7%86%E9%A2%91%E9%BB%98%E8%AE%A4%E9%80%89%E6%8B%A9%E6%9C%80%E9%AB%98%E6%B8%85%E6%99%B0%E5%BA%A6)。

本脚本的 UA 相关代码来自 [Bilibili 解锁杜比全景声 & 8K &开启 HDR &直播画质PRO](https://greasyfork.org/zh-TW/scripts/441403)。

直播画质切换逻辑来自 [Bilibili - 自动切换直播画质至最高画质](https://greasyfork.org/zh-CN/scripts/467427-bilibili-%E8%87%AA%E5%8A%A8%E5%88%87%E6%8D%A2%E7%9B%B4%E6%92%AD%E7%94%BB%E8%B4%A8%E8%87%B3%E6%9C%80%E9%AB%98%E7%94%BB%E8%B4%A8/code)。
