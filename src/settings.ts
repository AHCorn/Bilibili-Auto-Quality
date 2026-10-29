import { BILI } from "./contract";

export const PROD_DOUBLE_CHECK_DELAY_MS = 5000;
export const PROD_AUDIO_DELAY_MS = 4000;
export const PROD_AUDIO_RETRIES = 2;

export interface SettingSpec {
    key: string;
    def: unknown;
    enum?: readonly unknown[];
    min?: number;
    max?: number;
    int?: true;
}
// 设置注册表，GM 键名全文仅在此出现；属性名与键名不同为历史存量，改键名会丢老用户设置
export const SETTINGS: Record<string, SettingSpec> = {
    hiResAudioEnabled:         { key: "hiResAudio",                def: false },
    dolbyAtmosEnabled:         { key: "dolbyAtmos",                def: false },
    userQualitySetting:        { key: "qualitySetting",            def: "最高画质" },
    useHighestQualityFallback: { key: "useHighestQualityFallback", def: true },
    customSortEnabled:         { key: "customSortEnabled",         def: false },
    customQualityOrder:        { key: "customQualityOrder",        def: null },
    takeOverQualityControl:    { key: "takeOverQualityControl",    def: false },
    unlockUA:                  { key: "unlockUA",                  def: false },
    unlockHDR:                 { key: "unlockHDR",                 def: false },
    unlockMarker:              { key: "unlockMarker",              def: true },
    disableHDROption:          { key: "disableHDR",                def: false },
    preventBackgroundDegrade:  { key: "preventBackgroundDegrade",  def: true },
    liveAutoRecoverOnVisible:  { key: "liveAutoRecoverOnVisible",  def: false },
    userLiveQualitySetting:    { key: "liveQualitySetting",        def: "最高画质" },
    // 直播解码历史上存过"硬解"等站方文本，不设 enum 以免洗掉存量设置
    userLiveDecodeSetting:     { key: "liveDecodeSetting",         def: "默认" },
    userVideoDecodeSetting:    { key: "videoDecodeSetting",        def: "默认", enum: ["默认", "AV1", "HEVC", "AVC"] },
    decodeSettingEnabled:      { key: "decodeSettingEnabled",      def: false },
    devModeEnabled:            { key: "devModeEnabled",            def: false },
    devModeVipStatus:          { key: "devModeVipStatus",          def: "默认", enum: ["默认", "普通", "会员"] },
    devModeNoLoginStatus:      { key: "devModeNoLoginStatus",      def: false },
    preserveTouchPoints:       { key: "preserveTouchPoints",       def: false },
    devModeAudioRetries:       { key: "devModeAudioRetries",       def: PROD_AUDIO_RETRIES, min: 0, max: 5, int: true },
    devModeAudioDelay:         { key: "devModeAudioDelay",         def: PROD_AUDIO_DELAY_MS, min: 500, max: 10000, int: true },
    devDoubleCheckDelay:       { key: "devDoubleCheckDelay",       def: PROD_DOUBLE_CHECK_DELAY_MS, min: 1000, max: 20000, int: true },
    devAllowFreeVipQualities:  { key: "devAllowFreeVipQualities",  def: false },
    adaptiveQualityEnabled:    { key: "adaptiveQualityEnabled",    def: false },
    adaptiveQualitySensitivity: { key: "adaptiveQualitySensitivity", def: "标准", enum: ["灵敏", "标准", "保守"] },
    panelThemeOverride:        { key: "panelThemeOverride",        def: "", enum: ["", "light", "dark"] },
    injectQualityButton:       { key: "injectQualityButton",       def: true },
    qualityDoubleCheck:        { key: "qualityDoubleCheck",        def: true },
    liveQualityDoubleCheck:    { key: "liveQualityDoubleCheck",    def: true },
    liveQualityPollingEnabled: { key: "liveQualityPollingEnabled", def: false },
    livePollingInterval:       { key: "livePollingInterval",       def: 60, min: 5, max: 3600, int: true },
    liveKeepAliveEnabled:      { key: "liveKeepAliveEnabled",      def: false },
    liveKeepAliveInterval:     { key: "liveKeepAliveInterval",     def: 60, min: 1, max: 1440, int: true },
    autoWidescreen:            { key: "autoWidescreen",            def: false },
    liveDanmakuSync:           { key: "liveDanmakuSync",           def: false },
};
export function briefValue(value: unknown): string {
    if (typeof value === "string") return value.length > 40 ? `"${value.slice(0, 40)}…"` : `"${value}"`;
    if (value === null || value === undefined || typeof value !== "object") return String(value);
    return Object.prototype.toString.call(value);
}
export function normalizeSetting(name: string, value: unknown): unknown {
    const spec = SETTINGS[name];
    if (!spec) {
        console.error("[设置] 未注册的设置项:", name);
        return value;
    }
    if (spec.def === null) return value;
    if (value === undefined || value === null || typeof value !== typeof spec.def) {
        console.warn(`[设置] ${name} 的存储值 ${briefValue(value)} 与预期类型 ${typeof spec.def} 不符，回退为默认值 ${briefValue(spec.def)}`);
        return spec.def;
    }
    if (spec.enum && !spec.enum.includes(value)) {
        console.warn(`[设置] ${name} 的存储值 ${briefValue(value)} 不在允许取值 [${spec.enum.map(briefValue).join(", ")}] 内，回退为默认值 ${briefValue(spec.def)}`);
        return spec.def;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            console.warn(`[设置] ${name} 的存储值 ${briefValue(value)} 不是有限数，回退为默认值 ${briefValue(spec.def)}`);
            return spec.def;
        }
        // 取整先于夹取：先夹后取整可能把结果推出 [min, max]
        const rounded = spec.int ? Math.round(value) : value;
        if (spec.min !== undefined && rounded < spec.min) {
            console.warn(`[设置] ${name} 的值 ${briefValue(value)} 低于下限 ${spec.min}，已夹取为 ${spec.min}`);
            return spec.min;
        }
        if (spec.max !== undefined && rounded > spec.max) {
            console.warn(`[设置] ${name} 的值 ${briefValue(value)} 高于上限 ${spec.max}，已夹取为 ${spec.max}`);
            return spec.max;
        }
        return rounded;
    }
    return value;
}
function writeStorage(name: string, value: unknown): boolean {
    try {
        GM_setValue(SETTINGS[name].key, value);
        return true;
    } catch (e) {
        console.error(`[设置] ${name} 写入存储失败，本次修改未能保存:`, e);
        return false;
    }
}
let storageSchemaAhead = false;
export function loadSetting(name: string): unknown {
    const spec = SETTINGS[name];
    if (!spec) {
        console.error("[设置] 未注册的设置项:", name);
        return undefined;
    }
    const raw = GM_getValue(spec.key, spec.def);
    const normalized = normalizeSetting(name, raw);
    if (normalized !== raw && !storageSchemaAhead) writeStorage(name, normalized);
    return normalized;
}
export function setSetting(name: string, value: unknown): boolean {
    if (!SETTINGS[name]) {
        console.error("[设置] 未注册的设置项:", name);
        return false;
    }
    const normalized = normalizeSetting(name, value);
    const target = state as AppState & Record<string, unknown>;
    const previous = target[name];
    target[name] = normalized;
    if (!writeStorage(name, normalized)) {
        target[name] = previous;
        return false;
    }
    return true;
}

export const SCHEMA_VERSION = 1;
const SCHEMA_KEY = "schemaVersion";
const SCHEMA_FAILURE_KEY = "schemaMigrationFailures";
const MAX_MIGRATION_FAILURES = 3;
const MIGRATIONS: { to: number; run: () => void }[] = [];

function readVersionCounter(key: string): number {
    const raw = GM_getValue(key, 0);
    return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}
function stampVersion(version: number): void {
    try {
        GM_setValue(SCHEMA_KEY, version);
    } catch (e) {
        console.error("[设置] 配置版本戳写入失败，下次加载会重跑本轮迁移:", e);
    }
}
function stampFailures(count: number): void {
    try { GM_setValue(SCHEMA_FAILURE_KEY, count); } catch (e) { /* 忽略 */ }
}
function runMigrations(): void {
    // 读不到该键的现有安装一律归为 v0，不需要任何回填
    let from = readVersionCounter(SCHEMA_KEY);
    if (from > SCHEMA_VERSION) {
        storageSchemaAhead = true;
        console.warn(`[设置] 存储中的配置版本 v${from} 高于本版脚本的 v${SCHEMA_VERSION}，跳过迁移。` +
            "多半是本机装过更新的版本，本版只按自己认识的键读写，不改动存储");
        return;
    }
    if (from === SCHEMA_VERSION) return;
    let failures = readVersionCounter(SCHEMA_FAILURE_KEY);
    for (const step of MIGRATIONS) {
        if (step.to <= from) continue;
        try {
            step.run();
            console.log(`[设置] 配置已迁移至 v${step.to}`);
        } catch (e) {
            failures += 1;
            console.error(`[设置] 配置迁移到 v${step.to} 失败（连续第 ${failures} 次），本次不推进版本戳:`, e);
            stampFailures(failures);
            if (failures < MAX_MIGRATION_FAILURES) return;
            console.error(`[设置] 该步已连续失败 ${failures} 次，强制推进版本戳跳过它，` +
                "以免每次加载都重跑同一步；这一步涉及的设置项将保持旧值");
        }
        from = step.to;
        if (failures !== 0) { failures = 0; stampFailures(0); }
        stampVersion(from);
    }
    if (from !== SCHEMA_VERSION) stampVersion(SCHEMA_VERSION);
}
runMigrations();

export function debugTransient(e: unknown): void {
    if (state.devModeEnabled) console.debug("[瞬态异常]", e);
}

export type QualityFlowOutcome = "pending" | "switched" | "settled" | "stalled" | "abandoned" | "delegated";

export interface AppState {
    hiResAudioEnabled: boolean;
    dolbyAtmosEnabled: boolean;
    userQualitySetting: string;
    useHighestQualityFallback: boolean;
    customSortEnabled: boolean;
    customQualityOrder: string[] | null;
    takeOverQualityControl: boolean;
    unlockUA: boolean;
    unlockHDR: boolean;
    unlockMarker: boolean;
    disableHDROption: boolean;
    preventBackgroundDegrade: boolean;
    liveAutoRecoverOnVisible: boolean;
    userLiveQualitySetting: string;
    userLiveDecodeSetting: string;
    userVideoDecodeSetting: string;
    decodeSettingEnabled: boolean;
    devModeEnabled: boolean;
    devModeVipStatus: string;
    devModeNoLoginStatus: boolean;
    preserveTouchPoints: boolean;
    devModeAudioRetries: number;
    devModeAudioDelay: number;
    devDoubleCheckDelay: number;
    devAllowFreeVipQualities: boolean;
    adaptiveQualityEnabled: boolean;
    adaptiveQualitySensitivity: string;
    panelThemeOverride: string;
    injectQualityButton: boolean;
    qualityDoubleCheck: boolean;
    liveQualityDoubleCheck: boolean;
    liveQualityPollingEnabled: boolean;
    livePollingInterval: number;
    liveKeepAliveEnabled: boolean;
    liveKeepAliveInterval: number;
    autoWidescreen: boolean;
    liveDanmakuSync: boolean;
    isVipUser: boolean;
    vipStatusChecked: boolean;
    isLoading: boolean;
    isLivePage: boolean;
    liveEntryForceHighest: boolean;
    livePollingTimerId: ReturnType<typeof setInterval> | null;
    liveKeepAliveTimerId: ReturnType<typeof setInterval> | null;
    qualityFlow: QualityFlowOutcome;
    sessionCache: {
        vipStatus: boolean | null;
        vipChecked: boolean;
        vipSource: string | null;
    };
}
export const state = {
    // customQualityOrder 此处为原始值，随后由 loadCustomOrder 规范化
    ...Object.fromEntries(Object.keys(SETTINGS).map(name => [name, loadSetting(name)])),
    // 运行时状态
    isVipUser: false,
    vipStatusChecked: false,
    isLoading: true,
    isLivePage: false,
    liveEntryForceHighest: false,
    livePollingTimerId: null,
    liveKeepAliveTimerId: null,
    qualityFlow: "pending",
    sessionCache: {
        vipStatus: null,
        vipChecked: false,
        vipSource: null
    }
} as AppState;
export function getDoubleCheckConfig(isLive: boolean): { enabled: boolean; delayMs: number } {
    const enabled = state.devModeEnabled ? (isLive ? state.liveQualityDoubleCheck : state.qualityDoubleCheck) : true;
    const delayMs = state.devModeEnabled ? state.devDoubleCheckDelay : PROD_DOUBLE_CHECK_DELAY_MS;
    return { enabled, delayMs };
}

export function checkIfLivePage() {
    state.isLivePage = window.location.protocol === "file:"
        ? window.location.pathname.includes(BILI.liveHost)
        : window.location.hostname === BILI.liveHost;
}
