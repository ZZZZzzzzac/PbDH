import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { RestrictedMarkdown } from "@pbdh/resource-renderer/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { adversaryTemplate, type AdversaryData } from "../../../core/index.ts";

export type AdversaryRuntimeState = {
  currentHp: string;
  currentStress: string;
  focused: "true" | "false";
  notes: string;
};
export const adversaryCardRenderSource = {
  source: "template-html-css",
  implementation: "packages/templates/src/frontend/adversary/1.0.0/renderer.tsx",
  nativeCanvas: { width: 360, minimumHeight: 568 },
  fixedRatio: { width: 63, height: 88 },
  featureNames: ["特性 / 蓄力", "特性 / 蛮牛冲撞", "特性 / 角撞"],
};

export const adversaryRendererStyles = `
.enemy-card-frame {
  position: relative;
  width: 63px;
  height: 88px;
  overflow: hidden;
}
.enemy-card-frame.is-fluid { overflow: visible; }
.enemy-card {
  --enemy-media-height: 96px;
  --ink: #1d1713;
  --bone: #eee4d0;
  --oxblood: #641f1d;
  box-sizing: border-box;
  position: absolute;
  inset: 0 auto auto 0;
  width: 360px;
  height: 502.857px;
  transform: scale(.175);
  transform-origin: top left;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bone);
  color: var(--ink);
  font-family: "Noto Sans SC", sans-serif;
  border: 3px solid #21150f;
}
.enemy-card * { box-sizing: border-box; }
.enemy-card.is-text { --enemy-media-height: 0px; }
.enemy-card.is-fluid { height: auto; overflow: visible; }
.enemy-card.is-split.is-fluid { min-height: 568px; }
.enemy-art { position: relative; height: calc(var(--enemy-media-height) + 74px); flex: none; overflow: hidden; background: #251a14; }
.enemy-art img { width: 100%; height: 100%; display: block; object-fit: cover; }
.enemy-art::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 54.12%, #1d1310cc 100%); }
.enemy-art.is-image-only, .enemy-card.is-image .enemy-art { height: 100%; }
.enemy-card.is-image.is-fluid .enemy-art { height: auto; }
.enemy-card.is-image.is-fluid .enemy-art img { height: auto; }
.enemy-card.is-image .enemy-art::after { display: none; }
.enemy-image-missing { width: 100%; height: 100%; display: grid; place-items: center; color: #f8f3ea; font: 700 16px/1.3 "Noto Sans SC", sans-serif; }
.enemy-kicker { position: absolute; z-index: 2; right: 8.7px; top: calc(var(--enemy-media-height) + 17px); width: 82px; color: #f4dfbc; font: 650 16px/1.25 "Noto Sans SC", sans-serif; text-align: center; }
.enemy-heading { position: absolute; z-index: 2; inset: 0; pointer-events: none; }
.enemy-heading h1 { position: absolute; left: 14px; right: 14px; top: calc(var(--enemy-media-height) + 12px); margin: 0; color: #fff4df; font: 800 28px/1 "Noto Sans SC", sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.enemy-original-title { position: absolute; left: 14px; top: calc(var(--enemy-media-height) + 42px); margin: 0; color: #d8ba91; font: 650 10px/1.25 "Noto Sans SC", sans-serif; }
.enemy-summary { position: absolute; left: 14px; top: calc(var(--enemy-media-height) + 57px); width: 326px; margin: 0; color: #dcb299; font: italic 500 9.5px/1.25 "Noto Sans SC", sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.enemy-body { min-height: 0; height: 398px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.enemy-brief { height: 58px; flex: none; display: flex; align-items: center; gap: 6px; }
.enemy-motives { width: 210px; height: 58px; flex: none; padding: 6px 7px; display: flex; flex-direction: column; justify-content: center; gap: 1px; overflow: hidden; background: #f7ebd6; border: 1px solid #d4b78d; border-radius: 4px; font: 650 11.2px/1.3 "Noto Sans SC", sans-serif; }
.enemy-motives p { margin: 0; }
.enemy-motives p + p { color: var(--oxblood); font: 650 10.8px/1.3 "Noto Sans SC", sans-serif; }
.enemy-stats { width: 124px; height: 58px; flex: none; display: grid; grid-template-columns: 46px 78px; }
.enemy-stat { display: grid; place-content: center; text-align: center; border: 1px solid #ad8b68; }
.enemy-stat b { color: var(--oxblood); font: 800 18px/1.25 "Noto Sans SC", sans-serif; }
.enemy-stat span { font: 650 9px/1.25 "Noto Sans SC", sans-serif; }
.enemy-attack { height: 27px; flex: none; display: flex; align-items: center; padding: 0 8px; overflow: visible; background: var(--oxblood); }
.enemy-attack strong { display: block; color: #fff0d5; font: 750 16px/1.25 "Noto Sans SC", sans-serif; white-space: nowrap; }
.enemy-state { height: 60px; flex: none; display: flex; flex-direction: column; gap: 6px; }
.enemy-state-row { height: 26px; display: flex; align-items: center; gap: 4px; }
.enemy-state-label { width: 58px; height: 26px; flex: none; display: grid; place-items: center; background: #21150f; color: #f8ddba; font: 700 9px/1.25 "Noto Sans SC", sans-serif; }
.enemy-state-markers { display: flex; min-width: 0; gap: 4px; color: #111827; }
.enemy-state-marker { width: 24px; height: 24px; flex: none; display: grid; place-items: center; padding: 0; border: 0; background: transparent; color: inherit; }
.enemy-state-marker svg { width: 100%; height: 100%; display: block; overflow: visible; }
.enemy-state-marker .marker-shape { fill: transparent; stroke: currentColor; stroke-width: 2; stroke-linejoin: round; }
.enemy-state-marker[aria-pressed="true"] .marker-shape { fill: currentColor; }
.enemy-state-marker .marker-bolt { fill: transparent; stroke: currentColor; stroke-width: 1.6; stroke-linejoin: round; }
.enemy-state-marker[aria-pressed="true"] .marker-bolt { fill: var(--bone); stroke: var(--bone); }
.enemy-state-marker:not(:disabled) { cursor: pointer; }
.enemy-state-row.is-stress .enemy-state-markers { color: #424039; }
.enemy-feature-heading { height: 18px; flex: none; display: flex; align-items: center; gap: 8px; color: var(--oxblood); font: 800 13px/1 "Noto Sans SC", sans-serif; }
.enemy-feature-heading::after { content: ""; flex: 1; height: 2px; background: #b88a57; }
.enemy-features { min-height: 0; height: auto; flex: none; display: flex; flex-direction: column; gap: 4px; overflow: visible; }
.enemy-feature { min-height: 60px; display: grid; grid-template-columns: 76px minmax(0, 1fr); align-items: start; gap: 8px; padding: 6px 8px; overflow: visible; background: #f7ebd6; border: 1px solid #d4b78d; border-radius: 4px; }
.enemy-feature h2 { margin: 0; min-width: 0; color: var(--oxblood); }
.enemy-feature-primary { display: grid; gap: 1px; }
.enemy-feature-primary span { display: block; }
.enemy-feature-name { font: 800 14px/1.2 "Noto Sans SC", sans-serif; }
.enemy-feature-type { color: #87504b; font: 650 12px/1.2 "Noto Sans SC", sans-serif; }
.enemy-feature h2 small { display: block; margin-top: 1px; color: #5e4637; font: 650 8.5px/1.2 "Noto Sans SC", sans-serif; }
.enemy-feature p { min-width: 0; margin: 0; overflow: visible; color: var(--ink); font: 450 11px/1.28 "Noto Sans SC", sans-serif; }
.enemy-card.is-fluid .enemy-body { height: auto; }
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

function HeartMarker() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path className="marker-shape" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
  </svg>;
}

function StressMarker() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path className="marker-shape" d="M12 2 22 7v10l-10 5L2 17V7Z" />
    <path className="marker-bolt" d="m13.5 4.5-6 9h4l-1 6 6-10h-4Z" />
  </svg>;
}

function AdversaryCardFrame({
  fixedRatio,
  children,
}: {
  fixedRatio: boolean;
  children: (cardRef: React.RefObject<HTMLElement | null>) => ReactNode;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const [nativeHeight, setNativeHeight] = useState(fixedRatio ? 502.857 : 568);

  useLayoutEffect(() => {
    if (fixedRatio || !cardRef.current) return;
    const card = cardRef.current;
    const updateHeight = () => setNativeHeight(card.offsetHeight);
    const observer = new ResizeObserver(updateHeight);
    observer.observe(card);
    updateHeight();
    return () => observer.disconnect();
  }, [fixedRatio]);

  return <div
    className={`enemy-card-frame${fixedRatio ? "" : " is-fluid"}`}
    style={{ height: `${nativeHeight * .175}px` }}
  >{children(cardRef)}</div>;
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
      return <AdversaryCardFrame fixedRatio={presentation.fixedRatio}>{(cardRef) => <article ref={cardRef} className={cardClass} data-renderer-revision="enemy-card-r1" data-presentation-mode={mode}>
          <div className="enemy-art is-image-only">
            {portrait ? <img src={portrait} alt={data.名称} /> : <div className="enemy-image-missing" role="status">缺少主图</div>}
          </div>
        </article>}</AdversaryCardFrame>;
    }
    return <AdversaryCardFrame fixedRatio={presentation.fixedRatio}>{(cardRef) => <article ref={cardRef} className={cardClass} data-renderer-revision="enemy-card-r1" data-presentation-mode={mode}>
      <div className="enemy-art">
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
            <span className="enemy-state-label">生命点</span>
            <span className="enemy-state-markers">{Array.from({ length: Number(data.生命点) }, (_, index) => <button
              type="button" className="enemy-state-marker" aria-label={`将生命设为 ${markerTarget(state.currentHp, index)}`}
              aria-pressed={index < Number(state.currentHp)} disabled={!onStateCommand} key={index}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onStateCommand?.("adjust-hp", markerDelta(state.currentHp, index))}
            ><HeartMarker /></button>)}</span>
          </div>
          <div className="enemy-state-row is-stress">
            <span className="enemy-state-label">压力点</span>
            <span className="enemy-state-markers">{Array.from({ length: Number(data.压力点) }, (_, index) => <button
              type="button" className="enemy-state-marker" aria-label={`将压力设为 ${markerTarget(state.currentStress, index)}`}
              aria-pressed={index < Number(state.currentStress)} disabled={!onStateCommand} key={index}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onStateCommand?.("adjust-stress", markerDelta(state.currentStress, index))}
            ><StressMarker /></button>)}</span>
          </div>
        </section>
        <div className="enemy-feature-heading">特性</div>
        <section className="enemy-features" aria-label="敌人特性">{data.特性.map((feature, index) => <article className="enemy-feature" key={`${feature.名称}:${index}`}>
          <h2><span className="enemy-feature-primary"><span className="enemy-feature-name">{feature.名称}</span><span className="enemy-feature-type">{feature.类型}</span></span><small>{feature.原名}</small></h2>
          <RestrictedMarkdown value={feature.特性描述} />
        </article>)}</section>
      </div>
      </article>}</AdversaryCardFrame>;
  },
};
