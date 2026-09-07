import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { CardFooter, RestrictedMarkdown, TextFitContainer } from "@pbdh/resource-renderer/react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { adversaryTemplate, type AdversaryData } from "../../../core/adversary/1.0.3/capability.ts";

export type AdversaryRuntimeState = {
  currentHp: string;
  currentStress: string;
  focused: "true" | "false";
  notes: string;
};
export const adversaryCardRenderSource = {
  source: "template-html-css",
  implementation: "packages/templates/src/frontend/adversary/1.0.2/renderer.tsx",
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
.enemy-art { position: relative; height: calc(var(--enemy-media-height) + 74px); flex: none; overflow: hidden; background: #251a14; }
.enemy-art img { width: 100%; height: 100%; display: block; object-fit: cover; }
.enemy-art::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 54.12%, #1d1310cc 100%); }
.enemy-art.is-image-only, .enemy-card.is-image .enemy-art { height: 100%; }
.enemy-card.is-image.is-fluid .enemy-art { height: auto; }
.enemy-card.is-image.is-fluid .enemy-art img { height: auto; }
.enemy-card.is-image .enemy-art::after { display: none; }
.enemy-image-missing { width: 100%; height: 100%; display: grid; place-items: center; color: #f8f3ea; font: 700 16px/1.3 "Noto Sans SC", sans-serif; }
.enemy-heading { position: absolute; z-index: 2; left: 0; right: 0; top: var(--enemy-media-height); min-height: 74px; padding: 10px 14px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(58px, 82px); align-items: start; gap: 10px; pointer-events: none; }
.enemy-heading-copy { min-width: 0; display: grid; align-content: start; gap: 2px; }
.enemy-heading h1 { min-width: 0; margin: 0; color: #fff4df; font: 800 28px/1.2 "Noto Sans SC", sans-serif; white-space: normal; overflow-wrap: anywhere; }
.enemy-kicker { min-width: 0; justify-self: end; color: #f4dfbc; font: 650 16px/1.25 "Noto Sans SC", sans-serif; text-align: center; overflow-wrap: anywhere; }
.enemy-original-title { min-width: 0; margin: 0; color: #d8ba91; font: 650 10px/1.25 "Noto Sans SC", sans-serif; overflow-wrap: anywhere; }
.enemy-summary { min-width: 0; margin: 0; color: #dcb299; font: italic 500 9.5px/1.25 "Noto Sans SC", sans-serif; white-space: normal; overflow-wrap: anywhere; }
.enemy-card.is-text.is-fluid .enemy-art { height: auto; min-height: 74px; overflow: visible; }
.enemy-card.is-text.is-fluid .enemy-heading { position: relative; top: auto; }
.enemy-body { min-height: 0; height: 398px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.enemy-brief { height: 58px; flex: none; display: flex; align-items: center; gap: 6px; }
.enemy-motives { width: 210px; height: 58px; flex: none; padding: 6px 7px; display: flex; flex-direction: column; justify-content: center; gap: 1px; overflow: hidden; background: #f7ebd6; border: 1px solid #d4b78d; border-radius: 4px; font: 650 11.2px/1.3 "Noto Sans SC", sans-serif; }
.enemy-motives p { margin: 0; }
.enemy-motives p + p { color: var(--oxblood); font: 650 10.8px/1.3 "Noto Sans SC", sans-serif; }
.enemy-stats { width: 124px; height: 58px; flex: none; display: grid; grid-template-columns: 46px 78px; }
.enemy-stat { display: grid; place-content: center; text-align: center; border: 1px solid #ad8b68; }
.enemy-stat b { color: var(--oxblood); font: 800 18px/1.25 "Noto Sans SC", sans-serif; }
.enemy-stat span { font: 650 9px/1.25 "Noto Sans SC", sans-serif; }
.enemy-attack { min-height: 27px; height: auto; flex: none; display: flex; align-items: center; padding: 3px 8px; overflow: hidden; background: var(--oxblood); }
.enemy-attack strong { min-width: 0; display: block; color: #fff0d5; font: 750 16px/1.25 "Noto Sans SC", sans-serif; white-space: normal; overflow-wrap: anywhere; }
.enemy-state { min-height: 60px; height: auto; flex: none; display: flex; flex-direction: column; gap: 6px; }
.enemy-state-row { min-height: 26px; height: auto; display: flex; align-items: flex-start; gap: 4px; }
.enemy-state-label { width: 58px; height: 26px; flex: none; display: grid; place-items: center; background: #21150f; color: #f8ddba; font: 700 9px/1.25 "Noto Sans SC", sans-serif; }
.enemy-state-markers { flex: 1; display: flex; flex-wrap: wrap; min-width: 0; gap: 4px; color: #111827; }
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
.enemy-feature { position: relative; min-height: 0; display: block; padding: 6px; overflow: visible; background: #f7ebd6; border: 1px solid #d4b78d; border-radius: 4px; }
.enemy-feature:not(.is-expanded) { min-height: 0; display: block; }
.enemy-feature-toggle { min-width: 0; display: inline; margin: 0; padding: 0 22px 0 0; border: 0; background: transparent; color: var(--oxblood); text-align: left; cursor: pointer; }
.enemy-feature-toggle::after { content: "+"; position: absolute; right: 6px; top: 6px; color: #87504b; font: 700 16px/1 "Noto Sans SC", sans-serif; }
.enemy-feature.is-expanded .enemy-feature-toggle::after { content: "−"; }
.enemy-feature:not(.is-expanded) .enemy-feature-toggle { max-width: 100%; height: 24px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.enemy-feature-toggle:focus-visible { outline: 2px solid #b88a57; outline-offset: 2px; }
.enemy-feature-primary { display: inline; }
.enemy-feature-name { min-width: 0; margin-right: 7px; overflow-wrap: anywhere; font: 800 calc(var(--enemy-feature-font-size, 15px) + 4px)/1.2 "Noto Sans SC", sans-serif; }
.enemy-feature-type { margin-right: 1px; color: #87504b; font: 650 var(--enemy-feature-font-size, 15px)/1.2 "Noto Sans SC", sans-serif; }
.enemy-feature-toggle small { display: inline; margin-right: 7px; color: #5e4637; font: 650 max(8px, calc(var(--enemy-feature-font-size, 15px) - 3px))/1.2 "Noto Sans SC", sans-serif; }
.enemy-feature-separator { color: var(--ink); font: 450 var(--enemy-feature-font-size, 15px)/1.35 "Noto Sans SC", sans-serif; }
.enemy-feature-copy { display: inline; color: var(--ink); font: 450 var(--enemy-feature-font-size, 15px)/1.35 "Noto Sans SC", sans-serif; }
.enemy-feature-copy > [data-restricted-markdown] { display: inline; margin: 0; }
.enemy-feature-copy p { display: inline; min-width: 0; margin: 0; overflow: visible; }
.enemy-card.is-fluid .enemy-body { height: auto; }
.enemy-feature p,.enemy-feature [data-restricted-markdown] { font-size: var(--enemy-feature-font-size, 15px); }.enemy-card > .pbdh-card-footer { color: #725747; background: var(--bone); border-top: 1px solid #d4b78d; }.enemy-art > .pbdh-card-footer.is-overlay { position: absolute; z-index: 3; inset: auto 0 0; color: #fff4df; background: linear-gradient(180deg, #1d131000, #1d1310dc); text-shadow: 0 1px 2px #0e0907; }
.enemy-card.is-split { height: auto; min-height: 0; overflow: visible; }
.enemy-card.is-split .enemy-art { height: auto; min-height: 74px; overflow: visible; }
.enemy-card.is-split .enemy-art img { width: 100%; height: auto; object-fit: contain; }
.enemy-card.is-split .enemy-art::after { display: none; }
.enemy-card.is-split .enemy-heading { position: relative; top: auto; }
.enemy-card.is-split.has-portrait .enemy-heading { position: absolute; inset: auto 0 0; background: linear-gradient(180deg, #1d131000 0%, #1d1310b8 48%, #1d1310f5 100%); }
.enemy-card.is-split.has-fixed-base { height: var(--split-fixed-native-height); }
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
  splitFixed = false,
  imageKey,
  children,
}: {
  fixedRatio: boolean;
  splitFixed?: boolean;
  imageKey?: string;
  children: (cardRef: React.RefObject<HTMLElement | null>) => ReactNode;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const [nativeHeight, setNativeHeight] = useState(fixedRatio ? 502.857 : 568);

  useLayoutEffect(() => {
    if (fixedRatio || !cardRef.current) return;
    const card = cardRef.current;
    const image = card.querySelector("img");
    const updateHeight = () => setNativeHeight(splitFixed ? 502.857 + (image?.offsetHeight ?? 0) : card.offsetHeight);
    const observer = new ResizeObserver(updateHeight);
    observer.observe(card);
    if (image) observer.observe(image);
    updateHeight();
    return () => observer.disconnect();
  }, [fixedRatio, splitFixed, imageKey]);

  return <div
    className={`enemy-card-frame${fixedRatio ? "" : " is-fluid"}`}
    style={{ height: `${nativeHeight * .175}px`, "--split-fixed-native-height": `${nativeHeight}px` } as CSSProperties}
  >{children(cardRef)}</div>;
}

function AdversaryFeature({ feature }: { feature: AdversaryData["特性"][number] }) {
  const [expanded, setExpanded] = useState(true);
  return <article className={`enemy-feature${expanded ? " is-expanded" : ""}`}>
    <button
      type="button"
      className="enemy-feature-toggle"
      aria-expanded={expanded}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        setExpanded((current) => !current);
      }}
    >
      <span className="enemy-feature-primary">
        <span className="enemy-feature-name">{feature.特性名称}</span>
        {expanded && feature.特性原文?.trim() ? <small>{feature.特性原文}</small> : null}
        <span className="enemy-feature-type">{feature.特性类型}</span>
      </span>
    </button>
    {expanded ? <><span className="enemy-feature-separator">：</span><span className="enemy-feature-copy"><RestrictedMarkdown inline value={feature.特性描述} /></span></> : null}
  </article>;
}
export const adversaryRendererRevision: RendererRevisionCapability<
  AdversaryData,
  AdversaryRuntimeState,
  ReactNode
> = {
  revision: "enemy-card-r4",
  templateId: "敌人",
  templateVersion: "1.0.3",
  requiredMediaSlots: [],
  optionalMediaSlots: ["portrait"],
  defaultState(data) {
    return adversaryTemplate.tabletop.defaultState(data) as AdversaryRuntimeState;
  },
  validateState: isAdversaryState,
  styles: adversaryRendererStyles,
  render({ data, state, assets, presentation, attribution, onStateCommand }) {
    const portrait = assets.portrait;
    const mode = presentation.mode;
    const fixedSurface = presentation.fixedRatio && mode !== "split";
    const splitFixed = presentation.fixedRatio && mode === "split";
    const hasOriginalTitle = Boolean(data.原文?.trim());
    const cardClass = [
      "enemy-card", `is-${mode}`, fixedSurface ? "" : "is-fluid", splitFixed ? "has-fixed-base" : "", portrait ? "has-portrait" : "",
      state.focused === "true" ? "is-focused" : "",
    ].filter(Boolean).join(" ");
    if (mode === "image") {
      return <AdversaryCardFrame fixedRatio={presentation.fixedRatio}>{(cardRef) => <article ref={cardRef} className={cardClass} data-renderer-revision="enemy-card-r4" data-presentation-mode={mode}>
          <div className="enemy-art is-image-only">
            {portrait ? <img src={portrait} alt={data.名称} /> : <div className="enemy-image-missing" role="status">缺少主图</div>}
          </div>
        </article>}</AdversaryCardFrame>;
    }
    return <AdversaryCardFrame fixedRatio={fixedSurface} splitFixed={splitFixed} imageKey={portrait}>{(cardRef) => <article ref={cardRef} className={cardClass} data-renderer-revision="enemy-card-r4" data-presentation-mode={mode}>
      <div className="enemy-art">
        {mode === "split" && portrait ? <img src={portrait} alt="" /> : null}
        <header className={`enemy-heading${hasOriginalTitle ? " has-original-title" : ""}`}>
          <div className="enemy-heading-copy">
            <h1>{data.名称}</h1>
            {hasOriginalTitle ? <p className="enemy-original-title">{data.原文}</p> : null}
            <p className="enemy-summary"><RestrictedMarkdown inline value={data.简介} /></p>
          </div>
          <div className="enemy-kicker">位阶{data.位阶} {data.种类}</div>
        </header>
      </div>
      <TextFitContainer className="enemy-body" contentKey={JSON.stringify(data)} enabled={fixedSurface} minFontSizePx={8} maxFontSizePx={15} cssVariable="--enemy-feature-font-size">
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
        <section className="enemy-attack"><strong>攻击{data.攻击命中} | {data.攻击武器} | {data.攻击范围} | {data.攻击伤害} | {data.攻击属性}</strong></section>
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
        <section className="enemy-features" aria-label="敌人特性">{data.特性.map((feature, index) => <AdversaryFeature
          feature={feature}
          key={`${feature.特性名称}:${index}`}
        />)}</section>
      </TextFitContainer>
      <CardFooter attribution={attribution ?? { artworkCredit: "", sourceLabel: "" }} />
      </article>}</AdversaryCardFrame>;
  },
};
