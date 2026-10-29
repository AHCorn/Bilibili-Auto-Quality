import { renderThemeToggle, renderGithubLink } from "./panel-chrome";

export function renderPanelHeader(title: string, extraRight = ""): string {
    return `<div class="baq-header">
        <h2>${title}</h2>
        <div class="baq-header-right">${extraRight}${renderThemeToggle()}${renderGithubLink()}</div>
      </div>`;
}

export interface ToggleRowSpec {
    inputId: string;
    label: string;
    sublabel?: string;
    description?: string;
    descriptionId?: string;
    descriptionLive?: boolean;
    checked?: boolean;
    disabled?: boolean;
    slider?: string;
    rowId?: string;
    rowClass?: string;
    rowAttrs?: string;
}

export function renderToggleRow(spec: ToggleRowSpec): string {
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

export interface StepperSpec {
    inputId: string;
    label: string;
    description: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    disabled?: boolean;
    groupId?: string;
}

export function renderStepperGroup(spec: StepperSpec): string {
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

export interface StatusTabsSpec {
    active: string;
    options: string[];
    disabled?: boolean;
    id?: string;
    extraClass?: string;
    labelledBy?: string;
    describedBy?: string;
}

export function renderStatusTabs(spec: StatusTabsSpec): string {
    const cls = "baq-vip-status-tabs" + (spec.extraClass ? " " + spec.extraClass : "") + (spec.disabled ? " baq-disabled" : "");
    const id = spec.id ? ` id="${spec.id}"` : "";
    const labelledBy = spec.labelledBy ? ` aria-labelledby="${spec.labelledBy}"` : "";
    const describedBy = spec.describedBy ? ` aria-describedby="${spec.describedBy}"` : "";
    const disabled = spec.disabled ? ` aria-disabled="true"` : "";
    return `<div class="${cls}"${id} data-active="${spec.active}" role="radiogroup"${labelledBy}${describedBy}${disabled}>
        <div class="baq-vip-tab-indicator" aria-hidden="true"></div>
        ${spec.options.map(o => `<div class="baq-vip-status-tab${o === spec.active ? " baq-active" : ""}" data-status="${o}" role="radio" aria-checked="${o === spec.active ? "true" : "false"}" tabindex="${o === spec.active ? "0" : "-1"}"${disabled}>${o}</div>`).join("")}
      </div>`;
}

export type ActionTone = "primary" | "secondary" | "danger";

export interface ActionButtonSpec {
    id: string;
    label: string;
    tone: ActionTone;
    // 卡片左栏的说明，与卡片内标题同处一行组
    description: string;
}

export interface ActionRowSpec {
    title: string;
    note?: string;
    actions: ActionButtonSpec[];
}

export function renderActionRow(spec: ActionRowSpec): string {
    const note = spec.note ? `<span class="baq-title-note">${spec.note}</span>` : "";
    const cards = spec.actions.map(a => {
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
