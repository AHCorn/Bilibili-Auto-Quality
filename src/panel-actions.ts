// 开发者面板「数据管理」动作逻辑
import { exportSettings, importSettings, resetAllSettings, type ImportResult } from "./config-io";
import { collectDiagnostics } from "./diagnostics";

export interface PanelActionDeps {
    diagnostics: () => string;
    exportSettings: () => string;
    importSettings: (json: string) => ImportResult;
    resetAllSettings: () => { applied: number; failed: number };
    log: (message: string) => void;
    prompt: (message: string) => string | null;
    alert: (message: string) => void;
    confirm: (message: string) => boolean;
    reload: () => void;
}

export function runExportDiagnostics(deps: PanelActionDeps): void {
    deps.log(deps.diagnostics());
    deps.log("[诊断信息] 以上是脚本的运行状态快照，请整段复制后随反馈一并提供（其中不含账号信息与地址跟踪参数）");
}

export function runExportSettings(deps: PanelActionDeps): void {
    deps.log(deps.exportSettings());
    deps.log("[设置] 以上是当前全部设置的 JSON 备份，请整段复制保存；导入时粘贴到「导入设置」提示框");
}

export function runImportSettings(deps: PanelActionDeps): void {
    const raw = deps.prompt("粘贴导出的设置 JSON 文本：");
    if (raw === null) return;
    const result = deps.importSettings(raw);
    if (result.error) {
        deps.alert(`导入失败：${result.error}`);
        return;
    }
    if (result.failed > 0) {
        const head = result.applied > 0
            ? `导入未全部完成：已写入 ${result.applied} 项，另有 ${result.failed} 项写入失败`
            : `导入未能写入任何设置：${result.failed} 项全部写入失败`;
        deps.alert(`${head}，未改动 ${result.skipped} 项，忽略未知键 ${result.ignored} 项。\n请检查脚本管理器存储后重试。`);
        return;
    }
    deps.alert(`导入完成：写入 ${result.applied} 项，未改动 ${result.skipped} 项，忽略未知键 ${result.ignored} 项。\n请刷新页面使面板与播放器行为全部生效。`);
}

export function runResetAllSettings(deps: PanelActionDeps): void {
    if (!deps.confirm("确定把全部设置恢复为默认值？此操作不可撤销（可先「导出设置」备份）。")) return;
    const result = deps.resetAllSettings();
    if (result.failed > 0) {
        const head = result.applied > 0
            ? `恢复默认设置未全部完成：已重置 ${result.applied} 项，另有 ${result.failed} 项写入失败`
            : `恢复默认设置未能写入任何项：${result.failed} 项全部写入失败`;
        deps.alert(`${head}。\n请检查脚本管理器存储后重试。`);
        return;
    }
    deps.alert("已恢复默认设置，即将刷新页面。");
    deps.reload();
}

export function realPanelActionDeps(): PanelActionDeps {
    return {
        diagnostics: collectDiagnostics,
        exportSettings,
        importSettings,
        resetAllSettings,
        log: message => console.log(message),
        prompt: message => window.prompt(message),
        alert: message => window.alert(message),
        confirm: message => window.confirm(message),
        reload: () => location.reload(),
    };
}
