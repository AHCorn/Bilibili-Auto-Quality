import { SETTINGS, SCHEMA_VERSION, loadSetting, setSetting, normalizeSetting, state, briefValue, type AppState } from "./settings";
import { normalizeCustomOrder, writeCustomOrder } from "./quality-vocab";

export const CONFIG_FILE_APP = "bilibili-auto-quality";

export interface ImportResult {
    // 实际写入存储的项数
    applied: number;
    // 备份里存在、但不在注册表内的键数（未知键，忽略不写）
    ignored: number;
    skipped: number;
    failed: number;
    error?: string;
}

function scriptVersion(): string {
    try {
        if (typeof GM_info !== "undefined" && GM_info && GM_info.script && typeof GM_info.script.version === "string") {
            return GM_info.script.version;
        }
    } catch (e) { /* 读不到就记 unknown，不影响导出本身 */ }
    return "unknown";
}

function decodeOrder(raw: unknown): string[] {
    let value = raw;
    if (typeof value === "string") {
        try { value = JSON.parse(value); } catch (e) { value = null; }
    }
    return normalizeCustomOrder(value);
}
function sameOrder(a: string[] | null, b: string[] | null): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

function readPersisted(name: string): unknown {
    const raw = loadSetting(name);
    return name === "customQualityOrder" ? decodeOrder(raw) : raw;
}

export function exportSettings(): string {
    const settings: Record<string, unknown> = {};
    for (const name of Object.keys(SETTINGS)) {
        settings[SETTINGS[name].key] = readPersisted(name);
    }
    return JSON.stringify({
        app: CONFIG_FILE_APP,
        schema: SCHEMA_VERSION,
        version: scriptVersion(),
        exportedAt: new Date().toISOString(),
        settings,
    }, null, 2);
}

function rejectImport(message: string): ImportResult {
    console.warn(`[设置] 导入配置被拒绝：${message}`);
    return { applied: 0, ignored: 0, skipped: 0, failed: 0, error: message };
}

export function importSettings(json: string): ImportResult {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch (e) {
        return rejectImport("内容不是合法的 JSON 文本");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return rejectImport("内容不是一个 JSON 对象");
    }
    const payload = parsed as { app?: unknown; schema?: unknown; settings?: unknown };
    if (payload.app !== CONFIG_FILE_APP) {
        return rejectImport(`这不是本脚本的配置备份（app=${briefValue(payload.app)}）`);
    }
    let schema = 0;
    if (Object.prototype.hasOwnProperty.call(payload, "schema")) {
        const rawSchema = payload.schema;
        if (typeof rawSchema !== "number" || !Number.isInteger(rawSchema) || rawSchema < 0) {
            return rejectImport(`备份的配置版本不是合法的版本号（schema=${briefValue(rawSchema)}），文件可能已损坏`);
        }
        schema = rawSchema;
    }
    if (schema > SCHEMA_VERSION) {
        return rejectImport(`备份的配置版本 v${schema} 高于本版脚本支持的 v${SCHEMA_VERSION}，请先更新脚本再导入`);
    }
    if (!payload.settings || typeof payload.settings !== "object" || Array.isArray(payload.settings)) {
        return rejectImport("备份里缺少 settings 字段");
    }
    if (schema < SCHEMA_VERSION) {
        console.warn(`[设置] 备份的配置版本为 v${schema}，低于当前的 v${SCHEMA_VERSION}，将按当前规则逐项归一后导入`);
    }
    const values = payload.settings as Record<string, unknown>;
    const registryKeys = new Set<string>();
    const store = state as AppState & Record<string, unknown>;
    let applied = 0;
    let skipped = 0;
    let failed = 0;
    for (const name of Object.keys(SETTINGS)) {
        const key = SETTINGS[name].key;
        registryKeys.add(key);
        if (!Object.prototype.hasOwnProperty.call(values, key)) {
            skipped += 1;
            continue;
        }
        if (name === "customQualityOrder") {
            const nextOrder = decodeOrder(values[key]);
            if (sameOrder(nextOrder, state.customQualityOrder)) {
                skipped += 1;
                continue;
            }
            if (writeCustomOrder(nextOrder).saved) applied += 1;
            else failed += 1;
            continue;
        }
        const next = normalizeSetting(name, values[key]);
        if (next === store[name]) {
            skipped += 1;
            continue;
        }
        if (setSetting(name, next)) applied += 1;
        else failed += 1;
    }
    const ignored = Object.keys(values).filter(key => !registryKeys.has(key)).length;
    const summary = `写入 ${applied} 项${failed > 0 ? `，写入失败 ${failed} 项` : ""}，`
        + `未改动 ${skipped} 项，忽略未知键 ${ignored} 项`;
    if (failed > 0) console.warn(`[设置] 导入配置未全部完成：${summary}`);
    else console.log(`[设置] 导入配置完成：${summary}`);
    return { applied, ignored, skipped, failed };
}

export function resetAllSettings(): { applied: number; failed: number } {
    const store = state as AppState & Record<string, unknown>;
    let applied = 0;
    let failed = 0;
    for (const name of Object.keys(SETTINGS)) {
        if (name === "customQualityOrder") {
            const defaultOrder = normalizeCustomOrder(null);
            if (sameOrder(defaultOrder, state.customQualityOrder)) continue;
            if (writeCustomOrder(null).saved) applied += 1;
            else failed += 1;
            continue;
        }
        const def = SETTINGS[name].def;
        if (store[name] === def) continue;
        if (setSetting(name, def)) applied += 1;
        else failed += 1;
    }
    if (failed > 0) console.warn(`[设置] 恢复默认设置未全部完成：重置 ${applied} 项，写入失败 ${failed} 项，其余本就是默认值`);
    else console.log(`[设置] 已恢复默认设置：重置 ${applied} 项，其余本就是默认值`);
    return { applied, failed };
}
