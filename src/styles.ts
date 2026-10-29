import { BILI } from "./contract";

export function applyStyles(): void {
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
