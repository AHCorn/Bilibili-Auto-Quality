// Tampermonkey GM API 与 B 站播放器对象类型声明

declare global {
    interface BiliPlayerQualityState {
        nowQ?: number;
        newQ?: number;
        realQ?: number;
    }

    interface BiliPlayerToast {
        create?: (opt: { text: string; duration?: number }) => unknown;
    }

    interface BiliPlayer {
        getQuality?: () => BiliPlayerQualityState | null | undefined;
        requestQuality?: (qn: number) => { catch?: (fn: (reason?: unknown) => void) => unknown } | undefined;
        on?: (event: string, handler: () => void) => void;
        off?: (event: string, handler: () => void) => void;
        toast?: BiliPlayerToast;
    }

    interface BiliLiveQualityCandidate {
        qn?: number | string;
        desc?: string;
    }

    interface BiliLiveDanmakuState {
        display?: boolean;
    }

    interface BiliLivePlayerInfo {
        playurl?: unknown;
        quality?: number | string;
        qualityCandidates?: BiliLiveQualityCandidate[];
        danmaku?: BiliLiveDanmakuState;
    }

    interface BiliLivePlayer {
        getPlayerInfo?: () => BiliLivePlayerInfo | null | undefined;
        switchQuality?: (qn: number | string) => unknown;
        updateDMSetting?: (opt: Required<BiliLiveDanmakuState>) => void;
    }

    type BiliWindow = Window & typeof globalThis & {
        player?: BiliPlayer;
        livePlayer?: BiliLivePlayer;
    };

    interface BaqPanelElement extends HTMLDivElement {
        _hideTimer?: ReturnType<typeof setTimeout> | null;
        _themeAnimTimer?: ReturnType<typeof setTimeout> | null;
        updatePanel?: () => void;
        renderGrid?: () => void;
    }

    var unsafeWindow: BiliWindow;
    function GM_addStyle(css: string): void;
    function GM_setValue(key: string, value: unknown): void;
    function GM_getValue(key: string, def?: unknown): unknown;
    interface GMInfo {
        script?: { version?: string };
        scriptHandler?: string;
        version?: string;
    }
    var GM_info: GMInfo | undefined;
    var GM_registerMenuCommand: ((name: string, fn: () => void) => void) | undefined;
    var GM_addValueChangeListener: ((
        key: string,
        cb: (key: string, oldValue: unknown, newValue: unknown, remote: boolean) => void
    ) => string) | undefined;
}

export {};
