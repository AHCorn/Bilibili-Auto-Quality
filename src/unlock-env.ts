import { BILI } from "./contract";
import { debugTransient, state } from "./settings";

const SAFARI_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";
const SAFARI_PLATFORM = "MacIntel";
const SAFARI_VENDOR = "Apple Computer, Inc.";

const UNLOCK_BACKUP_KEY = "__baqUnlockBackup";
const ORIGIN_SEP = "|";
const MARKER_VALUE = "1";
interface MarkerRecord {
    original: string | null;
    written: boolean;
}
type MarkerBackup = Record<string, MarkerRecord>;
type BackupDelta = Map<string, MarkerRecord | undefined>;

function currentOrigin(): string {
    return window.location.origin || window.location.protocol;
}
function backupKeyFor(key: string): string {
    return currentOrigin() + ORIGIN_SEP + key;
}

function toMarkerRecord(value: unknown): MarkerRecord {
    if (typeof value === "string") return { original: value, written: true };
    if (value && typeof value === "object" && !Array.isArray(value) && "original" in value) {
        const record = value as { original?: unknown; written?: unknown };
        return { original: typeof record.original === "string" ? record.original : null, written: record.written === true };
    }
    return { original: null, written: true };
}

function readMarkerBackup(): MarkerBackup {
    const raw = GM_getValue(UNLOCK_BACKUP_KEY, null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const backup: MarkerBackup = {};
    const legacy: MarkerBackup = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const record = toMarkerRecord(value);
        if (key.indexOf(ORIGIN_SEP) > 0) backup[key] = record;
        else legacy[key] = record;
    }
    for (const [key, record] of Object.entries(legacy)) {
        const composite = backupKeyFor(key);
        if (!(composite in backup)) backup[composite] = record;
    }
    return backup;
}

function persistBackup(delta: BackupDelta): MarkerBackup {
    const merged = readMarkerBackup();
    delta.forEach((record, key) => {
        if (record === undefined) {
            delete merged[key];
            return;
        }
        const existing: MarkerRecord | undefined = merged[key];
        merged[key] = existing
            ? { original: existing.original, written: existing.written || record.written }
            : record;
    });
    GM_setValue(UNLOCK_BACKUP_KEY, merged);
    return readMarkerBackup();
}

function releaseMarkerKey(key: string, record: MarkerRecord): string {
    const current = window.localStorage.getItem(key);
    if (current === null) return `${key}: 站方已无此键，无需处置`;
    if (!record.written) return `${key}: 本脚本的写入未曾确认落地，当前值 ${current} 归属不明，保留不动`;
    if (current !== MARKER_VALUE) return `${key}: 当前值 ${current} 不是本脚本写入的值，已被改动过，保留不动`;
    const restoreTo = record.original !== null && record.original !== MARKER_VALUE ? record.original : null;
    if (restoreTo !== null) {
        window.localStorage.setItem(key, restoreTo);
        return `${key}: ${window.localStorage.getItem(key) === restoreTo ? "已还原原值" : "还原未生效"}`;
    }
    window.localStorage.removeItem(key);
    const after = window.localStorage.getItem(key);
    if (after !== null) return `${key}: 删除未生效，当前值 ${after}`;
    if (record.original === null) return `${key}: 已删除（本脚本接管前不存在）`;
    return `${key}: 已删除（原值与本脚本写入值相同、无从归属，若系其他脚本写入需由对方补回）`;
}

function claimMarkerKey(key: string, backupKey: string, backup: MarkerBackup, delta: BackupDelta): MarkerRecord | null {
    delta.set(backupKey, { original: window.localStorage.getItem(key), written: false });
    let stored: MarkerRecord | undefined;
    let failure: unknown;
    try {
        stored = persistBackup(delta)[backupKey];
    } catch (e) {
        failure = e;
    }
    if (!stored) {
        delta.delete(backupKey);
        console.warn(`[解锁设置] ${key} 的原值未能存入备份，本次不写入站方标记（改了就再也还不回去），` +
            "解锁开关仍开启时下次加载会重试:", failure ?? "落盘后回读不到该条目");
        return null;
    }
    backup[backupKey] = stored;
    return stored;
}

function applyMarkerKey(key: string, enabled: boolean, backup: MarkerBackup, delta: BackupDelta, released: string[]): void {
    const backupKey = backupKeyFor(key);
    const record: MarkerRecord | undefined = backup[backupKey];
    if (enabled) {
        const claimed = record ?? claimMarkerKey(key, backupKey, backup, delta);
        if (!claimed) return;
        window.localStorage.setItem(key, MARKER_VALUE);
        if (!claimed.written && window.localStorage.getItem(key) === MARKER_VALUE) {
            const confirmed: MarkerRecord = { original: claimed.original, written: true };
            backup[backupKey] = confirmed;
            delta.set(backupKey, confirmed);
        }
    } else if (record) {
        released.push(releaseMarkerKey(key, record));
        delete backup[backupKey];
        delta.set(backupKey, undefined);
    }
}

function otherOriginsIn(backup: MarkerBackup): string[] {
    const here = currentOrigin();
    const origins: string[] = [];
    for (const composite of Object.keys(backup)) {
        const sep = composite.indexOf(ORIGIN_SEP);
        if (sep <= 0) continue;
        const origin = composite.slice(0, sep);
        if (origin !== here && origins.indexOf(origin) < 0) origins.push(origin);
    }
    return origins;
}

interface MarkerSyncResult {
    released: string[];
    pendingOrigins: string[];
}

function syncMarkerKeys(unlockHDR: boolean, unlockMarker: boolean): MarkerSyncResult {
    const markerBaseKey = BILI.storage.markerBaseKey;
    const markerHdrKey = markerBaseKey + BILI.storage.markerHdrSuffix;
    const backup = readMarkerBackup();
    const delta: BackupDelta = new Map();
    const released: string[] = [];
    applyMarkerKey(BILI.storage.forceHdrKey, unlockHDR, backup, delta, released);
    applyMarkerKey(markerHdrKey, unlockMarker && unlockHDR, backup, delta, released);
    applyMarkerKey(markerBaseKey, unlockMarker && !unlockHDR, backup, delta, released);
    const latest = delta.size > 0 ? persistBackup(delta) : backup;
    return { released, pendingOrigins: otherOriginsIn(latest) };
}

function defineSpoof(nav: Navigator, prop: string, value: unknown, lock: boolean): void {
    Object.defineProperty(nav, prop, { get: () => value, configurable: !lock });
}

function isLockedTo(nav: Navigator, prop: string, value: unknown): boolean {
    const desc = Object.getOwnPropertyDescriptor(nav, prop);
    return !!desc && !desc.configurable && Reflect.get(nav, prop) === value;
}

function rollbackSpoof(nav: Navigator, applied: Map<string, PropertyDescriptor | undefined>): string[] {
    const failed: string[] = [];
    applied.forEach((descriptor, prop) => {
        try {
            if (descriptor) Object.defineProperty(nav, prop, descriptor);
            else if (!Reflect.deleteProperty(nav, prop)) failed.push(prop);
        } catch (e) {
            failed.push(prop);
            debugTransient(e);
        }
    });
    return failed;
}

function spoofNavigatorIdentity(nav: Navigator): boolean {
    const spoofs: [string, string][] = [
        ["userAgent", SAFARI_UA],
        ["platform", SAFARI_PLATFORM],
        ["vendor", SAFARI_VENDOR],
        ["appVersion", SAFARI_UA.replace(/^Mozilla\//, "")],
    ];
    const applied = new Map<string, PropertyDescriptor | undefined>();
    for (const [prop, value] of spoofs) {
        if (isLockedTo(nav, prop, value)) continue;
        const before = Object.getOwnPropertyDescriptor(nav, prop);
        try {
            defineSpoof(nav, prop, value, false);
        } catch (error) {
            const done = [...applied.keys()].join("、") || "无";
            const rollbackFailed = rollbackSpoof(nav, applied);
            if (rollbackFailed.length === 0) {
                console.warn(`[解锁设置] UA 修改在 ${prop} 上失败（已回滚 ${done}）:`, error);
            } else {
                console.error(`[解锁设置] UA 修改在 ${prop} 上失败，且 ${rollbackFailed.join("、")} 回滚失败:`, error);
            }
            return false;
        }
        applied.set(prop, before);
    }
    const unlocked: string[] = [];
    for (const [prop, value] of spoofs) {
        if (isLockedTo(nav, prop, value)) continue;
        try { defineSpoof(nav, prop, value, true); } catch (e) { unlocked.push(prop); debugTransient(e); }
    }
    if (unlocked.length > 0) console.warn(`[解锁设置] ${unlocked.join("、")} 属性未能锁定`);
    return true;
}

function reportSpoofResult(nav: Navigator): void {
    const appliedUA = nav.userAgent;
    const appliedPlatform = nav.platform;
    if (appliedUA !== SAFARI_UA || appliedPlatform !== SAFARI_PLATFORM) {
        console.warn(`[解锁设置] UA 或平台标识修改未生效，回读仍为: ${appliedUA} / ${appliedPlatform}`);
        return;
    }
    console.log("[解锁设置] UA 和平台标识修改成功");
}

// 应用解锁相关本地标记
export function applyUnlockEnvironment(): void {
    try {
        const { released, pendingOrigins } = syncMarkerKeys(state.unlockHDR, state.unlockMarker);
        if (released.length > 0) console.log(`[解锁设置] 已清理本地解锁标记: ${released.join("；")}`);
        if (released.length > 0 && pendingOrigins.length > 0) {
            console.log(`[解锁设置] 另有 ${pendingOrigins.length} 个站点仍有本脚本的标记（${pendingOrigins.join("、")}），` +
                "在那些站点上加载一次页面即会自动清掉，无需手动操作");
        }
    } catch (e) {
        console.warn('[解锁设置] 写入本地标记失败:', e);
    }
    function detectPointerType() {
        try {
            const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
            const hasCoarsePointer = window.matchMedia('(any-pointer: coarse)').matches;
            const anyHover = window.matchMedia('(any-hover: hover)').matches;
            const supportsTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
            console.log(`[解锁设置] 设备检测 Pointer: fine=${hasFinePointer}, any-coarse=${hasCoarsePointer}`);
            console.log(`[解锁设置] 设备检测 Hover: ${anyHover}`);
            console.log(`[解锁设置] 设备检测 Touch: ${supportsTouch}`);
            return {
                detected: true,
                isMouseDevice: hasFinePointer && anyHover,
                isTouchDevice: hasCoarsePointer && supportsTouch
            };
        } catch (error) {
            console.error("[解锁设置] 设备检测失败，保留 maxTouchPoints 原值:", error);
            return { detected: false, isMouseDevice: false, isTouchDevice: false };
        }
    }
    try {
        if (state.unlockUA) {
            const nav = unsafeWindow.navigator;
            if (spoofNavigatorIdentity(nav)) {
                const navProto = unsafeWindow.Navigator && unsafeWindow.Navigator.prototype;
                if (navProto && !Reflect.deleteProperty(navProto, "userAgentData")) {
                    console.warn("[解锁设置] userAgentData 未能删除");
                }
                reportSpoofResult(nav);
            }
        } else {
            console.log("[解锁设置] 未开启 UA 修改");
        }
        if (state.unlockUA && state.preserveTouchPoints) {
            console.log("[解锁设置] 已启用保留触控点，跳过 maxTouchPoints 修改");
        } else if (state.unlockUA) {
            const pointerType = detectPointerType();
            console.log(`[解锁设置] 设备检测结果: 鼠标=${pointerType.isMouseDevice}, 触控=${pointerType.isTouchDevice}`);
            if (pointerType.isMouseDevice && !pointerType.isTouchDevice) {
                if (!isLockedTo(unsafeWindow.navigator, 'maxTouchPoints', 0)) {
                    defineSpoof(unsafeWindow.navigator, 'maxTouchPoints', 0, true);
                }
                console.log("[解锁设置] 纯鼠标设备，已设置 maxTouchPoints 为 0");
            } else {
                const keepReason = !pointerType.detected
                    ? "设备检测失败"
                    : (pointerType.isTouchDevice ? "检测到触控设备" : "无精确鼠标指针");
                console.log(`[解锁设置] 保留 maxTouchPoints 原值: ${navigator.maxTouchPoints}，原因: ${keepReason}`);
            }
        }
    } catch (error) {
        console.error("[解锁设置] 修改 UA 或 maxTouchPoints 失败:", error);
    }
}
