import { checkIfLivePage, state } from "./settings";
import { toggleSettingsPanel, toggleLiveSettingsPanel, toggleDevSettingsPanel, toggleUnlockSettingsPanel, toggleDecodeSettingsPanel } from "./panels";

export function registerMenuCommands(): void {
    if (typeof GM_registerMenuCommand !== "function") {
        console.log("[菜单] 当前脚本管理器不支持菜单命令，请从播放器控制栏的设置按钮打开画质面板。");
        return;
    }
    const registerMenuCommand = GM_registerMenuCommand;
    registerMenuCommand("画质设置", function () {
        checkIfLivePage();
        if (state.isLivePage) toggleLiveSettingsPanel();
        else toggleSettingsPanel();
    });
    registerMenuCommand("解码设置", function () {
        checkIfLivePage();
        toggleDecodeSettingsPanel();
    });
    registerMenuCommand("解锁设置", toggleUnlockSettingsPanel);
    registerMenuCommand("开发者设置", toggleDevSettingsPanel);
}
