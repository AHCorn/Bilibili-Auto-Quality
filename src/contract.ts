// B 站页面选择器、文案与播放器接口常量定义

type FacadeNames<T> = { [K in keyof T]-?: K };

export const BILI = {
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
        playerRoot: "bilibili-player",
    },
    // 顶部栏登录态与会员图标
    header: {
        loginEntry: ".header-avatar-unlogin-entry, .header-avatar-unlogin-wrap, .go-login-btn, .header-login-entry",
        avatarWrap: ".header-avatar-wrap",
        bigVipIcon: ".bili-avatar-icon.bili-avatar-right-icon.bili-avatar-icon-big-vip",
        smallVipIcon: ".bili-avatar-icon.bili-avatar-right-icon.bili-avatar-icon-small-vip",
        bigVipIconClass: "bili-avatar-icon-big-vip",
        smallVipIconClass: "bili-avatar-icon-small-vip",
    },
    // 视频页编码单选框
    decode: {
        radioItem: ".bui-radio-wrap.bui-radio-button .bui-radio-item",
        radioText: ".bui-radio-text",
        radioInput: "input.bui-radio-input",
        defaultTextPattern: /默认|自动/,
    },
    // 直播页选择器与画质映射
    live: {
        decodeList: ".YccudlUCmLKcUTg_yzKN",
        decodeItem: "li.HfodaIBaRC9NaglgykBX",
        decodeSelectedClass: "fG2r2piYghHTQKQZF8bl",
        qnMap: {
            "1080P 原画": 10000,
            "1080P 蓝光": 400,
            "720P 超清": 250,
        } as Record<string, number>,
    },
    // 播放器 Toast 提示文案匹配
    toast: {
        weakNetPattern: /卡顿，试试切换到|网速较慢|网络质量不佳|网络不佳/,
        switchFailPattern: /切换失败/,
    },
    // 画质菜单角标文案
    badge: {
        trialKeywords: ["限免中", "试用中", "可试用", "限时体验", "试用"],
        vipKeyword: "大会员",
    },
    // 播放器对象接口与字段名
    facade: {
        playbackLagEvent: "PLAYER_PLAYBACK_LAG",
        video: {
            windowKey: "player" satisfies keyof BiliWindow,
            methods: {
                getQuality: "getQuality",
                requestQuality: "requestQuality",
                on: "on",
                off: "off",
            } satisfies Partial<FacadeNames<BiliPlayer>>,
            toastKey: "toast" satisfies keyof BiliPlayer,
            toastCreate: "create" satisfies keyof BiliPlayerToast,
            qualityFields: {
                nowQ: "nowQ",
                newQ: "newQ",
                realQ: "realQ",
            } satisfies FacadeNames<BiliPlayerQualityState>,
        },
        live: {
            windowKey: "livePlayer" satisfies keyof BiliWindow,
            methods: {
                getPlayerInfo: "getPlayerInfo",
                switchQuality: "switchQuality",
                updateDMSetting: "updateDMSetting",
            } satisfies FacadeNames<BiliLivePlayer>,
            infoFields: {
                playurl: "playurl",
                quality: "quality",
                qualityCandidates: "qualityCandidates",
                danmaku: "danmaku",
            } satisfies FacadeNames<BiliLivePlayerInfo>,
            candidateFields: {
                qn: "qn",
                desc: "desc",
            } satisfies FacadeNames<BiliLiveQualityCandidate>,
            danmakuDisplayKey: "display" satisfies keyof BiliLiveDanmakuState,
        },
    },
    // 解锁相关 localStorage 键名
    storage: {
        forceHdrKey: "bilibili_player_force_hdr",
        markerBaseKey: "bilibili_player_force_DolbyAtmos&8K",
        markerHdrSuffix: "&HDR",
    },
    api: {
        vipInfo: "https://api.bilibili.com/x/vip/web/user/info",
    },
    liveHost: "live.bilibili.com",
};
