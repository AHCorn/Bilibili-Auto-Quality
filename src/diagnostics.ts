import { BILI } from "./contract";
import { SETTINGS, state, type AppState, type QualityFlowOutcome } from "./settings";
import { taskQueue } from "./task-queue";
import { adaptive } from "./adaptive";
import { pageWindowBridge, SCRIPT_ENV, scriptEnvLabel } from "./env";

const DISCLOSABLE_URL_PARAMS = ["p", "bvid", "oid"];
function safeUrl(rawUrl: string): string {
    try {
        const url = new URL(rawUrl);
        const kept = DISCLOSABLE_URL_PARAMS
            .map(key => [key, url.searchParams.get(key)] as [string, string | null])
            .filter(([, value]) => value !== null) as [string, string][];
        url.search = "";
        url.hash = "";
        kept.forEach(([key, value]) => url.searchParams.set(key, value));
        return url.toString();
    } catch (error) {
        return "<地址解析失败，已整条省略>";
    }
}

function formatValue(value: unknown): string {
    if (typeof value === "string") return `"${value}"`;
    if (value === null || value === undefined) return String(value);
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
        return JSON.stringify(value);
    } catch (error) {
        return "<无法序列化>";
    }
}

function formatDeadline(timestamp: number, now: number): string {
    if (!timestamp) return "未设置";
    const delta = timestamp - now;
    return delta > 0 ? `${delta}ms 后到期` : `已过期（${-delta}ms 前）`;
}

function readPageObject(name: string): Record<string, unknown> | null {
    try {
        const value = (unsafeWindow as unknown as Record<string, unknown>)[name];
        return value && typeof value === "object" ? value as Record<string, unknown> : null;
    } catch (error) {
        return null;
    }
}

const PLAYER_METHODS = ["getQuality", "requestQuality", "on", "off"];
const LIVE_PLAYER_METHODS = ["getPlayerInfo", "switchQuality", "updateDMSetting"];
function describeFacade(name: string, methods: readonly string[]): string {
    const target = readPageObject(name);
    if (!target) return "缺失或不可访问";
    return `存在（${methods.map(m => `${m}: ${typeof target[m] === "function" ? "有" : "无"}`).join("，")}）`;
}

const CONTRACT_DOM_GROUPS = ["video", "header", "decode", "live"];
function looksLikeSelector(value: string): boolean {
    return /[.#[]/.test(value);
}
function countNodes(selector: string): number {
    try {
        return document.querySelectorAll(selector).length;
    } catch (error) {
        return -1;
    }
}
interface SelectorHit {
    path: string;
    selector: string;
    count: number;
}
function probeContractSelectors(): SelectorHit[] {
    const hits: SelectorHit[] = [];
    const table = BILI as unknown as Record<string, unknown>;
    CONTRACT_DOM_GROUPS.forEach(group => {
        const entries = table[group];
        if (!entries || typeof entries !== "object") return;
        Object.entries(entries as Record<string, unknown>).forEach(([key, value]) => {
            if (typeof value !== "string" || !looksLikeSelector(value)) return;
            hits.push({ path: `${group}.${key}`, selector: value, count: countNodes(value) });
        });
    });
    return hits;
}

const VIDEO_CRITICAL_ANCHORS = ["video.qualityMenu", "video.qualityMenuItem"];
const VIDEO_ENTRY_ANCHOR = "video.controlWrap";
const HEADER_LOGIN_ANCHORS = ["header.avatarWrap", "header.loginEntry"];

export function runContractSelfCheck(): void {
    const missing: string[] = [];
    if (state.isLivePage) {
        if (!readPageObject("livePlayer")) {
            missing.push("页面 window 上的 livePlayer（直播画质切换的唯一通路）");
        }
    } else {
        const hits = probeContractSelectors();
        const anchors = state.injectQualityButton
            ? VIDEO_CRITICAL_ANCHORS.concat(VIDEO_ENTRY_ANCHOR)
            : VIDEO_CRITICAL_ANCHORS;
        anchors.forEach(path => {
            const hit = hits.find(item => item.path === path);
            if (!hit) {
                missing.push(path);
            } else if (hit.count <= 0) {
                missing.push(`${path} = ${hit.selector}`);
            }
        });
        const headerHit = HEADER_LOGIN_ANCHORS.some(path => {
            const hit = hits.find(item => item.path === path);
            return !!hit && hit.count > 0;
        });
        if (!headerHit) {
            missing.push("header.avatarWrap / header.loginEntry");
        }
    }
    if (missing.length === 0) return;
    console.warn("[页面检查] 未找到关键页面节点：" + missing.join("、"));
}

function appendBasics(lines: string[]): void {
    lines.push("===== 哔哩哔哩自动画质 · 运行状态 =====");
    lines.push(`脚本版本: ${SCRIPT_ENV.scriptVersion}`);
    lines.push(`脚本管理器: ${scriptEnvLabel()}`);
    lines.push(`页面类型: ${state.isLivePage ? "直播页" : "视频页"}（脚本路由判定）`);
    lines.push(`页面地址: ${safeUrl(location.href)}`);
    lines.push(`页面 window: ${pageWindowBridge.detail}`);
    lines.push(`可选能力: 菜单命令 ${typeof GM_registerMenuCommand === "function" ? "有" : "无"}，` +
        `跨标签同步 ${typeof GM_addValueChangeListener === "function" ? "有" : "无"}`);
    const ownUA = navigator.userAgent;
    const pageNavigator = readPageObject("navigator");
    const pageUA = pageNavigator && typeof pageNavigator.userAgent === "string" ? pageNavigator.userAgent : null;
    lines.push(`UA: ${pageUA === null ? `${ownUA}（页面侧读取失败）`
        : pageUA === ownUA ? pageUA : `${pageUA}（脚本侧为 ${ownUA}）`}`);
    lines.push(`页面已运行: ${Math.round(performance.now() / 1000)} 秒`);
}

function appendSettings(lines: string[]): void {
    lines.push("");
    lines.push("----- 设置（行首 * 表示与默认值不同）-----");
    const values = state as AppState & Record<string, unknown>;
    Object.keys(SETTINGS).forEach(name => {
        const current = formatValue(values[name]);
        const fallback = formatValue(SETTINGS[name].def);
        const changed = current !== fallback;
        lines.push(`${changed ? "*" : " "} ${name} = ${current}${changed ? `（默认 ${fallback}）` : ""}`);
    });
}

const QUALITY_FLOW_LABEL: Record<QualityFlowOutcome, string> = {
    pending: "未落定，等下一轮接手",
    switched: "已点击目标档，等待确认",
    settled: "已判定无需切换",
    stalled: "画质菜单未就绪，本轮停摆",
    abandoned: "连续切换失败，已放弃",
    delegated: "已让位给降画质引擎",
};
export function qualityFlowLabel(outcome: QualityFlowOutcome): string {
    return QUALITY_FLOW_LABEL[outcome];
}

function appendRuntime(lines: string[]): void {
    lines.push("");
    lines.push("----- 运行时状态 -----");
    lines.push(`会员判定: ${state.isVipUser ? "是" : "否"}（${state.vipStatusChecked ? "已判定" : "尚未判定"}）`);
    lines.push(`判定依据: ${state.sessionCache.vipSource || "无（本页会话尚未落缓存）"}`);
    lines.push(`加载锁定 isLoading: ${state.isLoading}`);
    lines.push(`画质流程: ${qualityFlowLabel(state.qualityFlow)}`);
    lines.push(`当前任务号: #${taskQueue.currentTaskId}；运行中任务: ${taskQueue.activeTask === null ? "无" : `#${taskQueue.activeTask}`}`);
    const pending = Array.from(taskQueue.activeTimeouts.keys());
    lines.push(`挂起的延迟任务: ${pending.length === 0 ? "无" : `${pending.length} 项（${pending.join("、")}）`}`);
    lines.push(`登录门: ${taskQueue.loginObserved ? "已观测到头像，不再复查" : "尚未观测到头像"}`);
}

function appendAdaptive(lines: string[], now: number): void {
    lines.push("");
    lines.push("----- 智能降画质引擎 -----");
    lines.push(`功能开关: ${state.adaptiveQualityEnabled}（灵敏度「${state.adaptiveQualitySensitivity}」）`);
    lines.push(`tick 运行中: ${adaptive.timerId !== null}`);
    lines.push(`已见画质流程完成: ${adaptive.flowDoneSeen}`);
    lines.push(`观察期起点 armedAt: ${formatDeadline(adaptive.armedAt, now)}`);
    lines.push(`观察推迟 observationHoldUntil: ${formatDeadline(adaptive.observationHoldUntil, now)}`);
    lines.push(`冷却 cooldownUntil: ${formatDeadline(adaptive.cooldownUntil, now)}`);
    lines.push(`重试到点 retryAt: ${formatDeadline(adaptive.retryAt, now)}`);
    lines.push(`本视频已降档 ${adaptive.stepsUsed} 次；连续失败 ${adaptive.failures} 次；本视频已停用: ${adaptive.disabledForVideo}`);
    lines.push(`切换进行中: ${adaptive.switching
        ? `是（目标「${adaptive.switching.targetClean}」/ qn ${adaptive.switching.targetQn}）`
        : "否"}`);
    lines.push(`失败档位 failedQns: ${adaptive.failedQns
        ? (Array.from(adaptive.failedQns).join("、") || "无")
        : "未初始化"}`);
    lines.push(`最近读到的档位: ${adaptive.lastActiveClean || "未知"}`);
    lines.push(`信号累计: 卡顿记账 ${adaptive.strikes.length} 次，缓冲采样 ${adaptive.bufferSamples.length} 个`);
}

function appendProbes(lines: string[]): void {
    lines.push("");
    lines.push("----- 播放器 facade 探针 -----");
    lines.push(`player: ${describeFacade("player", PLAYER_METHODS)}`);
    lines.push(`livePlayer: ${describeFacade("livePlayer", LIVE_PLAYER_METHODS)}`);

    lines.push("");
    lines.push("----- 契约选择器命中数（行首 ! 表示一个都没命中）-----");
    probeContractSelectors().forEach(hit => {
        const count = hit.count === -1 ? "选择器非法" : `${hit.count} 个`;
        lines.push(`${hit.count === 0 ? "!" : " "} ${hit.path} = ${count}  ${hit.selector}`);
    });
}

export function collectDiagnostics(): string {
    const lines: string[] = [];
    try {
        const now = Date.now();
        appendBasics(lines);
        appendSettings(lines);
        appendRuntime(lines);
        appendAdaptive(lines, now);
        appendProbes(lines);
        lines.push("");
        lines.push("（本文本不含账号信息、Cookie 与地址跟踪参数，可直接粘贴）");
    } catch (error) {
        lines.push(`（采集中断: ${error instanceof Error ? error.message : String(error)}）`);
    }
    return lines.join("\n");
}
