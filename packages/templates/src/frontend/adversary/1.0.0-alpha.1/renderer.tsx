import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import type { ReactNode } from "react";

import {
  adversaryTemplate,
  type AdversaryData,
} from "../../../core/index.ts";

export type AdversaryRuntimeState = {
  currentHp: string;
  currentStress: string;
  focused: "true" | "false";
  notes: string;
};

export {
  adversaryCardDesignSource,
  adversaryRendererStyles,
} from "./design.generated.ts";
import { adversaryRendererStyles } from "./design.generated.ts";

function isAdversaryState(value: unknown): value is AdversaryRuntimeState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return Object.keys(state).length === 4
    && typeof state.currentHp === "string"
    && typeof state.currentStress === "string"
    && (state.focused === "true" || state.focused === "false")
    && typeof state.notes === "string";
}

function renderBoldText(value: string) {
  return value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part);
}

function markerTarget(current: string, index: number): string {
  const target = index + 1;
  return String(target === Number(current) ? target - 1 : target);
}

function markerDelta(current: string, index: number): string {
  return String(Number(markerTarget(current, index)) - Number(current));
}

export const adversaryRendererRevision: RendererRevisionCapability<
  AdversaryData,
  AdversaryRuntimeState,
  ReactNode
> = {
  revision: "enemy-card-r1",
  templateId: "敌人",
  templateVersion: "1.0.0-alpha.1",
  requiredMediaSlots: [],
  optionalMediaSlots: ["portrait"],
  defaultState(data) {
    return adversaryTemplate.tabletop.defaultState(data) as AdversaryRuntimeState;
  },
  validateState: isAdversaryState,
  styles: adversaryRendererStyles,
  render({ data, state, assets, presentation, onStateCommand }) {
    const portrait = assets.portrait;
    const mode = presentation.mode;
    const cardClass = [
      "enemy-card",
      `is-${mode}`,
      presentation.fixedRatio ? "" : "is-fluid",
      state.focused === "true" ? "is-focused" : "",
    ].filter(Boolean).join(" ");
    if (mode === "image") {
      return (
        <article className={cardClass} data-renderer-revision="enemy-card-r1" data-presentation-mode={mode}>
          <div className="enemy-art is-image-only">
            {portrait
              ? <img src={portrait} alt={data.名称} />
              : <div className="enemy-image-missing" role="status">缺少主图</div>}
          </div>
        </article>
      );
    }
    return (
      <article className={cardClass} data-renderer-revision="enemy-card-r1" data-presentation-mode={mode}>
        <div className={`enemy-art${mode === "text" ? " is-text-only" : ""}`}>
          {mode === "split" && portrait ? <img src={portrait} alt="" /> : null}
          <div className="enemy-kicker">位阶{data.位阶} {data.种类}</div>
          <header className="enemy-heading">
            <h1>{data.名称}</h1>
            <p className="enemy-original-title">{data.原文}</p>
            <p className="enemy-summary">{data.简介}</p>
          </header>
        </div>
        <div className="enemy-body">
          <div className="enemy-brief">
            <section className="enemy-motives" aria-label="动机与经历">
              <p>动机与战术：{data.动机与战术}</p>
              <p>经历：{data.经历}</p>
            </section>
            <section className="enemy-stats" aria-label="敌人数据">
              <div className="enemy-stat"><b>{data.难度}</b><span>难度</span></div>
              <div className="enemy-stat"><b>{data.重度伤害阈值} / {data.严重伤害阈值}</b><span>伤害阈值</span></div>
            </section>
          </div>
          <section className="enemy-attack">
            <strong>攻击{data.攻击命中} · {data.攻击武器} · {data.攻击范围} · {data.攻击伤害} · {data.攻击属性}</strong>
          </section>
          <section className="enemy-state" aria-label="状态轨道">
            <div className="enemy-state-row">
              <span className="enemy-state-label">HP {state.currentHp}/{data.生命点}</span>
              <span className="enemy-state-markers">
                {Array.from({ length: Number(data.生命点) }, (_, index) => <button
                  type="button"
                  className="enemy-state-marker"
                  aria-label={`将生命设为 ${markerTarget(state.currentHp, index)}`}
                  aria-pressed={index < Number(state.currentHp)}
                  disabled={!onStateCommand}
                  key={index}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onStateCommand?.("adjust-hp", markerDelta(state.currentHp, index))}
                >♡</button>)}
              </span>
            </div>
            <div className="enemy-state-row is-stress">
              <span className="enemy-state-label">压力 {state.currentStress}/{data.压力点}</span>
              <span className="enemy-state-markers">
                {Array.from({ length: Number(data.压力点) }, (_, index) => <button
                  type="button"
                  className="enemy-state-marker"
                  aria-label={`将压力设为 ${markerTarget(state.currentStress, index)}`}
                  aria-pressed={index < Number(state.currentStress)}
                  disabled={!onStateCommand}
                  key={index}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onStateCommand?.("adjust-stress", markerDelta(state.currentStress, index))}
                >◆</button>)}
              </span>
            </div>
          </section>
          <div className="enemy-feature-heading">特性</div>
          <section className="enemy-features" aria-label="敌人特性">
            {data.特性.map((feature, index) => (
              <article className="enemy-feature" key={`${feature.名称}:${index}`}>
                <h2>
                  {feature.名称}
                  <small><span>{feature.原名}</span><span>{feature.类型}</span></small>
                </h2>
                <p>{renderBoldText(feature.特性描述)}</p>
              </article>
            ))}
          </section>
        </div>
      </article>
    );
  },
};
