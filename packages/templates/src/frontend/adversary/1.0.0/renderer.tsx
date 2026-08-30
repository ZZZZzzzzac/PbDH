import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { RestrictedMarkdown } from "@pbdh/resource-renderer/react";
import type { ReactNode } from "react";

import { adversaryTemplate, type AdversaryData } from "../../../core/index.ts";

export type AdversaryRuntimeState = {
  currentHp: string;
  currentStress: string;
  focused: "true" | "false";
  notes: string;
};
export const adversaryCardDesignSource = {
  document: "docs/design/creator-app.op",
  page: "30 Components",
  surface: "#28 / Canonical Card Surface",
  component: "enemy-card-r1 / Canonical",
  presentation: { ratio: "63:88", variableHeight: false },
  featureNames: ["特性 / 蓄力", "特性 / 蛮牛冲撞", "特性 / 角撞"],
};

export const adversaryRendererStyles = `
.enemy-card{--ink:#1d1713;--bone:#eee4d0;--oxblood:#641f1d;box-sizing:border-box;position:relative;width:63mm;height:88mm;overflow:hidden;display:flex;flex-direction:column;background:var(--bone);color:var(--ink);font-family:"Noto Sans SC",sans-serif;border:.5mm solid #21150f}.enemy-card *{box-sizing:border-box}.enemy-card.is-fluid{height:auto;min-height:88mm;overflow:visible}.enemy-art{position:relative;height:25mm;flex:none;overflow:hidden;background:#251a14}.enemy-art img{width:100%;height:100%;display:block;object-fit:cover}.enemy-art:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 48%,#1d1310e6 100%)}.enemy-art.is-image-only,.enemy-card.is-image .enemy-art{height:100%}.enemy-card.is-image .enemy-art:after{display:none}.enemy-image-missing{width:100%;height:100%;display:grid;place-items:center;color:#f8f3ea;font:700 2.5mm/1.3 "Noto Sans SC",sans-serif}.enemy-kicker{position:absolute;z-index:2;right:2.5mm;top:3mm;color:#f4dfbc;font:700 2.2mm/1.2 "Noto Sans SC",sans-serif}.enemy-heading{position:absolute;z-index:2;left:3mm;right:3mm;bottom:2.5mm;color:#fff4df;pointer-events:none}.enemy-heading h1{margin:0;font:800 4.8mm/1.05 "Noto Sans SC",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.enemy-original-title,.enemy-summary{margin:.8mm 0 0;color:#d8ba91;font:600 1.7mm/1.2 "Noto Sans SC",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.enemy-summary{color:#dcb299;font-style:italic}.enemy-card.is-text .enemy-art{height:20mm}.enemy-card.is-text .enemy-body{height:68mm}.enemy-body{height:63mm;min-height:0;padding:2mm;display:flex;flex-direction:column;gap:1.2mm}.enemy-brief{height:9mm;flex:none;display:flex;gap:1mm}.enemy-motives{min-width:0;flex:1;padding:1mm 1.2mm;overflow:hidden;background:#f7ebd6;border:.2mm solid #d4b78d;border-radius:.7mm;font:650 1.65mm/1.25 "Noto Sans SC",sans-serif}.enemy-motives p{margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.enemy-motives p+p{color:var(--oxblood)}.enemy-stats{width:20mm;display:grid;grid-template-columns:8mm 1fr}.enemy-stat{display:grid;place-content:center;text-align:center;border:.2mm solid #ad8b68}.enemy-stat b{color:var(--oxblood);font:800 2.6mm/1.1 "Noto Sans SC",sans-serif}.enemy-stat span{font:650 1.35mm/1.1 "Noto Sans SC",sans-serif}.enemy-attack{height:5mm;flex:none;display:flex;align-items:center;padding:0 1.2mm;overflow:hidden;background:var(--oxblood)}.enemy-attack strong{color:#fff0d5;font:750 1.8mm/1.2 "Noto Sans SC",sans-serif;white-space:nowrap}.enemy-state{height:9mm;flex:none;display:grid;grid-template-rows:1fr 1fr;gap:.5mm}.enemy-state-row{display:flex;align-items:center;gap:.6mm;min-height:0}.enemy-state-label{width:13mm;align-self:stretch;display:grid;place-items:center;background:#21150f;color:#f8ddba;font:700 1.35mm/1 "Noto Sans SC",sans-serif}.enemy-state-markers{display:flex;min-width:0;gap:.3mm;color:#111827;overflow:hidden}.enemy-state-marker{width:3.2mm;height:3.2mm;display:grid;place-items:center;padding:0;border:0;background:transparent;color:inherit;font:2.8mm/1 sans-serif}.enemy-state-marker:not(:disabled){cursor:pointer}.enemy-state-row.is-stress .enemy-state-markers{color:#424039}.enemy-feature-heading{height:3mm;flex:none;display:flex;align-items:center;gap:1mm;color:var(--oxblood);font:800 2mm/1 "Noto Sans SC",sans-serif}.enemy-feature-heading:after{content:"";flex:1;height:.3mm;background:#b88a57}.enemy-features{min-height:0;flex:1;display:flex;flex-direction:column;gap:.7mm;overflow:hidden}.enemy-feature{min-height:0;flex:1;display:grid;grid-template-columns:14mm 1fr;gap:1mm;padding:.8mm 1mm;overflow:hidden;background:#f7ebd6;border:.2mm solid #d4b78d;border-radius:.7mm}.enemy-feature h2{margin:0;color:var(--oxblood);font:800 2mm/1.15 "Noto Sans SC",sans-serif}.enemy-feature h2 small{display:block;color:#5e4637;font:650 1.2mm/1.15 "Noto Sans SC",sans-serif}.enemy-feature h2 small span{display:block}.enemy-feature p{margin:0;overflow:hidden;color:var(--ink);font:450 1.55mm/1.25 "Noto Sans SC",sans-serif}.enemy-card.is-fluid .enemy-body{height:auto;min-height:68mm}.enemy-card.is-fluid .enemy-features{overflow:visible}.enemy-card.is-fluid .enemy-feature{min-height:10mm}
`;

function isAdversaryState(value: unknown): value is AdversaryRuntimeState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return Object.keys(state).length === 4
    && typeof state.currentHp === "string"
    && typeof state.currentStress === "string"
    && (state.focused === "true" || state.focused === "false")
    && typeof state.notes === "string";
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
  templateVersion: "1.0.0",
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
      "enemy-card", `is-${mode}`, presentation.fixedRatio ? "" : "is-fluid",
      state.focused === "true" ? "is-focused" : "",
    ].filter(Boolean).join(" ");
    if (mode === "image") {
      return <article className={cardClass} data-renderer-revision="enemy-card-r1" data-presentation-mode={mode}>
        <div className="enemy-art is-image-only">
          {portrait ? <img src={portrait} alt={data.名称} /> : <div className="enemy-image-missing" role="status">缺少主图</div>}
        </div>
      </article>;
    }
    return <article className={cardClass} data-renderer-revision="enemy-card-r1" data-presentation-mode={mode}>
      <div className={`enemy-art${mode === "text" ? " is-text-only" : ""}`}>
        {mode === "split" && portrait ? <img src={portrait} alt="" /> : null}
        <div className="enemy-kicker">位阶{data.位阶} {data.种类}</div>
        <header className="enemy-heading">
          <h1>{data.名称}</h1>
          <p className="enemy-original-title">{data.原文}</p>
          <p className="enemy-summary"><RestrictedMarkdown inline value={data.简介} /></p>
        </header>
      </div>
      <div className="enemy-body">
        <div className="enemy-brief">
          <section className="enemy-motives" aria-label="动机与经历">
            <p>动机与战术：<RestrictedMarkdown inline value={data.动机与战术} /></p>
            <p>经历：<RestrictedMarkdown inline value={data.经历} /></p>
          </section>
          <section className="enemy-stats" aria-label="敌人数据">
            <div className="enemy-stat"><b>{data.难度}</b><span>难度</span></div>
            <div className="enemy-stat"><b>{data.重度伤害阈值} / {data.严重伤害阈值}</b><span>伤害阈值</span></div>
          </section>
        </div>
        <section className="enemy-attack"><strong>攻击{data.攻击命中} · {data.攻击武器} · {data.攻击范围} · {data.攻击伤害} · {data.攻击属性}</strong></section>
        <section className="enemy-state" aria-label="状态轨道">
          <div className="enemy-state-row">
            <span className="enemy-state-label">HP {state.currentHp}/{data.生命点}</span>
            <span className="enemy-state-markers">{Array.from({ length: Number(data.生命点) }, (_, index) => <button
              type="button" className="enemy-state-marker" aria-label={`将生命设为 ${markerTarget(state.currentHp, index)}`}
              aria-pressed={index < Number(state.currentHp)} disabled={!onStateCommand} key={index}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onStateCommand?.("adjust-hp", markerDelta(state.currentHp, index))}
            >♡</button>)}</span>
          </div>
          <div className="enemy-state-row is-stress">
            <span className="enemy-state-label">压力 {state.currentStress}/{data.压力点}</span>
            <span className="enemy-state-markers">{Array.from({ length: Number(data.压力点) }, (_, index) => <button
              type="button" className="enemy-state-marker" aria-label={`将压力设为 ${markerTarget(state.currentStress, index)}`}
              aria-pressed={index < Number(state.currentStress)} disabled={!onStateCommand} key={index}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onStateCommand?.("adjust-stress", markerDelta(state.currentStress, index))}
            >◆</button>)}</span>
          </div>
        </section>
        <div className="enemy-feature-heading">特性</div>
        <section className="enemy-features" aria-label="敌人特性">{data.特性.map((feature, index) => <article className="enemy-feature" key={`${feature.名称}:${index}`}>
          <h2>{feature.名称}<small><span>{feature.原名}</span><span>{feature.类型}</span></small></h2>
          <RestrictedMarkdown value={feature.特性描述} />
        </article>)}</section>
      </div>
    </article>;
  },
};
