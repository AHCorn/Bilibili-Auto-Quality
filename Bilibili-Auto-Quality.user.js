// ==UserScript==
// @name         哔哩哔哩自动画质
// @namespace    https://github.com/AHCorn/Bilibili-Auto-Quality/
// @version      7.0
// @license      GPL-3.0
// @description  自动解锁并更改哔哩哔哩视频的画质和音质及直播画质，实现自动选择最高画质、无损音频、杜比全景声。
// @author       安和（AHCorn）
// @icon         https://www.bilibili.com/favicon.ico
// @match        *://www.bilibili.com/video/*
// @match        *://www.bilibili.com/list/*
// @match        *://www.bilibili.com/blackboard/*
// @match        *://www.bilibili.com/watchlater/*
// @match        *://www.bilibili.com/bangumi/*
// @match        *://www.bilibili.com/watchroom/*
// @match        *://www.bilibili.com/medialist/*
// @match        *://www.bilibili.com/cheese/play/*
// @match        *://www.bilibili.com/festival/*
// @match        *://bangumi.bilibili.com/*
// @match        *://live.bilibili.com/*
// @exclude      *://live.bilibili.com/
// @exclude      *://live.bilibili.com/?*
// @exclude      *://live.bilibili.com/p/*
// @noframes
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addValueChangeListener
// @grant        GM_info
// @grant        unsafeWindow
// @run-at       document-start
// @updateURL    https://github.com/AHCorn/Bilibili-Auto-Quality/raw/main/Bilibili-Auto-Quality.user.js
// @downloadURL  https://github.com/AHCorn/Bilibili-Auto-Quality/raw/main/Bilibili-Auto-Quality.user.js
// ==/UserScript==

"use strict";
(() => {
  // src/env.ts
  var UNKNOWN_IDENTITY = "未知";
  function readScriptEnv() {
    try {
      if (typeof GM_info !== "undefined" && GM_info) {
        return {
          handler: typeof GM_info.scriptHandler === "string" && GM_info.scriptHandler ? GM_info.scriptHandler : UNKNOWN_IDENTITY,
          handlerVersion: typeof GM_info.version === "string" ? GM_info.version : "",
          scriptVersion: GM_info.script && typeof GM_info.script.version === "string" ? GM_info.script.version : UNKNOWN_IDENTITY
        };
      }
    } catch (e) {
    }
    return {
      handler: UNKNOWN_IDENTITY,
      handlerVersion: "",
      scriptVersion: UNKNOWN_IDENTITY
    };
  }
  var SCRIPT_ENV = readScriptEnv();
  function scriptEnvLabel() {
    return SCRIPT_ENV.handlerVersion ? `${SCRIPT_ENV.handler} ${SCRIPT_ENV.handlerVersion}` : SCRIPT_ENV.handler;
  }
  var missingStorageApis = [
    ["GM_getValue", typeof GM_getValue === "function"],
    ["GM_setValue", typeof GM_setValue === "function"],
    ["GM_addStyle", typeof GM_addStyle === "function"]
  ].filter(([, available]) => !available).map(([name]) => name);
  if (missingStorageApis.length > 0) {
    console.error(
      `[环境检查] 当前脚本管理器未提供同步 GM 存储 API，缺少：${missingStorageApis.join("、")}。请使用 Tampermonkey 或 Violentmonkey。`
    );
  }
  var fellBack = typeof unsafeWindow === "undefined";
  if (fellBack) {
    globalThis.unsafeWindow = window;
  }
  var pageWindowBridge = {
    bridged: fellBack ? false : unsafeWindow === window ? null : true,
    fellBack,
    detail: fellBack ? "未取得（脚本管理器未提供 unsafeWindow，已回退脚本自身 window）" : unsafeWindow === window ? "unsafeWindow 与脚本 window 是同一对象" : "已取得页面真实 window"
  };
  if (pageWindowBridge.bridged === false) {
    console.warn(
      "[环境检查] 未取得页面真实 window，已回退到脚本自身 window；在隔离上下文中播放器接口、防后台降画质与 UA 修改可能无法生效。"
    );
  }

  // src/contract.ts
  var BILI = {
    // 视频页播放器（bpx）
    video: {
      qualityMenu: ".bpx-player-ctrl-quality-menu",
      qualityMenuItem: ".bpx-player-ctrl-quality-menu-item, .bpx-player-ctrl-quality-vip-vision-group-item, .bpx-player-ctrl-quality-vip-vision-group-single-item, .bpx-player-ctrl-quality-vip-vision-menu-item",
      activeQualityText: ".bpx-player-ctrl-quality-menu-item.bpx-state-active .bpx-player-ctrl-quality-text, .bpx-player-ctrl-quality-vip-vision-group-item.bpx-state-active .bpx-player-ctrl-quality-vip-vision-group-item-text, .bpx-player-ctrl-quality-vip-vision-group-single-item .bpx-player-ctrl-quality-vip-vision-group-single-item-title.bpx-state-active ~ .bpx-player-ctrl-quality-vip-vision-group-single-item-subtitle, .bpx-player-ctrl-quality-vip-vision-menu-item.bpx-state-active .bpx-player-ctrl-quality-vip-vision-menu-item-text",
      activeMenuItem: ".bpx-player-ctrl-quality-menu-item.bpx-state-active, .bpx-player-ctrl-quality-vip-vision-group-item.bpx-state-active, .bpx-player-ctrl-quality-vip-vision-menu-item.bpx-state-active, .bpx-player-ctrl-quality-vip-vision-group-single-item:has(.bpx-state-active)",
      qualityText: ".bpx-player-ctrl-quality-text, .bpx-player-ctrl-quality-vip-vision-group-item-text, .bpx-player-ctrl-quality-vip-vision-group-single-item-subtitle, .bpx-player-ctrl-quality-vip-vision-menu-item-text",
      vipBadge: ".bpx-player-ctrl-quality-badge-bigvip, .bpx-player-ctrl-quality-vip-vision-badge",
      vipVisionGroupItemClass: "bpx-player-ctrl-quality-vip-vision-group-item",
      vipVisionGroupTitle: ".bpx-player-ctrl-quality-vip-vision-group-item-title",
      vipVisionHdrIcon: ".bpx-player-vip-vision-hdr10-icon",
      vipVisionDolbyIcon: ".bpx-player-vip-vision-dolby-icon",
      qualityCtrl: ".bpx-player-ctrl-quality",
      qualityCtrlButton: ".bpx-player-ctrl-btn.bpx-player-ctrl-quality",
      controlWrap: ".bpx-player-control-wrap",
      flacButton: ".bpx-player-ctrl-flac",
      dolbyButton: ".bpx-player-ctrl-dolby",
      wideButton: ".bpx-player-ctrl-wide",
      wideEnterIcon: ".bpx-player-ctrl-wide-enter",
      menuActiveClass: "bpx-state-active",
      ctrlActiveClass: "bpx-state-active",
      activeStateClass: "bpx-state-active",
      toastText: ".bpx-player-toast-text",
      toastItem: ".bpx-player-toast-item",
      toastCancel: ".bpx-player-toast-cancel",
      qnAttr: "data-value",
      autoQualityKeyword: "自动",
      ctrlBtnClass: "bpx-player-ctrl-btn",
      ctrlBtnIconClass: "bpx-player-ctrl-btn-icon",
      commonSvgIconClass: "bpx-common-svg-icon",
      playerRoot: "bilibili-player"
    },
    // 顶部栏登录态与会员图标
    header: {
      loginEntry: ".header-avatar-unlogin-entry, .header-avatar-unlogin-wrap, .go-login-btn, .header-login-entry",
      avatarWrap: ".header-avatar-wrap",
      bigVipIcon: ".bili-avatar-icon.bili-avatar-right-icon.bili-avatar-icon-big-vip",
      smallVipIcon: ".bili-avatar-icon.bili-avatar-right-icon.bili-avatar-icon-small-vip",
      bigVipIconClass: "bili-avatar-icon-big-vip",
      smallVipIconClass: "bili-avatar-icon-small-vip"
    },
    // 视频页编码单选框
    decode: {
      radioItem: ".bui-radio-wrap.bui-radio-button .bui-radio-item",
      radioText: ".bui-radio-text",
      radioInput: "input.bui-radio-input",
      defaultTextPattern: /默认|自动/
    },
    // 直播页选择器与画质映射
    live: {
      decodeList: ".YccudlUCmLKcUTg_yzKN",
      decodeItem: "li.HfodaIBaRC9NaglgykBX",
      decodeSelectedClass: "fG2r2piYghHTQKQZF8bl",
      qnMap: {
        "1080P 原画": 1e4,
        "1080P 蓝光": 400,
        "720P 超清": 250
      }
    },
    // 播放器 Toast 提示文案匹配
    toast: {
      weakNetPattern: /卡顿，试试切换到|网速较慢|网络质量不佳|网络不佳/,
      switchFailPattern: /切换失败/
    },
    // 画质菜单角标文案
    badge: {
      trialKeywords: ["限免中", "试用中", "可试用", "限时体验", "试用"],
      vipKeyword: "大会员"
    },
    // 播放器对象接口与字段名
    facade: {
      playbackLagEvent: "PLAYER_PLAYBACK_LAG",
      video: {
        windowKey: "player",
        methods: {
          getQuality: "getQuality",
          requestQuality: "requestQuality",
          on: "on",
          off: "off"
        },
        toastKey: "toast",
        toastCreate: "create",
        qualityFields: {
          nowQ: "nowQ",
          newQ: "newQ",
          realQ: "realQ"
        }
      },
      live: {
        windowKey: "livePlayer",
        methods: {
          getPlayerInfo: "getPlayerInfo",
          switchQuality: "switchQuality",
          updateDMSetting: "updateDMSetting"
        },
        infoFields: {
          playurl: "playurl",
          quality: "quality",
          qualityCandidates: "qualityCandidates",
          danmaku: "danmaku"
        },
        candidateFields: {
          qn: "qn",
          desc: "desc"
        },
        danmakuDisplayKey: "display"
      }
    },
    // 解锁相关 localStorage 键名
    storage: {
      forceHdrKey: "bilibili_player_force_hdr",
      markerBaseKey: "bilibili_player_force_DolbyAtmos&8K",
      markerHdrSuffix: "&HDR"
    },
    api: {
      vipInfo: "https://api.bilibili.com/x/vip/web/user/info"
    },
    liveHost: "live.bilibili.com"
  };

  // src/settings.ts
  var PROD_DOUBLE_CHECK_DELAY_MS = 5e3;
  var PROD_AUDIO_DELAY_MS = 4e3;
  var PROD_AUDIO_RETRIES = 2;
  var SETTINGS = {
    hiResAudioEnabled: { key: "hiResAudio", def: false },
    dolbyAtmosEnabled: { key: "dolbyAtmos", def: false },
    userQualitySetting: { key: "qualitySetting", def: "最高画质" },
    useHighestQualityFallback: { key: "useHighestQualityFallback", def: true },
    customSortEnabled: { key: "customSortEnabled", def: false },
    customQualityOrder: { key: "customQualityOrder", def: null },
    takeOverQualityControl: { key: "takeOverQualityControl", def: false },
    unlockUA: { key: "unlockUA", def: false },
    unlockHDR: { key: "unlockHDR", def: false },
    unlockMarker: { key: "unlockMarker", def: true },
    disableHDROption: { key: "disableHDR", def: false },
    preventBackgroundDegrade: { key: "preventBackgroundDegrade", def: true },
    liveAutoRecoverOnVisible: { key: "liveAutoRecoverOnVisible", def: false },
    userLiveQualitySetting: { key: "liveQualitySetting", def: "最高画质" },
    // 直播解码历史上存过"硬解"等站方文本，不设 enum 以免洗掉存量设置
    userLiveDecodeSetting: { key: "liveDecodeSetting", def: "默认" },
    userVideoDecodeSetting: { key: "videoDecodeSetting", def: "默认", enum: ["默认", "AV1", "HEVC", "AVC"] },
    decodeSettingEnabled: { key: "decodeSettingEnabled", def: false },
    devModeEnabled: { key: "devModeEnabled", def: false },
    devModeVipStatus: { key: "devModeVipStatus", def: "默认", enum: ["默认", "普通", "会员"] },
    devModeNoLoginStatus: { key: "devModeNoLoginStatus", def: false },
    preserveTouchPoints: { key: "preserveTouchPoints", def: false },
    devModeAudioRetries: { key: "devModeAudioRetries", def: PROD_AUDIO_RETRIES, min: 0, max: 5, int: true },
    devModeAudioDelay: { key: "devModeAudioDelay", def: PROD_AUDIO_DELAY_MS, min: 500, max: 1e4, int: true },
    devDoubleCheckDelay: { key: "devDoubleCheckDelay", def: PROD_DOUBLE_CHECK_DELAY_MS, min: 1e3, max: 2e4, int: true },
    devAllowFreeVipQualities: { key: "devAllowFreeVipQualities", def: false },
    adaptiveQualityEnabled: { key: "adaptiveQualityEnabled", def: false },
    adaptiveQualitySensitivity: { key: "adaptiveQualitySensitivity", def: "标准", enum: ["灵敏", "标准", "保守"] },
    panelThemeOverride: { key: "panelThemeOverride", def: "", enum: ["", "light", "dark"] },
    injectQualityButton: { key: "injectQualityButton", def: true },
    qualityDoubleCheck: { key: "qualityDoubleCheck", def: true },
    liveQualityDoubleCheck: { key: "liveQualityDoubleCheck", def: true },
    liveQualityPollingEnabled: { key: "liveQualityPollingEnabled", def: false },
    livePollingInterval: { key: "livePollingInterval", def: 60, min: 5, max: 3600, int: true },
    liveKeepAliveEnabled: { key: "liveKeepAliveEnabled", def: false },
    liveKeepAliveInterval: { key: "liveKeepAliveInterval", def: 60, min: 1, max: 1440, int: true },
    autoWidescreen: { key: "autoWidescreen", def: false },
    liveDanmakuSync: { key: "liveDanmakuSync", def: false }
  };
  function briefValue(value) {
    if (typeof value === "string") return value.length > 40 ? `"${value.slice(0, 40)}…"` : `"${value}"`;
    if (value === null || value === void 0 || typeof value !== "object") return String(value);
    return Object.prototype.toString.call(value);
  }
  function normalizeSetting(name, value) {
    const spec = SETTINGS[name];
    if (!spec) {
      console.error("[设置] 未注册的设置项:", name);
      return value;
    }
    if (spec.def === null) return value;
    if (value === void 0 || value === null || typeof value !== typeof spec.def) {
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
      const rounded = spec.int ? Math.round(value) : value;
      if (spec.min !== void 0 && rounded < spec.min) {
        console.warn(`[设置] ${name} 的值 ${briefValue(value)} 低于下限 ${spec.min}，已夹取为 ${spec.min}`);
        return spec.min;
      }
      if (spec.max !== void 0 && rounded > spec.max) {
        console.warn(`[设置] ${name} 的值 ${briefValue(value)} 高于上限 ${spec.max}，已夹取为 ${spec.max}`);
        return spec.max;
      }
      return rounded;
    }
    return value;
  }
  function writeStorage(name, value) {
    try {
      GM_setValue(SETTINGS[name].key, value);
      return true;
    } catch (e) {
      console.error(`[设置] ${name} 写入存储失败，本次修改未能保存:`, e);
      return false;
    }
  }
  var storageSchemaAhead = false;
  function loadSetting(name) {
    const spec = SETTINGS[name];
    if (!spec) {
      console.error("[设置] 未注册的设置项:", name);
      return void 0;
    }
    const raw = GM_getValue(spec.key, spec.def);
    const normalized = normalizeSetting(name, raw);
    if (normalized !== raw && !storageSchemaAhead) writeStorage(name, normalized);
    return normalized;
  }
  function setSetting(name, value) {
    if (!SETTINGS[name]) {
      console.error("[设置] 未注册的设置项:", name);
      return false;
    }
    const normalized = normalizeSetting(name, value);
    const target = state;
    const previous = target[name];
    target[name] = normalized;
    if (!writeStorage(name, normalized)) {
      target[name] = previous;
      return false;
    }
    return true;
  }
  var SCHEMA_VERSION = 1;
  var SCHEMA_KEY = "schemaVersion";
  var SCHEMA_FAILURE_KEY = "schemaMigrationFailures";
  var MAX_MIGRATION_FAILURES = 3;
  var MIGRATIONS = [];
  function readVersionCounter(key) {
    const raw = GM_getValue(key, 0);
    return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  }
  function stampVersion(version) {
    try {
      GM_setValue(SCHEMA_KEY, version);
    } catch (e) {
      console.error("[设置] 配置版本戳写入失败，下次加载会重跑本轮迁移:", e);
    }
  }
  function stampFailures(count) {
    try {
      GM_setValue(SCHEMA_FAILURE_KEY, count);
    } catch (e) {
    }
  }
  function runMigrations() {
    let from = readVersionCounter(SCHEMA_KEY);
    if (from > SCHEMA_VERSION) {
      storageSchemaAhead = true;
      console.warn(`[设置] 存储中的配置版本 v${from} 高于本版脚本的 v${SCHEMA_VERSION}，跳过迁移。多半是本机装过更新的版本，本版只按自己认识的键读写，不改动存储`);
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
        console.error(`[设置] 该步已连续失败 ${failures} 次，强制推进版本戳跳过它，以免每次加载都重跑同一步；这一步涉及的设置项将保持旧值`);
      }
      from = step.to;
      if (failures !== 0) {
        failures = 0;
        stampFailures(0);
      }
      stampVersion(from);
    }
    if (from !== SCHEMA_VERSION) stampVersion(SCHEMA_VERSION);
  }
  runMigrations();
  function debugTransient(e) {
    if (state.devModeEnabled) console.debug("[瞬态异常]", e);
  }
  var state = {
    // customQualityOrder 此处为原始值，随后由 loadCustomOrder 规范化
    ...Object.fromEntries(Object.keys(SETTINGS).map((name) => [name, loadSetting(name)])),
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
  };
  function getDoubleCheckConfig(isLive) {
    const enabled = state.devModeEnabled ? isLive ? state.liveQualityDoubleCheck : state.qualityDoubleCheck : true;
    const delayMs = state.devModeEnabled ? state.devDoubleCheckDelay : PROD_DOUBLE_CHECK_DELAY_MS;
    return { enabled, delayMs };
  }
  function checkIfLivePage() {
    state.isLivePage = window.location.protocol === "file:" ? window.location.pathname.includes(BILI.liveHost) : window.location.hostname === BILI.liveHost;
  }

  // src/visibility.ts
  var VISIBILITY_PROPS = ["visibilityState", "hidden", "webkitVisibilityState", "webkitHidden"];
  var HIJACKED_VALUES = {
    visibilityState: "visible",
    hidden: false,
    webkitVisibilityState: "visible",
    webkitHidden: false
  };
  var nativeVisibilityStateGetter = (() => {
    try {
      const desc = Object.getOwnPropertyDescriptor(unsafeWindow.Document.prototype, "visibilityState");
      return desc && desc.get ? desc.get : null;
    } catch (e) {
      console.warn("[防后台降画质] 原生 visibilityState getter 捕获失败:", e);
      return null;
    }
  })();
  var hijackEnabled = false;
  function getRealVisibilityState() {
    try {
      if (nativeVisibilityStateGetter) return nativeVisibilityStateGetter.call(unsafeWindow.document);
    } catch (e) {
      debugTransient(e);
    }
    return hijackEnabled ? null : document.visibilityState;
  }
  var originalVisibilityDescriptors = null;
  function consequenceOf() {
    if (!hijackEnabled) return "真实可见性可正常读取。";
    return nativeVisibilityStateGetter ? "真实可见性仍可经原生 getter 读取。" : "真实可见性已不可读，切回前台的相关逻辑将不再触发。";
  }
  function applyVisibilityHijack(enable) {
    try {
      const proto = unsafeWindow.Document.prototype;
      if (enable) {
        hijackEnabled = true;
        if (!originalVisibilityDescriptors) {
          originalVisibilityDescriptors = {};
          for (const p of VISIBILITY_PROPS) originalVisibilityDescriptors[p] = Object.getOwnPropertyDescriptor(proto, p);
        }
        for (const p of VISIBILITY_PROPS) {
          if (!originalVisibilityDescriptors[p]) continue;
          const lie = HIJACKED_VALUES[p];
          Object.defineProperty(proto, p, { configurable: true, enumerable: true, get: () => lie });
        }
        console.log("[防后台降画质] 已启用");
      } else if (originalVisibilityDescriptors) {
        const failed = [];
        for (const p of VISIBILITY_PROPS) {
          try {
            if (originalVisibilityDescriptors[p]) Object.defineProperty(proto, p, originalVisibilityDescriptors[p]);
            else delete proto[p];
          } catch (e) {
            failed.push(p);
            debugTransient(e);
          }
        }
        const nowDesc = Object.getOwnPropertyDescriptor(proto, "visibilityState");
        const nativeDesc = originalVisibilityDescriptors["visibilityState"];
        hijackEnabled = !!(nowDesc && nowDesc.get && nowDesc.get !== (nativeDesc && nativeDesc.get));
        const unrestored = failed.length > 0 ? failed : hijackEnabled ? ["visibilityState"] : [];
        if (unrestored.length === 0) console.log("[防后台降画质] 已关闭");
        else console.warn(`[防后台降画质] 已关闭，但 ${unrestored.join("、")} 未能还原。${consequenceOf()}`);
      }
    } catch (e) {
      console.warn("[防后台降画质] 切换失败:", e, consequenceOf());
    }
  }

  // src/unlock-env.ts
  var SAFARI_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";
  var SAFARI_PLATFORM = "MacIntel";
  var SAFARI_VENDOR = "Apple Computer, Inc.";
  var UNLOCK_BACKUP_KEY = "__baqUnlockBackup";
  var ORIGIN_SEP = "|";
  var MARKER_VALUE = "1";
  function currentOrigin() {
    return window.location.origin || window.location.protocol;
  }
  function backupKeyFor(key) {
    return currentOrigin() + ORIGIN_SEP + key;
  }
  function toMarkerRecord(value) {
    if (typeof value === "string") return { original: value, written: true };
    if (value && typeof value === "object" && !Array.isArray(value) && "original" in value) {
      const record = value;
      return { original: typeof record.original === "string" ? record.original : null, written: record.written === true };
    }
    return { original: null, written: true };
  }
  function readMarkerBackup() {
    const raw = GM_getValue(UNLOCK_BACKUP_KEY, null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const backup = {};
    const legacy = {};
    for (const [key, value] of Object.entries(raw)) {
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
  function persistBackup(delta) {
    const merged = readMarkerBackup();
    delta.forEach((record, key) => {
      if (record === void 0) {
        delete merged[key];
        return;
      }
      const existing = merged[key];
      merged[key] = existing ? { original: existing.original, written: existing.written || record.written } : record;
    });
    GM_setValue(UNLOCK_BACKUP_KEY, merged);
    return readMarkerBackup();
  }
  function releaseMarkerKey(key, record) {
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
  function claimMarkerKey(key, backupKey, backup, delta) {
    delta.set(backupKey, { original: window.localStorage.getItem(key), written: false });
    let stored;
    let failure;
    try {
      stored = persistBackup(delta)[backupKey];
    } catch (e) {
      failure = e;
    }
    if (!stored) {
      delta.delete(backupKey);
      console.warn(`[解锁设置] ${key} 的原值未能存入备份，本次不写入站方标记（改了就再也还不回去），解锁开关仍开启时下次加载会重试:`, failure ?? "落盘后回读不到该条目");
      return null;
    }
    backup[backupKey] = stored;
    return stored;
  }
  function applyMarkerKey(key, enabled, backup, delta, released) {
    const backupKey = backupKeyFor(key);
    const record = backup[backupKey];
    if (enabled) {
      const claimed = record ?? claimMarkerKey(key, backupKey, backup, delta);
      if (!claimed) return;
      window.localStorage.setItem(key, MARKER_VALUE);
      if (!claimed.written && window.localStorage.getItem(key) === MARKER_VALUE) {
        const confirmed = { original: claimed.original, written: true };
        backup[backupKey] = confirmed;
        delta.set(backupKey, confirmed);
      }
    } else if (record) {
      released.push(releaseMarkerKey(key, record));
      delete backup[backupKey];
      delta.set(backupKey, void 0);
    }
  }
  function otherOriginsIn(backup) {
    const here = currentOrigin();
    const origins = [];
    for (const composite of Object.keys(backup)) {
      const sep = composite.indexOf(ORIGIN_SEP);
      if (sep <= 0) continue;
      const origin = composite.slice(0, sep);
      if (origin !== here && origins.indexOf(origin) < 0) origins.push(origin);
    }
    return origins;
  }
  function syncMarkerKeys(unlockHDR, unlockMarker) {
    const markerBaseKey = BILI.storage.markerBaseKey;
    const markerHdrKey = markerBaseKey + BILI.storage.markerHdrSuffix;
    const backup = readMarkerBackup();
    const delta = /* @__PURE__ */ new Map();
    const released = [];
    applyMarkerKey(BILI.storage.forceHdrKey, unlockHDR, backup, delta, released);
    applyMarkerKey(markerHdrKey, unlockMarker && unlockHDR, backup, delta, released);
    applyMarkerKey(markerBaseKey, unlockMarker && !unlockHDR, backup, delta, released);
    const latest = delta.size > 0 ? persistBackup(delta) : backup;
    return { released, pendingOrigins: otherOriginsIn(latest) };
  }
  function defineSpoof(nav, prop, value, lock) {
    Object.defineProperty(nav, prop, { get: () => value, configurable: !lock });
  }
  function isLockedTo(nav, prop, value) {
    const desc = Object.getOwnPropertyDescriptor(nav, prop);
    return !!desc && !desc.configurable && Reflect.get(nav, prop) === value;
  }
  function rollbackSpoof(nav, applied) {
    const failed = [];
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
  function spoofNavigatorIdentity(nav) {
    const spoofs = [
      ["userAgent", SAFARI_UA],
      ["platform", SAFARI_PLATFORM],
      ["vendor", SAFARI_VENDOR],
      ["appVersion", SAFARI_UA.replace(/^Mozilla\//, "")]
    ];
    const applied = /* @__PURE__ */ new Map();
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
    const unlocked = [];
    for (const [prop, value] of spoofs) {
      if (isLockedTo(nav, prop, value)) continue;
      try {
        defineSpoof(nav, prop, value, true);
      } catch (e) {
        unlocked.push(prop);
        debugTransient(e);
      }
    }
    if (unlocked.length > 0) console.warn(`[解锁设置] ${unlocked.join("、")} 属性未能锁定`);
    return true;
  }
  function reportSpoofResult(nav) {
    const appliedUA = nav.userAgent;
    const appliedPlatform = nav.platform;
    if (appliedUA !== SAFARI_UA || appliedPlatform !== SAFARI_PLATFORM) {
      console.warn(`[解锁设置] UA 或平台标识修改未生效，回读仍为: ${appliedUA} / ${appliedPlatform}`);
      return;
    }
    console.log("[解锁设置] UA 和平台标识修改成功");
  }
  function applyUnlockEnvironment() {
    try {
      const { released, pendingOrigins } = syncMarkerKeys(state.unlockHDR, state.unlockMarker);
      if (released.length > 0) console.log(`[解锁设置] 已清理本地解锁标记: ${released.join("；")}`);
      if (released.length > 0 && pendingOrigins.length > 0) {
        console.log(`[解锁设置] 另有 ${pendingOrigins.length} 个站点仍有本脚本的标记（${pendingOrigins.join("、")}），在那些站点上加载一次页面即会自动清掉，无需手动操作`);
      }
    } catch (e) {
      console.warn("[解锁设置] 写入本地标记失败:", e);
    }
    function detectPointerType() {
      try {
        const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
        const hasCoarsePointer = window.matchMedia("(any-pointer: coarse)").matches;
        const anyHover = window.matchMedia("(any-hover: hover)").matches;
        const supportsTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
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
          if (!isLockedTo(unsafeWindow.navigator, "maxTouchPoints", 0)) {
            defineSpoof(unsafeWindow.navigator, "maxTouchPoints", 0, true);
          }
          console.log("[解锁设置] 纯鼠标设备，已设置 maxTouchPoints 为 0");
        } else {
          const keepReason = !pointerType.detected ? "设备检测失败" : pointerType.isTouchDevice ? "检测到触控设备" : "无精确鼠标指针";
          console.log(`[解锁设置] 保留 maxTouchPoints 原值: ${navigator.maxTouchPoints}，原因: ${keepReason}`);
        }
      }
    } catch (error) {
      console.error("[解锁设置] 修改 UA 或 maxTouchPoints 失败:", error);
    }
  }

  // src/styles.ts
  function applyStyles() {
    GM_addStyle(`
    #bilibili-quality-selector, #bilibili-live-quality-selector, #bilibili-dev-settings, #bilibili-unlock-settings, #bilibili-decode-settings {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: #f0f3f6;
        border-radius: 24px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.14), 0 8px 24px rgba(0, 0, 0, 0.10);
        padding: 30px;
        width: 90%;
        max-width: 400px;
        max-height: 85vh;
        overflow-y: auto;
        overflow-x: hidden;
        display: none;
        z-index: 10000;
        font-family: 'Segoe UI', 'Roboto', sans-serif;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    #bilibili-quality-selector button, #bilibili-quality-selector input,
    #bilibili-live-quality-selector button, #bilibili-live-quality-selector input,
    #bilibili-dev-settings button, #bilibili-dev-settings input,
    #bilibili-unlock-settings button, #bilibili-unlock-settings input,
    #bilibili-decode-settings button, #bilibili-decode-settings input {
        font-family: inherit;
    }
    #bilibili-quality-selector, #bilibili-live-quality-selector, #bilibili-dev-settings {
        max-width: 760px;
    }
    .baq-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px 16px;
        margin-bottom: 20px;
    }
    .baq-header h2 {
        margin: 0 !important;
        text-align: left !important;
    }
    .baq-header-right {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
    }
    .baq-header .baq-status-bar {
        margin: 0;
    }
    .baq-theme-anim,
    .baq-theme-anim h2,
    .baq-theme-anim label,
    .baq-theme-anim input,
    .baq-theme-anim .baq-section-title,
    .baq-theme-anim .baq-beta-tag,
    .baq-theme-anim .baq-title-note,
    .baq-theme-anim .baq-theme-toggle,
    .baq-theme-anim .baq-status-bar,
    .baq-theme-anim .baq-dev-warning-pill,
    .baq-theme-anim .baq-toggle-switch,
    .baq-theme-anim .baq-input-group,
    .baq-theme-anim .baq-sens-section,
    .baq-theme-anim .baq-sens-label,
    .baq-theme-anim .baq-vip-status-section,
    .baq-theme-anim .baq-vip-status-title,
    .baq-theme-anim .baq-vip-status-description,
    .baq-theme-anim .baq-vip-status-tabs,
    .baq-theme-anim .baq-vip-status-tab,
    .baq-theme-anim .baq-description,
    .baq-theme-anim .baq-sublabel,
    .baq-theme-anim .baq-cq-hint,
    .baq-theme-anim .baq-cq-rank,
    .baq-theme-anim .baq-slider,
    .baq-theme-anim .baq-action-button,
    .baq-theme-anim .baq-quality-button,
    .baq-theme-anim .baq-live-quality-button,
    .baq-theme-anim .baq-decode-option,
    .baq-theme-anim .baq-decode-badge,
    .baq-theme-anim .baq-decode-desc,
    .baq-theme-anim .baq-num-stepper,
    .baq-theme-anim .baq-ns-field,
    .baq-theme-anim .baq-ns-btn,
    .baq-theme-anim .baq-unit,
    .baq-theme-anim .baq-warning {
        transition: background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease;
    }
    .baq-theme-toggle {
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #4b5563;
        flex-shrink: 0;
        transition: color 0.2s ease;
    }
    .baq-theme-toggle:hover {
        color: #1f2937;
    }
    .baq-theme-toggle svg {
        width: 22px;
        height: 22px;
    }
    .baq-theme-toggle .baq-tm-core {
        transition: r 0.5s cubic-bezier(0.2, 0, 0, 1);
    }
    .baq-theme-toggle .baq-tm-hole {
        transition: cx 0.5s cubic-bezier(0.2, 0, 0, 1), cy 0.5s cubic-bezier(0.2, 0, 0, 1);
    }
    .baq-theme-toggle .baq-tm-rays {
        transform-origin: 12px 12px;
        opacity: 0;
        transform: rotate(-50deg) scale(0.55);
        transition: transform 0.5s cubic-bezier(0.2, 0, 0, 1), opacity 0.3s ease;
    }
    .baq-dark .baq-theme-toggle .baq-tm-core {
        r: 5px;
    }
    .baq-dark .baq-theme-toggle .baq-tm-hole {
        cx: 30px;
        cy: -8px;
    }
    .baq-dark .baq-theme-toggle .baq-tm-rays {
        opacity: 1;
        transform: rotate(0deg) scale(1);
    }
    .baq-dark .baq-theme-toggle {
        color: #b6bcc4;
    }
    .baq-dark .baq-theme-toggle:hover {
        color: #f1f3f4;
    }
    @media (prefers-reduced-motion: reduce) {
        .baq-theme-toggle .baq-tm-core,
        .baq-theme-toggle .baq-tm-hole,
        .baq-theme-toggle .baq-tm-rays {
            transition: none;
        }
    }
    .baq-header .baq-github-link {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        margin-right: -2px;
    }
    .baq-columns {
        display: grid;
        grid-template-columns: 7fr 6fr;
        gap: 0 28px;
        align-items: stretch;
    }
    .baq-columns.baq-even {
        grid-template-columns: 1fr 1fr;
    }
    .baq-col {
        display: flex;
        flex-direction: column;
    }
    .baq-section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 700;
        color: #8a94a6;
        letter-spacing: 2px;
        margin: 2px 2px 10px;
    }
    .baq-section-title::after {
        content: "";
        flex: 1;
        height: 1px;
        background: rgba(60, 64, 67, 0.10);
        order: 1;
        min-width: 16px;
    }
    .baq-col > .baq-section-title:not(:first-child) {
        margin-top: 24px;
    }
    .baq-group-last {
        margin-top: auto;
        padding-top: 24px;
    }
    .baq-col > :last-child,
    .baq-group-last > :last-child {
        margin-bottom: 0;
    }
    #bilibili-live-quality-selector .baq-columns .baq-toggle-switch,
    #bilibili-live-quality-selector .baq-columns .baq-input-group,
    #bilibili-dev-settings .baq-columns .baq-toggle-switch,
    #bilibili-dev-settings .baq-columns .baq-input-group {
        flex: 1 0 auto;
    }
    #bilibili-quality-selector #quality-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-bottom: 20px;
        flex: 1 1 auto;
        align-content: stretch;
    }
    #bilibili-quality-selector #quality-grid .baq-quality-button {
        padding: 15px 10px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    @media (max-width: 800px) {
        #bilibili-quality-selector, #bilibili-live-quality-selector, #bilibili-dev-settings {
            max-width: 400px;
        }
        .baq-columns, .baq-columns.baq-even {
            grid-template-columns: 1fr;
            gap: 0;
        }
        .baq-col + .baq-col {
            margin-top: 22px;
        }
    }
    .baq-vip-status-section {
        background: #ffffff;
        border-radius: 16px;
        padding: 15px;
        margin-bottom: 16px;
        border: 1px solid #e5e7eb;
        transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.02);
    }

    .baq-vip-status-title {
        font-size: 16px;
        color: #3c4043;
        font-weight: 600;
        margin-bottom: 4px;
    }
    .baq-vip-status-description {
        font-size: 13px;
        color: #666;
        margin-bottom: 12px;
        line-height: 1.4;
    }
    .baq-vip-status-tabs {
        display: flex;
        border-radius: 12px;
        background: #eef0f3;
        padding: 4px;
        position: relative;
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
    }
    .baq-vip-status-tabs.baq-disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }
    .baq-vip-tab-indicator {
        position: absolute;
        top: 4px;
        left: 4px;
        width: calc((100% - 8px) / 3);
        height: calc(100% - 8px);
        border-radius: 9px;
        background: #00a1d6;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.10);
        transition: transform 0.28s cubic-bezier(0.2, 0, 0, 1), background-color 0.28s ease, box-shadow 0.28s ease;
        z-index: 0;
    }
    .baq-vip-status-tab {
        flex: 1;
        padding: 8px;
        text-align: center;
        cursor: pointer;
        border-radius: 9px;
        transition: color 0.2s ease;
        color: #5f6368;
        font-weight: 600;
        font-size: 15px;
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        -webkit-user-select: none;
        user-select: none;
    }
    .baq-vip-status-tabs:not(.baq-disabled) .baq-vip-status-tab:not(.baq-active):hover {
        color: #3c4043;
    }
    .baq-vip-status-tabs.baq-disabled .baq-vip-status-tab {
        cursor: not-allowed;
    }
    .baq-vip-status-tabs[data-active="默认"] .baq-vip-tab-indicator { transform: translateX(0); background: #00a1d6; box-shadow: 0 1px 2px rgba(0, 161, 214, 0.30), 0 2px 8px rgba(0, 161, 214, 0.22); }
    .baq-vip-status-tabs[data-active="普通"] .baq-vip-tab-indicator { transform: translateX(100%); background: #6b7280; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.20), 0 2px 8px rgba(0, 0, 0, 0.12); }
    .baq-vip-status-tabs[data-active="会员"] .baq-vip-tab-indicator { transform: translateX(200%); background: #fb7299; box-shadow: 0 1px 2px rgba(251, 114, 153, 0.30), 0 2px 8px rgba(251, 114, 153, 0.24); }
    .baq-vip-status-tabs[data-active="默认"] .baq-vip-status-tab[data-status="默认"],
    .baq-vip-status-tabs[data-active="普通"] .baq-vip-status-tab[data-status="普通"],
    .baq-vip-status-tabs[data-active="会员"] .baq-vip-status-tab[data-status="会员"] { color: #fff; }
    .baq-sens-tabs[data-active="灵敏"] .baq-vip-tab-indicator { transform: translateX(0); background: #f28123; box-shadow: 0 1px 2px rgba(242, 129, 35, 0.30), 0 2px 8px rgba(242, 129, 35, 0.22); }
    .baq-sens-tabs[data-active="标准"] .baq-vip-tab-indicator { transform: translateX(100%); background: #00a1d6; box-shadow: 0 1px 2px rgba(0, 161, 214, 0.30), 0 2px 8px rgba(0, 161, 214, 0.22); }
    .baq-sens-tabs[data-active="保守"] .baq-vip-tab-indicator { transform: translateX(200%); background: #4aa877; box-shadow: 0 1px 2px rgba(74, 168, 119, 0.30), 0 2px 8px rgba(74, 168, 119, 0.22); }
    .baq-sens-tabs[data-active="灵敏"] .baq-vip-status-tab[data-status="灵敏"],
    .baq-sens-tabs[data-active="标准"] .baq-vip-status-tab[data-status="标准"],
    .baq-sens-tabs[data-active="保守"] .baq-vip-status-tab[data-status="保守"] { color: #fff; }
    .baq-sens-section {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 12px 15px 14px;
        margin-bottom: 12px;
        box-shadow: 0 0.5px 0 rgba(31, 41, 55, 0.05), 0 1px 2px rgba(31, 41, 55, 0.05), 0 3px 8px rgba(31, 41, 55, 0.04);
        transition: opacity 0.2s ease;
    }
    .baq-sens-section.baq-disabled { opacity: 0.55; }
    .baq-sens-section.baq-disabled .baq-vip-status-tab { cursor: not-allowed; }
    .baq-sens-section.baq-disabled .baq-vip-status-tabs.baq-disabled { opacity: 1; }
    .baq-sens-label {
        font-size: 15px;
        color: #3c4043;
        font-weight: 600;
        margin-bottom: 10px;
    }
    .baq-sens-section .baq-vip-status-tab { font-size: 14px; padding: 6px; }
    .baq-sublabel {
        display: block;
        font-size: 12px;
        color: #9aa0a6;
        font-weight: 400;
        margin-top: 2px;
        white-space: nowrap;
    }
    input:checked + .baq-slider.baq-smart {
        background-color: #00a1d6;
    }
    #adaptive-toggle-row[data-level="灵敏"] input:checked + .baq-slider.baq-smart { background-color: #f28123; }
    #adaptive-toggle-row[data-level="标准"] input:checked + .baq-slider.baq-smart { background-color: #00a1d6; }
    #adaptive-toggle-row[data-level="保守"] input:checked + .baq-slider.baq-smart { background-color: #4aa877; }
    #adaptive-toggle-row[data-level="灵敏"] input:focus-visible + .baq-slider.baq-smart { box-shadow: 0 0 0 3px rgba(242, 129, 35, 0.35); }
    #adaptive-toggle-row[data-level="保守"] input:focus-visible + .baq-slider.baq-smart { box-shadow: 0 0 0 3px rgba(74, 168, 119, 0.35); }
    .baq-toggle-switch.baq-disabled {
        opacity: 0.55;
        pointer-events: none;
    }
    #bilibili-quality-selector h2, #bilibili-live-quality-selector h2, #bilibili-dev-settings h2,
    #bilibili-unlock-settings h2, #bilibili-decode-settings h2 {
        color: #1f2937;
        font-size: 23px;
        font-weight: 700;
        letter-spacing: 0.5px;
    }
    .baq-quality-group {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
        gap: 12px;
        margin-bottom: 25px;
    }
    .baq-quality-button {
        background-color: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 10px 8px;
        font-size: 14px;
        color: #3c4043;
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: 600;
        text-align: center;
        box-shadow: 0 0.5px 0 rgba(31, 41, 55, 0.05), 0 1px 2px rgba(31, 41, 55, 0.05), 0 3px 8px rgba(31, 41, 55, 0.04);
    }
    .baq-quality-button:hover {
        background-color: #f7f9fb;
        transform: translateY(-2px);
        box-shadow: 0 0.5px 0 rgba(31, 41, 55, 0.05), 0 2px 4px rgba(31, 41, 55, 0.06), 0 6px 14px rgba(31, 41, 55, 0.07);
    }
    .baq-quality-button.baq-active {
        background-color: #f4fbfe;
        color: #0087b8;
        border-color: rgba(0, 161, 214, 0.62);
        box-shadow: inset 0 0 0 1px rgba(0, 161, 214, 0.55), 0 2px 8px rgba(0, 161, 214, 0.13);
    }
    .baq-quality-button.baq-active.baq-vip-quality {
        background-color: #fef6f9;
        color: #d94a7a;
        border-color: rgba(251, 114, 153, 0.58);
        box-shadow: inset 0 0 0 1px rgba(251, 114, 153, 0.50), 0 2px 8px rgba(251, 114, 153, 0.13);
    }
    .baq-quality-button.baq-active[data-quality="最高画质"] {
        color: #2a3441;
        border-color: rgba(122, 110, 200, 0.34);
        background-color: #fdfdfe;
        position: relative;
        overflow: hidden;
        box-shadow: 0 4px 14px rgba(140, 120, 210, 0.20);
    }
    .baq-quality-button.baq-active[data-quality="最高画质"]::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 60' preserveAspectRatio='none'%3E%3Cdefs%3E%3CradialGradient id='b1'%3E%3Cstop offset='0%25' stop-color='%2300a1d6' stop-opacity='0.62'/%3E%3Cstop offset='45%25' stop-color='%2300a1d6' stop-opacity='0.38'/%3E%3Cstop offset='100%25' stop-color='%2300a1d6' stop-opacity='0'/%3E%3C/radialGradient%3E%3CradialGradient id='b2'%3E%3Cstop offset='0%25' stop-color='%230d95c9' stop-opacity='0.42'/%3E%3Cstop offset='100%25' stop-color='%230d95c9' stop-opacity='0'/%3E%3C/radialGradient%3E%3CradialGradient id='p1'%3E%3Cstop offset='0%25' stop-color='%23fb7299' stop-opacity='0.58'/%3E%3Cstop offset='45%25' stop-color='%23fb7299' stop-opacity='0.34'/%3E%3Cstop offset='100%25' stop-color='%23fb7299' stop-opacity='0'/%3E%3C/radialGradient%3E%3CradialGradient id='p2'%3E%3Cstop offset='0%25' stop-color='%23f4649c' stop-opacity='0.4'/%3E%3Cstop offset='100%25' stop-color='%23f4649c' stop-opacity='0'/%3E%3C/radialGradient%3E%3Cfilter id='ink' x='-45%25' y='-45%25' width='190%25' height='190%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.02 0.05' numOctaves='3' seed='11' result='n'/%3E%3CfeDisplacementMap in='SourceGraphic' in2='n' scale='46' xChannelSelector='R' yChannelSelector='G'/%3E%3CfeGaussianBlur stdDeviation='1.1'/%3E%3C/filter%3E%3C/defs%3E%3Cg filter='url(%23ink)'%3E%3Cellipse cx='42' cy='16' rx='66' ry='32' fill='url(%23b1)'/%3E%3Cellipse cx='128' cy='56' rx='52' ry='26' fill='url(%23b2)'/%3E%3Cellipse cx='-6' cy='60' rx='44' ry='24' fill='url(%23b2)'/%3E%3C/g%3E%3Cg filter='url(%23ink)' style='mix-blend-mode:multiply'%3E%3Cellipse cx='152' cy='12' rx='62' ry='30' fill='url(%23p1)'/%3E%3Cellipse cx='50' cy='52' rx='46' ry='22' fill='url(%23p2)'/%3E%3Cellipse cx='96' cy='30' rx='30' ry='16' fill='url(%23p2)'/%3E%3Cellipse cx='206' cy='58' rx='42' ry='22' fill='url(%23p2)'/%3E%3C/g%3E%3C/svg%3E"),
            linear-gradient(118deg, rgba(0, 161, 214, 0.14) 0%, rgba(140, 112, 205, 0.10) 50%, rgba(251, 114, 153, 0.14) 100%);
        background-size: 100% 100%;
        -webkit-mask-image: radial-gradient(ellipse 60% 90% at 46% 52%, #000 52%, transparent 76%);
        mask-image: radial-gradient(ellipse 60% 90% at 46% 52%, #000 52%, transparent 76%);
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-position: 46% 52%;
        mask-position: 46% 52%;
        -webkit-mask-size: 340% 340%;
        mask-size: 340% 340%;
        animation: baq-ink-bloom 1.1s cubic-bezier(0.2, 0, 0.2, 1);
        pointer-events: none;
    }
    @keyframes baq-ink-bloom {
        from { opacity: 0; filter: blur(12px); -webkit-mask-size: 10% 14%; mask-size: 10% 14%; }
        30% { opacity: 1; }
        to { opacity: 1; filter: blur(0); -webkit-mask-size: 340% 340%; mask-size: 340% 340%; }
    }
    @media (prefers-reduced-motion: reduce) {
        .baq-quality-button.baq-active[data-quality="最高画质"]::before {
            animation: none;
        }
    }
    .baq-quality-button.baq-cq-grid-item {
        position: relative;
        will-change: transform;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
    }
    .baq-quality-button.baq-cq-grid-item:hover { transform: none; }
    .baq-cq-grid-item .baq-cq-rank {
        position: absolute;
        top: 4px;
        left: 7px;
        color: #64748b;
        font-size: 12px;
        font-weight: 800;
        opacity: 0;
        transform: scale(0.6);
        transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.2, 0, 0, 1);
        pointer-events: none;
        z-index: 2;
    }
    .baq-quality-group.baq-cq-dragging .baq-cq-grid-item .baq-cq-rank { opacity: 1; transform: scale(1); }
    .baq-cq-grid-item.baq-cq-vip .baq-cq-rank { color: #fb7299; }
    .baq-cq-grid-item.baq-cq-fallback {
        background: #f4fbfe;
        border-color: rgba(0, 161, 214, 0.50);
        color: #0087b8;
        box-shadow: inset 0 0 0 1px rgba(0, 161, 214, 0.32);
    }
    .baq-cq-grid-item .baq-cq-tag {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #00a1d6;
        font-size: 0;
        overflow: hidden;
        z-index: 2;
    }
    .baq-cq-grid-item.baq-cq-dimmed {
        opacity: 0.5;
        filter: grayscale(1);
    }
    .baq-cq-grid-item.baq-cq-dimmed .baq-cq-rank { color: #aeb4bb; }
    .baq-quality-button.baq-cq-grid-item.baq-cq-press { transform: scale(0.94); }
    .baq-cq-grid-item.baq-dragging {
        cursor: grabbing;
        z-index: 30;
        opacity: 1 !important;
        filter: none;
        box-shadow: 0 16px 32px rgba(0,0,0,0.20), 0 6px 16px rgba(0,0,0,0.12);
        transition: box-shadow 0.2s ease, background-color 0.2s ease, color 0.2s ease;
    }
    .baq-cq-hint {
        font-size: 12px;
        color: #8a9099;
        line-height: 1.5;
        margin: 2px 2px 18px;
        text-align: center;
        white-space: nowrap;
    }
    .baq-hint-collapse {
        display: grid;
        grid-template-rows: 1fr;
        transition: grid-template-rows 0.28s cubic-bezier(0.2, 0, 0, 1);
    }
    .baq-hint-collapse > .baq-hint-inner {
        overflow: hidden;
        min-height: 0;
        opacity: 1;
        transition: opacity 0.22s ease;
    }
    .baq-hint-collapse.baq-collapsed {
        grid-template-rows: 0fr;
    }
    .baq-hint-collapse.baq-collapsed > .baq-hint-inner {
        opacity: 0;
    }
    .baq-toggle-switch {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding: 10px 15px;
        border-radius: 12px;
        transition: background-color 0.2s ease, box-shadow 0.2s ease;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        box-shadow: 0 0.5px 0 rgba(31, 41, 55, 0.05), 0 1px 2px rgba(31, 41, 55, 0.05), 0 3px 8px rgba(31, 41, 55, 0.04);
    }
    .baq-toggle-switch:hover {
        background-color: #f7f9fb;
        box-shadow: 0 0.5px 0 rgba(31, 41, 55, 0.05), 0 2px 4px rgba(31, 41, 55, 0.06), 0 6px 14px rgba(31, 41, 55, 0.07);
    }
    .baq-toggle-switch label {
        font-size: 16px;
        color: #3c4043;
        font-weight: 600;
        cursor: pointer;
    }
    .baq-switch {
        position: relative;
        display: inline-block;
        width: 52px;
        height: 28px;
        flex-shrink: 0;
    }
    .baq-switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    .baq-slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background-color: #d1d5db;
        transition: background-color 0.25s ease, box-shadow 0.2s ease;
        border-radius: 999px;
    }
    .baq-slider:before {
        position: absolute;
        content: "";
        height: 22px;
        width: 22px;
        left: 3px;
        top: 3px;
        background-color: #fff;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.08);
        transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1);
        border-radius: 50%;
    }
    input:checked + .baq-slider {
        background-color: #00a1d6;
    }
    input:checked + .baq-slider.baq-vip-audio {
        background-color: #fb7299;
    }
    input:checked + .baq-slider:before {
        transform: translateX(24px);
    }
    input:focus-visible + .baq-slider {
        box-shadow: 0 0 0 3px rgba(0, 161, 214, 0.35);
    }
    input:focus-visible + .baq-slider.baq-vip-audio {
        box-shadow: 0 0 0 3px rgba(251, 114, 153, 0.35);
    }
    input:checked + .baq-slider.baq-c-cyan { background-color: #12a5a5; }
    input:focus-visible + .baq-slider.baq-c-cyan { box-shadow: 0 0 0 3px rgba(18, 165, 165, 0.35); }
    input:checked + .baq-slider.baq-c-green { background-color: #4aa877; }
    input:focus-visible + .baq-slider.baq-c-green { box-shadow: 0 0 0 3px rgba(74, 168, 119, 0.35); }
    input:checked + .baq-slider.baq-c-amber { background-color: #f5a04a; }
    input:focus-visible + .baq-slider.baq-c-amber { box-shadow: 0 0 0 3px rgba(245, 160, 74, 0.35); }
    input:checked + .baq-slider.baq-c-orange { background-color: #f56d00; }
    input:focus-visible + .baq-slider.baq-c-orange { box-shadow: 0 0 0 3px rgba(245, 109, 0, 0.35); }
    input:checked + .baq-slider.baq-c-red { background-color: #e25a57; }
    input:focus-visible + .baq-slider.baq-c-red { box-shadow: 0 0 0 3px rgba(226, 90, 87, 0.35); }
    input:disabled + .baq-slider {
        opacity: 0.5;
        cursor: not-allowed;
    }
    input:disabled + .baq-slider:before {
        box-shadow: none;
    }
    @keyframes baq-panel-in {
        from { opacity: 0; transform: translate(-50%, -47%) scale(0.965); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes baq-panel-out {
        from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        to { opacity: 0; transform: translate(-50%, -47.5%) scale(0.975); }
    }
    #bilibili-quality-selector.baq-show, #bilibili-live-quality-selector.baq-show, #bilibili-decode-settings.baq-show {
        display: block;
        animation: baq-panel-in 0.24s cubic-bezier(0.2, 0, 0, 1);
    }
    #bilibili-quality-selector.baq-show.baq-hiding, #bilibili-live-quality-selector.baq-show.baq-hiding, #bilibili-decode-settings.baq-show.baq-hiding,
    #bilibili-dev-settings.baq-show.baq-hiding, #bilibili-unlock-settings.baq-show.baq-hiding {
        animation: baq-panel-out 0.15s cubic-bezier(0, 0, 0.2, 1) forwards;
    }
    @media (prefers-reduced-motion: reduce) {
        #bilibili-quality-selector.baq-show, #bilibili-live-quality-selector.baq-show, #bilibili-decode-settings.baq-show,
        #bilibili-dev-settings.baq-show, #bilibili-unlock-settings.baq-show,
        #bilibili-quality-selector.baq-show.baq-hiding, #bilibili-live-quality-selector.baq-show.baq-hiding, #bilibili-decode-settings.baq-show.baq-hiding,
        #bilibili-dev-settings.baq-show.baq-hiding, #bilibili-unlock-settings.baq-show.baq-hiding {
            animation-duration: 0.01s;
        }
        .baq-status-bar.baq-loading::before {
            animation: none;
        }
    }
    .baq-status-bar {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        width: fit-content;
        padding: 6px 14px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 600;
        transition: background-color 0.3s ease, color 0.3s ease;
        box-shadow: none;
        border: 1px solid rgba(31, 41, 55, 0.08);
    }
    .baq-status-bar::before {
        content: "";
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
        flex-shrink: 0;
    }
    .baq-status-bar.baq-loading {
        background-color: #eef1f5;
        color: #8a94a6;
    }
    .baq-status-bar.baq-loading::before {
        animation: baq-dot-pulse 1.2s ease-in-out infinite;
    }
    @keyframes baq-dot-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.25; }
    }
    .baq-status-bar.baq-non-vip {
        background-color: #eef1f5;
        color: #5f6368;
    }
    .baq-status-bar.baq-vip {
        background-color: #fff1f5;
        color: #fb7299;
    }
    .baq-warning {
        background-color: #fce8e6;
        color: #d93025;
        padding: 10px;
        border-radius: 8px;
        margin-top: 12px;
        margin-bottom: 12px;
        text-align: center;
        font-weight: bold;
        transition: background-color 0.3s ease, color 0.3s ease;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.02);
    }
    /* 只改和基础面板不一样的部分 */
    #bilibili-dev-settings {
        background-color: #fbfcfd;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.16), 0 10px 28px rgba(0, 0, 0, 0.10);
        padding: 30px;
    }
    #bilibili-dev-settings.baq-show, #bilibili-unlock-settings.baq-show {
        display: block;
        animation: baq-panel-in 0.24s cubic-bezier(0.2, 0, 0, 1);
    }
    .baq-dev-warning-pill {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 6px 14px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 600;
        background: #fdf0ef;
        color: #d93025;
        border: 1px solid rgba(217, 48, 37, 0.18);
        white-space: nowrap;
    }
    .baq-dev-warning-pill::before {
        content: "";
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
        flex-shrink: 0;
    }
    .baq-toggle-switch .baq-description {
        font-size: 13px;
        color: #666;
        margin-top: 4px;
    }
    #bilibili-dev-settings .baq-toggle-switch label, #bilibili-unlock-settings .baq-toggle-switch label, #bilibili-live-quality-selector .baq-toggle-switch label {
        display: flex;
        flex-direction: column;
    }
    .baq-input-group {
        background: #ffffff;
        border-radius: 16px;
        padding: 15px;
        margin-bottom: 16px;
        border: 1px solid #e5e7eb;
        transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.02);
    }
    .baq-input-group.baq-disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .baq-input-group:hover {
        background: #f9fafb;
        border-color: #e1e7ef;
        box-shadow: 0 3px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.035);
    }
    .baq-input-group label {
        flex: 1;
        display: flex;
        flex-direction: column;
        color: #3c4043;
        font-weight: 600;
        font-size: 15px;
    }
    .baq-input-group .baq-description {
        font-size: 13px;
        color: #666;
        margin-top: 4px;
        font-weight: normal;
    }
    .baq-num-stepper {
        flex-shrink: 0;
        display: inline-flex;
        align-items: stretch;
        width: 168px;
        height: 40px;
        border: 1.5px solid #dadce0;
        border-radius: 10px;
        background: #ffffff;
        overflow: hidden;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .baq-num-stepper:focus-within {
        border-color: #00a1d6;
        box-shadow: 0 0 0 3px rgba(0, 161, 214, 0.18);
    }
    .baq-ns-btn {
        flex-shrink: 0;
        width: 38px;
        padding: 0;
        border: none;
        background: transparent;
        color: #5f6368;
        font-size: 20px;
        font-weight: 500;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s ease, color 0.15s ease;
        -webkit-user-select: none;
        user-select: none;
        touch-action: manipulation;
    }
    .baq-ns-btn:hover {
        background: #f1f3f4;
        color: #202124;
    }
    .baq-ns-btn:active {
        background: #e8eaed;
    }
    .baq-ns-btn:disabled {
        color: #c8ccd1;
        background: transparent;
        cursor: default;
    }
    .baq-input-group.baq-disabled .baq-ns-btn {
        pointer-events: none;
        color: #c8ccd1;
    }
    .baq-ns-field {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        padding: 0 6px;
        border-left: 1px solid #eceef1;
        border-right: 1px solid #eceef1;
    }
    .baq-ns-field input[type="number"] {
        width: 1ch;
        min-width: 1ch;
        max-width: 100%;
        border: none;
        outline: none;
        background: transparent;
        padding: 0;
        margin: 0;
        text-align: center;
        font-size: 14px;
        font-weight: 600;
        color: #3c4043;
        -moz-appearance: textfield;
        appearance: textfield;
    }
    .baq-ns-field input[type="number"]::-webkit-inner-spin-button,
    .baq-ns-field input[type="number"]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    .baq-ns-field .baq-unit {
        flex-shrink: 0;
        color: #9aa0a6;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
    }
    .baq-action-row {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }
    .baq-columns + .baq-section-title {
        margin-top: 24px;
    }
    .baq-action-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 15px;
        border-radius: 12px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        box-shadow: 0 0.5px 0 rgba(31, 41, 55, 0.05), 0 1px 2px rgba(31, 41, 55, 0.05), 0 3px 8px rgba(31, 41, 55, 0.04);
    }
    .baq-action-text {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
        min-width: 0;
    }
    .baq-action-label {
        font-size: 15px;
        font-weight: 500;
        color: #202124;
    }
    .baq-action-row .baq-description {
        font-size: 13px;
        color: #666;
        line-height: 1.4;
    }
    .baq-action-card .baq-action-button {
        flex: 0 0 auto;
        width: 112px;
        margin-top: 0;
    }
    .baq-action-button {
        padding: 8px 10px;
        border: 1px solid transparent;
        border-radius: 10px;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.4;
        white-space: nowrap;
        cursor: pointer;
        transition: background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease;
    }
    .baq-action-button.baq-action-secondary {
        background: #fff;
        border-color: #dadce0;
        color: #3c4043;
    }
    .baq-action-button.baq-action-secondary:hover {
        background: #f1f3f4;
    }
    .baq-action-button.baq-action-danger {
        background: rgba(214, 69, 69, 0.08);
        border-color: rgba(214, 69, 69, 0.30);
        color: #b23b3b;
    }
    .baq-action-button.baq-action-danger:hover {
        background: rgba(214, 69, 69, 0.14);
    }
    #bilibili-dev-settings .baq-action-primary,
    #bilibili-unlock-settings .baq-action-primary {
        width: 100%;
        padding: 12px;
        background: #00a1d6;
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-top: 20px;
    }
    #bilibili-dev-settings .baq-action-primary:hover {
        background: #0087b8;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 161, 214, 0.2);
    }
    #bilibili-unlock-settings .baq-action-primary:hover {
        background: #0090bd;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 161, 214, 0.2);
    }
    ${BILI.video.qualityCtrl}.baq-quality-button-hidden {
        display: none !important;
    }
    .baq-injected.baq-panel-entry::after {
        content: "画质设置";
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(21, 21, 21, 0.9);
        color: #fff;
        padding: 5px 8px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
        margin-bottom: 5px;
    }
    .baq-injected.baq-panel-entry:hover::after {
        opacity: 1;
    }
    .baq-injected.baq-panel-entry {
        width: 34px;
        position: relative;
        cursor: pointer;
    }
    .baq-injected.baq-panel-entry .${BILI.video.ctrlBtnIconClass} {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
    }
    .baq-injected.baq-panel-entry svg {
        width: 20px;
        height: 20px;
        transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
    }
    .baq-injected.baq-panel-entry:hover svg {
        transform: scale(1.12);
    }
    .baq-github-link {
        width: 24px;
        height: 24px;
        cursor: pointer;
        transition: transform 0.3s ease;
    }
    .baq-github-link:hover {
        transform: scale(1.1);
    }
    .baq-github-link svg {
        width: 100%;
        height: 100%;
        fill: #24292f;
    }
    .baq-live-quality-group {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-bottom: 20px;
    }
    #bilibili-live-quality-selector .baq-live-quality-group {
        grid-template-columns: 1fr;
        flex: 1 0 auto;
        align-content: start;
        gap: 10px;
    }
    #bilibili-live-quality-selector .baq-live-quality-button {
        padding: 13px 8px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .baq-live-quality-button {
        background-color: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 15px 8px;
        font-size: 15px;
        color: #3c4043;
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: 600;
        text-align: center;
        box-shadow: 0 0.5px 0 rgba(31, 41, 55, 0.05), 0 1px 2px rgba(31, 41, 55, 0.05), 0 3px 8px rgba(31, 41, 55, 0.04);
    }
    .baq-live-quality-button:hover {
        background-color: #f7f9fb;
        transform: translateY(-2px);
        box-shadow: 0 0.5px 0 rgba(31, 41, 55, 0.05), 0 2px 4px rgba(31, 41, 55, 0.06), 0 6px 14px rgba(31, 41, 55, 0.07);
    }

    .baq-status-bar.baq-vip { border-color: rgba(251, 114, 153, 0.22); }
    .baq-live-quality-button.baq-active {
        background-color: #f4fbfe;
        color: #0087b8;
        border-color: rgba(0, 161, 214, 0.62);
        box-shadow: inset 0 0 0 1px rgba(0, 161, 214, 0.55), 0 2px 8px rgba(0, 161, 214, 0.13);
    }
    #bilibili-live-quality-selector .baq-toggle-switch .baq-description {
        font-weight: normal;
    }
    .baq-beta-tag {
        font-size: 10px;
        font-weight: 700;
        color: #b0b8c4;
        letter-spacing: 1.5px;
    }
    #bilibili-decode-settings {
        max-width: 420px;
    }
    .baq-decode-group {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .baq-decode-option {
        display: flex;
        align-items: center;
        gap: 14px;
        background-color: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 13px 16px;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s ease;
        box-shadow: 0 0.5px 0 rgba(31, 41, 55, 0.05), 0 1px 2px rgba(31, 41, 55, 0.05), 0 3px 8px rgba(31, 41, 55, 0.04);
    }
    .baq-decode-option::after {
        content: "";
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        margin-left: auto;
        border-radius: 50%;
        border: 1.5px solid #d1d5db;
        box-sizing: border-box;
        transition: border-color 0.2s ease, background-color 0.2s ease;
    }
    .baq-decode-option.baq-active::after {
        border-color: #00a1d6;
        background-color: #00a1d6;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E");
        background-size: 11px 11px;
        background-position: center;
        background-repeat: no-repeat;
    }
    .baq-decode-option:hover {
        background-color: #f7f9fb;
        transform: translateY(-1px);
        box-shadow: 0 0.5px 0 rgba(31, 41, 55, 0.05), 0 2px 4px rgba(31, 41, 55, 0.06), 0 6px 14px rgba(31, 41, 55, 0.07);
    }
    .baq-decode-option:hover .baq-decode-badge {
        filter: saturate(1.2) brightness(0.97);
    }
    .baq-decode-option .baq-decode-badge {
        width: 58px;
        padding: 5px 0;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        text-align: center;
        letter-spacing: 0.5px;
        flex-shrink: 0;
        transition: background-color 0.2s ease, color 0.2s ease, filter 0.2s ease;
    }
    .baq-decode-option .baq-decode-badge[data-codec="默认"] { background: rgba(0, 161, 214, 0.12); color: #0087b8; }
    .baq-decode-option .baq-decode-badge[data-codec="AV1"] { background: rgba(140, 112, 205, 0.14); color: #7a63c9; }
    .baq-decode-option .baq-decode-badge[data-codec="HEVC"] { background: rgba(18, 165, 165, 0.12); color: #0e8c8c; }
    .baq-decode-option .baq-decode-badge[data-codec="AVC"] { background: rgba(245, 160, 74, 0.16); color: #c47b28; }
    .baq-decode-option .baq-decode-desc {
        font-size: 13px;
        color: #6b7280;
        white-space: nowrap;
    }
    .baq-decode-option.baq-active {
        background-color: #f4fbfe;
        border-color: rgba(0, 161, 214, 0.62);
        box-shadow: inset 0 0 0 1px rgba(0, 161, 214, 0.55), 0 2px 8px rgba(0, 161, 214, 0.13);
    }
    .baq-decode-option.baq-active .baq-decode-badge[data-codec="默认"] { background: #00a1d6; color: #fff; }
    .baq-decode-option.baq-active .baq-decode-badge[data-codec="AV1"] { background: #8c70d2; color: #fff; }
    .baq-decode-option.baq-active .baq-decode-badge[data-codec="HEVC"] { background: #12a5a5; color: #fff; }
    .baq-decode-option.baq-active .baq-decode-badge[data-codec="AVC"] { background: #f5a04a; color: #fff; }
    .baq-decode-option.baq-active .baq-decode-desc {
        color: #3c4043;
    }
    .baq-dark .baq-decode-option {
        background-color: #2b2f34;
        border-color: rgba(255, 255, 255, 0.07);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.30), 0 3px 8px rgba(0, 0, 0, 0.22);
    }
    .baq-dark .baq-decode-option:hover {
        background-color: #33383e;
    }
    .baq-dark .baq-decode-option .baq-decode-badge[data-codec="默认"] { background: rgba(0, 161, 214, 0.20); color: #55c1e8; }
    .baq-dark .baq-decode-option .baq-decode-badge[data-codec="AV1"] { background: rgba(140, 112, 205, 0.22); color: #ab93e8; }
    .baq-dark .baq-decode-option .baq-decode-badge[data-codec="HEVC"] { background: rgba(18, 165, 165, 0.20); color: #3fc4c4; }
    .baq-dark .baq-decode-option .baq-decode-badge[data-codec="AVC"] { background: rgba(245, 160, 74, 0.20); color: #f5b573; }
    .baq-dark .baq-decode-option .baq-decode-desc {
        color: #9aa0a6;
    }
    .baq-dark .baq-decode-option.baq-active {
        background-color: rgba(0, 161, 214, 0.14);
        border-color: rgba(0, 161, 214, 0.55);
        box-shadow: inset 0 0 0 1px rgba(0, 161, 214, 0.45), 0 2px 8px rgba(0, 0, 0, 0.30);
    }
    .baq-dark .baq-decode-option.baq-active .baq-decode-badge[data-codec="默认"] { background: #00a1d6; color: #fff; }
    .baq-dark .baq-decode-option.baq-active .baq-decode-badge[data-codec="AV1"] { background: #8c70d2; color: #fff; }
    .baq-dark .baq-decode-option.baq-active .baq-decode-badge[data-codec="HEVC"] { background: #12a5a5; color: #fff; }
    .baq-dark .baq-decode-option.baq-active .baq-decode-badge[data-codec="AVC"] { background: #f5a04a; color: #fff; }
    .baq-dark .baq-decode-option.baq-active .baq-decode-desc {
        color: #d5d9dd;
    }
    .baq-dark .baq-decode-option::after {
        border-color: #4a4f56;
    }
    .baq-dark .baq-decode-option.baq-active::after {
        border-color: #00a1d6;
        background-color: #00a1d6;
    }
    .baq-title-note {
        order: 2;
        font-size: 11px;
        font-weight: 400;
        color: #a8b0bc;
        letter-spacing: 0;
        white-space: nowrap;
    }
    .baq-dark .baq-title-note {
        color: #6e7681;
    }
    #bilibili-unlock-settings .baq-section-title {
        margin-top: 22px;
    }
    /* 没启用时整块禁用 */
    #bilibili-decode-settings .baq-decode-strategy {
        margin-top: 24px;
        transition: opacity 0.25s ease;
    }
    #bilibili-decode-settings .baq-decode-strategy.baq-disabled {
        opacity: 0.45;
        pointer-events: none;
    }
    #bilibili-quality-selector,
    #bilibili-live-quality-selector,
    #bilibili-dev-settings,
    #bilibili-unlock-settings,
    #bilibili-decode-settings {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }

    .baq-dark {
        background-color: #212428 !important;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), 0 10px 28px rgba(0, 0, 0, 0.40) !important;
    }
    .baq-dark h2 {
        color: #f1f3f4 !important;
    }
    .baq-dark .baq-section-title {
        color: #7d8590;
    }
    .baq-dark .baq-section-title::after {
        background: rgba(255, 255, 255, 0.09);
    }
    .baq-dark .baq-beta-tag {
        color: #6e7681;
    }
    .baq-dark .baq-github-link svg {
        fill: #e8eaed;
    }
    .baq-dark .baq-status-bar,
    .baq-dark .baq-status-bar.baq-loading,
    .baq-dark .baq-status-bar.baq-non-vip {
        background-color: #33373d;
        color: #b6bcc4;
        border-color: rgba(255, 255, 255, 0.08);
    }
    .baq-dark .baq-status-bar.baq-vip {
        background-color: rgba(251, 114, 153, 0.16);
        color: #ff8fab;
        border-color: rgba(251, 114, 153, 0.30);
    }
    .baq-dark .baq-dev-warning-pill {
        background: rgba(217, 48, 37, 0.16);
        color: #ff8078;
        border-color: rgba(255, 128, 120, 0.28);
    }
    .baq-dark .baq-toggle-switch,
    .baq-dark .baq-input-group,
    .baq-dark .baq-sens-section,
    .baq-dark .baq-vip-status-section {
        background: #2b2f34;
        border-color: rgba(255, 255, 255, 0.07);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.30), 0 3px 8px rgba(0, 0, 0, 0.22);
    }
    .baq-dark .baq-toggle-switch:hover,
    .baq-dark .baq-input-group:hover {
        background: #31363c;
    }
    .baq-dark .baq-toggle-switch label,
    .baq-dark .baq-input-group label,
    .baq-dark .baq-sens-label,
    .baq-dark .baq-vip-status-title {
        color: #e8eaed !important;
    }
    .baq-dark .baq-toggle-switch .baq-description,
    .baq-dark .baq-input-group .baq-description,
    .baq-dark .baq-action-row .baq-description,
    .baq-dark .baq-vip-status-description {
        color: #9aa0a6 !important;
    }
    .baq-dark .baq-sublabel,
    .baq-dark .baq-cq-hint {
        color: #8a9099;
    }
    .baq-dark .baq-action-card {
        background: #2b2f34;
        border-color: rgba(255, 255, 255, 0.07);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.30), 0 3px 8px rgba(0, 0, 0, 0.22);
    }
    .baq-dark .baq-action-label {
        color: #e8eaed !important;
    }
    .baq-dark .baq-action-button.baq-action-secondary {
        background: #31363c;
        border-color: rgba(255, 255, 255, 0.07);
        color: #d5d9dd;
    }
    .baq-dark .baq-action-button.baq-action-secondary:hover {
        background: #3a4047;
    }
    .baq-dark .baq-action-button.baq-action-danger {
        background: rgba(214, 69, 69, 0.16);
        border-color: rgba(214, 69, 69, 0.40);
        color: #e89a9a;
    }
    .baq-dark .baq-action-button.baq-action-danger:hover {
        background: rgba(214, 69, 69, 0.24);
    }
    .baq-dark .baq-slider {
        background-color: #4a4f56;
    }
    .baq-dark .baq-slider:before {
        background-color: #d5d9dd;
    }
    .baq-dark input:disabled + .baq-slider {
        opacity: 0.4;
    }
    .baq-dark .baq-quality-button,
    .baq-dark .baq-live-quality-button {
        background-color: #2b2f34;
        border-color: rgba(255, 255, 255, 0.07);
        color: #d5d9dd;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.30), 0 3px 8px rgba(0, 0, 0, 0.22);
    }
    .baq-dark .baq-quality-button:hover,
    .baq-dark .baq-live-quality-button:hover {
        background-color: #33383e;
    }
    .baq-dark .baq-quality-button.baq-active,
    .baq-dark .baq-live-quality-button.baq-active {
        background-color: rgba(0, 161, 214, 0.14);
        color: #55c1e8;
        border-color: rgba(0, 161, 214, 0.55);
        box-shadow: inset 0 0 0 1px rgba(0, 161, 214, 0.45), 0 2px 8px rgba(0, 0, 0, 0.30);
    }
    .baq-dark .baq-quality-button.baq-active.baq-vip-quality {
        background-color: rgba(251, 114, 153, 0.14);
        color: #ff8fab;
        border-color: rgba(251, 114, 153, 0.50);
        box-shadow: inset 0 0 0 1px rgba(251, 114, 153, 0.42), 0 2px 8px rgba(0, 0, 0, 0.30);
    }
    .baq-dark .baq-quality-button.baq-active[data-quality="最高画质"] {
        color: #f1f3f4;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
        border-color: rgba(140, 120, 210, 0.40);
        background-color: #141d2b;
        background-image: linear-gradient(120deg, #16202e 0%, #1a2438 55%, #231e33 100%);
    }
    .baq-dark .baq-quality-button.baq-active[data-quality="最高画质"]::before {
        background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 60' preserveAspectRatio='none'%3E%3Cdefs%3E%3CradialGradient id='b1'%3E%3Cstop offset='0%25' stop-color='%2340d0ff' stop-opacity='0.72'/%3E%3Cstop offset='38%25' stop-color='%2300a1d6' stop-opacity='0.30'/%3E%3Cstop offset='100%25' stop-color='%2300a1d6' stop-opacity='0'/%3E%3C/radialGradient%3E%3CradialGradient id='b2'%3E%3Cstop offset='0%25' stop-color='%2329b8e8' stop-opacity='0.4'/%3E%3Cstop offset='100%25' stop-color='%2329b8e8' stop-opacity='0'/%3E%3C/radialGradient%3E%3CradialGradient id='p1'%3E%3Cstop offset='0%25' stop-color='%23ff8ab5' stop-opacity='0.66'/%3E%3Cstop offset='40%25' stop-color='%23fb7299' stop-opacity='0.26'/%3E%3Cstop offset='100%25' stop-color='%23fb7299' stop-opacity='0'/%3E%3C/radialGradient%3E%3CradialGradient id='p2'%3E%3Cstop offset='0%25' stop-color='%23ff9bc0' stop-opacity='0.36'/%3E%3Cstop offset='100%25' stop-color='%23ff9bc0' stop-opacity='0'/%3E%3C/radialGradient%3E%3CradialGradient id='v1'%3E%3Cstop offset='0%25' stop-color='%23a98cff' stop-opacity='0.42'/%3E%3Cstop offset='100%25' stop-color='%23a98cff' stop-opacity='0'/%3E%3C/radialGradient%3E%3CradialGradient id='w1'%3E%3Cstop offset='0%25' stop-color='%23ffffff' stop-opacity='0.30'/%3E%3Cstop offset='100%25' stop-color='%23ffffff' stop-opacity='0'/%3E%3C/radialGradient%3E%3Cfilter id='ink' x='-45%25' y='-45%25' width='190%25' height='190%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.018 0.05' numOctaves='4' seed='23' result='n'/%3E%3CfeDisplacementMap in='SourceGraphic' in2='n' scale='58' xChannelSelector='R' yChannelSelector='G'/%3E%3CfeGaussianBlur stdDeviation='0.8'/%3E%3C/filter%3E%3C/defs%3E%3Cg filter='url(%23ink)' style='mix-blend-mode:screen'%3E%3Cellipse cx='38' cy='16' rx='58' ry='26' fill='url(%23b1)'/%3E%3Cellipse cx='120' cy='52' rx='46' ry='22' fill='url(%23b2)'/%3E%3Cellipse cx='158' cy='12' rx='52' ry='25' fill='url(%23p1)'/%3E%3Cellipse cx='34' cy='52' rx='40' ry='19' fill='url(%23p2)'/%3E%3Cellipse cx='96' cy='30' rx='32' ry='17' fill='url(%23v1)'/%3E%3Cellipse cx='64' cy='10' rx='16' ry='9' fill='url(%23w1)'/%3E%3C/g%3E%3C/svg%3E");
    }
    .baq-dark .baq-vip-status-tabs,
    .baq-dark .baq-sens-tabs {
        background: #22262b;
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.35);
    }
    .baq-dark .baq-vip-status-tab {
        color: #9aa0a6;
    }
    .baq-dark .baq-vip-status-tabs:not(.baq-disabled) .baq-vip-status-tab:not(.baq-active):hover {
        color: #d5d9dd;
    }
    .baq-dark .baq-num-stepper {
        background: #22262b;
        border-color: rgba(255, 255, 255, 0.12);
    }
    .baq-dark .baq-num-stepper:focus-within {
        border-color: #00a1d6;
    }
    .baq-dark .baq-ns-field {
        border-left-color: rgba(255, 255, 255, 0.10) !important;
        border-right-color: rgba(255, 255, 255, 0.10) !important;
    }
    .baq-dark .baq-num-stepper input {
        color: #e8eaed !important;
        background: transparent !important;
    }
    .baq-dark .baq-num-stepper .baq-unit {
        color: #7d8590;
    }
    .baq-dark .baq-ns-btn {
        color: #9aa0a6;
    }
    .baq-dark .baq-input-group.baq-disabled .baq-ns-btn {
        color: #565c64;
    }
    .baq-dark .baq-ns-btn:hover {
        background: #31363c !important;
        color: #e8eaed !important;
    }
    .baq-dark .baq-ns-btn:active {
        background: #3a4046 !important;
    }
    .baq-dark .baq-ns-btn:disabled {
        color: #565c64 !important;
        background: transparent !important;
    }
    .baq-dark .baq-warning {
        background-color: rgba(217, 48, 37, 0.14);
        color: #ff8078;
    }
    .baq-dark .baq-cq-rank {
        color: #8a9099;
    }
    .baq-dark .baq-cq-grid-item.baq-cq-fallback {
        background: rgba(0, 161, 214, 0.12);
        border-color: rgba(0, 161, 214, 0.45);
        color: #55c1e8;
        box-shadow: inset 0 0 0 1px rgba(0, 161, 214, 0.30);
    }
    .baq-dark .baq-cq-grid-item.baq-cq-dimmed .baq-cq-rank {
        color: #565c64;
    }

    @media (max-width: 480px) {
        #bilibili-quality-selector, #bilibili-live-quality-selector, #bilibili-dev-settings, #bilibili-unlock-settings, #bilibili-decode-settings {
            width: 95%;
            padding: 20px;
            max-height: 80vh;
        }
        #bilibili-dev-settings, #bilibili-unlock-settings {
            width: 95%;
            padding: 24px;
        }
        .baq-quality-group,
        #bilibili-quality-selector #quality-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }
        .baq-quality-button,
        #bilibili-quality-selector #quality-grid .baq-quality-button {
            box-sizing: border-box;
            padding: 13px 6px;
            font-size: 13px;
            min-height: 44px;
        }
        .baq-live-quality-button,
        #bilibili-live-quality-selector .baq-live-quality-button {
            box-sizing: border-box;
            padding: 13px 6px;
            font-size: 14px;
            min-height: 44px;
        }
        .baq-toggle-switch {
            padding: 8px 12px;
            margin-bottom: 8px;
        }
        .baq-toggle-switch label {
            font-size: 14px;
        }
        .baq-toggle-switch .baq-description {
            font-size: 12px;
        }
        .baq-input-group {
            padding: 12px;
            margin-bottom: 12px;
        }
        .baq-input-group label {
            font-size: 14px;
        }
        .baq-input-group .baq-description {
            font-size: 12px;
        }
        #bilibili-dev-settings .baq-toggle-switch,
        #bilibili-dev-settings .baq-input-group,
        #bilibili-unlock-settings .baq-toggle-switch,
        #bilibili-unlock-settings .baq-input-group {
            padding: 14px 16px;
        }
        .baq-action-row {
            grid-template-columns: 1fr;
        }
        .baq-action-card .baq-action-button {
            width: auto;
            max-width: 45%;
        }
        .baq-action-card {
            padding: 10px 12px;
        }
        .baq-action-label {
            font-size: 14px;
        }
        .baq-action-row .baq-description {
            font-size: 12px;
        }
        .baq-github-link {
            width: 20px;
            height: 20px;
        }
        #bilibili-quality-selector h2, #bilibili-live-quality-selector h2, #bilibili-dev-settings h2,
        #bilibili-unlock-settings h2, #bilibili-decode-settings h2 {
            font-size: 20px;
        }
        .baq-dev-warning-pill {
            font-size: 12px;
            padding: 5px 12px;
        }
        .baq-warning {
            font-size: 13px;
            padding: 8px;
            margin: 8px 0;
        }
        .baq-status-bar {
            font-size: 12px;
            padding: 5px 12px;
        }
        .baq-cq-hint,
        .baq-sublabel,
        .baq-decode-option .baq-decode-desc {
            white-space: normal;
        }
    }
    @media (max-height: 600px) {
        #bilibili-quality-selector, #bilibili-live-quality-selector, #bilibili-dev-settings,
        #bilibili-unlock-settings, #bilibili-decode-settings {
            max-height: 90vh;
            padding: 15px;
        }
        .baq-quality-group,
        #bilibili-quality-selector #quality-grid {
            margin-bottom: 15px;
        }
        .baq-toggle-switch {
            margin-bottom: 6px;
        }
        .baq-input-group {
            margin-bottom: 10px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        #bilibili-quality-selector, #bilibili-live-quality-selector, #bilibili-dev-settings,
        #bilibili-unlock-settings, #bilibili-decode-settings,
        .baq-vip-tab-indicator,
        .baq-quality-button,
        .baq-cq-grid-item .baq-cq-rank,
        .baq-hint-collapse,
        .baq-slider:before,
        .baq-action-button,
        .baq-injected.baq-panel-entry svg,
        .baq-github-link,
        .baq-live-quality-button,
        .baq-decode-option {
            transition-duration: 0.01ms;
        }
    }
    @media (max-width: 800px) {
        .baq-action-row {
            grid-template-columns: 1fr;
        }
    }
    `);
  }

  // src/quality-vocab.ts
  var QUALITY_ORDER = [
    "8K",
    "杜比视界",
    "HDR",
    "4K",
    "SDR增强",
    "1080P 高码率",
    "1080P 60帧",
    "AI修复",
    "智能修复",
    "1080P 高清",
    "1080P",
    "720P 60帧",
    "720P",
    "480P",
    "360P",
    "默认"
  ];
  var HDR_QUALITIES = ["HDR", "杜比视界"];
  var NO_LOGIN_BLOCKED_QUALITIES = ["8K", "杜比视界", "HDR", "4K", "SDR增强"];
  var TRIAL_KEYWORDS = BILI.badge.trialKeywords;
  var CLEAN_KEYWORDS = [BILI.badge.vipKeyword, ...TRIAL_KEYWORDS];
  function escapeForRegExp(literal) {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  var CLEAN_PATTERN = new RegExp(CLEAN_KEYWORDS.map(escapeForRegExp).join("|"), "g");
  function cleanQuality(q) {
    if (!q) return "";
    return q.replace(CLEAN_PATTERN, "").replace(/\s+/g, " ").trim();
  }
  function qualityTierIndex(name) {
    for (let i = 0; i < QUALITY_ORDER.length; i++) {
      if (name.includes(QUALITY_ORDER[i])) return i;
    }
    return -1;
  }
  function qualityNameMatches(menuNameClean, target) {
    const targetTier = qualityTierIndex(target);
    if (targetTier === -1) return menuNameClean.includes(target);
    return qualityTierIndex(menuNameClean) === targetTier;
  }
  function qualitySortRank(name) {
    const tier = qualityTierIndex(name);
    return tier === -1 ? QUALITY_ORDER.length : tier;
  }
  var CUSTOM_HIGHEST = "最高画质";
  var CUSTOM_DEFAULT = "默认";
  var CUSTOM_QUALITY_ITEMS = ["8K", "杜比视界", "HDR", "4K", "1080P 高码率", "1080P 60帧", "1080P 高清", "720P", "480P", "360P"];
  var VIP_QUALITIES = ["8K", "杜比视界", "HDR", "4K", "SDR增强", "1080P 高码率", "1080P 60帧"];
  var DEFAULT_CUSTOM_ORDER = [CUSTOM_HIGHEST, ...CUSTOM_QUALITY_ITEMS, CUSTOM_DEFAULT];
  function normalizeCustomOrder(order) {
    const known = new Set(DEFAULT_CUSTOM_ORDER);
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    if (Array.isArray(order)) {
      order.forEach((q) => {
        if (known.has(q) && !seen.has(q)) {
          result.push(q);
          seen.add(q);
        }
      });
    }
    DEFAULT_CUSTOM_ORDER.forEach((q) => {
      if (!seen.has(q)) {
        result.push(q);
        seen.add(q);
      }
    });
    return result;
  }
  function customEffectiveCutoff(qualities) {
    const hi = qualities.indexOf(CUSTOM_HIGHEST);
    const def = qualities.indexOf(CUSTOM_DEFAULT);
    if (hi === -1) return def;
    if (def === -1) return hi;
    return Math.min(hi, def);
  }
  function loadCustomOrder() {
    let raw = loadSetting("customQualityOrder");
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch (e) {
        console.warn(`[设置] 自定义画质顺序解析失败（${briefValue(raw)}），已回退为默认顺序:`, e);
        raw = null;
      }
    }
    return normalizeCustomOrder(raw);
  }
  function writeCustomOrder(order) {
    const normalized = normalizeCustomOrder(order);
    const previous = state.customQualityOrder;
    state.customQualityOrder = normalized;
    try {
      GM_setValue(SETTINGS.customQualityOrder.key, JSON.stringify(normalized));
    } catch (e) {
      console.error("[设置] 自定义画质顺序写入存储失败:", e);
      state.customQualityOrder = previous;
      return { order: previous || normalizeCustomOrder(previous), saved: false };
    }
    return { order: normalized, saved: true };
  }
  function saveCustomOrder(order) {
    return writeCustomOrder(order).order;
  }
  state.customQualityOrder = loadCustomOrder();

  // src/utils.ts
  var Utils = {
    delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
    query(selector, parent = document) {
      return parent.querySelector(selector);
    },
    queryAll(selector, parent = document) {
      return Array.from(parent.querySelectorAll(selector));
    }
  };
  function runSafely(promise, label) {
    void Promise.resolve(promise).catch((error) => {
      if (error instanceof Error) console.error(`[${label}] 异步任务失败:`, error);
      else console.error(`[${label}] 异步任务失败:`, new Error(String(error)), error);
    });
  }

  // src/panel-parts.ts
  function renderPanelHeader(title, extraRight = "") {
    return `<div class="baq-header">
        <h2>${title}</h2>
        <div class="baq-header-right">${extraRight}${renderThemeToggle()}${renderGithubLink()}</div>
      </div>`;
  }
  function renderToggleRow(spec) {
    const rowClass = "baq-toggle-switch" + (spec.rowClass ? " " + spec.rowClass : "");
    const rowId = spec.rowId ? ` id="${spec.rowId}"` : "";
    const rowAttrs = spec.rowAttrs ? " " + spec.rowAttrs : "";
    const labelId = spec.inputId + "-label";
    const subId = spec.inputId + "-sub";
    const descId = spec.descriptionId || spec.inputId + "-desc";
    const sub = spec.sublabel ? `<span class="baq-sublabel" id="${subId}">${spec.sublabel}</span>` : "";
    const desc = spec.description ? `<div class="baq-description" id="${descId}"${spec.descriptionLive ? ` role="status"` : ""}>${spec.description}</div>` : "";
    const describedBy = [spec.sublabel ? subId : "", spec.description ? descId : ""].filter(Boolean).join(" ");
    return `<div class="${rowClass}"${rowId}${rowAttrs}>
        <label for="${spec.inputId}"><span id="${labelId}">${spec.label}</span>${sub}${desc}</label>
        <label class="baq-switch">
          <input type="checkbox" id="${spec.inputId}" aria-labelledby="${labelId}"${describedBy ? ` aria-describedby="${describedBy}"` : ""}${spec.checked ? " checked" : ""}${spec.disabled ? " disabled" : ""}>
          <span class="baq-slider${spec.slider ? " " + spec.slider : ""}"></span>
        </label>
      </div>`;
  }
  function renderStepperGroup(spec) {
    const groupClass = "baq-input-group" + (spec.disabled ? " baq-disabled" : "");
    const groupId = spec.groupId ? ` id="${spec.groupId}"` : "";
    const labelId = spec.inputId + "-label";
    const descId = spec.inputId + "-desc";
    const unitId = spec.inputId + "-unit";
    return `<div class="${groupClass}"${groupId}>
        <label for="${spec.inputId}"><span id="${labelId}">${spec.label}</span><div class="baq-description" id="${descId}">${spec.description}</div></label>
        <div class="baq-num-stepper">
          <button class="baq-ns-btn baq-ns-dec" type="button" aria-label="减少${spec.label}（${spec.unit}）">−</button>
          <div class="baq-ns-field">
            <input type="number" id="${spec.inputId}" value="${spec.value}" min="${spec.min}" max="${spec.max}" step="${spec.step}" aria-labelledby="${labelId} ${unitId}" aria-describedby="${descId}"${spec.disabled ? " disabled" : ""}>
            <span class="baq-unit" id="${unitId}">${spec.unit}</span>
          </div>
          <button class="baq-ns-btn baq-ns-inc" type="button" aria-label="增加${spec.label}（${spec.unit}）">+</button>
        </div>
      </div>`;
  }
  function renderStatusTabs(spec) {
    const cls = "baq-vip-status-tabs" + (spec.extraClass ? " " + spec.extraClass : "") + (spec.disabled ? " baq-disabled" : "");
    const id = spec.id ? ` id="${spec.id}"` : "";
    const labelledBy = spec.labelledBy ? ` aria-labelledby="${spec.labelledBy}"` : "";
    const describedBy = spec.describedBy ? ` aria-describedby="${spec.describedBy}"` : "";
    const disabled = spec.disabled ? ` aria-disabled="true"` : "";
    return `<div class="${cls}"${id} data-active="${spec.active}" role="radiogroup"${labelledBy}${describedBy}${disabled}>
        <div class="baq-vip-tab-indicator" aria-hidden="true"></div>
        ${spec.options.map((o) => `<div class="baq-vip-status-tab${o === spec.active ? " baq-active" : ""}" data-status="${o}" role="radio" aria-checked="${o === spec.active ? "true" : "false"}" tabindex="${o === spec.active ? "0" : "-1"}"${disabled}>${o}</div>`).join("")}
      </div>`;
  }
  function renderActionRow(spec) {
    const note = spec.note ? `<span class="baq-title-note">${spec.note}</span>` : "";
    const cards = spec.actions.map((a) => {
      const labelId = `${a.id}-label`;
      const descId = `${a.id}-desc`;
      return `<div class="baq-action-card">
          <div class="baq-action-text">
            <span class="baq-action-label" id="${labelId}">${a.label}</span>
            <div class="baq-description" id="${descId}">${a.description}</div>
          </div>
          <button type="button" id="${a.id}" class="baq-action-button baq-action-${a.tone}" aria-labelledby="${labelId}" aria-describedby="${descId}">${a.label}</button>
        </div>`;
    }).join("\n        ");
    return `<div class="baq-section-title">${spec.title}${note}</div>
      <div class="baq-action-row">
        ${cards}
      </div>`;
  }

  // src/vip.ts
  var VIP_EVIDENCE = { dom: 1, api: 2 };
  var cachedVipPriority = 0;
  function cacheVipStatus(isVip, source, priority = VIP_EVIDENCE.dom) {
    if (priority < cachedVipPriority) {
      console.log("[会员状态] 忽略弱于现有依据的缓存写入:", source, "| 现有依据:", state.sessionCache.vipSource);
      return;
    }
    cachedVipPriority = priority;
    state.sessionCache.vipStatus = isVip;
    state.sessionCache.vipChecked = true;
    state.sessionCache.vipSource = source;
  }
  async function checkVipStatusAsync() {
    if (state.devModeEnabled && (state.devModeNoLoginStatus || state.devModeVipStatus !== "默认")) {
      if (state.devModeNoLoginStatus) {
        state.isVipUser = false;
        state.vipStatusChecked = true;
        console.log("[开发者模式] 未登录模式，用户会员状态: 否");
        return;
      }
      state.isVipUser = state.devModeVipStatus === "会员";
      state.vipStatusChecked = true;
      console.log("[开发者模式] 用户会员状态:", state.isVipUser ? "是" : "否");
      return;
    }
    if (state.sessionCache.vipChecked) {
      state.isVipUser = state.sessionCache.vipStatus;
      state.vipStatusChecked = true;
      console.log("[会员状态] 用户会员状态:", state.isVipUser ? "是" : "否");
      console.log("[会员状态] 判定依据:", state.sessionCache.vipSource || "会话缓存");
      return;
    }
    const reason = detectVipByDOM();
    state.isVipUser = !!reason;
    state.vipStatusChecked = true;
    if (reason) {
      cacheVipStatus(true, "DOM 检测（" + reason + "）");
    }
    console.log("[会员状态] 用户会员状态:", state.isVipUser ? "是" : "否");
    if (reason) {
      console.log("[会员状态] 判定依据:", reason);
    }
  }
  function detectVipByDOM() {
    if (document.querySelector(BILI.header.bigVipIcon) || document.querySelector(BILI.header.smallVipIcon)) {
      return "发现会员图标";
    }
    const activeItem = findActiveQualityItem();
    if (activeItem) {
      const parsed = parseQualityMenuItem(activeItem);
      if (parsed.isVipOnly && !parsed.isFreeNow) {
        return "当前使用会员画质";
      }
    }
    return null;
  }
  function isLoginGateBlocking() {
    if (state.isLivePage) return false;
    if (state.devModeEnabled && state.devModeNoLoginStatus) return false;
    if (document.querySelector(BILI.header.avatarWrap)) return false;
    const entry = document.querySelector(BILI.header.loginEntry);
    return !!entry && entry.getClientRects().length > 0;
  }

  // src/task-queue.ts
  var TaskQueue = class {
    constructor() {
      this.currentTaskId = 0;
      this.activeTimeouts = /* @__PURE__ */ new Map();
      this.activeTask = null;
      this.activeTaskToken = null;
      this.scheduleSeq = 0;
      this.loginObserved = false;
    }
    generateTaskId() {
      return ++this.currentTaskId;
    }
    clearPreviousTasks() {
      this.activeTimeouts.forEach((entry, key) => {
        clearTimeout(entry.timeout);
        console.log(`[任务管理] 取消挂起项 ${key}`);
        entry.resolve();
      });
      this.activeTimeouts.clear();
      if (this.activeTask !== null) {
        console.log(`[任务管理] 清理时任务 #${this.activeTask} 仍在运行，它将在下一个取消检查点自行退出`);
        this.activeTask = null;
        this.activeTaskToken = null;
      }
    }
    // 取消指定槽位的挂起任务（清定时器并兑现 Promise）
    cancelSlot(slot) {
      const entry = this.activeTimeouts.get(slot);
      if (!entry) return;
      clearTimeout(entry.timeout);
      entry.resolve();
      this.activeTimeouts.delete(slot);
      console.log(`[任务管理] 取消槽位 ${slot} 的挂起任务`);
    }
    isTaskCancelled(taskId) {
      if (taskId !== this.currentTaskId) {
        console.log(`[任务管理] 任务 #${taskId} 已过期，当前任务 #${this.currentTaskId}`);
        return true;
      }
      if (!state.isLivePage && !this.loginObserved) {
        if (document.querySelector(BILI.header.avatarWrap)) {
          this.loginObserved = true;
        } else if (isLoginGateBlocking()) {
          console.log(`[任务管理] 任务 #${taskId} 取消：检测到未登录且未开启未登录模式`);
          return true;
        }
      }
      return false;
    }
    async scheduleTask(taskId, task, delay = 0, slot = null) {
      if (this.isTaskCancelled(taskId)) return;
      if (!(delay > 0)) {
        console.warn(`[任务管理] 任务 #${taskId} 的调度延迟无效（${delay}），已钳到 1 毫秒：延迟必须为正数，否则任务不可取消、不参与槽位去重`);
        delay = 1;
      }
      const token = {};
      this.activeTask = taskId;
      this.activeTaskToken = token;
      try {
        const key = slot || `seq-${++this.scheduleSeq}`;
        if (slot) {
          const previous = this.activeTimeouts.get(key);
          if (previous) {
            clearTimeout(previous.timeout);
            previous.resolve();
            console.log(`[任务管理] 槽位 ${slot} 的旧任务被新调度替换`);
          }
        }
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(async () => {
            this.activeTimeouts.delete(key);
            if (!this.isTaskCancelled(taskId)) {
              try {
                await task();
                resolve();
              } catch (error) {
                reject(error);
              }
            } else {
              console.log(`[任务管理] 延迟任务 #${taskId} 已取消`);
              resolve();
            }
          }, delay);
          this.activeTimeouts.set(key, { timeout, resolve });
        });
      } finally {
        if (this.activeTaskToken === token) {
          this.activeTask = null;
          this.activeTaskToken = null;
        }
      }
    }
  };
  var taskQueue = new TaskQueue();

  // src/adaptive.ts
  var ADAPTIVE_SENSITIVITY_PRESETS = {
    "灵敏": { settleMs: 5e3, hardStallMs: 2e3, strikeMinMs: 600, strikesToTrigger: 2, strikeWindowMs: 6e4, predictive: true, lowWaterS: 6, drainRateS: 0.4, cooldownMs: 15e3, maxSteps: 4 },
    "标准": { settleMs: 8e3, hardStallMs: 3e3, strikeMinMs: 700, strikesToTrigger: 3, strikeWindowMs: 6e4, predictive: true, lowWaterS: 4, drainRateS: 0.5, cooldownMs: 3e4, maxSteps: 3 },
    "保守": { settleMs: 12e3, hardStallMs: 5e3, strikeMinMs: 1e3, strikesToTrigger: 4, strikeWindowMs: 45e3, predictive: false, lowWaterS: 3, drainRateS: 0.6, cooldownMs: 6e4, maxSteps: 2 }
  };
  var ADAPTIVE_TOAST_PATTERN = BILI.toast.weakNetPattern;
  var ADAPTIVE_FAIL_TOAST_PATTERN = BILI.toast.switchFailPattern;
  var ADAPTIVE_FAIL_RETRY_BACKOFF_MS = 4e3;
  var ADAPTIVE_TICK_MS = 500;
  var ADAPTIVE_CONFIRM_TIMEOUT_MS = 3e4;
  var ADAPTIVE_MAX_FAILURES = 2;
  var ADAPTIVE_SEEK_GRACE_MS = 2e3;
  var ADAPTIVE_TAIL_GUARD_S = 10;
  var ADAPTIVE_RETRY_WINDOW_MS = 1e4;
  var ADAPTIVE_ARM_VERIFY_BUFFER_MS = 3e3;
  var ADAPTIVE_TICK_GAP_FACTOR = 4;
  var adaptive = {
    timerId: null,
    flowDoneSeen: false,
    armedAt: 0,
    observationHoldUntil: 0,
    cooldownUntil: 0,
    stepsUsed: 0,
    failures: 0,
    disabledForVideo: false,
    switching: null,
    lastActiveClean: "",
    lastCt: -1,
    stallStartAt: 0,
    strikes: [],
    bufferSamples: [],
    lastSeekAt: 0,
    lastTickAt: 0,
    lastTickWallAt: 0,
    retryAt: 0,
    retryExpireAt: 0,
    consumedToasts: null,
    failedQns: null,
    // Set，本视频内切换失败过的档位（qn 与名称），后续降档跳过
    timeoutTarget: null,
    blindYieldKey: "",
    floorLogged: false,
    // 本视频已触底（无更低档）的日志一次性标记
    boundPlayer: null,
    playerLagHandler: null
  };
  function adaptiveConfig() {
    return ADAPTIVE_SENSITIVITY_PRESETS[state.adaptiveQualitySensitivity] || ADAPTIVE_SENSITIVITY_PRESETS["标准"];
  }
  var adaptiveReportedFaults = /* @__PURE__ */ new Set();
  function adaptiveFaultFirstSeen(channel, e) {
    const key = channel + "|" + (e instanceof Error ? e.name + ": " + e.message : String(e));
    if (adaptiveReportedFaults.has(key)) return false;
    adaptiveReportedFaults.add(key);
    return true;
  }
  function adaptiveDebugOnce(e) {
    if (!state.devModeEnabled) return;
    if (adaptiveFaultFirstSeen("debug", e)) debugTransient(e);
  }
  function adaptiveWarnOnce(message, e) {
    if (adaptiveFaultFirstSeen("warn", e)) console.warn(message, e);
  }
  function adaptiveDeadlinePending(now, deadline, maxSpanMs) {
    return deadline > now && deadline - now <= maxSpanMs;
  }
  function adaptiveRetryChainMaxMs() {
    return ADAPTIVE_FAIL_RETRY_BACKOFF_MS + ADAPTIVE_RETRY_WINDOW_MS + QUALITY_FAIL_WATCH_WINDOW_MS;
  }
  function adaptiveArmMaxSpanMs() {
    const presetMax = Math.max(...Object.values(ADAPTIVE_SENSITIVITY_PRESETS).map((p) => p.settleMs));
    const verifyMax = SETTINGS.devDoubleCheckDelay.max;
    return Math.max(presetMax, (typeof verifyMax === "number" ? verifyMax : 0) + ADAPTIVE_ARM_VERIFY_BUFFER_MS);
  }
  function adaptiveArmPending(now) {
    return adaptiveDeadlinePending(now, adaptive.armedAt, adaptiveArmMaxSpanMs());
  }
  function adaptiveReadActiveClean() {
    return cleanQuality(readActiveQualityText());
  }
  function adaptiveHoldObservation(untilMs) {
    const now = Date.now();
    const previous = adaptive.observationHoldUntil;
    adaptive.observationHoldUntil = Math.min(Math.max(previous, untilMs), now + QUALITY_FAIL_WATCH_WINDOW_MS);
    const heldFor = adaptive.observationHoldUntil - Math.max(now, previous);
    if (adaptive.retryExpireAt && heldFor > 0) adaptive.retryExpireAt += heldFor;
  }
  function adaptiveResetSignals() {
    adaptive.stallStartAt = 0;
    adaptive.strikes = [];
    adaptive.bufferSamples = [];
  }
  function resetAdaptiveSession() {
    adaptive.flowDoneSeen = false;
    adaptive.armedAt = 0;
    adaptive.cooldownUntil = 0;
    adaptive.retryAt = 0;
    adaptive.retryExpireAt = 0;
    adaptive.stepsUsed = 0;
    adaptive.failures = 0;
    adaptive.disabledForVideo = false;
    adaptive.switching = null;
    adaptive.lastActiveClean = "";
    adaptive.lastCt = -1;
    adaptive.lastSeekAt = 0;
    adaptive.lastTickAt = 0;
    adaptive.lastTickWallAt = 0;
    adaptive.consumedToasts = /* @__PURE__ */ new WeakSet();
    adaptive.failedQns = /* @__PURE__ */ new Set();
    adaptive.timeoutTarget = null;
    adaptive.blindYieldKey = "";
    adaptive.floorLogged = false;
    adaptiveResetSignals();
  }
  function startAdaptiveQuality() {
    if (adaptive.timerId !== null) return;
    if (state.isLivePage || !state.adaptiveQualityEnabled) return;
    resetAdaptiveSession();
    adaptive.timerId = setInterval(adaptiveTick, ADAPTIVE_TICK_MS);
    console.log(`[智能降画质] 已启动，灵敏度: ${state.adaptiveQualitySensitivity}`);
  }
  function stopAdaptiveQuality() {
    if (adaptive.timerId !== null) {
      clearInterval(adaptive.timerId);
      adaptive.timerId = null;
      console.log("[智能降画质] 已停止");
    }
    if (adaptive.boundPlayer && adaptive.playerLagHandler) {
      try {
        adaptive.boundPlayer.off(BILI.facade.playbackLagEvent, adaptive.playerLagHandler);
      } catch (e) {
        adaptiveDebugOnce(e);
      }
    }
    adaptive.boundPlayer = null;
    adaptive.playerLagHandler = null;
    resetAdaptiveSession();
  }
  function restartAdaptiveQuality() {
    stopAdaptiveQuality();
    startAdaptiveQuality();
  }
  function adaptiveEnsurePlayerBinding() {
    let player;
    try {
      player = unsafeWindow.player;
    } catch (e) {
      adaptiveDebugOnce(e);
      return;
    }
    if (!player || typeof player.on !== "function" || typeof player.off !== "function" || adaptive.boundPlayer === player) return;
    if (adaptive.boundPlayer && adaptive.playerLagHandler) {
      try {
        adaptive.boundPlayer.off(BILI.facade.playbackLagEvent, adaptive.playerLagHandler);
      } catch (e) {
        adaptiveDebugOnce(e);
      }
    }
    const handler = () => {
      adaptiveTryDowngrade("播放器上报卡顿");
    };
    try {
      player.on(BILI.facade.playbackLagEvent, handler);
      adaptive.boundPlayer = player;
      adaptive.playerLagHandler = handler;
      console.log("[智能降画质] 已订阅播放器卡顿事件");
    } catch (e) {
      adaptiveWarnOnce("[智能降画质] 订阅播放器卡顿事件失败，该路信号本页不可用:", e);
    }
  }
  function adaptivePickNextLower() {
    const qualityMenu = document.querySelector(BILI.video.qualityMenu);
    if (!qualityMenu) return null;
    const items = Array.from(qualityMenu.querySelectorAll(BILI.video.qualityMenuItem));
    const activeIndex = items.findIndex(isQualityItemActive);
    if (activeIndex === -1) return null;
    if (parseQualityMenuItem(items[activeIndex]).textName.includes(BILI.video.autoQualityKeyword)) return null;
    const skipTimedOut = adaptive.retryAt ? adaptive.timeoutTarget : null;
    for (let i = activeIndex + 1; i < items.length; i++) {
      const q = parseQualityMenuItem(items[i]);
      const name = q.textName;
      if (name.includes(BILI.video.autoQualityKeyword)) continue;
      if (isQualityFilteredByDevMode(q.name)) continue;
      if (isQualityUsableForUser(q)) {
        const qnRaw = parseInt(items[i].getAttribute(BILI.video.qnAttr) || "", 10);
        const qn = Number.isFinite(qnRaw) && qnRaw > 0 ? qnRaw : null;
        const clean = cleanQuality(name);
        if (adaptive.failedQns && (qn && adaptive.failedQns.has(qn) || adaptive.failedQns.has(clean))) continue;
        if (skipTimedOut && (qn !== null && qn === skipTimedOut.qn || clean !== "" && clean === skipTimedOut.clean)) continue;
        return { name, clean, qn, element: items[i] };
      }
    }
    return null;
  }
  function adaptiveFeedbackToast(qualityName) {
    try {
      const player = unsafeWindow.player;
      if (player && player.toast && typeof player.toast.create === "function") {
        player.toast.create({ text: `网络波动，已自动降至 ${qualityName}`, duration: 5e3 });
      }
    } catch (e) {
      adaptiveDebugOnce(e);
    }
  }
  function adaptiveDismissBiliToast() {
    try {
      Utils.queryAll(BILI.video.toastItem).forEach((item) => {
        const textEl = item.querySelector(BILI.video.toastText);
        if (textEl && ADAPTIVE_TOAST_PATTERN.test(textEl.textContent || "")) {
          const cancel = item.querySelector(BILI.video.toastCancel);
          if (cancel) cancel.click();
        }
      });
    } catch (e) {
      adaptiveDebugOnce(e);
    }
  }
  function adaptiveIsPlayerSwitching() {
    try {
      const player = unsafeWindow.player;
      if (player && typeof player.getQuality === "function") {
        const q = player.getQuality();
        if (q && typeof q.nowQ === "number" && typeof q.newQ === "number" && q.nowQ !== q.newQ) return true;
      }
    } catch (e) {
      adaptiveDebugOnce(e);
    }
    return false;
  }
  function adaptiveConfirmByFacade(targetQn) {
    if (!targetQn) return null;
    try {
      const player = unsafeWindow.player;
      if (player && typeof player.getQuality === "function") {
        const q = player.getQuality();
        if (q && typeof q.realQ === "number") return q.realQ === targetQn && q.nowQ === q.newQ;
      }
    } catch (e) {
      adaptiveDebugOnce(e);
    }
    return null;
  }
  function adaptiveSettledElsewhere(targetQn) {
    if (!targetQn) return null;
    try {
      const player = unsafeWindow.player;
      if (player && typeof player.getQuality === "function") {
        const q = player.getQuality();
        if (q && typeof q.realQ === "number" && typeof q.nowQ === "number" && typeof q.newQ === "number") {
          return q.nowQ === q.newQ && q.realQ !== targetQn;
        }
      }
    } catch (e) {
      adaptiveDebugOnce(e);
    }
    return null;
  }
  function adaptiveReadRealQ() {
    try {
      const player = unsafeWindow.player;
      if (player && typeof player.getQuality === "function") {
        const q = player.getQuality();
        if (q && typeof q.realQ === "number") return q.realQ;
      }
    } catch (e) {
      adaptiveDebugOnce(e);
    }
    return null;
  }
  function adaptiveTryDowngrade(reason) {
    if (adaptive.timerId === null || !state.adaptiveQualityEnabled) return null;
    if (adaptive.disabledForVideo || adaptive.switching) return null;
    const now = Date.now();
    const cfg = adaptiveConfig();
    if (!adaptive.flowDoneSeen || adaptiveArmPending(now)) return null;
    if (adaptiveDeadlinePending(now, adaptive.observationHoldUntil, QUALITY_FAIL_WATCH_WINDOW_MS)) return null;
    if (adaptiveDeadlinePending(now, adaptive.cooldownUntil, cfg.cooldownMs)) return null;
    if (adaptive.stepsUsed >= cfg.maxSteps) return null;
    const video = document.querySelector("video");
    if (!video || !isFinite(video.duration) || video.duration <= 0) return null;
    if (video.seeking || now - adaptive.lastSeekAt < ADAPTIVE_SEEK_GRACE_MS) return null;
    if (video.duration - video.currentTime <= ADAPTIVE_TAIL_GUARD_S) return null;
    if (adaptiveIsPlayerSwitching()) return null;
    const qualityMenu = document.querySelector(BILI.video.qualityMenu);
    if (!qualityMenu || !findActiveQualityItem(qualityMenu)) return null;
    const target = adaptivePickNextLower();
    if (!target) {
      if (!adaptive.floorLogged) {
        console.log(`[智能降画质] 触发（${reason}），但已无更低的可用画质`);
        adaptive.floorLogged = true;
      }
      adaptive.cooldownUntil = now + cfg.cooldownMs;
      return "floor";
    }
    adaptive.floorLogged = false;
    const fromQn = adaptiveReadRealQ();
    if (target.qn !== null && fromQn !== null && target.qn === fromQn) return null;
    console.log(`[智能降画质] 触发（${reason}），降档到: ${target.name}`);
    adaptiveResetSignals();
    try {
      Utils.queryAll(BILI.video.toastText).forEach((el) => {
        if (ADAPTIVE_FAIL_TOAST_PATTERN.test(el.textContent || "")) adaptive.consumedToasts.add(el);
      });
    } catch (e) {
      adaptiveDebugOnce(e);
    }
    adaptive.switching = { targetClean: target.clean, targetQn: target.qn, fromQn, stableTicks: 0, divergedTicks: 0, deadline: now + ADAPTIVE_CONFIRM_TIMEOUT_MS };
    adaptiveExecuteSwitch(target);
    return "switching";
  }
  function adaptiveSwitchFailed(reason, evidence = "confirmed") {
    const now = Date.now();
    const failed = adaptive.switching;
    if (failed && evidence === "timeout") {
      adaptive.timeoutTarget = { qn: failed.targetQn, clean: failed.targetClean };
    } else {
      adaptive.timeoutTarget = null;
      if (failed) {
        if (failed.targetQn) adaptive.failedQns.add(failed.targetQn);
        if (failed.targetClean) adaptive.failedQns.add(failed.targetClean);
      }
    }
    adaptive.switching = null;
    adaptive.failures++;
    console.warn(`[智能降画质] 降档未完成（${reason}，第 ${adaptive.failures} 次失败）`);
    if (adaptive.failures >= ADAPTIVE_MAX_FAILURES) {
      adaptive.disabledForVideo = true;
      console.warn("[智能降画质] 连续失败，本视频内不再尝试自动降档");
      return;
    }
    adaptive.retryAt = now + ADAPTIVE_FAIL_RETRY_BACKOFF_MS;
    adaptive.retryExpireAt = adaptive.retryAt + ADAPTIVE_RETRY_WINDOW_MS;
    adaptive.cooldownUntil = Math.max(adaptive.cooldownUntil, adaptive.retryAt);
  }
  function adaptiveExecuteSwitch(target) {
    if (target.qn) {
      try {
        const player = unsafeWindow.player;
        if (player && typeof player.requestQuality === "function") {
          const result = player.requestQuality(target.qn);
          if (result && typeof result.catch === "function") {
            const session = adaptive.switching;
            void result.catch((reason) => {
              console.warn("[智能降画质] requestQuality 被拒绝:", reason);
              if (session && adaptive.switching === session) {
                adaptiveSwitchFailed("requestQuality 拒绝");
              }
            });
          }
          return;
        }
      } catch (e) {
        adaptiveDebugOnce(e);
      }
    }
    try {
      const opts = { bubbles: true, cancelable: true, view: unsafeWindow };
      ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
        const ev = type.indexOf("pointer") === 0 ? new PointerEvent(type, opts) : new MouseEvent(type, opts);
        target.element.dispatchEvent(ev);
      });
    } catch (e) {
      target.element.click();
    }
  }
  function adaptiveTickSwitching(now, cfg, video, activeClean) {
    const facadeConfirm = adaptiveConfirmByFacade(adaptive.switching.targetQn);
    let confirmed = facadeConfirm === true;
    let takenOver = false;
    if (facadeConfirm === null) {
      if (activeClean && activeClean === adaptive.switching.targetClean) {
        adaptive.switching.stableTicks++;
        adaptive.switching.divergedTicks = 0;
        confirmed = adaptive.switching.stableTicks >= 4;
      } else {
        adaptive.switching.stableTicks = 0;
        if (activeClean) {
          adaptive.switching.divergedTicks++;
          takenOver = adaptive.switching.divergedTicks >= 10;
        }
      }
    } else if (!confirmed) {
      if (adaptiveSettledElsewhere(adaptive.switching.targetQn) === true) {
        adaptive.switching.divergedTicks++;
        takenOver = adaptive.switching.divergedTicks >= 6;
      } else {
        adaptive.switching.divergedTicks = 0;
      }
    }
    let failToast = null;
    if (!confirmed) {
      failToast = Utils.queryAll(BILI.video.toastText).find((el) => ADAPTIVE_FAIL_TOAST_PATTERN.test(el.textContent || "") && !adaptive.consumedToasts.has(el)) || null;
      if (failToast) qualityFailConsumedToasts.add(failToast);
      if (failToast && audioToggleGraceActive()) {
        adaptive.consumedToasts.add(failToast);
        failToast = null;
      }
    }
    if (confirmed) {
      const settledName = activeClean || adaptive.switching.targetClean;
      adaptive.switching = null;
      adaptive.stepsUsed++;
      adaptive.failures = 0;
      adaptive.retryAt = 0;
      adaptive.cooldownUntil = now + cfg.cooldownMs;
      adaptive.lastActiveClean = settledName;
      console.log(`[智能降画质] 降档成功: ${settledName}（本视频第 ${adaptive.stepsUsed} 次）`);
      adaptiveFeedbackToast(settledName);
      adaptiveDismissBiliToast();
    } else if (failToast) {
      adaptive.consumedToasts.add(failToast);
      adaptiveSwitchFailed("B 站提示切换失败");
    } else if (takenOver) {
      const fromQn = adaptive.switching.fromQn;
      const realQ = adaptiveReadRealQ();
      const undecidable = fromQn === null || realQ === null;
      const targetKey = `${adaptive.switching.targetQn || ""}|${adaptive.switching.targetClean}`;
      if (!undecidable && realQ === fromQn) {
        adaptiveSwitchFailed("切换未被受理");
      } else if (undecidable && adaptive.blindYieldKey === targetKey) {
        adaptive.blindYieldKey = "";
        adaptiveSwitchFailed("同一档位连续两次未被受理");
      } else {
        adaptive.blindYieldKey = undecidable ? targetKey : "";
        adaptive.switching = null;
        adaptive.retryAt = 0;
        adaptive.cooldownUntil = Math.max(adaptive.cooldownUntil, now + cfg.settleMs);
        adaptive.lastActiveClean = activeClean || adaptive.lastActiveClean;
        console.log("[智能降画质] 切换期间画质被外部接管，让位并进入宽限期");
      }
    } else if (!adaptiveDeadlinePending(now, adaptive.switching.deadline, ADAPTIVE_CONFIRM_TIMEOUT_MS)) {
      adaptiveSwitchFailed("确认超时", "timeout");
    }
    if (video) adaptive.lastCt = video.currentTime;
    adaptiveResetSignals();
  }
  function adaptiveDetectStall(now, cfg, frozen) {
    const inSeekGrace = now - adaptive.lastSeekAt < ADAPTIVE_SEEK_GRACE_MS;
    if (frozen) {
      if (inSeekGrace) {
        adaptive.stallStartAt = 0;
      } else if (!adaptive.stallStartAt) {
        adaptive.stallStartAt = now;
      } else if (now - adaptive.stallStartAt >= cfg.hardStallMs) {
        if (adaptiveTryDowngrade(`连续卡顿超过 ${cfg.hardStallMs / 1e3} 秒`)) {
          adaptive.stallStartAt = 0;
        }
      }
      return true;
    }
    if (adaptive.stallStartAt) {
      const stallDuration = now - adaptive.stallStartAt;
      adaptive.stallStartAt = 0;
      if (stallDuration >= cfg.strikeMinMs && !adaptiveArmPending(now)) {
        adaptive.strikes.push(now);
      }
    }
    adaptive.strikes = adaptive.strikes.filter((t) => now - t <= cfg.strikeWindowMs);
    if (adaptive.strikes.length >= cfg.strikesToTrigger) {
      if (adaptiveTryDowngrade(`${cfg.strikeWindowMs / 1e3} 秒内发生 ${cfg.strikesToTrigger} 次卡顿`)) {
        adaptive.strikes = [];
      }
      return true;
    }
    return false;
  }
  function adaptiveDetectBufferDrain(now, cfg, video) {
    if (!cfg.predictive || adaptiveArmPending(now) || adaptiveDeadlinePending(now, adaptive.cooldownUntil, cfg.cooldownMs)) {
      adaptive.bufferSamples = [];
      return;
    }
    let bufferAhead = -1;
    try {
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= video.currentTime && video.currentTime <= video.buffered.end(i)) {
          bufferAhead = video.buffered.end(i) - video.currentTime;
          break;
        }
      }
    } catch (e) {
      adaptiveDebugOnce(e);
      return;
    }
    if (bufferAhead < 0) {
      adaptive.bufferSamples = [];
      return;
    }
    if (video.currentTime + bufferAhead >= video.duration - 2) {
      adaptive.bufferSamples = [];
      return;
    }
    const lastSample = adaptive.bufferSamples[adaptive.bufferSamples.length - 1];
    if (lastSample && now - lastSample.t < ADAPTIVE_TICK_MS / 2) return;
    const monoNow = performance.now();
    if (lastSample) {
      const ctAdvance = video.currentTime - lastSample.ct;
      const clockAdvance = (monoNow - lastSample.pt) / 1e3 * (video.playbackRate || 1);
      const jumped = ctAdvance < 0 || ctAdvance > clockAdvance + 1;
      if (jumped || lastSample.ahead - bufferAhead > Math.max(ctAdvance, clockAdvance) * 1.2) {
        adaptive.bufferSamples = [{ t: now, ct: video.currentTime, pt: monoNow, ahead: bufferAhead }];
        return;
      }
    }
    adaptive.bufferSamples.push({ t: now, ct: video.currentTime, pt: monoNow, ahead: bufferAhead });
    if (adaptive.bufferSamples.length > 8) adaptive.bufferSamples.shift();
    const oldest = adaptive.bufferSamples[0];
    const newest = adaptive.bufferSamples[adaptive.bufferSamples.length - 1];
    const spanS = (newest.t - oldest.t) / 1e3;
    if (spanS >= 2.5 && newest.ahead < cfg.lowWaterS) {
      const drainRate = (oldest.ahead - newest.ahead) / spanS;
      if (drainRate >= cfg.drainRateS) {
        adaptive.bufferSamples = [];
        adaptiveTryDowngrade(`缓冲即将耗尽（余量 ${newest.ahead.toFixed(1)} 秒，流失 ${drainRate.toFixed(2)} 秒/秒）`);
      }
    }
  }
  var ADAPTIVE_ARM_OUTCOME = {
    switched: true,
    settled: true,
    abandoned: true,
    delegated: true,
    pending: false,
    stalled: false
  };
  function adaptiveTick() {
    const now = Date.now();
    const cfg = adaptiveConfig();
    const monoNow = performance.now();
    const sinceLastTick = adaptive.lastTickAt ? monoNow - adaptive.lastTickAt : 0;
    const sinceLastWall = adaptive.lastTickWallAt ? now - adaptive.lastTickWallAt : 0;
    const clockDrift = Math.abs(sinceLastWall - sinceLastTick);
    adaptive.lastTickAt = monoNow;
    adaptive.lastTickWallAt = now;
    if (sinceLastTick > ADAPTIVE_TICK_MS * ADAPTIVE_TICK_GAP_FACTOR || clockDrift > ADAPTIVE_TICK_MS * ADAPTIVE_TICK_GAP_FACTOR) {
      adaptiveResetSignals();
      adaptive.lastCt = -1;
      if (adaptive.switching) {
        adaptive.switching.deadline = Math.min(adaptive.switching.deadline + sinceLastTick, now + ADAPTIVE_CONFIRM_TIMEOUT_MS);
      }
      return;
    }
    adaptiveEnsurePlayerBinding();
    const video = document.querySelector("video");
    if (video && video.seeking) adaptive.lastSeekAt = now;
    if (adaptive.switching) {
      adaptiveTickSwitching(now, cfg, video, adaptiveReadActiveClean());
      return;
    }
    if (!ADAPTIVE_ARM_OUTCOME[state.qualityFlow]) {
      adaptive.flowDoneSeen = false;
      return;
    }
    if (!adaptive.flowDoneSeen) {
      adaptive.flowDoneSeen = true;
      const doubleCheck = getDoubleCheckConfig(false);
      adaptive.armedAt = now + Math.max(cfg.settleMs, doubleCheck.enabled ? doubleCheck.delayMs + ADAPTIVE_ARM_VERIFY_BUFFER_MS : 0);
      adaptive.lastActiveClean = adaptiveReadActiveClean();
      adaptive.lastCt = -1;
      adaptiveResetSignals();
      return;
    }
    if (!video) return;
    const activeClean = adaptiveReadActiveClean();
    if (video.readyState === 0) return;
    if (activeClean && adaptive.lastActiveClean && activeClean !== adaptive.lastActiveClean) {
      console.log(`[智能降画质] 检测到外部画质变更: ${adaptive.lastActiveClean} → ${activeClean}，进入宽限期`);
      adaptive.cooldownUntil = Math.max(adaptive.cooldownUntil, now + cfg.settleMs);
      adaptiveResetSignals();
    }
    if (activeClean) adaptive.lastActiveClean = activeClean;
    if (adaptive.retryAt && !adaptiveDeadlinePending(now, adaptive.retryAt, ADAPTIVE_FAIL_RETRY_BACKOFF_MS)) {
      const retryOutcome = adaptiveTryDowngrade("上次切换失败，改试更低一档");
      if (retryOutcome || !adaptiveDeadlinePending(now, adaptive.retryExpireAt, adaptiveRetryChainMaxMs())) {
        adaptive.retryAt = 0;
        adaptive.retryExpireAt = 0;
      }
      if (adaptive.switching) return;
    }
    const toastEl = Utils.queryAll(BILI.video.toastText).find((el) => ADAPTIVE_TOAST_PATTERN.test(el.textContent || "") && !adaptive.consumedToasts.has(el));
    if (toastEl) {
      const outcome = adaptiveTryDowngrade(`B 站弱网提示"${(toastEl.textContent || "").trim()}"`);
      if (outcome) adaptive.consumedToasts.add(toastEl);
      if (adaptive.switching) return;
    }
    const previousCt = adaptive.lastCt;
    adaptive.lastCt = video.currentTime;
    if (video.paused || video.ended || video.seeking) {
      adaptiveResetSignals();
      return;
    }
    if (previousCt < 0) return;
    const frozen = video.currentTime === previousCt;
    if (adaptiveDetectStall(now, cfg, frozen)) return;
    adaptiveDetectBufferDrain(now, cfg, video);
  }

  // src/live.ts
  function normalizeLiveCandidates(raw) {
    if (!Array.isArray(raw)) return [];
    const options = [];
    raw.forEach((item) => {
      const q = item;
      if (!q || typeof q !== "object") return;
      const qn = Number(q.qn);
      if (!Number.isFinite(qn) || qn <= 0) return;
      options.push({ qn, desc: typeof q.desc === "string" ? q.desc : "" });
    });
    return options;
  }
  function describeDroppedCandidates(raw, kept) {
    if (kept > 0 || !Array.isArray(raw) || raw.length === 0) return void 0;
    const first = raw[0];
    const keys = first && typeof first === "object" ? Object.keys(first).join("/") : typeof first;
    return `原始 ${raw.length} 项全部无效，首项字段: ${keys}`;
  }
  function liveQualityLabel(q) {
    return q.desc || `qn ${q.qn}`;
  }
  var liveSession = null;
  function liveRoomKey() {
    try {
      return window.location.pathname;
    } catch (e) {
      debugTransient(e);
      return "";
    }
  }
  function liveSessionState() {
    const roomKey = liveRoomKey();
    if (!liveSession || liveSession.roomKey !== roomKey) {
      _liveUserInputAt = 0;
      liveSession = {
        roomKey,
        lastSwitch: null,
        consecutiveFailures: /* @__PURE__ */ new Map(),
        blockedQns: /* @__PURE__ */ new Set(),
        yieldedSetting: null,
        yieldedAt: 0,
        yieldCount: 0,
        lastPollNormal: false,
        announcedDowngradeQn: null,
        blindSwitchQn: null
      };
    }
    return liveSession;
  }
  function liveInputInTextEntry(target) {
    const el = target;
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : "";
    return tag === "INPUT" || tag === "TEXTAREA";
  }
  var _liveUserInputAt = 0;
  var _liveUserInputBound = false;
  function bindLiveUserInputWatch() {
    if (_liveUserInputBound) return;
    _liveUserInputBound = true;
    const mark = (e) => {
      if (!e.isTrusted) return;
      if (liveInputInTextEntry(e.target)) return;
      _liveUserInputAt = Date.now();
    };
    ["pointerdown", "keydown"].forEach((name) => document.addEventListener(name, mark, { capture: true, passive: true }));
  }
  var LIVE_MANUAL_INPUT_SETTLE_MS = 15e3;
  function liveRecentUserInput(intervalMs) {
    if (_liveUserInputAt === 0) return false;
    const elapsed = Date.now() - _liveUserInputAt;
    return elapsed >= 0 && elapsed <= Math.min(intervalMs, 6e4) + LIVE_MANUAL_INPUT_SETTLE_MS;
  }
  var LIVE_YIELD_TTL_MS = 5 * 60 * 1e3;
  var LIVE_YIELD_STICKY_COUNT = 2;
  function liveYieldHolds(yieldedAt, yieldCount, now) {
    if (yieldCount >= LIVE_YIELD_STICKY_COUNT) return true;
    const elapsed = now - yieldedAt;
    return elapsed >= 0 && elapsed < LIVE_YIELD_TTL_MS;
  }
  function liveResetYield(session) {
    session.yieldedSetting = null;
    session.yieldedAt = 0;
    session.yieldCount = 0;
  }
  function liveLockYielded() {
    const session = liveSessionState();
    if (session.yieldedSetting === null) return false;
    if (session.yieldedSetting !== state.userLiveQualitySetting) {
      liveResetYield(session);
      return false;
    }
    if (liveYieldHolds(session.yieldedAt, session.yieldCount, Date.now())) return true;
    session.yieldedSetting = null;
    session.yieldedAt = 0;
    console.log("[直播画质] 手动切换让位已到期，恢复画质锁定；若当前画质就是你要的，再改一次即可长期保留");
    return false;
  }
  function liveNameMatches(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length < 2 || b.length < 2) return false;
    return a.includes(b) || b.includes(a);
  }
  function liveDesiredQn(setting) {
    const direct = BILI.live.qnMap[setting];
    if (typeof direct === "number") return direct;
    const key = Object.keys(BILI.live.qnMap).find((k) => liveNameMatches(k, setting));
    if (key === void 0) return void 0;
    const mapped = BILI.live.qnMap[key];
    return typeof mapped === "number" ? mapped : void 0;
  }
  function describeTargetMiss(info) {
    if (!info) return "播放器信息不可用";
    if (info.qualityCandidates.length > 0) {
      const blocked = liveSessionState().blockedQns;
      const usable = info.qualityCandidates.filter((q) => !blocked.has(q.qn));
      if (usable.length === 0) return "本直播间的候选档位已全部切换失败并拉黑";
      return `未找到匹配项: ${state.userLiveQualitySetting}；本直播间可用: ${usable.map(liveQualityLabel).join("、")}`;
    }
    return info.candidatesDigest ? `候选全部无效，${info.candidatesDigest}` : "候选列表为空";
  }
  function pickHighest(candidates) {
    return candidates.reduce((best, q) => q.qn > best.qn ? q : best, candidates[0]);
  }
  function resolveLiveTargetQuality(qualityCandidates) {
    const blocked = liveSessionState().blockedQns;
    const candidates = (qualityCandidates || []).filter((q) => !blocked.has(q.qn));
    if (candidates.length === 0) return null;
    const setting = state.userLiveQualitySetting;
    let resolution = null;
    if (setting === "最高画质") resolution = { option: pickHighest(candidates) };
    else {
      const desiredQn = liveDesiredQn(setting);
      if (desiredQn !== void 0) {
        const byQn = candidates.find((q) => q.qn === desiredQn);
        if (byQn) resolution = { option: byQn };
      }
      if (!resolution) {
        const byName = candidates.find((q) => (desiredQn === void 0 || q.qn <= desiredQn) && liveNameMatches(q.desc, setting));
        if (byName) resolution = { option: byName };
      }
      if (!resolution && desiredQn !== void 0) {
        const lower = candidates.filter((q) => q.qn < desiredQn);
        if (lower.length > 0) resolution = { option: pickHighest(lower), downgradedFrom: setting };
      }
    }
    if (!resolution) return null;
    return resolution;
  }
  function announceLiveDowngrade(resolution) {
    if (!resolution.downgradedFrom) return;
    const session = liveSessionState();
    if (session.announcedDowngradeQn === resolution.option.qn) return;
    session.announcedDowngradeQn = resolution.option.qn;
    console.log(`[直播画质] 本直播间没有「${resolution.downgradedFrom}」，已就近降到「${liveQualityLabel(resolution.option)}」(qn: ${resolution.option.qn})`);
  }
  function liveFacadeInfo() {
    try {
      const lp = unsafeWindow.livePlayer;
      if (lp && typeof lp.getPlayerInfo === "function") {
        const info = lp.getPlayerInfo();
        if (!info) return null;
        const quality = Number(info.quality);
        const qualityCandidates = normalizeLiveCandidates(info.qualityCandidates);
        return {
          playurl: info.playurl,
          quality: Number.isFinite(quality) ? quality : void 0,
          qualityCandidates,
          candidatesDigest: describeDroppedCandidates(info.qualityCandidates, qualityCandidates.length),
          danmaku: info.danmaku
        };
      }
    } catch (e) {
      debugTransient(e);
    }
    return null;
  }
  var liveSwitchSeq = 0;
  var LIVE_SWITCH_DEDUPE_MS = 1e3;
  function liveSwitchQuality(qn, options = {}) {
    const session = liveSessionState();
    const last = session.lastSwitch;
    const sinceLast = last ? Date.now() - last.at : Infinity;
    if (!options.force && last && last.targetQn === qn && sinceLast >= 0 && sinceLast < LIVE_SWITCH_DEDUPE_MS) {
      debugTransient(`[直播画质] ${LIVE_SWITCH_DEDUPE_MS} 毫秒内重复请求 qn=${qn}，已去重`);
      return true;
    }
    try {
      const lp = unsafeWindow.livePlayer;
      if (lp && typeof lp.switchQuality === "function") {
        const seq = ++liveSwitchSeq;
        session.lastSwitch = { targetQn: qn, fromQn: options.fromQn, at: Date.now(), confirmed: false };
        const result = lp.switchQuality(qn);
        if (result && typeof result.catch === "function") {
          result.catch((reason) => {
            if (seq !== liveSwitchSeq) {
              debugTransient(reason);
              return;
            }
            console.warn("[直播画质] 切换调用被拒绝:", reason);
          });
        }
        return true;
      }
    } catch (e) {
      debugTransient(e);
    }
    return false;
  }
  var LIVE_SWITCH_MAX_FAILURES = 2;
  function liveNoteSwitchFailure(target) {
    const session = liveSessionState();
    const count = (session.consecutiveFailures.get(target.qn) || 0) + 1;
    session.consecutiveFailures.set(target.qn, count);
    if (count < LIVE_SWITCH_MAX_FAILURES) {
      console.log(`[直播画质] 「${liveQualityLabel(target)}」第 ${count} 次未切换成功，稍后重试`);
      return false;
    }
    session.consecutiveFailures.delete(target.qn);
    session.blockedQns.add(target.qn);
    console.warn(`[直播画质] 「${liveQualityLabel(target)}」连续 ${count} 次切不过去（付费直播、舰长专属、大会员专属档常见此现象），本直播间内不再尝试该档，改用可用的次高档；换直播间后重置`);
    updatePollingStatusIndicator();
    return true;
  }
  function liveNoteSwitchSettled(qn) {
    const session = liveSessionState();
    session.consecutiveFailures.delete(qn);
    if (session.lastSwitch && session.lastSwitch.targetQn === qn) session.lastSwitch.confirmed = true;
  }
  var LIVE_VERIFY_MAX_ROUNDS = 2;
  function scheduleLiveVerify(taskId, target, delayMs, waitMs, round) {
    runSafely(taskQueue.scheduleTask(taskId, async () => {
      if (taskQueue.isTaskCancelled(taskId)) return;
      const nextRound = (next) => {
        if (round >= LIVE_VERIFY_MAX_ROUNDS) {
          console.log(`[直播画质] 已验证 ${round} 轮仍未落地，停止自动重试（重选画质或开启轮询锁定可继续纠正）`);
          return;
        }
        scheduleLiveVerify(taskId, next, delayMs, delayMs, round + 1);
      };
      const afterInfo = liveFacadeInfo();
      if (!afterInfo) return;
      if (afterInfo.quality === target.qn) {
        liveNoteSwitchSettled(target.qn);
        console.log("[直播画质] 画质切换验证成功，当前画质:", liveQualityLabel(target));
        return;
      }
      const sw = liveSessionState().lastSwitch;
      if (sw && sw.targetQn === target.qn && !sw.confirmed) {
        const remainMs = sw.at + LIVE_SWITCH_INFLIGHT_MS - Date.now();
        if (remainMs > 0 && remainMs <= LIVE_SWITCH_INFLIGHT_MS) {
          debugTransient(`[直播画质] 切换仍在在途宽限内，${remainMs} 毫秒后再验`);
          scheduleLiveVerify(taskId, target, delayMs, remainMs, round);
          return;
        }
      }
      const after = afterInfo.quality;
      if (sw && after !== void 0 && after !== sw.fromQn && after !== sw.targetQn) {
        console.log(`[直播画质] 画质已被改为 qn=${after}（非本脚本所切），不再纠正`);
        return;
      }
      if (after === void 0) {
        console.log("[直播画质] 读不到当前画质，无法验证本次切换，不做重切");
        return;
      }
      const stuck = !sw || after === sw.fromQn;
      if (stuck && liveNoteSwitchFailure(target)) {
        const retry = resolveLiveTargetQuality(afterInfo.qualityCandidates);
        if (!retry) {
          console.warn(`[直播画质] 已无可用的替代档位 (${describeTargetMiss(afterInfo)})，停止切换`);
          return;
        }
        announceLiveDowngrade(retry);
        console.log("[直播画质] 改切可用档位:", liveQualityLabel(retry.option), "(qn:", retry.option.qn, ")");
        const issued = liveSwitchQuality(retry.option.qn, { fromQn: after, force: true });
        if (!issued) console.log("[直播画质] 改切调用失败，播放器可能正在重建");
        updateLiveSettingsPanel();
        updatePollingStatusIndicator();
        if (issued) nextRound(retry.option);
        return;
      }
      console.log("[直播画质] 画质切换可能未成功，执行二次切换...");
      if (!liveSwitchQuality(target.qn, { fromQn: after, force: true })) {
        console.log("[直播画质] 二次切换调用失败，播放器可能正在重建");
        return;
      }
      nextRound(target);
    }, waitMs, "live-quality-double-check"), "直播二次验证");
  }
  var LIVE_READY_PROBE_ATTEMPTS = 30;
  var LIVE_READY_PROBE_INTERVAL_MS = 1e3;
  async function selectLiveQuality() {
    const taskId = taskQueue.currentTaskId;
    const waitKey = `live-wait-${taskId}`;
    const previousWait = taskQueue.activeTimeouts.get(waitKey);
    if (previousWait) {
      clearTimeout(previousWait.timeout);
      previousWait.resolve();
      taskQueue.activeTimeouts.delete(waitKey);
    }
    const readyResult = await new Promise((resolve) => {
      let attempts = 0;
      const finish = (result) => {
        taskQueue.activeTimeouts.delete(waitKey);
        resolve(result);
      };
      const probe = () => {
        if (taskQueue.isTaskCancelled(taskId)) return finish("cancelled");
        const info = liveFacadeInfo();
        let switchable = false;
        try {
          const lp = unsafeWindow.livePlayer;
          switchable = !!(lp && typeof lp.switchQuality === "function");
        } catch (e) {
          debugTransient(e);
        }
        if (info && info.playurl && switchable) return finish("ready");
        if (++attempts >= LIVE_READY_PROBE_ATTEMPTS) return finish("timeout");
        const timeout = setTimeout(probe, LIVE_READY_PROBE_INTERVAL_MS);
        taskQueue.activeTimeouts.set(waitKey, { timeout, resolve: () => resolve("cancelled") });
      };
      probe();
    });
    if (readyResult !== "ready") {
      console.log(readyResult === "cancelled" ? "[直播画质] 任务已取消，停止后续操作" : `[直播画质] 等待播放器就绪超时（约 ${LIVE_READY_PROBE_ATTEMPTS * LIVE_READY_PROBE_INTERVAL_MS / 1e3} 秒；直播间未开播时必然跑满），停止后续操作`);
      return;
    }
    const entryInfo = liveFacadeInfo();
    const qualityCandidates = entryInfo?.qualityCandidates || [];
    console.log("[直播画质] 可用画质选项:", qualityCandidates.map((q, i) => `${i + 1}. ${liveQualityLabel(q)} (qn: ${q.qn})`));
    console.log("[直播画质] 选择的画质:", state.userLiveQualitySetting);
    const resolution = resolveLiveTargetQuality(qualityCandidates);
    if (!resolution) {
      console.log(`[直播画质] 画质切换失败 (${describeTargetMiss(entryInfo)})，跳过切换。`);
      return;
    }
    announceLiveDowngrade(resolution);
    const targetQuality = resolution.option;
    console.log("[直播画质] 目标画质:", liveQualityLabel(targetQuality), "(qn:", targetQuality.qn, ")");
    function switchQuality() {
      if (liveLockYielded()) {
        console.log("[直播画质] 已让位于你的手动切换，跳过本次自动纠正（换直播间、重新选择画质或重开轮询锁定后恢复）");
        return;
      }
      const shouldForceHighestOnce = state.liveEntryForceHighest && state.userLiveQualitySetting === "最高画质";
      const info = liveFacadeInfo();
      if (!info) {
        console.log("[直播画质] 播放器暂不可用，跳过本次切换");
        return;
      }
      const currentQualityNumber = info.quality;
      if (currentQualityNumber !== targetQuality.qn || shouldForceHighestOnce) {
        if (!liveSwitchQuality(targetQuality.qn, { fromQn: currentQualityNumber })) {
          console.log("[直播画质] 切换调用失败，播放器可能正在重建");
          return;
        }
        if (shouldForceHighestOnce) state.liveEntryForceHighest = false;
        state.qualityFlow = "switched";
        console.log("[直播画质] 已切换到目标画质:", liveQualityLabel(targetQuality));
        updateLiveSettingsPanel();
        if (state.liveQualityPollingEnabled && state.livePollingTimerId !== null) {
          console.log("[直播画质] 轮询锁定运行中，跳过二次验证");
        } else {
          const { enabled, delayMs } = getDoubleCheckConfig(true);
          if (enabled) {
            console.log(`[直播画质] 等待 ${delayMs} 毫秒后进行二次验证...`);
            scheduleLiveVerify(taskId, targetQuality, delayMs, delayMs, 1);
          } else {
            console.log("[直播画质] 二次验证已关闭，跳过验证");
          }
        }
      } else {
        liveNoteSwitchSettled(targetQuality.qn);
        state.qualityFlow = "settled";
        console.log("[直播画质] 已经是目标画质:", liveQualityLabel(targetQuality));
        updateLiveSettingsPanel();
      }
    }
    switchQuality();
  }
  function updateLiveSettingsPanel() {
    const panel = document.getElementById("bilibili-live-quality-selector");
    if (panel && typeof panel.updatePanel === "function") panel.updatePanel();
  }
  function updatePollingStatusIndicator() {
    const statusEl = document.getElementById("live-polling-status");
    if (!statusEl) return;
    const pollingActive = state.liveQualityPollingEnabled && state.livePollingTimerId !== null;
    if (!pollingActive) {
      statusEl.textContent = "未启用";
      return;
    }
    const session = liveSessionState();
    const yielded = session.yieldedSetting !== null && session.yieldedSetting === state.userLiveQualitySetting && liveYieldHolds(session.yieldedAt, session.yieldCount, Date.now());
    if (yielded) {
      if (session.yieldCount >= LIVE_YIELD_STICKY_COUNT) {
        statusEl.textContent = "已暂停：多次检测到你手动切换画质，重选画质或换直播间后恢复";
        return;
      }
      const remainMin = Math.max(1, Math.ceil((LIVE_YIELD_TTL_MS - (Date.now() - session.yieldedAt)) / 6e4));
      statusEl.textContent = "已暂停：检测到你手动切换了画质，约 " + remainMin + " 分钟后自动恢复锁定";
      return;
    }
    const base = "运行中，每 " + state.livePollingInterval + " 秒检查一次";
    statusEl.textContent = session.blockedQns.size > 0 ? base + "（已跳过 " + session.blockedQns.size + " 个切不过去的档位）" : base;
  }
  var LIVE_SWITCH_INFLIGHT_MS = 8e3;
  function startLivePolling() {
    stopLivePolling();
    if (!state.liveQualityPollingEnabled) return;
    const intervalMs = state.livePollingInterval * 1e3;
    liveResetYield(liveSessionState());
    bindLiveUserInputWatch();
    console.log(`[直播轮询] 启动画质轮询锁定，间隔 ${state.livePollingInterval} 秒`);
    state.livePollingTimerId = setInterval(() => {
      try {
        updatePollingStatusIndicator();
        if (liveLockYielded()) {
          debugTransient("[直播轮询] 已让位于手动切换，跳过本次轮询");
          return;
        }
        const session = liveSessionState();
        const playerInfo = liveFacadeInfo();
        if (!playerInfo) {
          console.log("[直播轮询] 播放器尚未就绪，跳过本次轮询");
          return;
        }
        const resolution = resolveLiveTargetQuality(playerInfo.qualityCandidates);
        if (!resolution) {
          console.log(`[直播轮询] 未定出目标画质 (${describeTargetMiss(playerInfo)})，跳过本次轮询`);
          return;
        }
        announceLiveDowngrade(resolution);
        const targetQuality = resolution.option;
        const currentQn = playerInfo.quality;
        if (currentQn === targetQuality.qn) {
          liveNoteSwitchSettled(targetQuality.qn);
          if (!session.lastPollNormal) {
            console.log(`[直播轮询] 画质正常：${liveQualityLabel(targetQuality)} (qn=${targetQuality.qn})`);
          } else {
            debugTransient(`[直播轮询] 画质正常：qn=${currentQn}`);
          }
          session.lastPollNormal = true;
          return;
        }
        session.lastPollNormal = false;
        if (currentQn !== void 0) session.blindSwitchQn = null;
        const sw = session.lastSwitch;
        const atStart = !!sw && !sw.confirmed && currentQn !== void 0 && currentQn === sw.fromQn && sw.targetQn !== currentQn;
        const sinceSwitch = sw ? Date.now() - sw.at : 0;
        if (atStart && sw && sinceSwitch >= 0 && sinceSwitch < LIVE_SWITCH_INFLIGHT_MS) {
          debugTransient(`[直播轮询] 上次切换仍在途（qn=${currentQn} → ${sw.targetQn}），本次不动作`);
          return;
        }
        if (currentQn !== void 0 && (!sw || currentQn !== sw.targetQn) && liveRecentUserInput(intervalMs)) {
          session.yieldCount += 1;
          session.yieldedAt = Date.now();
          session.yieldedSetting = state.userLiveQualitySetting;
          const recovery = session.yieldCount >= LIVE_YIELD_STICKY_COUNT ? "本直播间内不再自动恢复" : `约 ${Math.round(LIVE_YIELD_TTL_MS / 6e4)} 分钟后自动恢复`;
          console.log(`[直播轮询] 画质被改动且这段时间页面有真实操作，判定为手动切换（当前 qn=${currentQn}，目标 ${liveQualityLabel(targetQuality)}），已暂停画质锁定让位；${recovery}，换直播间、重新选择画质或重开锁定可立即恢复`);
          updatePollingStatusIndicator();
          return;
        }
        if (atStart && liveNoteSwitchFailure(targetQuality)) {
          const retry = resolveLiveTargetQuality(playerInfo.qualityCandidates);
          if (!retry) {
            console.warn(`[直播轮询] 已无可用的替代档位 (${describeTargetMiss(playerInfo)})，本次跳过`);
            return;
          }
          announceLiveDowngrade(retry);
          console.log(`[直播轮询] 改切可用档位：${liveQualityLabel(retry.option)} (qn=${retry.option.qn})`);
          liveSwitchQuality(retry.option.qn, { fromQn: currentQn, force: true });
          updateLiveSettingsPanel();
          updatePollingStatusIndicator();
          return;
        }
        if (currentQn === void 0) {
          if (session.blindSwitchQn === targetQuality.qn) {
            debugTransient(`[直播轮询] 仍读不到当前画质，已按 qn=${targetQuality.qn} 切过一次，本次不动作`);
            return;
          }
          console.log(`[直播轮询] 读不到当前画质，先按目标 ${liveQualityLabel(targetQuality)} (qn=${targetQuality.qn}) 切一次；在读到有效画质前不再重切`);
          if (liveSwitchQuality(targetQuality.qn, { fromQn: currentQn })) {
            session.blindSwitchQn = targetQuality.qn;
          }
          return;
        }
        console.log(`[直播轮询] 画质偏离：当前 qn=${currentQn}，目标 ${liveQualityLabel(targetQuality)} (qn=${targetQuality.qn})，执行切换`);
        liveSwitchQuality(targetQuality.qn, { fromQn: currentQn });
      } catch (e) {
        console.warn("[直播轮询] 轮询执行出错:", e);
      }
    }, intervalMs);
    updatePollingStatusIndicator();
  }
  function stopLivePolling() {
    if (state.livePollingTimerId !== null) {
      clearInterval(state.livePollingTimerId);
      state.livePollingTimerId = null;
      console.log("[直播轮询] 已停止画质轮询锁定");
    }
    liveResetYield(liveSessionState());
    updatePollingStatusIndicator();
  }
  function restartLivePollingIfNeeded() {
    if (state.liveQualityPollingEnabled) {
      startLivePolling();
    }
  }
  function startLiveKeepAlive() {
    stopLiveKeepAlive();
    if (!state.liveKeepAliveEnabled) return;
    const intervalMs = state.liveKeepAliveInterval * 60 * 1e3;
    console.log(`[直播保活] 启动模拟活跃，间隔 ${state.liveKeepAliveInterval} 分钟`);
    state.liveKeepAliveTimerId = setInterval(() => {
      try {
        const evt = new MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
          clientX: Math.floor(Math.random() * window.innerWidth),
          clientY: Math.floor(Math.random() * window.innerHeight)
        });
        const target = document.querySelector("video") || document.body || document;
        target.dispatchEvent(evt);
        console.log("[直播保活] 已模拟鼠标移动");
      } catch (e) {
        console.warn("[直播保活] 模拟操作失败:", e);
      }
    }, intervalMs);
    updateKeepAliveStatusIndicator();
  }
  function stopLiveKeepAlive() {
    if (state.liveKeepAliveTimerId !== null) {
      clearInterval(state.liveKeepAliveTimerId);
      state.liveKeepAliveTimerId = null;
      console.log("[直播保活] 已停止模拟活跃");
    }
    updateKeepAliveStatusIndicator();
  }
  function updateKeepAliveStatusIndicator() {
    const statusEl = document.getElementById("live-keepalive-status");
    if (!statusEl) return;
    const active = state.liveKeepAliveEnabled && state.liveKeepAliveTimerId !== null;
    statusEl.textContent = active ? "运行中，每 " + state.liveKeepAliveInterval + " 分钟模拟一次" : "未启用";
  }
  var _danmakuSyncing = false;
  var _danmakuForcedOff = false;
  var _danmakuPagehideBound = false;
  function bindDanmakuRestoreOnPagehide() {
    if (_danmakuPagehideBound) return;
    _danmakuPagehideBound = true;
    window.addEventListener("pagehide", () => {
      if (!_danmakuForcedOff) return;
      if (liveSetDanmakuDisplay(true)) _danmakuForcedOff = false;
    });
  }
  function liveSetDanmakuDisplay(display) {
    try {
      const lp = unsafeWindow.livePlayer;
      if (lp && typeof lp.updateDMSetting === "function") {
        lp.updateDMSetting({ display });
        return true;
      }
    } catch (e) {
      debugTransient(e);
    }
    return false;
  }
  function syncLiveDanmaku() {
    if (_danmakuSyncing) return;
    try {
      const lp = unsafeWindow.livePlayer;
      if (!lp?.getPlayerInfo || !lp?.updateDMSetting) return;
      if (!lp.getPlayerInfo()?.danmaku?.display) {
        if (_danmakuForcedOff && liveSetDanmakuDisplay(true)) {
          _danmakuForcedOff = false;
          console.log("[弹幕同步] 已补开上次未恢复的弹幕");
        }
        return;
      }
      _danmakuSyncing = true;
      _danmakuForcedOff = true;
      bindDanmakuRestoreOnPagehide();
      if (!liveSetDanmakuDisplay(false)) {
        _danmakuSyncing = false;
        _danmakuForcedOff = false;
        return;
      }
      setTimeout(() => {
        if (liveSetDanmakuDisplay(true)) {
          _danmakuForcedOff = false;
          console.log("[弹幕同步] 已刷新直播弹幕");
        } else {
          console.warn("[弹幕同步] 恢复弹幕显示失败，将在下次同步或离开页面时补开");
        }
        _danmakuSyncing = false;
      }, 500);
    } catch (e) {
      _danmakuSyncing = false;
      console.warn("[弹幕同步] 执行失败:", e);
    }
  }

  // src/video-quality.ts
  function selectQualityBasedOnSetting() {
    if (state.isLivePage) {
      runSafely(selectLiveQuality(), "直播画质");
    } else {
      runSafely(selectVideoQuality(), "画质设置");
    }
  }
  var audioToggleGraceUntil = 0;
  function audioToggleGraceActive() {
    const remaining = audioToggleGraceUntil - Date.now();
    return remaining > 0 && remaining <= QUALITY_FAIL_WATCH_WINDOW_MS;
  }
  var audioToggleAttempts = /* @__PURE__ */ new Map();
  var AUDIO_TOGGLE_EFFECT_MIN_MS = 1e3;
  async function setAudioQuality(taskId, retryCount = 0) {
    if (taskQueue.isTaskCancelled(taskId)) return;
    if (!state.isVipUser) {
      console.log("[音质设置] 非会员用户，略过音质设置");
      return;
    }
    const maxRetries = state.devModeEnabled ? state.devModeAudioRetries : PROD_AUDIO_RETRIES;
    const baseDelay = state.devModeEnabled ? state.devModeAudioDelay : PROD_AUDIO_DELAY_MS;
    const retryInterval = baseDelay * Math.pow(2, retryCount);
    function tryToggle(buttonSelector, shouldEnable, label) {
      if (taskQueue.isTaskCancelled(taskId)) return "ok";
      const button = document.querySelector(buttonSelector);
      if (!button) {
        if (shouldEnable) console.log(`[音质设置] ${label}按钮尚未渲染，等待重试 (第${retryCount + 1}次尝试)`);
        return shouldEnable ? "missing" : "ok";
      }
      const isActive = button.classList.contains(BILI.video.ctrlActiveClass);
      const attempt = audioToggleAttempts.get(buttonSelector);
      if (attempt) {
        if (attempt.wasActive !== isActive) {
          audioToggleAttempts.delete(buttonSelector);
        } else if (attempt.converged || Date.now() - attempt.at >= AUDIO_TOGGLE_EFFECT_MIN_MS) {
          if (!attempt.converged) {
            attempt.converged = true;
            console.warn(`[音质设置] ${label}点击后选中态未变化，停止重试以免音轨反复中断（站方选中类名可能已变更）`);
          }
          return "ok";
        }
      }
      if (shouldEnable !== isActive) {
        console.log(`[音质设置] 检测到需${shouldEnable ? "开启" : "关闭"}${label} (第${retryCount + 1}次尝试)`);
        audioToggleAttempts.set(buttonSelector, { at: Date.now(), wasActive: isActive, converged: false });
        button.click();
        return "clicked";
      }
      return "ok";
    }
    console.log(`[音质设置] 开始第${retryCount + 1}次设置`);
    const hiResResult = tryToggle(BILI.video.flacButton, state.hiResAudioEnabled, "Hi-Res音质");
    const dolbyResult = tryToggle(BILI.video.dolbyButton, state.dolbyAtmosEnabled, "杜比全景声");
    if (hiResResult === "clicked" || dolbyResult === "clicked") {
      audioToggleGraceUntil = Date.now() + Math.min(baseDelay, QUALITY_FAIL_WATCH_WINDOW_MS);
    }
    if ([hiResResult, dolbyResult].some((r) => r !== "ok") && retryCount < maxRetries) {
      console.log(`[音质设置] 等待 ${retryInterval / 1e3} 秒后验证设置`);
      await taskQueue.scheduleTask(taskId, async () => {
        if (!taskQueue.isTaskCancelled(taskId)) {
          await setAudioQuality(taskId, retryCount + 1);
        }
      }, retryInterval, "audio-quality-retry");
    } else {
      console.log("[音质设置] 设置完成或达到最大重试次数");
    }
  }
  function isQualityItemActive(item) {
    return item.classList.contains(BILI.video.menuActiveClass) || !!item.querySelector("." + BILI.video.menuActiveClass);
  }
  function findActiveQualityItem(root = document) {
    const items = root.querySelectorAll(BILI.video.qualityMenuItem);
    for (let i = 0; i < items.length; i++) {
      if (isQualityItemActive(items[i])) return items[i];
    }
    return root.querySelector(BILI.video.activeMenuItem);
  }
  function readActiveQualityText() {
    const activeItem = findActiveQualityItem();
    if (activeItem) return parseQualityMenuItem(activeItem).textName;
    const el = document.querySelector(BILI.video.activeQualityText);
    return el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
  }
  function resolveMenuItemBadge(item) {
    const ownBadge = item.querySelector(BILI.video.vipBadge);
    if (ownBadge) return ownBadge;
    if (item.classList.contains(BILI.video.vipVisionGroupItemClass)) {
      const menu = item.closest(BILI.video.qualityMenu);
      const groupTitle = menu ? menu.querySelector(BILI.video.vipVisionGroupTitle) : null;
      if (groupTitle) return groupTitle.querySelector(BILI.video.vipBadge);
    }
    return null;
  }
  function parseQualityMenuItem(item) {
    const badge = resolveMenuItemBadge(item);
    const badgeText = badge ? (badge.textContent || "").trim() : "";
    const text = (item.textContent || "").replace(/\s+/g, " ").trim();
    const nameEl = item.querySelector(BILI.video.qualityText);
    let textName = ((nameEl ? nameEl.textContent : text) || "").replace(/\s+/g, " ").trim();
    const qn = parseInt(item.getAttribute(BILI.video.qnAttr) || "", 10);
    if ((qn === 126 || item.querySelector(BILI.video.vipVisionDolbyIcon)) && !textName.includes("杜比视界")) {
      textName = textName ? `${textName} 杜比视界` : "杜比视界";
    } else if ((qn === 125 || item.querySelector(BILI.video.vipVisionHdrIcon)) && !textName.includes("HDR")) {
      textName = textName ? `${textName} HDR` : "HDR";
    }
    const name = badgeText && !textName.includes(badgeText) ? `${textName} ${badgeText}` : textName || text;
    const isGroupVipItem = item.classList.contains(BILI.video.vipVisionGroupItemClass);
    return {
      name,
      textName,
      element: item,
      isVipOnly: !!badge || isGroupVipItem,
      isFreeNow: TRIAL_KEYWORDS.some((k) => text.includes(k)) || !!(badgeText && TRIAL_KEYWORDS.some((k) => badgeText.includes(k)))
    };
  }
  function isQualityFilteredByDevMode(name) {
    if (state.devModeEnabled && state.disableHDROption && HDR_QUALITIES.some((q) => name.includes(q))) return true;
    if (state.devModeEnabled && state.devModeNoLoginStatus && NO_LOGIN_BLOCKED_QUALITIES.some((q) => name.includes(q))) return true;
    return false;
  }
  function isQualityUsableForUser(q) {
    if (state.isVipUser) return true;
    const allowFreeVip = state.devModeEnabled && state.devAllowFreeVipQualities;
    return allowFreeVip ? !q.isVipOnly || q.isFreeNow : !q.isVipOnly && !q.isFreeNow;
  }
  var QUALITY_FAIL_WATCH_TICKS = 16;
  var QUALITY_FAIL_WATCH_INTERVAL_MS = 500;
  var QUALITY_FAIL_WATCH_WINDOW_MS = (QUALITY_FAIL_WATCH_TICKS + 1) * QUALITY_FAIL_WATCH_INTERVAL_MS;
  var qualityFailWatchTimer = null;
  var qualityFailRetryCount = 0;
  var QUALITY_WAIT_RETRY_LIMIT = 3;
  var QUALITY_WAIT_RETRY_DELAY_MS = 2e3;
  var qualityWaitRetryCount = 0;
  var qualityFailConsumedToasts = /* @__PURE__ */ new WeakSet();
  var QUALITY_MENU_RECOVERY_LIMIT = 2;
  var qualityMenuRecoveryObserver = null;
  var qualityMenuRecoveryTarget = null;
  var qualityMenuRecoveryCount = 0;
  function stopQualityMenuRecovery() {
    if (qualityMenuRecoveryObserver) {
      qualityMenuRecoveryObserver.disconnect();
      qualityMenuRecoveryObserver = null;
    }
    qualityMenuRecoveryTarget = null;
  }
  function retargetQualityMenuRecovery() {
    const observer = qualityMenuRecoveryObserver;
    if (!observer) return;
    const menu = document.querySelector(BILI.video.qualityMenu);
    if (!menu || menu === qualityMenuRecoveryTarget) return;
    observer.disconnect();
    qualityMenuRecoveryTarget = menu;
    observer.observe(menu, { childList: true, subtree: true });
    if (menu.parentElement) observer.observe(menu.parentElement, { childList: true });
  }
  function armQualityMenuRecovery(taskId) {
    stopQualityMenuRecovery();
    if (qualityMenuRecoveryCount >= QUALITY_MENU_RECOVERY_LIMIT) return;
    if (!document.querySelector(BILI.video.qualityMenu)) return;
    qualityMenuRecoveryObserver = new MutationObserver(() => {
      retargetQualityMenuRecovery();
      const menu = document.querySelector(BILI.video.qualityMenu);
      if (!menu || menu.querySelectorAll(BILI.video.qualityMenuItem).length === 0) return;
      stopQualityMenuRecovery();
      if (taskQueue.isTaskCancelled(taskId)) return;
      qualityMenuRecoveryCount++;
      console.log("[画质设置] 画质菜单已出现选项，重跑一次画质设置");
      runSafely(selectVideoQuality(), "画质菜单就绪重试");
    });
    retargetQualityMenuRecovery();
  }
  function resetQualityFailWatch() {
    if (qualityFailWatchTimer) {
      clearInterval(qualityFailWatchTimer);
      qualityFailWatchTimer = null;
    }
    qualityFailRetryCount = 0;
    qualityWaitRetryCount = 0;
    stopQualityMenuRecovery();
    qualityMenuRecoveryCount = 0;
    audioToggleGraceUntil = 0;
    audioToggleAttempts.clear();
  }
  function watchQualitySwitchFailure(taskId, targetClean, targetQn) {
    if (qualityFailWatchTimer) {
      clearInterval(qualityFailWatchTimer);
      qualityFailWatchTimer = null;
    }
    adaptiveHoldObservation(Date.now() + QUALITY_FAIL_WATCH_WINDOW_MS);
    Utils.queryAll(BILI.video.toastText).forEach((el) => {
      if (ADAPTIVE_FAIL_TOAST_PATTERN.test(el.textContent || "")) qualityFailConsumedToasts.add(el);
    });
    let ticks = 0;
    const startedAt = Date.now();
    qualityFailWatchTimer = setInterval(() => {
      if (taskQueue.isTaskCancelled(taskId) || Date.now() - startedAt >= QUALITY_FAIL_WATCH_WINDOW_MS || ++ticks > QUALITY_FAIL_WATCH_TICKS) {
        clearInterval(qualityFailWatchTimer);
        qualityFailWatchTimer = null;
        return;
      }
      const facadeConfirmed = adaptiveConfirmByFacade(targetQn);
      const switchConfirmed = facadeConfirmed !== null ? facadeConfirmed : !!targetClean && adaptiveReadActiveClean() === targetClean;
      if (switchConfirmed) {
        clearInterval(qualityFailWatchTimer);
        qualityFailWatchTimer = null;
        qualityFailRetryCount = 0;
        return;
      }
      if (adaptive.switching) {
        Utils.queryAll(BILI.video.toastText).forEach((el) => {
          if (ADAPTIVE_FAIL_TOAST_PATTERN.test(el.textContent || "")) qualityFailConsumedToasts.add(el);
        });
        return;
      }
      const failToast = Utils.queryAll(BILI.video.toastText).find((el) => ADAPTIVE_FAIL_TOAST_PATTERN.test(el.textContent || "") && !qualityFailConsumedToasts.has(el));
      if (!failToast) return;
      qualityFailConsumedToasts.add(failToast);
      if (audioToggleGraceActive() && adaptiveSettledElsewhere(targetQn) !== true) return;
      clearInterval(qualityFailWatchTimer);
      qualityFailWatchTimer = null;
      state.qualityFlow = "pending";
      qualityFailRetryCount++;
      if (qualityFailRetryCount >= 2) {
        console.warn("[画质设置] 连续切换失败已达上限，保持当前画质等待手动处理");
        state.qualityFlow = "abandoned";
        return;
      }
      console.log(`[画质设置] 检测到 B 站切换失败提示，重试画质设置（第 ${qualityFailRetryCount} 次）`);
      runSafely(taskQueue.scheduleTask(taskId, async () => {
        if (taskQueue.isTaskCancelled(taskId)) return;
        if (adaptive.switching) {
          taskQueue.cancelSlot("video-quality-double-check");
          state.qualityFlow = "delegated";
          return;
        }
        await selectVideoQuality();
      }, 1200, "video-quality-fail-retry"), "画质失败重试");
    }, QUALITY_FAIL_WATCH_INTERVAL_MS);
  }
  function collectAvailableQualities() {
    const qualityMenu = document.querySelector(BILI.video.qualityMenu);
    if (!qualityMenu) return null;
    const qualityItems = Array.from(
      qualityMenu.querySelectorAll(BILI.video.qualityMenuItem)
    );
    const availableQualities = qualityItems.map(parseQualityMenuItem).filter((q) => !isQualityFilteredByDevMode(q.name)).filter((q) => !q.textName.includes(BILI.video.autoQualityKeyword));
    if (state.devModeEnabled && state.devModeNoLoginStatus) {
      console.log("[未登录模式] 已过滤高于1080P的画质，可用画质:", availableQualities.map((q) => q.name));
    }
    console.log("[画质设置] 可用画质:", availableQualities.map((q) => q.name));
    console.log("[画质设置] 会员状态:", state.isVipUser ? "是" : "否");
    return availableQualities;
  }
  function keepCurrentDecision(availableQualities, message) {
    console.log(message);
    return availableQualities.length > 0 ? { kind: "settle" } : { kind: "wait" };
  }
  function resolveCustomSortBranch(availableQualities) {
    const order = normalizeCustomOrder(state.customQualityOrder);
    const cutoff = order.indexOf(CUSTOM_HIGHEST);
    const prefs = order.slice(0, cutoff);
    let targetQuality;
    let useDefault = false;
    for (const pref of prefs) {
      if (pref === CUSTOM_DEFAULT) {
        useDefault = true;
        break;
      }
      const match = availableQualities.find((q) => isQualityUsableForUser(q) && qualityNameMatches(cleanQuality(q.name), pref));
      if (match) {
        targetQuality = match;
        break;
      }
    }
    if (useDefault) {
      console.log("[画质设置] 自定义顺序命中“默认”，使用默认画质");
      return { decision: { kind: "settle" } };
    }
    let usedFallback = false;
    if (!targetQuality) {
      const ordered = state.isVipUser ? availableQualities : [...availableQualities].sort((a, b) => qualitySortRank(a.name) - qualitySortRank(b.name));
      targetQuality = ordered.find(isQualityUsableForUser) || null;
      usedFallback = true;
    }
    if (!targetQuality) {
      return { decision: keepCurrentDecision(availableQualities, "[画质设置] 自定义顺序未匹配到可用画质，保持当前画质") };
    }
    console.log("[画质设置] 自定义模式目标画质: " + targetQuality.name + (usedFallback ? "（兜底最高画质）" : ""));
    return { target: targetQuality, guardDowngrade: usedFallback };
  }
  function resolveHighestBranch(availableQualities) {
    const hasFreeVip = availableQualities.some((q) => q.isFreeNow);
    const allowFreeVipForNonVip = state.devModeEnabled && state.devAllowFreeVipQualities;
    let targetQuality;
    if (state.isVipUser) {
      targetQuality = availableQualities[0];
    } else if (hasFreeVip && allowFreeVipForNonVip) {
      targetQuality = availableQualities.find((q) => q.isFreeNow) || availableQualities.find((q) => !q.isVipOnly);
    } else {
      availableQualities.sort((a, b) => qualitySortRank(a.name) - qualitySortRank(b.name));
      targetQuality = availableQualities.find(isQualityUsableForUser);
      if (!targetQuality) {
        return { decision: keepCurrentDecision(availableQualities, "[画质设置] 未找到可用画质，保持当前画质") };
      }
    }
    return { target: targetQuality, guardDowngrade: true };
  }
  function resolveNamedBranch(availableQualities) {
    const namedMatch = availableQualities.find((q) => qualityNameMatches(cleanQuality(q.name), state.userQualitySetting));
    let targetQuality = namedMatch && isQualityUsableForUser(namedMatch) ? namedMatch : void 0;
    if (namedMatch && !targetQuality) {
      console.log("[画质设置] 目标画质为会员专属且当前不可用，转入兜底选择");
    }
    let usedFallback = false;
    if (!targetQuality) {
      usedFallback = true;
      if (!namedMatch) console.log("[画质设置] 未找到目标画质 " + state.userQualitySetting);
      if (!targetQuality && state.useHighestQualityFallback) {
        const allowFreeVipForNonVip = state.devModeEnabled && state.devAllowFreeVipQualities;
        targetQuality = state.isVipUser ? availableQualities[0] : allowFreeVipForNonVip ? availableQualities.find((q) => q.isFreeNow) || availableQualities.find((q) => !q.isVipOnly) : availableQualities.find((q) => !q.isVipOnly && !q.isFreeNow);
      }
      if (!targetQuality) {
        return { decision: keepCurrentDecision(availableQualities, "[画质设置] 未找到可用画质，保持当前画质") };
      }
    }
    return { target: targetQuality, guardDowngrade: usedFallback };
  }
  function shouldPreventDowngrade(availableQualities, currentQuality, targetQuality) {
    const currentClean = cleanQuality(currentQuality);
    if (currentClean && !currentClean.includes(BILI.video.autoQualityKeyword) && qualitySortRank(currentClean) >= QUALITY_ORDER.length) {
      console.log(`[画质设置] 防护触发：当前画质 ${currentQuality} 不在档位词表内，无从判定与目标 ${targetQuality.name} 的高低，放弃切换`);
      return true;
    }
    const currentQualityItem = availableQualities.find((q) => cleanQuality(q.textName || q.name) === currentClean);
    const currentQualityIndex = currentQualityItem ? availableQualities.indexOf(currentQualityItem) : -1;
    const targetQualityIndex = availableQualities.indexOf(targetQuality);
    if (currentQualityIndex !== -1 && targetQualityIndex > currentQualityIndex) {
      console.log(`[画质设置] 防护触发：当前画质 ${currentQuality} (数组索引${currentQualityIndex}) 高于目标 ${targetQuality.name} (数组索引${targetQualityIndex})，放弃切换`);
      return true;
    }
    return false;
  }
  function resolveVideoQualityTarget(availableQualities, currentQuality, waitRetryAvailable = true) {
    let branch;
    if (state.customSortEnabled) {
      branch = resolveCustomSortBranch(availableQualities);
    } else if (state.userQualitySetting === "最高画质") {
      branch = resolveHighestBranch(availableQualities);
    } else if (state.userQualitySetting === "默认") {
      console.log("[画质设置] 使用默认画质");
      branch = { decision: { kind: "settle" } };
    } else {
      branch = resolveNamedBranch(availableQualities);
    }
    if ("decision" in branch) return branch.decision;
    const targetQuality = branch.target;
    if (!targetQuality || !targetQuality.element) {
      console.warn("[画质设置] 没有可执行的目标画质，等待下次重试");
      return { kind: "wait" };
    }
    console.log("[画质设置] 实际目标画质: " + targetQuality.name);
    if (branch.guardDowngrade) {
      const currentReadable = !!(currentQuality && currentQuality.trim());
      if (!currentReadable && waitRetryAvailable) {
        console.log("[画质设置] 读不到当前画质，本轮不做兜底切换以免降档，等待下次重试");
        return { kind: "wait" };
      }
      if (!currentReadable) {
        console.warn("[画质设置] 仍读不到当前画质，防降档无法判定，按目标画质继续切换");
      } else if (shouldPreventDowngrade(availableQualities, currentQuality, targetQuality)) {
        return { kind: "settle" };
      }
    }
    return { kind: "switch", target: targetQuality };
  }
  function readSettledCurrentQn() {
    const activeItem = findActiveQualityItem();
    if (!activeItem) return null;
    const raw = parseInt(activeItem.getAttribute(BILI.video.qnAttr) || "", 10);
    const qn = Number.isFinite(raw) && raw > 0 ? raw : null;
    return adaptiveConfirmByFacade(qn) === true ? qn : null;
  }
  async function verifyQualitySwitch(taskId, targetQualityNameClean, targetQn, fromQn) {
    if (taskQueue.isTaskCancelled(taskId)) return;
    const currentQualityAfterSwitch = readActiveQualityText();
    const facadeConfirmed = adaptiveConfirmByFacade(targetQn);
    const facadeSettledElsewhere = adaptiveSettledElsewhere(targetQn);
    let verdict;
    if (facadeConfirmed === true) verdict = "ok";
    else if (facadeSettledElsewhere === true) {
      verdict = adaptiveConfirmByFacade(fromQn) === false ? "yield" : "reswitch";
    } else if (facadeConfirmed === false) verdict = "skip";
    else if (currentQualityAfterSwitch) verdict = cleanQuality(currentQualityAfterSwitch) !== cleanQuality(targetQualityNameClean) ? "reswitch" : "ok";
    else verdict = "skip";
    if (verdict === "reswitch") {
      console.log("[画质设置] 画质切换未成功，执行二次切换...");
      const qualityButton = document.querySelector(BILI.video.qualityCtrlButton + ":not(.baq-injected)");
      if (qualityButton) {
        qualityButton.click();
        await Utils.delay(80);
      }
      const qualityMenu = document.querySelector(BILI.video.qualityMenu);
      if (qualityMenu) {
        const freshItems = Array.from(qualityMenu.querySelectorAll(BILI.video.qualityMenuItem));
        const freshTarget = targetQn && freshItems.find((item) => parseInt(item.getAttribute(BILI.video.qnAttr) || "", 10) === targetQn) || freshItems.find((item) => {
          const text = parseQualityMenuItem(item).textName;
          return !text.includes(BILI.video.autoQualityKeyword) && qualityNameMatches(cleanQuality(text), targetQualityNameClean);
        });
        if (freshTarget && !taskQueue.isTaskCancelled(taskId)) {
          freshTarget.click();
          watchQualitySwitchFailure(taskId, targetQualityNameClean, targetQn);
        } else if (!freshTarget) {
          console.warn("[画质设置] 无法重新定位目标画质元素:", targetQualityNameClean);
          state.qualityFlow = "pending";
        }
      } else {
        console.warn("[画质设置] 画质菜单未打开，无法执行二次切换");
        state.qualityFlow = "pending";
      }
    } else if (verdict === "ok") {
      console.log("[画质设置] 画质切换验证成功，当前画质: " + (currentQualityAfterSwitch || targetQualityNameClean));
    } else if (verdict === "yield") {
      console.log("[画质设置] 画质已被改为 " + (currentQualityAfterSwitch || "其它档位") + "（非本脚本所切），不再纠正");
    } else {
      console.log("[画质设置] 二次验证暂无法定论，跳过判定");
    }
  }
  async function executeQualitySwitch(taskId, targetQuality) {
    const targetQualityNameClean = cleanQuality(targetQuality.textName || targetQuality.name);
    const targetQnRaw = parseInt(targetQuality.element.getAttribute(BILI.video.qnAttr) || "", 10);
    const targetQn = Number.isFinite(targetQnRaw) && targetQnRaw > 0 ? targetQnRaw : null;
    const fromQn = readSettledCurrentQn();
    targetQuality.element.click();
    state.qualityFlow = "switched";
    watchQualitySwitchFailure(taskId, targetQualityNameClean, targetQn);
    const { enabled, delayMs } = getDoubleCheckConfig(false);
    if (enabled) {
      console.log(`[画质设置] 等待 ${delayMs} 毫秒后进行二次验证...`);
      runSafely(taskQueue.scheduleTask(taskId, () => verifyQualitySwitch(taskId, targetQualityNameClean, targetQn, fromQn), delayMs, "video-quality-double-check"), "画质二次验证");
    } else {
      console.log("[画质设置] 二次验证已关闭，跳过验证");
    }
  }
  async function selectVideoQuality() {
    const taskId = taskQueue.currentTaskId;
    const currentQuality = readActiveQualityText();
    console.log("[画质设置] 当前画质:", currentQuality);
    console.log("[画质设置] 目标画质:", state.userQualitySetting);
    if (!state.vipStatusChecked) {
      console.log("[画质设置] 等待会员状态检查完成");
      return;
    }
    const availableQualities = collectAvailableQualities();
    if (!availableQualities) {
      console.warn("[画质设置] 未找到画质菜单节点，终止本次切换");
      return;
    }
    const waitRetryAvailable = qualityWaitRetryCount < QUALITY_WAIT_RETRY_LIMIT;
    const decision = resolveVideoQualityTarget(availableQualities, currentQuality, waitRetryAvailable);
    if (decision.kind === "switch") {
      await executeQualitySwitch(taskId, decision.target);
    } else {
      taskQueue.cancelSlot("video-quality-double-check");
      if (decision.kind === "settle") {
        state.qualityFlow = "settled";
      } else if (waitRetryAvailable) {
        qualityWaitRetryCount++;
        console.log(`[画质设置] 暂无可执行目标，${QUALITY_WAIT_RETRY_DELAY_MS} 毫秒后重试（第 ${qualityWaitRetryCount} 次）`);
        runSafely(taskQueue.scheduleTask(taskId, async () => {
          if (taskQueue.isTaskCancelled(taskId)) return;
          await selectVideoQuality();
        }, QUALITY_WAIT_RETRY_DELAY_MS, "video-quality-wait-retry"), "画质等待重试");
      } else {
        console.warn(`[画质设置] 等待重试已达上限（${QUALITY_WAIT_RETRY_LIMIT} 次），本轮放弃，等画质菜单就绪、切回前台或换页再试`);
        state.qualityFlow = "stalled";
        armQualityMenuRecovery(taskId);
      }
    }
    runSafely(setAudioQuality(taskId), "音质设置");
  }

  // src/decode.ts
  var decodeRetryTimer = null;
  var decodeVerifyTimer = null;
  function cancelDecodeRetry() {
    if (decodeRetryTimer) {
      clearTimeout(decodeRetryTimer);
      decodeRetryTimer = null;
    }
    if (decodeVerifyTimer) {
      clearTimeout(decodeVerifyTimer);
      decodeVerifyTimer = null;
    }
  }
  var DECODE_RETRY_BUDGET_MS = 6e4;
  var DECODE_RETRY_MIN_DELAY_MS = 1e3;
  var DECODE_RETRY_MAX_DELAY_MS = 5e3;
  var decodeRetryDeadline = 0;
  function decodeRetryDelay(retryCount) {
    return Math.min(DECODE_RETRY_MIN_DELAY_MS * Math.pow(2, Math.floor(retryCount / 2)), DECODE_RETRY_MAX_DELAY_MS);
  }
  function decodeRetryExhausted() {
    return Date.now() >= decodeRetryDeadline;
  }
  function scheduleDecodeRetry(retryCount) {
    cancelDecodeRetry();
    decodeRetryTimer = setTimeout(() => {
      decodeRetryTimer = null;
      applyDecodeSetting(retryCount + 1);
    }, decodeRetryDelay(retryCount));
  }
  var decodeMissReported = false;
  var DECODE_MAX_CLICK_ATTEMPTS = 3;
  var decodeClickAttempts = 0;
  var DECODE_LIVE_VERIFY_DELAY_MS = 1200;
  function applyDecodeSetting(retryCount = 0) {
    if (retryCount === 0) {
      cancelDecodeRetry();
      decodeRetryDeadline = Date.now() + DECODE_RETRY_BUDGET_MS;
      decodeMissReported = false;
      decodeClickAttempts = 0;
    }
    if (!state.decodeSettingEnabled) {
      console.log("[解码设置] 解码设置未启用，跳过");
      return;
    }
    const wanted = state.isLivePage ? state.userLiveDecodeSetting || "默认" : state.userVideoDecodeSetting || "默认";
    if (state.isLivePage) {
      const decodeList = document.querySelector(BILI.live.decodeList);
      if (!decodeList) {
        if (!decodeRetryExhausted()) {
          scheduleDecodeRetry(retryCount);
        } else {
          console.log("[解码设置] 未找到直播解码列表");
        }
        return;
      }
      const items = Array.from(decodeList.querySelectorAll(BILI.live.decodeItem));
      if (items.length === 0) {
        if (!decodeRetryExhausted()) {
          scheduleDecodeRetry(retryCount);
        } else {
          console.log("[解码设置] 直播解码选项为空");
        }
        return;
      }
      const selectedClass = BILI.live.decodeSelectedClass;
      const itemText = (li) => (li.textContent || "").trim();
      let target = items.find((li) => itemText(li).includes(wanted));
      if (!target && wanted === "默认") {
        target = items.find((li) => BILI.decode.defaultTextPattern.test(itemText(li)));
      }
      if (!target) {
        if (!decodeMissReported) {
          decodeMissReported = true;
          const rendered = items.map(itemText).filter(Boolean);
          console.warn(`[解码设置] 直播页未匹配到「${wanted}」，当前可选项：${rendered.length ? rendered.join(" / ") : "空"}`);
        }
        if (!decodeRetryExhausted()) {
          scheduleDecodeRetry(retryCount);
        } else {
          console.log(`[解码设置] 直播页未找到目标编码「${wanted}」，保持当前设置`);
        }
        return;
      }
      const selectedCount = items.filter((li) => li.classList.contains(selectedClass)).length;
      if (selectedCount !== 1) {
        console.warn(`[解码设置] 直播页选中状态异常（匹配 ${selectedCount} 项），跳过切换`);
      } else if (target.classList.contains(selectedClass)) {
        console.log("[解码设置] 直播页已是目标解码:", itemText(target));
      } else {
        console.log("[解码设置] 直播页切换解码为:", itemText(target));
        const clicked = target;
        decodeClickAttempts++;
        clicked.click();
        decodeVerifyTimer = setTimeout(() => {
          decodeVerifyTimer = null;
          if (clicked.classList.contains(selectedClass)) {
            debugTransient("[解码设置] 直播页解码点击已生效");
            return;
          }
          console.warn(`[解码设置] 直播页解码切换可能未生效：${itemText(clicked)}`);
        }, DECODE_LIVE_VERIFY_DELAY_MS);
      }
    } else {
      let getText2 = function(el) {
        const t = el.querySelector(BILI.decode.radioText);
        return (t && t.textContent ? t.textContent : el.textContent || "").trim();
      };
      var getText = getText2;
      const radioItems = Array.from(document.querySelectorAll(BILI.decode.radioItem));
      if (radioItems.length === 0) {
        if (!decodeRetryExhausted()) {
          scheduleDecodeRetry(retryCount);
        } else {
          console.log("[解码设置] 未找到视频页编码单选项");
        }
        return;
      }
      let target = radioItems.find((el) => getText2(el).includes(wanted));
      if (!target && wanted === "默认") {
        target = radioItems.find((el) => BILI.decode.defaultTextPattern.test(getText2(el)));
      }
      if (!target) {
        if (!decodeMissReported) {
          decodeMissReported = true;
          const rendered = radioItems.map(getText2).filter(Boolean);
          console.warn(`[解码设置] 视频页未匹配到「${wanted}」，当前可选项：${rendered.length ? rendered.join(" / ") : "空"}`);
        }
        if (!decodeRetryExhausted()) {
          scheduleDecodeRetry(retryCount);
        } else {
          console.log(`[解码设置] 视频页未找到目标编码「${wanted}」，保持当前设置`);
        }
        return;
      }
      const input = target.querySelector(BILI.decode.radioInput);
      if (!input) {
        console.warn("[解码设置] 视频页编码项内未找到单选框，跳过切换");
      } else if (input.checked) {
        console.log("[解码设置] 视频页已是目标解码:", getText2(target));
      } else {
        console.log("[解码设置] 视频页切换解码为:", getText2(target));
        decodeClickAttempts++;
        input.click();
        decodeVerifyTimer = setTimeout(() => {
          decodeVerifyTimer = null;
          if (input.checked) return;
          if (decodeClickAttempts >= DECODE_MAX_CLICK_ATTEMPTS) {
            console.warn(`[解码设置] 视频页解码点击 ${decodeClickAttempts} 次仍未生效，站方可能拒绝了该编码，不再重试`);
          } else if (!decodeRetryExhausted()) {
            console.log("[解码设置] 视频页解码点击未生效，稍后重试");
            scheduleDecodeRetry(retryCount);
          } else {
            console.warn("[解码设置] 视频页解码点击未生效，且已超过重试时限");
          }
        }, 0);
      }
    }
    const panel = document.getElementById("bilibili-decode-settings");
    if (panel) updateDecodeButtons(panel);
  }

  // src/features.ts
  var _wsObserver = null;
  var _wsTimeout = null;
  var _wsRaf = null;
  var _wsTick = null;
  var _wsScope = null;
  var _wsLastOutcome = "no-button";
  function clickWide() {
    const btn = document.querySelector(BILI.video.wideButton);
    if (!btn) return "no-button";
    const enter = btn.querySelector(BILI.video.wideEnterIcon);
    if (!enter) return "no-enter-icon";
    if (getComputedStyle(enter).display === "none") return "already-wide";
    btn.click();
    return "clicked";
  }
  function settleOutcome(outcome) {
    _wsLastOutcome = outcome;
    if (outcome === "clicked") {
      console.log("[自动宽屏] 已自动切换到宽屏模式");
      return true;
    }
    return outcome === "already-wide";
  }
  function clearPendingCheck() {
    if (_wsRaf !== null) {
      cancelAnimationFrame(_wsRaf);
      _wsRaf = null;
    }
    if (_wsTick !== null) {
      clearTimeout(_wsTick);
      _wsTick = null;
    }
  }
  function stopWatching() {
    if (_wsObserver) {
      _wsObserver.disconnect();
      _wsObserver = null;
    }
    if (_wsTimeout) {
      clearTimeout(_wsTimeout);
      _wsTimeout = null;
    }
    clearPendingCheck();
    _wsScope = null;
  }
  function armObserver() {
    if (!_wsObserver) return;
    const scope = document.querySelector(BILI.video.controlWrap);
    _wsObserver.disconnect();
    _wsScope = scope;
    if (!scope) {
      _wsObserver.observe(document.getElementById(BILI.video.playerRoot) || document.body, { childList: true, subtree: true });
      return;
    }
    _wsObserver.observe(scope, { childList: true, subtree: true });
    if (scope.parentElement) _wsObserver.observe(scope.parentElement, { childList: true });
  }
  function runCheck() {
    if (!_wsObserver) return;
    if (settleOutcome(clickWide())) {
      stopWatching();
      return;
    }
    if (document.querySelector(BILI.video.controlWrap) !== _wsScope) armObserver();
  }
  function scheduleCheck() {
    if (_wsRaf !== null || _wsTick !== null) return;
    _wsRaf = requestAnimationFrame(() => {
      _wsRaf = null;
      clearPendingCheck();
      runCheck();
    });
    _wsTick = setTimeout(() => {
      _wsTick = null;
      clearPendingCheck();
      runCheck();
    }, 250);
  }
  function applyAutoWidescreen() {
    stopWatching();
    if (!state.autoWidescreen || state.isLivePage) return;
    if (settleOutcome(clickWide())) return;
    _wsObserver = new MutationObserver(scheduleCheck);
    armObserver();
    _wsTimeout = setTimeout(() => {
      const reason = _wsLastOutcome === "no-enter-icon" ? "未找到宽屏切换图标" : "未找到宽屏按钮";
      stopWatching();
      console.warn(`[自动宽屏] 等待 15 秒后放弃：${reason}`);
    }, 15e3);
  }

  // src/config-io.ts
  var CONFIG_FILE_APP = "bilibili-auto-quality";
  function scriptVersion() {
    try {
      if (typeof GM_info !== "undefined" && GM_info && GM_info.script && typeof GM_info.script.version === "string") {
        return GM_info.script.version;
      }
    } catch (e) {
    }
    return "unknown";
  }
  function decodeOrder(raw) {
    let value = raw;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch (e) {
        value = null;
      }
    }
    return normalizeCustomOrder(value);
  }
  function sameOrder(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  function readPersisted(name) {
    const raw = loadSetting(name);
    return name === "customQualityOrder" ? decodeOrder(raw) : raw;
  }
  function exportSettings() {
    const settings = {};
    for (const name of Object.keys(SETTINGS)) {
      settings[SETTINGS[name].key] = readPersisted(name);
    }
    return JSON.stringify({
      app: CONFIG_FILE_APP,
      schema: SCHEMA_VERSION,
      version: scriptVersion(),
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      settings
    }, null, 2);
  }
  function rejectImport(message) {
    console.warn(`[设置] 导入配置被拒绝：${message}`);
    return { applied: 0, ignored: 0, skipped: 0, failed: 0, error: message };
  }
  function importSettings(json) {
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      return rejectImport("内容不是合法的 JSON 文本");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return rejectImport("内容不是一个 JSON 对象");
    }
    const payload = parsed;
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
    const values = payload.settings;
    const registryKeys = /* @__PURE__ */ new Set();
    const store = state;
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
    const ignored = Object.keys(values).filter((key) => !registryKeys.has(key)).length;
    const summary = `写入 ${applied} 项${failed > 0 ? `，写入失败 ${failed} 项` : ""}，未改动 ${skipped} 项，忽略未知键 ${ignored} 项`;
    if (failed > 0) console.warn(`[设置] 导入配置未全部完成：${summary}`);
    else console.log(`[设置] 导入配置完成：${summary}`);
    return { applied, ignored, skipped, failed };
  }
  function resetAllSettings() {
    const store = state;
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

  // src/diagnostics.ts
  var DISCLOSABLE_URL_PARAMS = ["p", "bvid", "oid"];
  function safeUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      const kept = DISCLOSABLE_URL_PARAMS.map((key) => [key, url.searchParams.get(key)]).filter(([, value]) => value !== null);
      url.search = "";
      url.hash = "";
      kept.forEach(([key, value]) => url.searchParams.set(key, value));
      return url.toString();
    } catch (error) {
      return "<地址解析失败，已整条省略>";
    }
  }
  function formatValue(value) {
    if (typeof value === "string") return `"${value}"`;
    if (value === null || value === void 0) return String(value);
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      return JSON.stringify(value);
    } catch (error) {
      return "<无法序列化>";
    }
  }
  function formatDeadline(timestamp, now) {
    if (!timestamp) return "未设置";
    const delta = timestamp - now;
    return delta > 0 ? `${delta}ms 后到期` : `已过期（${-delta}ms 前）`;
  }
  function readPageObject(name) {
    try {
      const value = unsafeWindow[name];
      return value && typeof value === "object" ? value : null;
    } catch (error) {
      return null;
    }
  }
  var PLAYER_METHODS = ["getQuality", "requestQuality", "on", "off"];
  var LIVE_PLAYER_METHODS = ["getPlayerInfo", "switchQuality", "updateDMSetting"];
  function describeFacade(name, methods) {
    const target = readPageObject(name);
    if (!target) return "缺失或不可访问";
    return `存在（${methods.map((m) => `${m}: ${typeof target[m] === "function" ? "有" : "无"}`).join("，")}）`;
  }
  var CONTRACT_DOM_GROUPS = ["video", "header", "decode", "live"];
  function looksLikeSelector(value) {
    return /[.#[]/.test(value);
  }
  function countNodes(selector) {
    try {
      return document.querySelectorAll(selector).length;
    } catch (error) {
      return -1;
    }
  }
  function probeContractSelectors() {
    const hits = [];
    const table = BILI;
    CONTRACT_DOM_GROUPS.forEach((group) => {
      const entries = table[group];
      if (!entries || typeof entries !== "object") return;
      Object.entries(entries).forEach(([key, value]) => {
        if (typeof value !== "string" || !looksLikeSelector(value)) return;
        hits.push({ path: `${group}.${key}`, selector: value, count: countNodes(value) });
      });
    });
    return hits;
  }
  var VIDEO_CRITICAL_ANCHORS = ["video.qualityMenu", "video.qualityMenuItem"];
  var VIDEO_ENTRY_ANCHOR = "video.controlWrap";
  var HEADER_LOGIN_ANCHORS = ["header.avatarWrap", "header.loginEntry"];
  function runContractSelfCheck() {
    const missing = [];
    if (state.isLivePage) {
      if (!readPageObject("livePlayer")) {
        missing.push("页面 window 上的 livePlayer（直播画质切换的唯一通路）");
      }
    } else {
      const hits = probeContractSelectors();
      const anchors = state.injectQualityButton ? VIDEO_CRITICAL_ANCHORS.concat(VIDEO_ENTRY_ANCHOR) : VIDEO_CRITICAL_ANCHORS;
      anchors.forEach((path) => {
        const hit = hits.find((item) => item.path === path);
        if (!hit) {
          missing.push(path);
        } else if (hit.count <= 0) {
          missing.push(`${path} = ${hit.selector}`);
        }
      });
      const headerHit = HEADER_LOGIN_ANCHORS.some((path) => {
        const hit = hits.find((item) => item.path === path);
        return !!hit && hit.count > 0;
      });
      if (!headerHit) {
        missing.push("header.avatarWrap / header.loginEntry");
      }
    }
    if (missing.length === 0) return;
    console.warn("[页面检查] 未找到关键页面节点：" + missing.join("、"));
  }
  function appendBasics(lines) {
    lines.push("===== 哔哩哔哩自动画质 · 运行状态 =====");
    lines.push(`脚本版本: ${SCRIPT_ENV.scriptVersion}`);
    lines.push(`脚本管理器: ${scriptEnvLabel()}`);
    lines.push(`页面类型: ${state.isLivePage ? "直播页" : "视频页"}（脚本路由判定）`);
    lines.push(`页面地址: ${safeUrl(location.href)}`);
    lines.push(`页面 window: ${pageWindowBridge.detail}`);
    lines.push(`可选能力: 菜单命令 ${typeof GM_registerMenuCommand === "function" ? "有" : "无"}，跨标签同步 ${typeof GM_addValueChangeListener === "function" ? "有" : "无"}`);
    const ownUA = navigator.userAgent;
    const pageNavigator = readPageObject("navigator");
    const pageUA = pageNavigator && typeof pageNavigator.userAgent === "string" ? pageNavigator.userAgent : null;
    lines.push(`UA: ${pageUA === null ? `${ownUA}（页面侧读取失败）` : pageUA === ownUA ? pageUA : `${pageUA}（脚本侧为 ${ownUA}）`}`);
    lines.push(`页面已运行: ${Math.round(performance.now() / 1e3)} 秒`);
  }
  function appendSettings(lines) {
    lines.push("");
    lines.push("----- 设置（行首 * 表示与默认值不同）-----");
    const values = state;
    Object.keys(SETTINGS).forEach((name) => {
      const current = formatValue(values[name]);
      const fallback = formatValue(SETTINGS[name].def);
      const changed = current !== fallback;
      lines.push(`${changed ? "*" : " "} ${name} = ${current}${changed ? `（默认 ${fallback}）` : ""}`);
    });
  }
  var QUALITY_FLOW_LABEL = {
    pending: "未落定，等下一轮接手",
    switched: "已点击目标档，等待确认",
    settled: "已判定无需切换",
    stalled: "画质菜单未就绪，本轮停摆",
    abandoned: "连续切换失败，已放弃",
    delegated: "已让位给降画质引擎"
  };
  function qualityFlowLabel(outcome) {
    return QUALITY_FLOW_LABEL[outcome];
  }
  function appendRuntime(lines) {
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
  function appendAdaptive(lines, now) {
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
    lines.push(`切换进行中: ${adaptive.switching ? `是（目标「${adaptive.switching.targetClean}」/ qn ${adaptive.switching.targetQn}）` : "否"}`);
    lines.push(`失败档位 failedQns: ${adaptive.failedQns ? Array.from(adaptive.failedQns).join("、") || "无" : "未初始化"}`);
    lines.push(`最近读到的档位: ${adaptive.lastActiveClean || "未知"}`);
    lines.push(`信号累计: 卡顿记账 ${adaptive.strikes.length} 次，缓冲采样 ${adaptive.bufferSamples.length} 个`);
  }
  function appendProbes(lines) {
    lines.push("");
    lines.push("----- 播放器 facade 探针 -----");
    lines.push(`player: ${describeFacade("player", PLAYER_METHODS)}`);
    lines.push(`livePlayer: ${describeFacade("livePlayer", LIVE_PLAYER_METHODS)}`);
    lines.push("");
    lines.push("----- 契约选择器命中数（行首 ! 表示一个都没命中）-----");
    probeContractSelectors().forEach((hit) => {
      const count = hit.count === -1 ? "选择器非法" : `${hit.count} 个`;
      lines.push(`${hit.count === 0 ? "!" : " "} ${hit.path} = ${count}  ${hit.selector}`);
    });
  }
  function collectDiagnostics() {
    const lines = [];
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

  // src/panel-actions.ts
  function runExportDiagnostics(deps) {
    deps.log(deps.diagnostics());
    deps.log("[诊断信息] 以上是脚本的运行状态快照，请整段复制后随反馈一并提供（其中不含账号信息与地址跟踪参数）");
  }
  function runExportSettings(deps) {
    deps.log(deps.exportSettings());
    deps.log("[设置] 以上是当前全部设置的 JSON 备份，请整段复制保存；导入时粘贴到「导入设置」提示框");
  }
  function runImportSettings(deps) {
    const raw = deps.prompt("粘贴导出的设置 JSON 文本：");
    if (raw === null) return;
    const result = deps.importSettings(raw);
    if (result.error) {
      deps.alert(`导入失败：${result.error}`);
      return;
    }
    if (result.failed > 0) {
      const head = result.applied > 0 ? `导入未全部完成：已写入 ${result.applied} 项，另有 ${result.failed} 项写入失败` : `导入未能写入任何设置：${result.failed} 项全部写入失败`;
      deps.alert(`${head}，未改动 ${result.skipped} 项，忽略未知键 ${result.ignored} 项。
请检查脚本管理器存储后重试。`);
      return;
    }
    deps.alert(`导入完成：写入 ${result.applied} 项，未改动 ${result.skipped} 项，忽略未知键 ${result.ignored} 项。
请刷新页面使面板与播放器行为全部生效。`);
  }
  function runResetAllSettings(deps) {
    if (!deps.confirm("确定把全部设置恢复为默认值？此操作不可撤销（可先「导出设置」备份）。")) return;
    const result = deps.resetAllSettings();
    if (result.failed > 0) {
      const head = result.applied > 0 ? `恢复默认设置未全部完成：已重置 ${result.applied} 项，另有 ${result.failed} 项写入失败` : `恢复默认设置未能写入任何项：${result.failed} 项全部写入失败`;
      deps.alert(`${head}。
请检查脚本管理器存储后重试。`);
      return;
    }
    deps.alert("已恢复默认设置，即将刷新页面。");
    deps.reload();
  }
  function realPanelActionDeps() {
    return {
      diagnostics: collectDiagnostics,
      exportSettings,
      importSettings,
      resetAllSettings,
      log: (message) => console.log(message),
      prompt: (message) => window.prompt(message),
      alert: (message) => window.alert(message),
      confirm: (message) => window.confirm(message),
      reload: () => location.reload()
    };
  }

  // src/panels.ts
  function setDevPanelEnabled(panel, enabled) {
    panel.querySelectorAll('input[type="checkbox"]:not(#dev-mode):not(#preserve-touch-points), input[type="number"]').forEach((option) => {
      option.disabled = !enabled;
    });
    panel.querySelectorAll(".baq-input-group").forEach((group) => {
      if (enabled) {
        group.classList.remove("baq-disabled");
      } else {
        group.classList.add("baq-disabled");
      }
    });
    panel.querySelectorAll(".baq-vip-status-tabs").forEach((tabs) => {
      tabs.classList.toggle("baq-disabled", !enabled);
      syncTabsAria(tabs);
    });
  }
  function bindPanelKeyGuard(panel) {
    const guard = (e) => {
      if (e.key === "Escape") return;
      const target = e.target;
      const onThemeToggle = !!(target && typeof target.closest === "function" && target.closest(".baq-theme-toggle"));
      if (onThemeToggle && (e.key === "Enter" || e.key === " ")) return;
      e.stopPropagation();
    };
    panel.addEventListener("keydown", guard, true);
    panel.addEventListener("keyup", guard, true);
  }
  function decorateChromeAria(panel) {
    panel.querySelectorAll("svg").forEach((svg) => {
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
    });
    const github = panel.querySelector(".baq-github-link");
    if (github && !github.hasAttribute("aria-label")) github.setAttribute("aria-label", "在 GitHub 查看项目主页");
  }
  function setupPanelA11y(panel) {
    panel.setAttribute("tabindex", "-1");
    bindPanelKeyGuard(panel);
    bindRadioGridRoving(panel);
    decorateChromeAria(panel);
  }
  function setAriaFlag(el, name, on) {
    if (on) el.setAttribute(name, "true");
    else el.removeAttribute(name);
  }
  function syncRadioGroupAria(container, itemSelector, options = {}) {
    if (!container) return;
    container.setAttribute("role", "radiogroup");
    if (options.labelledBy) container.setAttribute("aria-labelledby", options.labelledBy);
    else if (options.label) container.setAttribute("aria-label", options.label);
    setAriaFlag(container, "aria-disabled", !!options.disabled);
    const items = Utils.queryAll(itemSelector, container);
    let tabStop = items.findIndex((it) => it.classList.contains("baq-active"));
    if (tabStop === -1 && items.length) tabStop = 0;
    items.forEach((item, i) => {
      item.setAttribute("role", "radio");
      item.setAttribute("aria-checked", item.classList.contains("baq-active") ? "true" : "false");
      item.setAttribute("tabindex", i === tabStop ? "0" : "-1");
      item.removeAttribute("aria-label");
      setAriaFlag(item, "aria-disabled", !!options.disabled);
      if (options.describedBy) item.setAttribute("aria-describedby", options.describedBy);
      else item.removeAttribute("aria-describedby");
    });
  }
  var RADIO_GRID_CONTAINERS = "#quality-grid, .baq-live-quality-group, .baq-decode-group";
  var RADIO_GRID_ITEMS = ".baq-quality-button, .baq-live-quality-button, .baq-decode-option";
  function bindRadioGridRoving(root) {
    root.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target;
      if (!target || typeof target.matches !== "function" || !target.matches(RADIO_GRID_ITEMS)) return;
      const container = target.closest(RADIO_GRID_CONTAINERS);
      if (!container || container.getAttribute("role") !== "radiogroup") return;
      const items = Utils.queryAll(RADIO_GRID_ITEMS, container);
      const from = items.indexOf(target);
      if (from === -1) return;
      let to;
      if (e.key === "Home") to = 0;
      else if (e.key === "End") to = items.length - 1;
      else {
        let step;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") step = 1;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") step = -1;
        else return;
        to = (from + step + items.length) % items.length;
      }
      e.preventDefault();
      e.stopPropagation();
      items.forEach((it, i) => it.setAttribute("tabindex", i === to ? "0" : "-1"));
      items[to].focus();
    }, true);
  }
  function bindSettingCheckbox(panel, inputId, settingName, options = {}) {
    panel.querySelector("#" + inputId).addEventListener("change", function(e) {
      if (options.gated && state.isLoading) return;
      const input = e.target;
      if (!setSetting(settingName, input.checked)) {
        input.checked = !!state[settingName];
        return;
      }
      if (options.after) options.after();
    });
  }
  function syncCheckbox(panel, inputId, checked) {
    const input = panel.querySelector("#" + inputId);
    if (input) input.checked = checked;
  }
  function syncStatusTabs(tabs, active) {
    tabs.setAttribute("data-active", active);
    tabs.querySelectorAll(".baq-vip-status-tab").forEach((tab) => {
      tab.classList.toggle("baq-active", tab.getAttribute("data-status") === active);
    });
    syncTabsAria(tabs);
  }
  function setupStatusTabs(panel, tabs, isEnabled, apply) {
    tabs.addEventListener("click", function(e) {
      if (!isEnabled()) return;
      if (e.target.classList.contains("baq-vip-status-tab")) {
        apply(e.target.getAttribute("data-status"));
      }
    });
    bindTabsKeyboard(panel, tabs, isEnabled, apply);
    syncTabsAria(tabs);
  }
  function setWarningText(el, text) {
    if (!text) {
      el.style.display = "none";
      return;
    }
    el.style.display = "block";
    if (el.textContent !== text) el.textContent = text;
  }
  function updateWarnings(panel) {
    if (!panel || state.isLoading || !state.vipStatusChecked) return;
    const nonVipWarning = panel.querySelector("#non-vip-warning");
    const audioWarning = panel.querySelector("#audio-warning");
    setWarningText(nonVipWarning, !state.isVipUser && VIP_QUALITIES.includes(state.userQualitySetting) ? state.useHighestQualityFallback ? "无法使用此会员画质。已自动选择最高可用画质。" : "无法使用此会员画质。将保持当前画质。" : "");
    setWarningText(audioWarning, !state.isVipUser && (state.hiResAudioEnabled || state.dolbyAtmosEnabled) ? "非大会员用户不能使用高级音频选项。" : "");
  }
  function setLiveText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }
  var QUALITY_STATUS_ID = "quality-status-bar";
  function syncQualityGridAria(panel) {
    const grid = panel.querySelector("#quality-grid");
    if (!grid) return;
    if (state.customSortEnabled) {
      grid.setAttribute("role", "group");
      grid.setAttribute("aria-labelledby", "quality-section-title");
      setAriaFlag(grid, "aria-disabled", state.isLoading);
      return;
    }
    syncRadioGroupAria(grid, ".baq-quality-button", {
      labelledBy: "quality-section-title",
      disabled: state.isLoading,
      describedBy: state.isLoading ? QUALITY_STATUS_ID : void 0
    });
  }
  function updateQualityButtons(panel) {
    if (!panel) return;
    const statusBar = panel.querySelector(".baq-status-bar");
    const vipDependentSelector = "#quality-grid .baq-quality-button, #custom-sort-container, #highest-quality-fallback-container, #hi-res-audio-container, #dolby-atmos-container";
    const vipGatedInputs = "#custom-sort, #hi-res-audio, #dolby-atmos";
    if (state.isLoading) {
      setLiveText(statusBar, "正在获取账号状态");
      statusBar.className = "baq-status-bar baq-loading";
      Utils.queryAll(vipDependentSelector, panel).forEach((el) => {
        el.style.opacity = "0.5";
      });
      panel.querySelectorAll(vipGatedInputs).forEach((input) => {
        input.disabled = true;
      });
    } else {
      Utils.queryAll(vipDependentSelector, panel).forEach((el) => {
        el.style.opacity = "1";
      });
      panel.querySelectorAll(vipGatedInputs).forEach((input) => {
        input.disabled = false;
      });
      if (state.vipStatusChecked) {
        setLiveText(statusBar, state.isVipUser ? "大会员 · 全部选项可用" : "非大会员 · 会员专属选项不可用");
        statusBar.className = "baq-status-bar " + (state.isVipUser ? "baq-vip" : "baq-non-vip");
      } else {
        setLiveText(statusBar, "会员状态未知 · 画质选项不受影响");
        statusBar.className = "baq-status-bar baq-non-vip";
      }
    }
    Utils.queryAll("#quality-grid .baq-quality-button", panel).forEach((button) => {
      const wasActive = button.classList.contains("baq-active");
      button.classList.remove("baq-active", "baq-vip-quality");
      if (!state.customSortEnabled && button.getAttribute("data-quality") === state.userQualitySetting) {
        button.classList.add("baq-active");
        if (VIP_QUALITIES.includes(button.getAttribute("data-quality"))) {
          button.classList.add("baq-vip-quality");
        }
        if (!wasActive && button.getAttribute("data-quality") === "最高画质") {
          try {
            if (typeof button.animate === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
              button.animate([
                { opacity: 0, filter: "blur(12px)", webkitMaskSize: "10% 14%", maskSize: "10% 14%" },
                { opacity: 1, offset: 0.3 },
                { opacity: 1, filter: "blur(0px)", webkitMaskSize: "340% 340%", maskSize: "340% 340%" }
              ], { duration: 1100, easing: "cubic-bezier(0.2, 0, 0.2, 1)", pseudoElement: "::before" });
            }
          } catch (e) {
            debugTransient(e);
          }
        }
      }
    });
    if (state.customSortEnabled) refreshCustomGridDecorations(panel);
    const hintWrap = panel.querySelector("#quality-grid-hint-wrap");
    if (hintWrap) hintWrap.classList.toggle("baq-collapsed", !state.customSortEnabled);
    const sectionTitle = panel.querySelector("#quality-section-title");
    if (sectionTitle) sectionTitle.textContent = state.customSortEnabled ? "画质优先级" : "画质选择";
    const fallbackContainer = panel.querySelector("#highest-quality-fallback-container");
    if (fallbackContainer) fallbackContainer.classList.toggle("baq-disabled", state.customSortEnabled);
    syncCheckbox(panel, "custom-sort", state.customSortEnabled);
    syncCheckbox(panel, "hi-res-audio", state.hiResAudioEnabled);
    syncCheckbox(panel, "dolby-atmos", state.dolbyAtmosEnabled);
    const fallbackCheckbox = panel.querySelector("#highest-quality-fallback");
    if (fallbackCheckbox) {
      fallbackCheckbox.checked = state.useHighestQualityFallback;
      fallbackCheckbox.disabled = state.customSortEnabled || state.isLoading;
    }
    syncCheckbox(panel, "inject-quality-button", state.injectQualityButton);
    syncCheckbox(panel, "auto-widescreen", state.autoWidescreen);
    syncCheckbox(panel, "adaptive-quality-downgrade", state.adaptiveQualityEnabled);
    const sensSection = panel.querySelector("#adaptive-sensitivity-section");
    if (sensSection) sensSection.classList.toggle("baq-disabled", !state.adaptiveQualityEnabled);
    const sensTabs = panel.querySelector("#adaptive-quality-sensitivity");
    if (sensTabs) {
      sensTabs.classList.toggle("baq-disabled", !state.adaptiveQualityEnabled);
      syncStatusTabs(sensTabs, state.adaptiveQualitySensitivity);
    }
    const adaptiveRow = panel.querySelector("#adaptive-toggle-row");
    if (adaptiveRow) adaptiveRow.setAttribute("data-level", state.adaptiveQualitySensitivity);
    syncQualityGridAria(panel);
    updateWarnings(panel);
  }
  function createSettingsPanel() {
    const panel = document.createElement("div");
    panel.id = "bilibili-quality-selector";
    const QUALITIES = DEFAULT_CUSTOM_ORDER;
    function buildDefaultItemsHTML() {
      return QUALITIES.map((q) => `<button class="baq-quality-button" data-quality="${q}">${q}</button>`).join("");
    }
    function buildCustomItemsHTML() {
      const order = normalizeCustomOrder(state.customQualityOrder);
      const cutoff = customEffectiveCutoff(order);
      return order.map((q, i) => {
        const isFallback = q === CUSTOM_HIGHEST;
        const dimmed = cutoff !== -1 && i > cutoff;
        const cls = ["baq-quality-button", "baq-cq-grid-item"];
        if (isFallback) cls.push("baq-cq-fallback");
        if (dimmed) cls.push("baq-cq-dimmed");
        if (VIP_QUALITIES.includes(q)) cls.push("baq-cq-vip");
        const tag = isFallback ? `<span class="baq-cq-tag" role="img" aria-label="兜底档位">兜底</span>` : "";
        const title = isFallback ? ` title="兜底：找不到上方偏好画质时，选当前可用的最高画质"` : "";
        return `<button class="${cls.join(" ")}" data-quality="${q}" draggable="false"${title}><span class="baq-cq-rank">${i + 1}</span>${q}${tag}</button>`;
      }).join("");
    }
    function gridHTML() {
      return state.customSortEnabled ? buildCustomItemsHTML() : buildDefaultItemsHTML();
    }
    function renderGrid() {
      const grid = panel.querySelector("#quality-grid");
      if (!grid) return;
      grid.innerHTML = gridHTML();
    }
    panel.innerHTML = `
      ${renderPanelHeader("画质设置", `<div class="baq-status-bar" id="${QUALITY_STATUS_ID}" role="status"></div>`)}
      <div class="baq-columns">
        <div class="baq-col">
          <div class="baq-section-title" id="quality-section-title">${state.customSortEnabled ? "画质优先级" : "画质选择"}</div>
          <div class="baq-quality-group" id="quality-grid">
            ${gridHTML()}
          </div>
          <div class="baq-hint-collapse${state.customSortEnabled ? "" : " baq-collapsed"}" id="quality-grid-hint-wrap"><div class="baq-hint-inner">
            <div class="baq-cq-hint" id="quality-grid-hint" role="note" aria-label="长按拖动排序，或聚焦某一档后按 Alt 加上下方向键换位。标有蓝点的「最高画质」是兜底档位，代表找不到上方偏好画质时改选当前可用的最高画质；它与「默认」之后的档位不再生效，界面上以灰显表示。">长按拖动排序，「最高画质」和「默认」之后的档位不生效</div>
          </div></div>
          <div id="non-vip-warning" class="baq-warning" role="alert" style="display:none;"></div>
          ${renderToggleRow({ rowId: "custom-sort-container", inputId: "custom-sort", label: "自定义排序", checked: state.customSortEnabled })}
          ${renderToggleRow({ rowId: "highest-quality-fallback-container", rowClass: state.customSortEnabled ? "baq-disabled" : "", inputId: "highest-quality-fallback", label: "找不到目标画质时使用最高画质", checked: state.useHighestQualityFallback, disabled: state.customSortEnabled })}
        </div>
        <div class="baq-col">
          <div class="baq-section-title">会员音频</div>
          ${renderToggleRow({ rowId: "hi-res-audio-container", inputId: "hi-res-audio", label: "Hi-Res 音质", checked: state.hiResAudioEnabled, slider: "baq-vip-audio" })}
          ${renderToggleRow({ rowId: "dolby-atmos-container", inputId: "dolby-atmos", label: "杜比全景声", checked: state.dolbyAtmosEnabled, slider: "baq-vip-audio" })}
          <div id="audio-warning" class="baq-warning" role="alert" style="display:none;"></div>
          <div class="baq-section-title">播放器</div>
          ${renderToggleRow({ inputId: "inject-quality-button", label: "控制栏设置入口", sublabel: "在播放器控制栏显示本面板按钮", checked: state.injectQualityButton, slider: "baq-c-cyan" })}
          ${renderToggleRow({ inputId: "auto-widescreen", label: "自动宽屏", checked: state.autoWidescreen, slider: "baq-c-cyan" })}
          <div class="baq-group-last">
            <div class="baq-section-title">智能降档</div>
            ${renderToggleRow({ rowId: "adaptive-toggle-row", rowAttrs: `data-level="${state.adaptiveQualitySensitivity}"`, inputId: "adaptive-quality-downgrade", label: "网络自适应降画质", sublabel: "卡顿或网络不佳时自动降低一档", checked: state.adaptiveQualityEnabled, slider: "baq-smart" })}
            <div class="baq-sens-section ${state.adaptiveQualityEnabled ? "" : "baq-disabled"}" id="adaptive-sensitivity-section">
              <div class="baq-sens-label" id="adaptive-sens-label">降档灵敏度</div>
              ${renderStatusTabs({ id: "adaptive-quality-sensitivity", extraClass: "baq-sens-tabs", disabled: !state.adaptiveQualityEnabled, active: state.adaptiveQualitySensitivity, options: ["灵敏", "标准", "保守"], labelledBy: "adaptive-sens-label" })}
            </div>
          </div>
        </div>
      </div>
    `;
    setupPanelA11y(panel);
    bindCustomOrderKeyboard(panel);
    panel.addEventListener("click", function(e) {
      const btn = e.target.closest(".baq-quality-button");
      if (btn && !state.customSortEnabled && !state.isLoading) {
        setSetting("userQualitySetting", btn.getAttribute("data-quality"));
        updateQualityButtons(panel);
        selectQualityBasedOnSetting();
      }
    });
    bindSettingCheckbox(panel, "custom-sort", "customSortEnabled", { gated: true, after: () => {
      const hintWrap = panel.querySelector("#quality-grid-hint-wrap");
      if (hintWrap) hintWrap.classList.toggle("baq-collapsed", !state.customSortEnabled);
      const grid = panel.querySelector("#quality-grid");
      grid.style.transition = "opacity 0.16s ease";
      grid.style.opacity = "0";
      setTimeout(() => {
        renderGrid();
        updateQualityButtons(panel);
        const rebuilt = panel.querySelector("#quality-grid");
        rebuilt.style.transition = "opacity 0.16s ease";
        rebuilt.style.opacity = "1";
      }, 170);
      selectQualityBasedOnSetting();
    } });
    bindSettingCheckbox(panel, "highest-quality-fallback", "useHighestQualityFallback", { gated: true, after: selectQualityBasedOnSetting });
    bindSettingCheckbox(panel, "hi-res-audio", "hiResAudioEnabled", { gated: true, after: () => {
      updateQualityButtons(panel);
      selectQualityBasedOnSetting();
    } });
    bindSettingCheckbox(panel, "dolby-atmos", "dolbyAtmosEnabled", { gated: true, after: () => {
      updateQualityButtons(panel);
      selectQualityBasedOnSetting();
    } });
    bindSettingCheckbox(panel, "inject-quality-button", "injectQualityButton", { after: () => ensureQualitySettingsButton(state.injectQualityButton) });
    bindSettingCheckbox(panel, "auto-widescreen", "autoWidescreen", { after: applyAutoWidescreen });
    bindSettingCheckbox(panel, "adaptive-quality-downgrade", "adaptiveQualityEnabled", { after: () => {
      const section = panel.querySelector("#adaptive-sensitivity-section");
      if (section) section.classList.toggle("baq-disabled", !state.adaptiveQualityEnabled);
      const tabs = panel.querySelector("#adaptive-quality-sensitivity");
      if (tabs) {
        tabs.classList.toggle("baq-disabled", !state.adaptiveQualityEnabled);
        syncTabsAria(tabs);
      }
      restartAdaptiveQuality();
    } });
    const sensitivityTabs = panel.querySelector("#adaptive-quality-sensitivity");
    if (sensitivityTabs) {
      setupStatusTabs(panel, sensitivityTabs, () => state.adaptiveQualityEnabled, (level) => {
        setSetting("adaptiveQualitySensitivity", level);
        syncStatusTabs(sensitivityTabs, level);
        const adaptiveRow = panel.querySelector("#adaptive-toggle-row");
        if (adaptiveRow) adaptiveRow.setAttribute("data-level", level);
        restartAdaptiveQuality();
        console.log(`[智能降画质] 灵敏度设置为: ${level}`);
      });
    }
    document.body.appendChild(panel);
    panel.renderGrid = renderGrid;
    setupCustomGridDrag(panel);
    updateQualityButtons(panel);
  }
  function refreshCustomGridDecorations(panel) {
    const grid = panel.querySelector("#quality-grid");
    if (!grid) return;
    const items = Utils.queryAll(".baq-cq-grid-item", grid);
    const cutoff = customEffectiveCutoff(items.map((it) => it.getAttribute("data-quality")));
    items.forEach((it, i) => {
      const rank = it.querySelector(".baq-cq-rank");
      if (rank) rank.textContent = String(i + 1);
      const dimmed = cutoff !== -1 && i > cutoff;
      const fallback = it.getAttribute("data-quality") === CUSTOM_HIGHEST;
      it.classList.toggle("baq-cq-dimmed", dimmed);
      it.classList.toggle("baq-cq-fallback", fallback);
      it.removeAttribute("role");
      it.removeAttribute("aria-checked");
      it.setAttribute("tabindex", "0");
      setAriaFlag(it, "aria-disabled", state.isLoading);
      it.setAttribute("aria-describedby", state.isLoading ? `quality-grid-hint ${QUALITY_STATUS_ID}` : "quality-grid-hint");
      it.setAttribute("aria-label", `${it.getAttribute("data-quality")}，第 ${i + 1} 位，共 ${items.length} 位${fallback ? "，兜底档位" : ""}${dimmed ? "，不生效" : ""}`);
    });
  }
  function commitCustomOrder(panel, orderedItems) {
    saveCustomOrder(orderedItems.map((n) => n.getAttribute("data-quality")));
    refreshCustomGridDecorations(panel);
    if (!state.customSortEnabled && typeof panel.renderGrid === "function") {
      panel.renderGrid();
      updateQualityButtons(panel);
    }
    selectQualityBasedOnSetting();
  }
  function bindCustomOrderKeyboard(panel) {
    panel.addEventListener("keydown", (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const target = e.target;
      const item = target && typeof target.closest === "function" ? target.closest(".baq-cq-grid-item") : null;
      if (!item) return;
      const grid = panel.querySelector("#quality-grid");
      if (!grid || !grid.contains(item)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!state.customSortEnabled || state.isLoading) return;
      if (grid.classList.contains("baq-cq-dragging")) return;
      const items = Utils.queryAll(".baq-cq-grid-item", grid);
      const from = items.indexOf(item);
      if (from === -1) return;
      const to = from + (e.key === "ArrowDown" ? 1 : -1);
      if (to < 0 || to >= items.length) return;
      const neighbor = items[to];
      if (to > from) grid.insertBefore(neighbor, item);
      else grid.insertBefore(item, neighbor);
      commitCustomOrder(panel, Utils.queryAll(".baq-cq-grid-item", grid));
      item.focus();
    }, true);
  }
  function setupCustomGridDrag(panel) {
    const grid = panel.querySelector("#quality-grid");
    if (!grid || grid.dataset.dragBound === "1") return;
    grid.dataset.dragBound = "1";
    const LONG_PRESS_MS = 260;
    const MOVE_CANCEL_PX = 10;
    const EDGE = 48;
    const SCROLL_SPEED = 14;
    let pressTimer = null;
    let pressEl = null;
    let activePointerId = null;
    let activated = false;
    let committed = false;
    let dragging = null;
    let items = [];
    let slots = [];
    let startIndex = -1;
    let currentIndex = -1;
    let pointerStartClientX = 0;
    let pointerStartClientY = 0;
    let lastClientX = 0;
    let lastClientY = 0;
    let moveRAF = null;
    let autoScrollRAF = null;
    function clearPress() {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      if (pressEl) {
        pressEl.classList.remove("baq-cq-press");
        pressEl = null;
      }
    }
    function captureSlots() {
      const gridRect = grid.getBoundingClientRect();
      slots = items.map((it) => {
        const r = it.getBoundingClientRect();
        return { x: r.left - gridRect.left + r.width / 2, y: r.top - gridRect.top + r.height / 2 };
      });
    }
    function pointerRel() {
      const gridRect = grid.getBoundingClientRect();
      return { x: lastClientX - gridRect.left, y: lastClientY - gridRect.top };
    }
    function nearestIndex(p) {
      let best = 0, bestD = Infinity;
      for (let i = 0; i < slots.length; i++) {
        const dx = slots[i].x - p.x, dy = slots[i].y - p.y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    }
    function workingOrder() {
      const arr = items.slice();
      arr.splice(startIndex, 1);
      arr.splice(currentIndex, 0, dragging);
      return arr;
    }
    function applyLayout() {
      const order = workingOrder();
      const cutoff = customEffectiveCutoff(order.map((it) => it.getAttribute("data-quality")));
      order.forEach((it, newIdx) => {
        const oldIdx = items.indexOf(it);
        const rank = it.querySelector(".baq-cq-rank");
        if (rank) rank.textContent = String(newIdx + 1);
        if (it === dragging) return;
        it.classList.toggle("baq-cq-dimmed", cutoff !== -1 && newIdx > cutoff);
        const dx = slots[newIdx].x - slots[oldIdx].x;
        const dy = slots[newIdx].y - slots[oldIdx].y;
        it.style.transform = `translate(${dx}px, ${dy}px)`;
      });
    }
    function updateDrag() {
      moveRAF = null;
      if (!activated || !dragging) return;
      const p = pointerRel();
      const dx = p.x - slots[startIndex].x;
      const dy = p.y - slots[startIndex].y;
      dragging.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
      const idx = nearestIndex(p);
      if (idx !== currentIndex) {
        currentIndex = idx;
        applyLayout();
      }
    }
    function stopAutoScroll() {
      if (autoScrollRAF) {
        cancelAnimationFrame(autoScrollRAF);
        autoScrollRAF = null;
      }
    }
    function handleAutoScroll() {
      const rect = panel.getBoundingClientRect();
      let dir = 0;
      if (lastClientY < rect.top + EDGE) dir = -1;
      else if (lastClientY > rect.bottom - EDGE) dir = 1;
      if (dir === 0) {
        stopAutoScroll();
        return;
      }
      if (autoScrollRAF) return;
      const tick = () => {
        if (!activated) {
          stopAutoScroll();
          return;
        }
        const before = panel.scrollTop;
        panel.scrollTop += dir * SCROLL_SPEED;
        if (panel.scrollTop !== before) updateDrag();
        autoScrollRAF = requestAnimationFrame(tick);
      };
      autoScrollRAF = requestAnimationFrame(tick);
    }
    function activateDrag(item) {
      items = Utils.queryAll(".baq-cq-grid-item", grid);
      startIndex = items.indexOf(item);
      if (startIndex === -1) {
        item.classList.remove("baq-cq-press");
        return;
      }
      activated = true;
      committed = false;
      dragging = item;
      currentIndex = startIndex;
      captureSlots();
      grid.classList.add("baq-cq-dragging");
      item.classList.remove("baq-cq-press");
      item.classList.add("baq-dragging");
      items.forEach((it) => {
        it.style.transform = "";
      });
    }
    function commitOrder() {
      if (committed) return;
      committed = true;
      const order = workingOrder();
      order.forEach((n) => {
        n.style.transition = "none";
        n.style.transform = "";
        grid.appendChild(n);
      });
      void grid.offsetHeight;
      order.forEach((n) => {
        n.style.transition = "";
      });
      grid.classList.remove("baq-cq-dragging");
      dragging = null;
      activated = false;
      commitCustomOrder(panel, order);
    }
    function finishDrag() {
      stopAutoScroll();
      if (moveRAF) {
        cancelAnimationFrame(moveRAF);
        moveRAF = null;
      }
      if (!dragging) {
        activated = false;
        grid.classList.remove("baq-cq-dragging");
        return;
      }
      const item = dragging;
      const dx = slots[currentIndex].x - slots[startIndex].x;
      const dy = slots[currentIndex].y - slots[startIndex].y;
      item.classList.remove("baq-dragging");
      requestAnimationFrame(() => {
        item.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      let done = false;
      const onEnd = (ev) => {
        if (ev && ev.propertyName && ev.propertyName !== "transform") return;
        if (done) return;
        done = true;
        item.removeEventListener("transitionend", onEnd);
        commitOrder();
      };
      item.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 300);
    }
    function onPointerDown(e) {
      if (!state.customSortEnabled || state.isLoading) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (activated || pressTimer || activePointerId !== null) return;
      const item = e.target.closest(".baq-cq-grid-item");
      if (!item || !grid.contains(item)) return;
      try {
        grid.setPointerCapture(e.pointerId);
      } catch (err) {
        debugTransient(err);
        return;
      }
      pressEl = item;
      activePointerId = e.pointerId;
      pointerStartClientX = e.clientX;
      pointerStartClientY = e.clientY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      item.classList.add("baq-cq-press");
      pressTimer = setTimeout(() => {
        pressTimer = null;
        const pointerId = activePointerId;
        if (pointerId === null || !grid.hasPointerCapture(pointerId)) {
          clearPress();
          activePointerId = null;
          return;
        }
        activateDrag(item);
      }, LONG_PRESS_MS);
    }
    function onPointerMove(e) {
      if (e.pointerId !== activePointerId) return;
      if (!activated) {
        if (pressTimer && (Math.abs(e.clientY - pointerStartClientY) > MOVE_CANCEL_PX || Math.abs(e.clientX - pointerStartClientX) > MOVE_CANCEL_PX)) {
          clearPress();
        }
        return;
      }
      e.preventDefault();
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      if (!moveRAF) moveRAF = requestAnimationFrame(updateDrag);
      handleAutoScroll();
    }
    function onPointerUp(e) {
      if (e.pointerId !== activePointerId) return;
      clearPress();
      try {
        grid.releasePointerCapture(activePointerId);
      } catch (err) {
        debugTransient(err);
      }
      activePointerId = null;
      if (activated) finishDrag();
    }
    grid.addEventListener("pointerdown", onPointerDown);
    grid.addEventListener("pointermove", onPointerMove);
    grid.addEventListener("pointerup", onPointerUp);
    grid.addEventListener("pointercancel", onPointerUp);
    grid.addEventListener("dragstart", (e) => e.preventDefault());
    grid.addEventListener("contextmenu", (e) => {
      if (activated || pressTimer) e.preventDefault();
    });
  }
  function syncTabsAria(container) {
    if (!container) return;
    syncRadioGroupAria(container, ".baq-vip-status-tab", { disabled: container.classList.contains("baq-disabled") });
  }
  function bindTabsKeyboard(root, container, isEnabled, onSelect) {
    if (!root || !container) return;
    root.addEventListener("keydown", (e) => {
      const target = e.target;
      if (!target || !container.contains(target) || !target.classList.contains("baq-vip-status-tab")) return;
      const tabs = Utils.queryAll(".baq-vip-status-tab", container);
      if (!tabs.length) return;
      let next;
      if (e.key === "Enter" || e.key === " ") next = target;
      else if (e.key === "Home") next = tabs[0];
      else if (e.key === "End") next = tabs[tabs.length - 1];
      else {
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        const from = tabs.indexOf(target);
        next = tabs[((from === -1 ? 0 : from) + step + tabs.length) % tabs.length];
      }
      e.preventDefault();
      e.stopPropagation();
      if (!isEnabled()) return;
      onSelect(next.getAttribute("data-status"));
      next.focus();
    }, true);
  }
  function isInputBusy(input) {
    return document.activeElement === input || !!input.closest(".baq-num-stepper[data-holding]");
  }
  function getNumberMirror() {
    let m = document.getElementById("baq-num-mirror");
    if (!m) {
      m = document.createElement("span");
      m.id = "baq-num-mirror";
      m.style.cssText = "position:absolute;left:-9999px;top:-9999px;visibility:hidden;white-space:pre;pointer-events:none;";
      document.body.appendChild(m);
    }
    return m;
  }
  function setupSteppers(panel) {
    Utils.queryAll(".baq-num-stepper", panel).forEach((stepper) => {
      if (stepper.dataset.stepperBound === "1") return;
      stepper.dataset.stepperBound = "1";
      const input = stepper.querySelector('input[type="number"]');
      const dec = stepper.querySelector(".baq-ns-dec");
      const inc = stepper.querySelector(".baq-ns-inc");
      if (!input || !dec || !inc) return;
      const step = parseFloat(input.step) || 1;
      const min = input.min !== "" ? parseFloat(input.min) : -Infinity;
      const max = input.max !== "" ? parseFloat(input.max) : Infinity;
      const labelEl = input.id ? panel.querySelector("#" + input.id + "-label") : null;
      const fieldName = labelEl && labelEl.textContent || input.id || "数值";
      const unitText = stepper.querySelector(".baq-unit")?.textContent || "";
      function clampSnap(v) {
        if (isNaN(v)) v = min !== -Infinity ? min : 0;
        if (min !== -Infinity) v = Math.round((v - min) / step) * step + min;
        v = Math.min(max, Math.max(min, v));
        return Math.round(v * 1e3) / 1e3;
      }
      function fitWidth() {
        const cs = getComputedStyle(input);
        const m = getNumberMirror();
        m.style.fontSize = cs.fontSize;
        m.style.fontFamily = cs.fontFamily;
        m.style.fontWeight = cs.fontWeight;
        m.style.letterSpacing = cs.letterSpacing;
        m.textContent = input.value === "" ? "0" : input.value;
        input.style.width = Math.max(12, m.offsetWidth + 2) + "px";
      }
      function refreshButtons() {
        const v = parseFloat(input.value);
        const cur = isNaN(v) ? null : clampSnap(v);
        dec.disabled = cur !== null && cur <= min;
        inc.disabled = cur !== null && cur >= max;
      }
      function applyDelta(dir) {
        if (input.disabled) return;
        let v = parseFloat(input.value);
        if (isNaN(v)) v = min !== -Infinity ? min : 0;
        v = clampSnap(v + dir * step);
        if (String(v) !== input.value) {
          input.value = String(v);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          fitWidth();
        }
        refreshButtons();
      }
      function bindHold(btn, dir) {
        let delayTimer = null;
        let repeatTimer = null;
        let held = false;
        function stop() {
          if (delayTimer) {
            clearTimeout(delayTimer);
            delayTimer = null;
          }
          if (repeatTimer) {
            clearInterval(repeatTimer);
            repeatTimer = null;
          }
          stepper.removeAttribute("data-holding");
          if (held) {
            held = false;
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
        btn.addEventListener("pointerdown", function(e) {
          if (e.button != null && e.button !== 0) return;
          if (btn.disabled || input.disabled) return;
          e.preventDefault();
          held = true;
          stepper.setAttribute("data-holding", "1");
          applyDelta(dir);
          try {
            btn.setPointerCapture(e.pointerId);
          } catch (err) {
            debugTransient(err);
          }
          delayTimer = setTimeout(function() {
            repeatTimer = setInterval(function() {
              if (btn.disabled || input.disabled) {
                stop();
                return;
              }
              applyDelta(dir);
            }, 90);
          }, 350);
        });
        ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => btn.addEventListener(ev, stop));
        btn.addEventListener("click", function(e) {
          if (e.detail === 0 && !btn.disabled && !input.disabled) {
            applyDelta(dir);
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
      }
      bindHold(dec, -1);
      bindHold(inc, 1);
      input.addEventListener("input", function() {
        fitWidth();
        refreshButtons();
      });
      input.addEventListener("change", function() {
        if (!input.disabled) {
          const typed = input.value;
          const raw = parseFloat(typed);
          const snapped = clampSnap(isNaN(raw) ? min !== -Infinity ? min : 0 : raw);
          if (String(snapped) !== input.value) {
            console.log(`[设置] ${fieldName}：输入「${typed === "" ? "空" : typed}」不可用，已修正为 ${snapped}${unitText}`);
            input.value = String(snapped);
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
        fitWidth();
        refreshButtons();
      });
      fitWidth();
      refreshButtons();
    });
  }
  function createLiveSettingsPanel() {
    if (document.getElementById("bilibili-live-quality-selector")) return;
    const panel = document.createElement("div");
    panel.id = "bilibili-live-quality-selector";
    function syncPanel() {
      const keepAliveActive = state.liveKeepAliveEnabled && state.liveKeepAliveTimerId !== null;
      panel.querySelectorAll("[data-quality].baq-live-quality-button").forEach((btn) => {
        btn.classList.toggle("baq-active", btn.getAttribute("data-quality") === state.userLiveQualitySetting);
      });
      syncRadioGroupAria(panel.querySelector(".baq-live-quality-group"), "[data-quality].baq-live-quality-button", { labelledBy: "live-quality-title" });
      syncCheckbox(panel, "live-quality-polling", state.liveQualityPollingEnabled);
      updatePollingStatusIndicator();
      const pollingGroup = panel.querySelector("#live-polling-interval-group");
      if (pollingGroup) pollingGroup.classList.toggle("baq-disabled", !state.liveQualityPollingEnabled);
      const pollingInput = panel.querySelector("#live-polling-interval");
      if (pollingInput) {
        if (!isInputBusy(pollingInput)) pollingInput.value = state.livePollingInterval;
        pollingInput.disabled = !state.liveQualityPollingEnabled;
      }
      syncCheckbox(panel, "live-keep-alive", state.liveKeepAliveEnabled);
      setLiveText(panel.querySelector("#live-keepalive-status"), keepAliveActive ? `运行中，每 ${state.liveKeepAliveInterval} 分钟模拟一次` : "未启用");
      const keepAliveGroup = panel.querySelector("#live-keepalive-interval-group");
      if (keepAliveGroup) keepAliveGroup.classList.toggle("baq-disabled", !state.liveKeepAliveEnabled);
      const keepAliveInput = panel.querySelector("#live-keepalive-interval");
      if (keepAliveInput) {
        if (!isInputBusy(keepAliveInput)) keepAliveInput.value = state.liveKeepAliveInterval;
        keepAliveInput.disabled = !state.liveKeepAliveEnabled;
      }
      syncCheckbox(panel, "prevent-bg-degrade", state.preventBackgroundDegrade);
      syncCheckbox(panel, "live-auto-recover", state.liveAutoRecoverOnVisible);
      syncCheckbox(panel, "live-danmaku-sync", state.liveDanmakuSync);
    }
    function buildPanel() {
      const LIVE_QUALITY_LABELS = { "1080P 原画": "1080P 原画 / 高码率" };
      const LIVE_QUALITIES = [
        { value: CUSTOM_HIGHEST, label: CUSTOM_HIGHEST },
        ...Object.keys(BILI.live.qnMap).map((value) => ({ value, label: LIVE_QUALITY_LABELS[value] || value }))
      ];
      const pollingActive = state.liveQualityPollingEnabled && state.livePollingTimerId !== null;
      const keepAliveActive = state.liveKeepAliveEnabled && state.liveKeepAliveTimerId !== null;
      panel.innerHTML = `
        ${renderPanelHeader("直播设置")}
        <div class="baq-columns baq-even">
          <div class="baq-col">
            <div class="baq-section-title" id="live-quality-title">画质选择</div>
            <div class="baq-live-quality-group">
              ${LIVE_QUALITIES.map((q) => `<button class="baq-live-quality-button ${q.value === state.userLiveQualitySetting ? "baq-active" : ""}" data-quality="${q.value}">${q.label}</button>`).join("")}
            </div>
            <div class="baq-group-last">
              <div class="baq-section-title">画质锁定<span class="baq-beta-tag">BETA</span></div>
              ${renderToggleRow({ inputId: "live-quality-polling", label: "画质轮询锁定", description: pollingActive ? "运行中，每 " + state.livePollingInterval + " 秒检查一次" : "未启用", descriptionId: "live-polling-status", descriptionLive: true, checked: state.liveQualityPollingEnabled, slider: "baq-c-orange" })}
              ${renderStepperGroup({ groupId: "live-polling-interval-group", disabled: !state.liveQualityPollingEnabled, inputId: "live-polling-interval", label: "轮询间隔", description: "检查画质的间隔", value: state.livePollingInterval, min: 5, max: 3600, step: 1, unit: "秒" })}
            </div>
          </div>
          <div class="baq-col">
            <div class="baq-section-title">画质稳定<span class="baq-beta-tag">BETA</span></div>
            ${renderToggleRow({ inputId: "prevent-bg-degrade", label: "防后台降画质", description: "切到其他标签时不降画质", checked: state.preventBackgroundDegrade, slider: "baq-c-cyan" })}
            ${renderToggleRow({ inputId: "live-auto-recover", label: "切回前台时自动纠正画质", description: "发现画质与目标不符时自动重切", checked: state.liveAutoRecoverOnVisible, slider: "baq-c-cyan" })}
            ${renderToggleRow({ inputId: "live-danmaku-sync", label: "切回前台时刷新弹幕", description: "自动开关弹幕以同步弹幕状态", checked: state.liveDanmakuSync, slider: "baq-c-cyan" })}
            <div class="baq-group-last">
              <div class="baq-section-title">页面保活<span class="baq-beta-tag">BETA</span></div>
              ${renderToggleRow({ inputId: "live-keep-alive", label: "模拟用户活跃", description: keepAliveActive ? "运行中，每 " + state.liveKeepAliveInterval + " 分钟模拟一次" : "未启用", descriptionId: "live-keepalive-status", descriptionLive: true, checked: state.liveKeepAliveEnabled, slider: "baq-c-green" })}
              ${renderStepperGroup({ groupId: "live-keepalive-interval-group", disabled: !state.liveKeepAliveEnabled, inputId: "live-keepalive-interval", label: "保活间隔", description: "模拟活跃的间隔", value: state.liveKeepAliveInterval, min: 1, max: 1440, step: 1, unit: "分钟" })}
            </div>
          </div>
        </div>
      `;
      setupPanelA11y(panel);
      panel.querySelectorAll("[data-quality].baq-live-quality-button").forEach((button) => {
        button.addEventListener("click", () => {
          setSetting("userLiveQualitySetting", button.getAttribute("data-quality"));
          syncPanel();
          runSafely(selectLiveQuality(), "直播画质");
          restartLivePollingIfNeeded();
        });
      });
      bindSettingCheckbox(panel, "live-quality-polling", "liveQualityPollingEnabled", { after: () => {
        const intervalGroup = panel.querySelector("#live-polling-interval-group");
        const intervalInputEl = panel.querySelector("#live-polling-interval");
        if (intervalGroup) intervalGroup.classList.toggle("baq-disabled", !state.liveQualityPollingEnabled);
        if (intervalInputEl) intervalInputEl.disabled = !state.liveQualityPollingEnabled;
        if (state.liveQualityPollingEnabled) {
          startLivePolling();
        } else {
          stopLivePolling();
        }
      } });
      const intervalInput = panel.querySelector("#live-polling-interval");
      if (intervalInput) {
        intervalInput.addEventListener("change", function(e) {
          const target = e.target;
          const value = normalizeSetting("livePollingInterval", parseInt(target.value, 10));
          target.value = value;
          setSetting("livePollingInterval", value);
          restartLivePollingIfNeeded();
          updatePollingStatusIndicator();
        });
      }
      bindSettingCheckbox(panel, "live-keep-alive", "liveKeepAliveEnabled", { after: () => {
        const kaGroup = panel.querySelector("#live-keepalive-interval-group");
        const kaInput = panel.querySelector("#live-keepalive-interval");
        if (kaGroup) kaGroup.classList.toggle("baq-disabled", !state.liveKeepAliveEnabled);
        if (kaInput) kaInput.disabled = !state.liveKeepAliveEnabled;
        if (state.liveKeepAliveEnabled) {
          startLiveKeepAlive();
        } else {
          stopLiveKeepAlive();
        }
      } });
      const keepAliveIntervalInput = panel.querySelector("#live-keepalive-interval");
      if (keepAliveIntervalInput) {
        keepAliveIntervalInput.addEventListener("change", function(e) {
          const target = e.target;
          const value = normalizeSetting("liveKeepAliveInterval", parseInt(target.value, 10));
          target.value = value;
          setSetting("liveKeepAliveInterval", value);
          if (state.liveKeepAliveEnabled) startLiveKeepAlive();
          updateKeepAliveStatusIndicator();
        });
      }
      bindSettingCheckbox(panel, "prevent-bg-degrade", "preventBackgroundDegrade", { after: () => applyVisibilityHijack(state.preventBackgroundDegrade) });
      bindSettingCheckbox(panel, "live-auto-recover", "liveAutoRecoverOnVisible");
      bindSettingCheckbox(panel, "live-danmaku-sync", "liveDanmakuSync");
      setupSteppers(panel);
    }
    document.body.appendChild(panel);
    panel.updatePanel = syncPanel;
    buildPanel();
    syncPanel();
  }
  function createDecodeSettingsPanel() {
    const panel = document.createElement("div");
    panel.id = "bilibili-decode-settings";
    const OPTIONS = [
      { value: "默认", desc: "跟随 B 站自动选择" },
      { value: "AV1", desc: "压缩率最高，需较新设备" },
      { value: "HEVC", desc: "硬解广泛，功耗较低" },
      { value: "AVC", desc: "兼容性最好，码率较高" }
    ];
    const current = state.isLivePage ? state.userLiveDecodeSetting : state.userVideoDecodeSetting;
    panel.innerHTML = `
      ${renderPanelHeader("解码设置")}
      ${renderToggleRow({ inputId: "decode-setting-enabled", label: "启用解码设置", sublabel: "替您切换 B 站播放设置中的视频编码", checked: state.decodeSettingEnabled, slider: "baq-c-cyan" })}
      <div class="baq-decode-strategy${state.decodeSettingEnabled ? "" : " baq-disabled"}" id="decode-strategy">
        <div class="baq-section-title">解码策略<span class="baq-title-note">仅模拟点选，生效与否由 B 站决定</span></div>
        <div class="baq-decode-group">
          ${OPTIONS.map((o) => `<button class="baq-decode-option ${current === o.value ? "baq-active" : ""}" data-decode="${o.value}">
            <span class="baq-decode-badge" data-codec="${o.value}">${o.value}</span>
            <span class="baq-decode-desc">${o.desc}</span>
          </button>`).join("")}
        </div>
      </div>
    `;
    setupPanelA11y(panel);
    bindSettingCheckbox(panel, "decode-setting-enabled", "decodeSettingEnabled", { after: () => {
      console.log(`[解码设置] 解码设置已${state.decodeSettingEnabled ? "启用" : "关闭"}`);
      const strategy = panel.querySelector("#decode-strategy");
      if (strategy) strategy.classList.toggle("baq-disabled", !state.decodeSettingEnabled);
      syncDecodeGroupAria(panel);
      if (state.decodeSettingEnabled) {
        applyDecodeSetting();
      }
    } });
    panel.addEventListener("click", function(e) {
      if (!state.decodeSettingEnabled) return;
      const target = e.target.closest(".baq-decode-option");
      if (target && panel.contains(target)) {
        const value = target.getAttribute("data-decode");
        setSetting(state.isLivePage ? "userLiveDecodeSetting" : "userVideoDecodeSetting", value);
        Utils.queryAll(".baq-decode-option", panel).forEach((btn) => {
          btn.classList.toggle("baq-active", btn === target);
        });
        syncDecodeGroupAria(panel);
        applyDecodeSetting();
      }
    });
    document.body.appendChild(panel);
  }
  function syncDecodeGroupAria(panel) {
    syncRadioGroupAria(panel.querySelector(".baq-decode-group"), ".baq-decode-option", {
      label: "解码策略",
      disabled: !state.decodeSettingEnabled
    });
  }
  function updateDecodeButtons(panel) {
    if (!panel) return;
    syncCheckbox(panel, "decode-setting-enabled", state.decodeSettingEnabled);
    const strategy = panel.querySelector("#decode-strategy");
    if (strategy) strategy.classList.toggle("baq-disabled", !state.decodeSettingEnabled);
    Utils.queryAll(".baq-decode-option", panel).forEach((btn) => {
      const wanted = state.isLivePage ? state.userLiveDecodeSetting : state.userVideoDecodeSetting;
      btn.classList.toggle("baq-active", btn.getAttribute("data-decode") === (wanted || "默认"));
    });
    syncDecodeGroupAria(panel);
  }
  function toggleDecodeSettingsPanel() {
    togglePanel("bilibili-decode-settings", createDecodeSettingsPanel, updateDecodeButtons);
  }
  function createUnlockSettingsPanel() {
    const panel = document.createElement("div");
    panel.id = "bilibili-unlock-settings";
    panel.innerHTML = `
      ${renderPanelHeader("解锁设置")}
      <div class="baq-section-title">环境伪装</div>
      ${renderToggleRow({ inputId: "unlock-ua", label: "UA 修改", description: "模拟 Safari 标识并调整触控点", checked: state.unlockUA, slider: "baq-c-amber" })}
      <div class="baq-section-title">进阶选项<span class="baq-title-note">写入本地标记，不保证一定生效</span></div>
      ${renderToggleRow({ inputId: "unlock-hdr", label: "HDR 修改", description: "尝试显示 HDR 相关画质选项", checked: state.unlockHDR, slider: "baq-c-amber" })}
      ${renderToggleRow({ inputId: "unlock-marker", label: "标记解锁", description: "尝试解锁杜比全景声与 8K 选项", checked: state.unlockMarker, slider: "baq-c-amber" })}
      <button class="baq-action-button baq-action-primary" id="unlock-confirm-reload">确认并刷新页面</button>
    `;
    document.body.appendChild(panel);
    setupPanelA11y(panel);
    bindSettingCheckbox(panel, "unlock-ua", "unlockUA", { after: () => console.log(`[解锁设置] 开启 UA 修改: ${state.unlockUA}`) });
    bindSettingCheckbox(panel, "unlock-hdr", "unlockHDR", { after: () => console.log(`[解锁设置] 开启 HDR 修改: ${state.unlockHDR}`) });
    bindSettingCheckbox(panel, "unlock-marker", "unlockMarker", { after: () => console.log(`[解锁设置] 开启标记解锁: ${state.unlockMarker}`) });
    panel.querySelector("#unlock-confirm-reload").addEventListener("click", function() {
      console.log("[解锁设置] 已确认，准备刷新页面以应用设置");
      location.reload();
    });
    return panel;
  }
  var DEV_PANEL_MANUAL_ACTIONS = {
    "dev-export-diagnostics": runExportDiagnostics,
    "dev-export-settings": runExportSettings,
    "dev-import-settings": runImportSettings,
    "dev-reset-settings": runResetAllSettings
  };
  var DEV_PANEL_ACTIONS = [
    { id: "dev-export-diagnostics", label: "导出诊断信息", tone: "secondary", description: "打印运行状态快照，随反馈附上" },
    { id: "dev-export-settings", label: "导出设置", tone: "secondary", description: "打印全部设置的 JSON 备份" },
    { id: "dev-import-settings", label: "导入设置", tone: "secondary", description: "粘贴备份 JSON 恢复设置" },
    { id: "dev-reset-settings", label: "恢复默认设置", tone: "danger", description: "重置全部设置并刷新，不可撤销" }
  ];
  function bindDevPanelActions(panel) {
    const deps = realPanelActionDeps();
    for (const [id, handler] of Object.entries(DEV_PANEL_MANUAL_ACTIONS)) {
      const button = panel.querySelector(`#${id}`);
      if (!button) throw new Error(`开发者面板缺少动作按钮 #${id}`);
      button.addEventListener("click", () => handler(deps));
    }
  }
  function createDevSettingsPanel() {
    const panel = document.createElement("div");
    panel.id = "bilibili-dev-settings";
    const devLocked = !state.devModeEnabled;
    panel.innerHTML = `
      ${renderPanelHeader("开发者设置", `<div class="baq-dev-warning-pill">错误配置可能影响脚本正常工作</div>`)}
      ${renderToggleRow({ rowId: "dev-mode-container", inputId: "dev-mode", label: "开发者模式", description: "启用后可以使用以下开发者选项", checked: state.devModeEnabled })}
      <div class="baq-columns baq-even">
        <div class="baq-col">
          <div class="baq-section-title">模拟状态</div>
          <div class="baq-vip-status-section">
            <div class="baq-vip-status-title" id="dev-vip-status-title">模拟会员状态</div>
            <div class="baq-vip-status-description" id="dev-vip-status-desc">模拟脚本所识别到的大会员状态，<b>并非破解</b></div>
            ${renderStatusTabs({ disabled: devLocked, active: state.devModeVipStatus, options: ["默认", "普通", "会员"], labelledBy: "dev-vip-status-title", describedBy: "dev-vip-status-desc" })}
          </div>
          ${renderToggleRow({ inputId: "dev-no-login", label: "未登录模式", description: "不等待头像加载，最高画质 1080P", checked: state.devModeNoLoginStatus, disabled: devLocked, slider: "baq-c-red" })}
          ${renderToggleRow({ inputId: "dev-allow-freevip", label: "非会员允许限免画质", description: "默认关闭，避免可能出现的会员推广", checked: state.devAllowFreeVipQualities, disabled: devLocked, slider: "baq-c-red" })}
          <div class="baq-group-last">
            <div class="baq-section-title">音质切换</div>
            ${renderStepperGroup({ disabled: devLocked, inputId: "dev-audio-delay", label: "初始延迟", description: "重试等待的基数", value: state.devModeAudioDelay, min: 500, max: 1e4, step: 100, unit: "毫秒" })}
            ${renderStepperGroup({ disabled: devLocked, inputId: "dev-audio-retries", label: "重试次数", description: "失败后的重试次数", value: state.devModeAudioRetries, min: 0, max: 5, step: 1, unit: "次" })}
          </div>
        </div>
        <div class="baq-col">
          <div class="baq-section-title">画质验证</div>
          ${renderToggleRow({ inputId: "quality-double-check", label: "视频画质二次验证", description: "切换后延时复核，不符则重切", checked: state.qualityDoubleCheck, disabled: devLocked })}
          ${renderToggleRow({ inputId: "live-quality-double-check", label: "直播画质二次验证", description: "直播画质切换后的延时复核", checked: state.liveQualityDoubleCheck, disabled: devLocked })}
          ${renderStepperGroup({ disabled: devLocked, inputId: "dev-double-check-delay", label: "验证等待时间", description: "验证前等待时长", value: state.devDoubleCheckDelay, min: 1e3, max: 2e4, step: 100, unit: "毫秒" })}
          <div class="baq-group-last">
            <div class="baq-section-title">播放器行为</div>
            ${renderToggleRow({ inputId: "preserve-touch-points", label: "保留触控点", description: "保留 maxTouchPoints 原值（设备兼容，不依赖开发者模式）", checked: state.preserveTouchPoints, slider: "baq-c-amber" })}
            ${renderToggleRow({ inputId: "disable-hdr", label: "禁用 HDR 和杜比视界", description: "选择两者以外的最高画质", checked: state.disableHDROption, disabled: devLocked, slider: "baq-c-amber" })}
            ${renderToggleRow({ inputId: "remove-quality-button", label: "移除清晰度按钮", description: "隐藏播放器原生清晰度按钮", checked: state.takeOverQualityControl, disabled: devLocked, slider: "baq-c-amber" })}
          </div>
        </div>
      </div>
      ${renderActionRow({
      title: "数据管理",
      note: "备份与维护，不需要开启开发者模式",
      actions: DEV_PANEL_ACTIONS
    })}
      <button class="baq-action-button baq-action-primary" id="dev-confirm-reload">确认并刷新页面</button>
    `;
    document.body.appendChild(panel);
    setupPanelA11y(panel);
    setupSteppers(panel);
    bindDevPanelActions(panel);
    bindSettingCheckbox(panel, "dev-mode", "devModeEnabled", { after: () => {
      setDevPanelEnabled(panel, state.devModeEnabled);
      hideQualityButton();
    } });
    bindSettingCheckbox(panel, "quality-double-check", "qualityDoubleCheck");
    bindSettingCheckbox(panel, "live-quality-double-check", "liveQualityDoubleCheck");
    const vipStatusTabs = panel.querySelector(".baq-vip-status-tabs");
    if (vipStatusTabs) {
      setupStatusTabs(panel, vipStatusTabs, () => state.devModeEnabled, (status) => {
        setSetting("devModeVipStatus", status);
        syncStatusTabs(vipStatusTabs, status);
        console.log(`[开发者模式] 会员状态设置为: ${status}`);
      });
    }
    bindSettingCheckbox(panel, "dev-no-login", "devModeNoLoginStatus");
    bindSettingCheckbox(panel, "dev-allow-freevip", "devAllowFreeVipQualities");
    bindSettingCheckbox(panel, "preserve-touch-points", "preserveTouchPoints");
    bindSettingCheckbox(panel, "disable-hdr", "disableHDROption");
    bindSettingCheckbox(panel, "remove-quality-button", "takeOverQualityControl", { after: hideQualityButton });
    [
      ["#dev-double-check-delay", "devDoubleCheckDelay"],
      ["#dev-audio-delay", "devModeAudioDelay"],
      ["#dev-audio-retries", "devModeAudioRetries"]
    ].forEach(([sel, name]) => {
      const input = panel.querySelector(sel);
      input.addEventListener("change", function(e) {
        const target = e.target;
        const value = normalizeSetting(name, parseInt(target.value, 10));
        target.value = value;
        setSetting(name, value);
      });
    });
    panel.querySelector("#dev-confirm-reload").addEventListener("click", function() {
      location.reload();
    });
    return panel;
  }
  function togglePanel(panelId, createPanelFunc, updateFunc) {
    let panel = document.getElementById(panelId);
    if (!panel) {
      createPanelFunc();
      panel = document.getElementById(panelId);
    }
    mountPanelToRenderRoot(panel);
    if (!panel.classList.contains("baq-show") || panel.classList.contains("baq-hiding")) {
      PANEL_IDS.forEach((id) => {
        if (id !== panelId) {
          hidePanel(document.getElementById(id));
        }
      });
      showPanel(panel);
    } else {
      hidePanel(panel);
    }
    if (updateFunc) updateFunc(panel);
  }
  function toggleSettingsPanel() {
    togglePanel("bilibili-quality-selector", createSettingsPanel, updateQualityButtons);
  }
  function toggleLiveSettingsPanel() {
    togglePanel("bilibili-live-quality-selector", createLiveSettingsPanel, updateLiveSettingsPanel);
  }
  function toggleDevSettingsPanel() {
    togglePanel("bilibili-dev-settings", createDevSettingsPanel, function(panel) {
      syncCheckbox(panel, "remove-quality-button", state.takeOverQualityControl);
      const vipStatusTabs = panel.querySelector(".baq-vip-status-tabs");
      if (vipStatusTabs) syncStatusTabs(vipStatusTabs, state.devModeVipStatus);
    });
  }
  function toggleUnlockSettingsPanel() {
    togglePanel("bilibili-unlock-settings", createUnlockSettingsPanel);
  }

  // src/controls-button.ts
  var QUALITY_CONTROL_SELECTOR = BILI.video.qualityCtrl + ":not(.baq-injected)";
  var entryExpanded = false;
  function setEntryExpanded(expanded) {
    entryExpanded = expanded;
    document.querySelectorAll(".baq-panel-entry").forEach((el) => el.setAttribute("aria-expanded", expanded ? "true" : "false"));
  }
  function ensureQualitySettingsButton(shouldInject, resolvedControl) {
    if (!shouldInject) {
      document.querySelectorAll(".baq-injected").forEach((el) => el.remove());
      return;
    }
    const qualityControl = resolvedControl || document.querySelector(QUALITY_CONTROL_SELECTOR);
    if (!qualityControl) return;
    const parent = qualityControl.parentElement;
    if (!parent) return;
    const existing = parent.querySelector(".baq-injected");
    if (!existing) {
      const settingsButton = document.createElement("div");
      settingsButton.className = `${BILI.video.ctrlBtnClass} baq-injected baq-panel-entry`;
      settingsButton.setAttribute("role", "button");
      settingsButton.setAttribute("tabindex", "0");
      settingsButton.setAttribute("aria-label", "画质设置");
      settingsButton.setAttribute("aria-haspopup", "dialog");
      settingsButton.setAttribute("aria-expanded", entryExpanded ? "true" : "false");
      settingsButton.innerHTML = `<div class="${BILI.video.ctrlBtnIconClass}"><span class="${BILI.video.commonSvgIconClass}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="4" y1="6" x2="20" y2="6"></line><circle cx="14" cy="6" r="2.4" fill="currentColor" stroke="none"></circle><line x1="4" y1="12" x2="20" y2="12"></line><circle cx="8" cy="12" r="2.4" fill="currentColor" stroke="none"></circle><line x1="4" y1="18" x2="20" y2="18"></line><circle cx="17" cy="18" r="2.4" fill="currentColor" stroke="none"></circle></svg></span></div>`;
      settingsButton.addEventListener("click", toggleSettingsPanel);
      settingsButton.addEventListener("keydown", function(e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          toggleSettingsPanel();
        }
      });
      parent.insertBefore(settingsButton, qualityControl);
    }
  }
  var DOM = {
    selectors: {
      qualityControl: QUALITY_CONTROL_SELECTOR,
      qualityButton: BILI.video.qualityCtrlButton + ":not(.baq-injected)",
      playerControls: BILI.video.controlWrap
    },
    query(key) {
      return document.querySelector(this.selectors[key]);
    }
  };
  function hideQualityButton() {
    const qualityControl = DOM.query("qualityButton");
    if (!qualityControl) return;
    const shouldHide = state.devModeEnabled && state.takeOverQualityControl && !qualityControl.classList.contains("baq-injected");
    qualityControl.classList.toggle("baq-quality-button-hidden", shouldHide);
  }
  var playerControlsObserver = null;
  var playerControlsObservedTarget = null;
  var PLAYER_CONTROLS_CHECK_COALESCE_MS = 150;
  var playerControlsCheckTimer = null;
  function retargetPlayerControlsObserver() {
    const observer = playerControlsObserver;
    if (!observer) return;
    const controls = DOM.query("playerControls");
    const playerRoot = document.getElementById(BILI.video.playerRoot);
    const target = controls || playerRoot || document.body;
    if (target === playerControlsObservedTarget) return;
    observer.disconnect();
    playerControlsObservedTarget = target;
    if (!controls) {
      observer.observe(target, { childList: true, subtree: true });
      return;
    }
    observer.observe(controls, { childList: true, subtree: true });
    if (controls.parentElement) observer.observe(controls.parentElement, { childList: true });
    if (playerRoot) observer.observe(playerRoot, { childList: true });
  }
  function runPlayerControlsCheck() {
    playerControlsCheckTimer = null;
    const qualityControl = DOM.query("qualityControl");
    if (qualityControl) {
      hideQualityButton();
      ensureQualitySettingsButton(state.injectQualityButton, qualityControl);
    }
    retargetPlayerControlsObserver();
  }
  function ensurePlayerControlsBinding() {
    if (!playerControlsObserver) {
      playerControlsObserver = new MutationObserver(function() {
        if (playerControlsCheckTimer !== null) return;
        playerControlsCheckTimer = setTimeout(runPlayerControlsCheck, PLAYER_CONTROLS_CHECK_COALESCE_MS);
      });
    }
    retargetPlayerControlsObserver();
    hideQualityButton();
    ensureQualitySettingsButton(state.injectQualityButton);
  }
  function releasePlayerControlsBinding() {
    if (playerControlsCheckTimer !== null) {
      clearTimeout(playerControlsCheckTimer);
      playerControlsCheckTimer = null;
    }
    if (playerControlsObserver) playerControlsObserver.disconnect();
    playerControlsObservedTarget = null;
  }

  // src/panel-chrome.ts
  var PANEL_IDS = [
    "bilibili-quality-selector",
    "bilibili-live-quality-selector",
    "bilibili-dev-settings",
    "bilibili-unlock-settings",
    "bilibili-decode-settings"
  ];
  var ENTRY_PANEL_ID = PANEL_IDS[0];
  function fullscreenRoot() {
    const fsDoc = document;
    return document.fullscreenElement || fsDoc.webkitFullscreenElement || null;
  }
  function mountPanelToRenderRoot(panel) {
    if (!panel) return;
    const root = fullscreenRoot() || document.body;
    if (panel.parentElement === root) return;
    const keepFocus = panel.contains(document.activeElement);
    root.appendChild(panel);
    if (keepFocus) {
      try {
        panel.focus({ preventScroll: true });
      } catch (e) {
        debugTransient(e);
      }
    }
  }
  function bgIsDark(el) {
    if (!el) return null;
    const bg = getComputedStyle(el).backgroundColor;
    const m = bg && bg.match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) return null;
    const a = m.length >= 4 ? parseFloat(m[3]) : 1;
    if (!(a > 0.5)) return null;
    const lum = 0.2126 * Number(m[0]) + 0.7152 * Number(m[1]) + 0.0722 * Number(m[2]);
    if (lum < 100) return true;
    if (lum > 160) return false;
    return null;
  }
  function isPageDark() {
    try {
      const fromBody = bgIsDark(document.body);
      if (fromBody !== null) return fromBody;
      const fromRoot = bgIsDark(document.documentElement);
      if (fromRoot !== null) return fromRoot;
    } catch (e) {
      debugTransient(e);
    }
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  var panelOutsideHandlers = /* @__PURE__ */ new WeakMap();
  var outsideBoundPanels = /* @__PURE__ */ new Set();
  function bindOutsideClose(panel) {
    unbindOutsideClose(panel);
    let pressStartedInside = false;
    function panelDetached() {
      if (panel.isConnected) return false;
      unbindOutsideClose(panel);
      return true;
    }
    function onPointerDown(event) {
      if (panelDetached()) return;
      pressStartedInside = !!(panel && panel.contains(event.target));
    }
    function onMouseDown(event) {
      if (panelDetached()) return;
      if (pressStartedInside) return;
      if (event.target && event.target.closest && event.target.closest(".baq-panel-entry")) return;
      if (panel && !panel.contains(event.target)) {
        hidePanel(panel);
      }
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("mousedown", onMouseDown, true);
    panelOutsideHandlers.set(panel, { onPointerDown, onMouseDown });
    outsideBoundPanels.add(panel);
  }
  function unbindOutsideClose(panel) {
    outsideBoundPanels.delete(panel);
    const handlers = panelOutsideHandlers.get(panel);
    if (!handlers) return;
    document.removeEventListener("pointerdown", handlers.onPointerDown, true);
    document.removeEventListener("mousedown", handlers.onMouseDown, true);
    panelOutsideHandlers.delete(panel);
  }
  var panelReturnFocus = /* @__PURE__ */ new WeakMap();
  function canFocus(el) {
    return !!el && typeof el.focus === "function";
  }
  function rememberTrigger(panel) {
    const active = document.activeElement;
    if (active && panel.contains(active)) return;
    if (canFocus(active) && active !== document.body && active !== document.documentElement) panelReturnFocus.set(panel, active);
    else panelReturnFocus.delete(panel);
  }
  function restoreTrigger(panel) {
    const target = panelReturnFocus.get(panel);
    panelReturnFocus.delete(panel);
    if (!target) return;
    if (!panel.contains(document.activeElement)) return;
    if (!target.isConnected) return;
    try {
      target.focus({ preventScroll: true });
    } catch (e) {
      debugTransient(e);
    }
  }
  function showPanel(panel) {
    if (!panel) return;
    if (!panel.hasAttribute("role")) {
      panel.setAttribute("role", "dialog");
      const title = panel.querySelector(".baq-header h2");
      if (title && title.textContent) panel.setAttribute("aria-label", title.textContent);
    }
    if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
    if (panel._hideTimer) {
      clearTimeout(panel._hideTimer);
      panel._hideTimer = null;
    }
    panel.classList.toggle("baq-dark", effectiveDark());
    panel.classList.remove("baq-hiding");
    panel.classList.add("baq-show");
    bindOutsideClose(panel);
    if (panel.id === ENTRY_PANEL_ID) setEntryExpanded(true);
    rememberTrigger(panel);
    try {
      panel.focus({ preventScroll: true });
    } catch (e) {
      debugTransient(e);
    }
  }
  function hidePanel(panel) {
    if (!panel) return;
    unbindOutsideClose(panel);
    if (!panel.classList.contains("baq-show") || panel.classList.contains("baq-hiding")) return;
    if (panel.id === ENTRY_PANEL_ID) setEntryExpanded(false);
    restoreTrigger(panel);
    panel.classList.add("baq-hiding");
    panel._hideTimer = setTimeout(() => {
      panel.classList.remove("baq-show", "baq-hiding");
      panel._hideTimer = null;
    }, 160);
  }
  function closeAllPanels() {
    PANEL_IDS.forEach((id) => {
      hidePanel(document.getElementById(id));
    });
  }
  function closeAllPanelsUnlessDragging() {
    if (document.querySelector(".baq-cq-dragging")) return false;
    closeAllPanels();
    return true;
  }
  function remountShownPanels() {
    PANEL_IDS.forEach((id) => {
      const panel = document.getElementById(id);
      if (panel && panel.classList.contains("baq-show")) mountPanelToRenderRoot(panel);
    });
  }
  ["fullscreenchange", "webkitfullscreenchange"].forEach((e) => document.addEventListener(e, () => {
    if (!closeAllPanelsUnlessDragging()) remountShownPanels();
    applyPanelThemeNow();
  }));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeAllPanelsUnlessDragging();
  });
  function applyPanelThemeNow() {
    const dark = effectiveDark();
    PANEL_IDS.forEach((id) => {
      const panel = document.getElementById(id);
      if (panel) panel.classList.toggle("baq-dark", dark);
    });
    syncThemeToggles();
  }
  var GITHUB_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>`;
  function renderGithubLink() {
    return `<a href="https://github.com/AHCorn/Bilibili-Auto-Quality/" target="_blank" rel="noopener noreferrer" class="baq-github-link" aria-label="项目主页（GitHub，新标签页打开）">${GITHUB_SVG}</a>`;
  }
  function followDark() {
    if (fullscreenRoot()) return true;
    return isPageDark();
  }
  function effectiveDark() {
    if (state.panelThemeOverride === "dark") return true;
    if (state.panelThemeOverride === "light") return false;
    return followDark();
  }
  function nextThemeOverride() {
    const followValue = followDark() ? "dark" : "light";
    const current = state.panelThemeOverride;
    if (current !== "light" && current !== "dark") return followValue === "dark" ? "light" : "dark";
    return current === followValue ? "" : followValue;
  }
  var THEME_MODE_LABELS = {
    "": "跟随页面",
    light: "亮色",
    dark: "深色"
  };
  function themeToggleMode() {
    return state.panelThemeOverride === "light" || state.panelThemeOverride === "dark" ? state.panelThemeOverride : "";
  }
  function themeToggleLabel(mode) {
    return `面板主题：${THEME_MODE_LABELS[mode] || THEME_MODE_LABELS[""]}（点击切换）`;
  }
  function syncThemeToggles() {
    const mode = themeToggleMode();
    const label = themeToggleLabel(mode);
    document.querySelectorAll(".baq-theme-toggle").forEach((el) => {
      el.setAttribute("data-theme-mode", mode || "auto");
      el.setAttribute("aria-label", label);
      el.setAttribute("title", label);
    });
  }
  var themeToggleSeq = 0;
  function renderThemeToggle() {
    const maskId = `baq-tm-mask-${++themeToggleSeq}`;
    const mode = themeToggleMode();
    const label = themeToggleLabel(mode);
    return `<span class="baq-theme-toggle" role="button" tabindex="0" data-theme-mode="${mode || "auto"}" aria-label="${label}" title="${label}">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
        <mask id="${maskId}">
          <rect x="0" y="0" width="24" height="24" fill="white"></rect>
          <circle class="baq-tm-hole" cx="17" cy="7" r="8.2" fill="black"></circle>
        </mask>
        <circle class="baq-tm-core" cx="12" cy="12" r="8.6" mask="url(#${maskId})"></circle>
        <g class="baq-tm-rays" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none">
          <line x1="12" y1="4.2" x2="12" y2="2"></line>
          <line x1="12" y1="19.8" x2="12" y2="22"></line>
          <line x1="18.76" y1="8.1" x2="20.66" y2="7"></line>
          <line x1="5.24" y1="8.1" x2="3.34" y2="7"></line>
          <line x1="18.76" y1="15.9" x2="20.66" y2="17"></line>
          <line x1="5.24" y1="15.9" x2="3.34" y2="17"></line>
        </g>
      </svg>
    </span>`;
  }
  function togglePanelTheme() {
    setSetting("panelThemeOverride", nextThemeOverride());
    const dark = effectiveDark();
    syncThemeToggles();
    PANEL_IDS.forEach((id) => {
      const panel = document.getElementById(id);
      if (!panel) return;
      panel.classList.add("baq-theme-anim");
      panel.classList.toggle("baq-dark", dark);
      if (panel._themeAnimTimer) clearTimeout(panel._themeAnimTimer);
      panel._themeAnimTimer = setTimeout(() => {
        panel.classList.remove("baq-theme-anim");
        panel._themeAnimTimer = null;
      }, 420);
    });
  }
  document.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest && e.target.closest(".baq-theme-toggle");
    if (btn) togglePanelTheme();
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target && e.target.classList && e.target.classList.contains("baq-theme-toggle")) {
      e.preventDefault();
      e.stopPropagation();
      togglePanelTheme();
    }
  });

  // src/menu.ts
  function registerMenuCommands() {
    if (typeof GM_registerMenuCommand !== "function") {
      console.log("[菜单] 当前脚本管理器不支持菜单命令，请从播放器控制栏的设置按钮打开画质面板。");
      return;
    }
    const registerMenuCommand = GM_registerMenuCommand;
    registerMenuCommand("画质设置", function() {
      checkIfLivePage();
      if (state.isLivePage) toggleLiveSettingsPanel();
      else toggleSettingsPanel();
    });
    registerMenuCommand("解码设置", function() {
      checkIfLivePage();
      toggleDecodeSettingsPanel();
    });
    registerMenuCommand("解锁设置", toggleUnlockSettingsPanel);
    registerMenuCommand("开发者设置", toggleDevSettingsPanel);
  }

  // src/settings-sync.ts
  function installSettingsSync() {
    const REMOTE_SYNC_INPUT_IDS = {
      injectQualityButton: "inject-quality-button",
      devModeNoLoginStatus: "dev-no-login",
      devAllowFreeVipQualities: "dev-allow-freevip",
      qualityDoubleCheck: "quality-double-check",
      liveQualityDoubleCheck: "live-quality-double-check",
      preserveTouchPoints: "preserve-touch-points",
      disableHDROption: "disable-hdr",
      takeOverQualityControl: "remove-quality-button",
      unlockUA: "unlock-ua",
      unlockHDR: "unlock-hdr",
      unlockMarker: "unlock-marker",
      devModeAudioDelay: "dev-audio-delay",
      devModeAudioRetries: "dev-audio-retries",
      devDoubleCheckDelay: "dev-double-check-delay"
    };
    function findPanelInput(inputId) {
      for (const panelId of PANEL_IDS) {
        const panel = document.getElementById(panelId);
        const input = panel ? panel.querySelector("#" + inputId) : null;
        if (input) return input;
      }
      return null;
    }
    function applyRemoteSettingChange(names) {
      const has = (name) => names.has(name);
      if (has("preventBackgroundDegrade")) applyVisibilityHijack(state.preventBackgroundDegrade);
      if (has("adaptiveQualityEnabled") || has("adaptiveQualitySensitivity")) restartAdaptiveQuality();
      if (has("injectQualityButton")) ensureQualitySettingsButton(state.injectQualityButton);
      if (has("takeOverQualityControl") || has("devModeEnabled")) hideQualityButton();
      if (has("autoWidescreen")) applyAutoWidescreen();
      if (has("panelThemeOverride")) applyPanelThemeNow();
      if (state.isLivePage) {
        if (has("liveQualityPollingEnabled") || has("livePollingInterval")) {
          if (state.liveQualityPollingEnabled) startLivePolling();
          else stopLivePolling();
        }
        if (has("liveKeepAliveEnabled") || has("liveKeepAliveInterval")) {
          if (state.liveKeepAliveEnabled) startLiveKeepAlive();
          else stopLiveKeepAlive();
        }
      }
    }
    function syncPanelsAfterRemoteChange(names) {
      const qualityPanel = document.getElementById("bilibili-quality-selector");
      if (qualityPanel) {
        if ((names.has("customSortEnabled") || names.has("customQualityOrder")) && typeof qualityPanel.renderGrid === "function" && !qualityPanel.querySelector(".baq-cq-dragging")) {
          qualityPanel.renderGrid();
        }
        updateQualityButtons(qualityPanel);
      }
      updateLiveSettingsPanel();
      const decodePanel = document.getElementById("bilibili-decode-settings");
      if (decodePanel) updateDecodeButtons(decodePanel);
      const devPanel = document.getElementById("bilibili-dev-settings");
      if (devPanel && names.has("devModeEnabled")) {
        const devSwitch = devPanel.querySelector("#dev-mode");
        if (devSwitch) devSwitch.checked = state.devModeEnabled;
        setDevPanelEnabled(devPanel, state.devModeEnabled);
      }
      if (devPanel && names.has("devModeVipStatus")) {
        const tabs = devPanel.querySelector(".baq-vip-status-tabs");
        if (tabs) syncStatusTabs(tabs, state.devModeVipStatus);
      }
      names.forEach((name) => {
        const inputId = REMOTE_SYNC_INPUT_IDS[name];
        if (!inputId) return;
        const input = findPanelInput(inputId);
        if (input && (input.type === "checkbox" || !isInputBusy(input))) {
          if (input.type === "checkbox") input.checked = !!state[name];
          else input.value = state[name];
        }
      });
    }
    const REMOTE_FLUSH_WINDOW_MS = 50;
    let pendingRemoteNames = null;
    let pendingFlushTimer = null;
    function queueRemoteFlush(name) {
      if (!pendingRemoteNames) pendingRemoteNames = /* @__PURE__ */ new Set();
      pendingRemoteNames.add(name);
      if (pendingFlushTimer !== null) return;
      pendingFlushTimer = setTimeout(() => {
        pendingFlushTimer = null;
        const batch = pendingRemoteNames || /* @__PURE__ */ new Set();
        pendingRemoteNames = null;
        try {
          applyRemoteSettingChange(batch);
          syncPanelsAfterRemoteChange(batch);
        } catch (e) {
          console.error("[设置同步] 应用其他标签页的变更时出错:", e);
        }
      }, REMOTE_FLUSH_WINDOW_MS);
    }
    if (typeof GM_addValueChangeListener === "function") {
      const addValueChangeListener = GM_addValueChangeListener;
      Object.keys(SETTINGS).forEach((name) => {
        addValueChangeListener(SETTINGS[name].key, (_key, _oldValue, newValue, remote) => {
          if (!remote) return;
          if (name === "customQualityOrder") {
            let raw = newValue;
            if (typeof raw === "string") {
              try {
                raw = JSON.parse(raw);
              } catch (e) {
                console.warn(`[设置] 其他标签页写入的自定义画质顺序不是合法 JSON（${briefValue(raw)}），已回退为默认顺序:`, e);
                raw = null;
              }
            }
            state.customQualityOrder = normalizeCustomOrder(raw);
          } else {
            state[name] = normalizeSetting(name, newValue);
          }
          console.log(`[设置同步] 其他标签页更新 ${name}:`, state[name]);
          queueRemoteFlush(name);
        });
      });
    }
  }

  // src/lifecycle.ts
  function readVipFromResponse(raw) {
    const d = raw;
    if (!d || d.code !== 0 || !d.data) return null;
    if (typeof d.data.vip_type !== "number" || typeof d.data.vip_status !== "number") return null;
    return d.data.vip_type > 0 && d.data.vip_status === 1;
  }
  var VIP_BACKFILL_MAX_AGE_MS = 1e4;
  var VIP_GATE_COALESCE_MS = 150;
  var NO_LOGIN_SETTLE_MS = 5e3;
  var AVATAR_PROBE_INTERVAL_MS = 1e3;
  var VIP_GATE_FALLBACK_MS = 8e3;
  var pageGeneration = 0;
  function pageChangedSince(generation) {
    return generation !== pageGeneration;
  }
  var qualityFlowSnapshot = null;
  var qualityFlowSnapshotGeneration = -1;
  function recordQualityFlowSnapshot() {
    qualityFlowSnapshot = { outcome: state.qualityFlow, activeClean: adaptiveReadActiveClean() };
    qualityFlowSnapshotGeneration = pageGeneration;
  }
  var CONTRACT_SELF_CHECK_DELAY_MS = 3e3;
  var CONTRACT_SELF_CHECK_SLOT = "contract-self-check";
  var contractSelfCheckGeneration = -1;
  function scheduleContractSelfCheck(taskId) {
    const generation = pageGeneration;
    if (contractSelfCheckGeneration === generation) return;
    runSafely(taskQueue.scheduleTask(taskId, () => {
      if (getRealVisibilityState() !== "visible") return;
      if (pageChangedSince(generation)) return;
      contractSelfCheckGeneration = generation;
      runContractSelfCheck();
    }, CONTRACT_SELF_CHECK_DELAY_MS, CONTRACT_SELF_CHECK_SLOT), "契约自检");
  }
  var VIP_BACKFILL_SAFE_OUTCOME = {
    switched: true,
    settled: true,
    stalled: true,
    abandoned: true,
    pending: false,
    delegated: false
  };
  function vipBackfillBlockReason(initGeneration, gateOpenedAt) {
    if (pageChangedSince(initGeneration)) return "本轮任务已被换页作废";
    const ageMs = Date.now() - gateOpenedAt;
    if (ageMs > VIP_BACKFILL_MAX_AGE_MS) return `接口迟到 ${Math.round(ageMs / 1e3)} 秒`;
    const snapshot = qualityFlowSnapshotGeneration === initGeneration ? qualityFlowSnapshot : null;
    if (!snapshot) return "本轮画质流程尚未跑完";
    if (state.qualityFlow !== snapshot.outcome) {
      return `画质流程结论已从「${qualityFlowLabel(snapshot.outcome)}」变为「${qualityFlowLabel(state.qualityFlow)}」`;
    }
    if (!VIP_BACKFILL_SAFE_OUTCOME[state.qualityFlow]) return `本轮画质流程仍有人接手（${qualityFlowLabel(state.qualityFlow)}）`;
    if (adaptive.switching) return "降档引擎正在切换";
    const activeClean = adaptiveReadActiveClean();
    if (activeClean && activeClean !== snapshot.activeClean) {
      return `画质已被改为「${activeClean}」（本轮设定为「${snapshot.activeClean}」）`;
    }
    return null;
  }
  function refreshQualityPanel() {
    const panel = Utils.query("#bilibili-quality-selector");
    if (panel) updateQualityButtons(panel);
  }
  function settleLoadingLock(taskId, stage) {
    if (taskId !== taskQueue.currentTaskId) return;
    if (!state.isLoading) {
      refreshQualityPanel();
      return;
    }
    state.isLoading = false;
    if (!isLoginGateBlocking()) {
      console.log(`[任务管理] ${stage}：本轮流程未跑到解锁点，解除面板加载锁定`);
      refreshQualityPanel();
      return;
    }
    console.log(`[会员状态] ${stage}：未登录且未开启未登录模式，本页按设计不自动设置画质；面板已解除锁定，画质偏好仍可自行修改`);
    if (!document.getElementById(BILI.video.playerRoot)) {
      releasePlayerControlsBinding();
      stopAdaptiveQuality();
    }
    runSafely(checkVipStatusAsync().then(refreshQualityPanel), "登录门收尾");
  }
  function initPlayerScripts() {
    checkIfLivePage();
    if (state.isLivePage) {
      state.isLoading = false;
      state.liveEntryForceHighest = state.userLiveQualitySetting === "最高画质";
      const initTaskId = taskQueue.currentTaskId;
      runSafely((async () => {
        createLiveSettingsPanel();
        await selectLiveQuality();
        if (taskQueue.isTaskCancelled(initTaskId)) return;
        applyDecodeSetting();
        if (state.liveQualityPollingEnabled) startLivePolling();
        if (state.liveKeepAliveEnabled) startLiveKeepAlive();
        scheduleContractSelfCheck(initTaskId);
      })(), "直播初始化");
    } else {
      applyAutoWidescreen();
      startAdaptiveQuality();
      ensurePlayerControlsBinding();
      const initTaskId = taskQueue.currentTaskId;
      const initGeneration = pageGeneration;
      let vipGateOpened = false;
      let vipCheckObserver = null;
      let vipGateCoalesceTimer = null;
      let avatarProbeTimer = null;
      const stopVipGateWatch = () => {
        if (vipCheckObserver) {
          vipCheckObserver.disconnect();
          vipCheckObserver = null;
        }
        if (vipGateCoalesceTimer !== null) {
          clearTimeout(vipGateCoalesceTimer);
          vipGateCoalesceTimer = null;
        }
        if (avatarProbeTimer !== null) {
          clearInterval(avatarProbeTimer);
          avatarProbeTimer = null;
        }
      };
      const runQualityInit = () => {
        runSafely((async () => {
          try {
            const outcome = await waitForPlayerWithBackoff(initTaskId, async () => {
              state.isLoading = false;
              await checkVipStatusAsync();
              await selectVideoQuality();
              recordQualityFlowSnapshot();
              refreshQualityPanel();
              applyDecodeSetting();
            }, 5, 1e3, 0);
            settlePlayerWait(initTaskId, outcome);
          } finally {
            settleLoadingLock(initTaskId, "画质初始化");
          }
        })(), "画质初始化");
      };
      const runVipGate = () => {
        if (state.devModeEnabled && state.devModeNoLoginStatus) {
          stopVipGateWatch();
          vipGateOpened = true;
          console.log("[未登录模式] 跳过等待头像元素，直接执行画质设置");
          runQualityInit();
          return;
        }
        const headerAvatar = document.querySelector(BILI.header.avatarWrap);
        if (headerAvatar) {
          stopVipGateWatch();
          vipGateOpened = true;
          const gateOpenedAt = Date.now();
          let timeoutId = null;
          let hasExecuted = false;
          let vipIconObserver = null;
          const executeQualitySettings = () => {
            if (hasExecuted) return;
            hasExecuted = true;
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            if (vipIconObserver) {
              vipIconObserver.disconnect();
              vipIconObserver = null;
            }
            runQualityInit();
          };
          if (state.devModeEnabled && state.devModeVipStatus !== "默认") {
            console.log("[会员状态] 开发者模式已模拟会员状态，跳过接口查询");
          } else {
            fetch(BILI.api.vipInfo, { credentials: "include" }).then((r) => r.json()).catch((e) => {
              console.debug("[会员状态] VIP 接口请求失败，回退 DOM 检测:", e);
              return null;
            }).then((raw) => {
              if (raw === null) return;
              const isVip = readVipFromResponse(raw);
              if (isVip === null) {
                console.debug("[会员状态] VIP 接口未返回可用数据，回退 DOM 检测");
                return;
              }
              cacheVipStatus(isVip, "API 接口", VIP_EVIDENCE.api);
              if (!hasExecuted) {
                executeQualitySettings();
                return;
              }
              if (state.isVipUser === isVip) return;
              const blockReason = vipBackfillBlockReason(initGeneration, gateOpenedAt);
              if (blockReason) {
                console.log(`[会员状态] 接口结果与当前页判定不一致，但${blockReason}，本页不回灌（缓存已更新，下个视频生效）`);
                return;
              }
              console.log("[会员状态] 接口结果与当前页判定不一致，重新执行画质设置");
              runSafely((async () => {
                await checkVipStatusAsync();
                if (pageChangedSince(initGeneration)) return;
                await selectVideoQuality();
                refreshQualityPanel();
              })(), "会员状态回灌");
            });
          }
          vipIconObserver = new MutationObserver((mutations, obs) => {
            const vipElement = document.querySelector(BILI.header.bigVipIcon) || document.querySelector(BILI.header.smallVipIcon);
            if (vipElement || mutations.some((m) => m.target.classList && (m.target.classList.contains(BILI.header.bigVipIconClass) || m.target.classList.contains(BILI.header.smallVipIconClass)))) {
              obs.disconnect();
              console.log("[会员状态] 会员图标已加载，开始执行画质设置");
              executeQualitySettings();
            }
          });
          vipIconObserver.observe(headerAvatar, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class"]
          });
          timeoutId = setTimeout(() => {
            if (vipIconObserver) {
              vipIconObserver.disconnect();
              vipIconObserver = null;
            }
            console.log("[会员状态] 会员图标检测超时，继续执行画质设置");
            executeQualitySettings();
          }, 3500);
        }
      };
      vipCheckObserver = new MutationObserver(() => {
        if (vipGateCoalesceTimer !== null) return;
        vipGateCoalesceTimer = setTimeout(() => {
          vipGateCoalesceTimer = null;
          runVipGate();
        }, VIP_GATE_COALESCE_MS);
      });
      vipCheckObserver.observe(document.body, { childList: true, subtree: true });
      runVipGate();
      setTimeout(() => {
        const observer = vipCheckObserver;
        if (vipGateOpened || !observer || !isLoginGateBlocking()) return;
        console.log("[会员状态] 登录入口在场且始终未见头像，判定为未登录，停止头部变更观察，改用轻量探测");
        observer.disconnect();
        vipCheckObserver = null;
        if (vipGateCoalesceTimer !== null) {
          clearTimeout(vipGateCoalesceTimer);
          vipGateCoalesceTimer = null;
        }
        settleLoadingLock(initTaskId, "会员门");
        avatarProbeTimer = setInterval(runVipGate, AVATAR_PROBE_INTERVAL_MS);
      }, NO_LOGIN_SETTLE_MS);
      setTimeout(() => {
        stopVipGateWatch();
        if (vipGateOpened) return;
        console.log("[会员状态] 等待头像元素超时，兜底执行画质设置");
        runQualityInit();
      }, VIP_GATE_FALLBACK_MS);
    }
  }
  function installLifecycle() {
    if (document.readyState === "loading") {
      const bootGeneration = pageGeneration;
      window.addEventListener("DOMContentLoaded", () => {
        if (pageGeneration !== bootGeneration) {
          console.log("[生命周期] 启动期地址已变化，初始化交由换页流程接管");
          return;
        }
        initPlayerScripts();
      }, { once: true });
    } else {
      initPlayerScripts();
    }
  }
  var VISIBILITY_RETRY_OUTCOME = {
    pending: true,
    stalled: true,
    switched: false,
    settled: false,
    abandoned: false,
    delegated: false
  };
  var visibilityRecoverTimer = null;
  document.addEventListener("visibilitychange", () => {
    if (getRealVisibilityState() !== "visible") return;
    checkIfLivePage();
    if (state.isLivePage) {
      if (state.liveDanmakuSync) syncLiveDanmaku();
      if (state.liveAutoRecoverOnVisible) {
        console.log("[可见性恢复] 直播页切回前台，重新切换画质");
        if (visibilityRecoverTimer) clearTimeout(visibilityRecoverTimer);
        visibilityRecoverTimer = setTimeout(() => runSafely((async () => {
          visibilityRecoverTimer = null;
          if (liveFacadeInfo()) {
            await selectLiveQuality();
          }
        })(), "可见性恢复"), 800);
      }
      return;
    }
    if (!VISIBILITY_RETRY_OUTCOME[state.qualityFlow]) return;
    console.log(`[可见性恢复] 标签页变为可见，画质流程「${qualityFlowLabel(state.qualityFlow)}」，尝试重新触发`);
    if (visibilityRecoverTimer) clearTimeout(visibilityRecoverTimer);
    visibilityRecoverTimer = setTimeout(() => runSafely((async () => {
      visibilityRecoverTimer = null;
      if (!VISIBILITY_RETRY_OUTCOME[state.qualityFlow]) return;
      const taskId = taskQueue.generateTaskId();
      state.isLoading = !state.vipStatusChecked;
      try {
        const outcome = await waitForPlayerWithBackoff(taskId, async () => {
          if (taskQueue.isTaskCancelled(taskId)) return;
          state.isLoading = false;
          if (!VISIBILITY_RETRY_OUTCOME[state.qualityFlow]) {
            refreshQualityPanel();
            return;
          }
          await checkVipStatusAsync();
          await selectVideoQuality();
          recordQualityFlowSnapshot();
          refreshQualityPanel();
          applyDecodeSetting();
        }, 5, 1e3, 0);
        settlePlayerWait(taskId, outcome);
      } finally {
        settleLoadingLock(taskId, "可见性恢复");
      }
    })(), "可见性恢复"), 800);
  });
  function isPlayerReady() {
    const qualityMenu = document.querySelector(BILI.video.qualityMenu);
    const qualityItems = qualityMenu ? qualityMenu.querySelectorAll(BILI.video.qualityMenuItem) : null;
    const headerAvatar = document.querySelector(BILI.header.avatarWrap);
    const isReady = !!qualityItems && qualityItems.length > 0;
    console.log(`[播放器状态]
    - 画质菜单: ${qualityMenu ? "已加载" : "未加载"}
    - 画质选项: ${qualityItems ? `${qualityItems.length}个选项` : "未加载"}
    - 用户头像: ${headerAvatar ? "已加载" : "未加载（仅影响会员门，不影响就绪）"}`);
    return isReady;
  }
  function releasePlayerBindingsIfNotPlayerPage(taskId) {
    if (state.isLivePage) return false;
    if (taskId !== taskQueue.currentTaskId || isLoginGateBlocking()) return false;
    if (document.getElementById(BILI.video.playerRoot)) return false;
    console.log("[生命周期] 当前地址没有播放器容器，释放控制栏观察器与降档引擎");
    releasePlayerControlsBinding();
    stopAdaptiveQuality();
    return true;
  }
  function settlePlayerWait(taskId, outcome) {
    if (outcome === "cancelled") return;
    if (outcome === "exhausted" && releasePlayerBindingsIfNotPlayerPage(taskId)) return;
    scheduleContractSelfCheck(taskId);
  }
  async function waitForPlayerWithBackoff(taskId, callback, maxRetries = 5, initialDelay = 1e3, retryCount = 0) {
    if (taskQueue.isTaskCancelled(taskId)) {
      console.log(`[任务管理] 任务 #${taskId} 已取消，停止等待播放器`);
      return "cancelled";
    }
    if (isPlayerReady()) {
      console.log(`[任务管理] 任务 #${taskId}: 播放器和用户信息已就绪`);
      await callback();
      return "ready";
    }
    if (retryCount >= maxRetries) {
      console.log(`[任务管理] 任务 #${taskId}: 达到最大重试次数(${maxRetries})，强制执行回调`);
      await callback();
      return "exhausted";
    }
    const delayTime = initialDelay * Math.pow(2, retryCount);
    console.log(`[任务管理] 任务 #${taskId}: 等待播放器加载中 (第${retryCount + 1}次尝试，等待${delayTime}ms)`);
    let outcome = "cancelled";
    await taskQueue.scheduleTask(taskId, async () => {
      if (!taskQueue.isTaskCancelled(taskId)) {
        outcome = await waitForPlayerWithBackoff(taskId, callback, maxRetries, initialDelay, retryCount + 1);
      }
    }, delayTime);
    return outcome;
  }
  var CONTENT_URL_PARAMS = ["p", "bvid", "oid"];
  function canonicalUrl(rawUrl) {
    try {
      const urlObj = new URL(rawUrl);
      const path = urlObj.pathname;
      let end = path.length;
      while (end > 0 && path.charCodeAt(end - 1) === 47) end--;
      urlObj.pathname = end === path.length ? path : path.slice(0, end);
      urlObj.hash = "";
      const kept = CONTENT_URL_PARAMS.map((k) => [k, urlObj.searchParams.get(k)]).filter(([, v]) => v !== null);
      urlObj.search = "";
      kept.forEach(([k, v]) => urlObj.searchParams.set(k, v));
      return urlObj.toString();
    } catch (e) {
      return rawUrl;
    }
  }
  var lastCanonicalUrl = canonicalUrl(location.href);
  (function(history) {
    const pushState = history.pushState;
    if (pushState.__baqLocationPatched) return;
    const replaceState = history.replaceState;
    history.pushState = function(...args) {
      const result = pushState.apply(history, args);
      window.dispatchEvent(new Event("baq:locationchange"));
      return result;
    };
    history.replaceState = function(...args) {
      const result = replaceState.apply(history, args);
      window.dispatchEvent(new Event("baq:locationchange"));
      return result;
    };
    history.pushState.__baqLocationPatched = true;
  })(window.history);
  async function onUrlChange() {
    const newUrl = canonicalUrl(location.href);
    if (newUrl === lastCanonicalUrl) return;
    lastCanonicalUrl = newUrl;
    pageGeneration++;
    const taskId = taskQueue.generateTaskId();
    console.log(`[URL变更] 开始新任务 #${taskId}, URL: ${newUrl}`);
    taskQueue.clearPreviousTasks();
    cancelDecodeRetry();
    if (visibilityRecoverTimer) {
      clearTimeout(visibilityRecoverTimer);
      visibilityRecoverTimer = null;
    }
    resetQualityFailWatch();
    state.isLoading = !state.vipStatusChecked;
    state.qualityFlow = "pending";
    checkIfLivePage();
    applyAutoWidescreen();
    restartAdaptiveQuality();
    stopLivePolling();
    stopLiveKeepAlive();
    if (state.isLivePage) {
      releasePlayerControlsBinding();
    } else {
      ensurePlayerControlsBinding();
    }
    refreshQualityPanel();
    try {
      await taskQueue.scheduleTask(taskId, async () => {
        if (taskQueue.isTaskCancelled(taskId)) return;
        if (state.isLivePage) {
          console.log(`[任务管理] 任务 #${taskId}: 直播页跳过视频版就绪等待`);
          state.isLoading = false;
          state.liveEntryForceHighest = state.userLiveQualitySetting === "最高画质";
          createLiveSettingsPanel();
          await selectLiveQuality();
          if (taskQueue.isTaskCancelled(taskId)) return;
          applyDecodeSetting();
          if (state.liveQualityPollingEnabled) startLivePolling();
          if (state.liveKeepAliveEnabled) startLiveKeepAlive();
          refreshQualityPanel();
          scheduleContractSelfCheck(taskId);
          console.log(`[任务管理] 任务 #${taskId}: 画质设置完成`);
          return;
        }
        console.log(`[任务管理] 任务 #${taskId}: 开始检查播放器状态`);
        const outcome = await waitForPlayerWithBackoff(taskId, async () => {
          if (taskQueue.isTaskCancelled(taskId)) return;
          console.log(`[任务管理] 任务 #${taskId}: 播放器就绪，开始初始化画质设置`);
          state.isLoading = false;
          await checkVipStatusAsync();
          await selectVideoQuality();
          recordQualityFlowSnapshot();
          applyDecodeSetting();
          applyAutoWidescreen();
          refreshQualityPanel();
          console.log(`[任务管理] 任务 #${taskId}: 画质设置完成`);
        });
        settlePlayerWait(taskId, outcome);
      }, 1e3);
    } catch (error) {
      console.error(`[任务管理] 任务 #${taskId}: 执行出错:`, error);
    } finally {
      settleLoadingLock(taskId, "URL变更");
    }
  }
  var urlChangeEvents = ["popstate", "hashchange", "baq:locationchange"];
  var handleUrlChange = () => runSafely(onUrlChange(), "URL变更");
  function bindUrlChangeListeners() {
    urlChangeEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleUrlChange);
    });
  }
  bindUrlChangeListeners();
  window.addEventListener("pagehide", () => {
    stopLivePolling();
    stopLiveKeepAlive();
    stopAdaptiveQuality();
    releasePlayerControlsBinding();
    resetQualityFailWatch();
    urlChangeEvents.forEach((eventName) => {
      window.removeEventListener(eventName, handleUrlChange);
    });
  });
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    bindUrlChangeListeners();
    console.log("[生命周期] 页面自 bfcache 恢复，重挂 URL 监听并重整当前页");
    checkIfLivePage();
    if (canonicalUrl(location.href) !== lastCanonicalUrl) {
      handleUrlChange();
      return;
    }
    if (state.isLivePage) {
      if (state.liveQualityPollingEnabled) startLivePolling();
      if (state.liveKeepAliveEnabled) startLiveKeepAlive();
      return;
    }
    ensurePlayerControlsBinding();
    restartAdaptiveQuality();
  });

  // src/index.ts
  applyVisibilityHijack(state.preventBackgroundDegrade);
  applyUnlockEnvironment();
  applyStyles();
  registerMenuCommands();
  installSettingsSync();
  installLifecycle();
})();
