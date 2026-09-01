import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { CardFooter, RestrictedMarkdown, useContainerTextFit } from "@pbdh/resource-renderer/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { ancestryTemplate, type AncestryData } from "../../../core/index.ts";

type AncestryRuntimeState = Record<string, string>;

export const ancestryRendererStyles = `
.ancestry-card-frame {
  position: relative;
  width: 63px;
  height: 88px;
  overflow: hidden;
}
.ancestry-card-frame.is-fluid { overflow: visible; }
.ancestry-card {
  --ancestry-media-height: 96px;
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
.ancestry-card * { box-sizing: border-box; }
.ancestry-card.is-text { --ancestry-media-height: 0px; }
.ancestry-card.is-fluid { height: auto; overflow: visible; }
.ancestry-card.is-split.is-fluid { min-height: 568px; }
.ancestry-art { position: relative; flex: none; overflow: hidden; display: flex; flex-direction: column; background: #251a14; border-bottom: 3px solid #b88a57; }
.ancestry-art::before { content: ""; height: var(--ancestry-media-height); flex: none; }
.ancestry-art img { position: absolute; z-index: 0; inset: 0 0 auto; width: 100%; height: var(--ancestry-media-height); display: block; object-fit: cover; }
.ancestry-art::after { content: ""; position: absolute; z-index: 1; inset: 0 0 auto; height: var(--ancestry-media-height); background: linear-gradient(180deg, transparent 50%, #1d1310e6 100%); }
.ancestry-card.is-text .ancestry-art::after { display: none; }
.ancestry-card.is-split .ancestry-art img { height: 100%; }
.ancestry-card.is-split .ancestry-art::after { height: 100%; background: linear-gradient(180deg, #1d131000 12%, #1d131052 38%, #1d1310c7 68%, #1d1310f5 100%); }
.ancestry-card.is-split .ancestry-heading { text-shadow: 0 1px 2px #0e0907; }
.ancestry-art.is-image-only, .ancestry-card.is-image .ancestry-art { height: 100%; border-bottom: 0; }
.ancestry-art.is-image-only::before, .ancestry-card.is-image .ancestry-art::before { display: none; }
.ancestry-art.is-image-only img, .ancestry-card.is-image .ancestry-art img { position: static; height: 100%; }
.ancestry-card.is-image.is-fluid .ancestry-art { height: auto; }
.ancestry-card.is-image.is-fluid .ancestry-art img { height: auto; }
.ancestry-card.is-image .ancestry-art::after { display: none; }
.ancestry-image-missing { width: 100%; height: 100%; display: grid; place-items: center; color: #f8f3ea; font: 700 16px/1.3 "Noto Sans SC", sans-serif; }
.ancestry-kicker { min-width: 72px; color: #f4dfbc; font: 650 17px/1.25 "Noto Sans SC", sans-serif; text-align: right; }
.ancestry-heading { position: relative; z-index: 2; padding: 10px 14px; display: flex; flex-direction: column; pointer-events: none; }
.ancestry-title-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 14px; }
.ancestry-heading h1 { min-width: 0; min-height: 32px; margin: 0; display: flex; align-items: flex-end; overflow: hidden; color: #fff4df; font: 800 32px/1 "Noto Sans SC", sans-serif; text-overflow: ellipsis; white-space: nowrap; }
.ancestry-original-title { margin: 5px 0 0; color: #d8ba91; font: 650 11.5px/1.25 "Noto Sans SC", sans-serif; }
.ancestry-summary { margin: 8px 0 0; color: #dcb299; font: italic 500 14px/1.4 "Noto Sans SC", sans-serif; overflow-wrap: anywhere; }
.ancestry-body { min-height: 0; flex: 1 1 0; padding: 14px 10px; display: flex; flex-direction: column; overflow: hidden; }
.ancestry-features { min-height: 0; display: flex; flex: 1 1 auto; flex-direction: column; gap: 7px; overflow: hidden; }
.ancestry-feature { flex: none; display: flex; flex-direction: column; gap: 9px; padding: 14px; overflow: hidden; background: #f7ebd6; border: 1px solid #d4b78d; border-radius: 4px; }
.ancestry-feature h2 { margin: 0; min-width: 0; display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; color: var(--oxblood); font: 800 19px/1.25 "Noto Sans SC", sans-serif; overflow-wrap: anywhere; }
.ancestry-feature-name { display: inline; }
.ancestry-feature h2 small { display: inline; margin: 0; color: #725747; font: 650 12px/1.25 "Noto Sans SC", sans-serif; letter-spacing: .025em; }
.ancestry-feature [data-restricted-markdown] { min-width: 0; overflow: hidden; color: var(--ink); font: 450 var(--ancestry-feature-font-size, 15px)/1.45 "Noto Sans SC", sans-serif; }
.ancestry-empty { min-height: 108px; display: grid; place-items: center; border: 1px dashed #c9ad86; color: #715d4d; font: 650 15px/1.3 "Noto Sans SC", sans-serif; }
.ancestry-card > .pbdh-card-footer { color: #725747; background: var(--bone); border-top: 1px solid #d4b78d; }
.ancestry-art > .pbdh-card-footer.is-overlay { position: absolute; z-index: 3; inset: auto 0 0; color: #fff4df; background: linear-gradient(180deg, #1d131000, #1d1310dc); text-shadow: 0 1px 2px #0e0907; }
.ancestry-card.is-fluid .ancestry-body { flex: none; overflow: visible; }
.ancestry-card.is-fluid .ancestry-features { flex: none; overflow: visible; }
.ancestry-card.is-fluid .ancestry-feature { flex: none; overflow: visible; }
`;

function isEmptyState(value: unknown): value is AncestryRuntimeState {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

const ancestryScale = .175;
const fixedAncestryNativeHeight = 502.857;

export function ancestryFrameHeight(fixedRatio: boolean, nativeHeight: number): number {
  return fixedRatio ? 88 : nativeHeight * ancestryScale;
}

function AncestryCardFrame({
  fixedRatio,
  fitContentKey,
  children,
}: {
  fixedRatio: boolean;
  fitContentKey: string;
  children: (
    cardRef: React.RefObject<HTMLElement | null>,
    featureContainerRef: React.RefObject<HTMLElement | null>,
  ) => ReactNode;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const featureContainerRef = useRef<HTMLElement>(null);
  const [nativeHeight, setNativeHeight] = useState(fixedRatio ? fixedAncestryNativeHeight : 568);
  useContainerTextFit(featureContainerRef, fitContentKey, {
    enabled: fixedRatio,
    minFontSizePx: 11,
    maxFontSizePx: 15,
    cssVariable: "--ancestry-feature-font-size",
  });

  useLayoutEffect(() => {
    if (fixedRatio) {
      setNativeHeight(fixedAncestryNativeHeight);
      return;
    }
    if (!cardRef.current) return;
    const card = cardRef.current;
    const updateHeight = () => setNativeHeight(card.offsetHeight);
    const observer = new ResizeObserver(updateHeight);
    observer.observe(card);
    updateHeight();
    return () => observer.disconnect();
  }, [fixedRatio]);

  return <div
    className={`ancestry-card-frame${fixedRatio ? "" : " is-fluid"}`}
    style={{ height: `${ancestryFrameHeight(fixedRatio, nativeHeight)}px` }}
  >{children(cardRef, featureContainerRef)}</div>;
}

export const ancestryRendererRevision: RendererRevisionCapability<
  AncestryData,
  AncestryRuntimeState,
  ReactNode
> = {
  revision: "ancestry-card-r1",
  templateId: "种族",
  templateVersion: "1.0.0",
  requiredMediaSlots: [],
  optionalMediaSlots: ["portrait"],
  defaultState(data) {
    return ancestryTemplate.tabletop.defaultState(data);
  },
  validateState: isEmptyState,
  styles: ancestryRendererStyles,
  render({ data, presentation, assets, attribution }) {
    const cardAttribution = attribution ?? { artworkCredit: "", sourceLabel: "" };
    const portrait = assets.portrait;
    const mode = presentation.mode;
    const cardClass = [
      "ancestry-card", `is-${mode}`, presentation.fixedRatio ? "" : "is-fluid",
    ].filter(Boolean).join(" ");
    const fitContentKey = data.特性
      .map((feature) => `${feature.名称}\u0000${feature.原名 ?? ""}\u0000${feature.描述}`)
      .join("\u0001");

    if (mode === "image") {
      return <AncestryCardFrame fixedRatio={presentation.fixedRatio} fitContentKey="">{(cardRef) => <article ref={cardRef} className={cardClass} data-renderer-revision="ancestry-card-r1" data-presentation-mode={mode}>
        <div className="ancestry-art is-image-only">
          {portrait ? <img src={portrait} alt={data.名称} /> : <div className="ancestry-image-missing" role="status">缺少主图</div>}
          <CardFooter attribution={cardAttribution} overlay />
        </div>
      </article>}</AncestryCardFrame>;
    }

    return <AncestryCardFrame fixedRatio={presentation.fixedRatio} fitContentKey={fitContentKey}>{(cardRef, featureContainerRef) => <article ref={cardRef} className={cardClass} data-renderer-revision="ancestry-card-r1" data-presentation-mode={mode}>
      <div className="ancestry-art">
        {mode === "split" && portrait ? <img src={portrait} alt="" /> : null}
        <header className="ancestry-heading">
          <div className="ancestry-title-row">
            <h1>{data.名称 || "未命名种族"}</h1>
            <div className="ancestry-kicker">{data.类型 || "种族"}</div>
          </div>
          {data.原文?.trim() ? <p className="ancestry-original-title">{data.原文}</p> : null}
          <div className="ancestry-summary"><RestrictedMarkdown inline value={data.简介} /></div>
        </header>
      </div>
      <div className="ancestry-body">
        <section ref={featureContainerRef} className="ancestry-features" aria-label="种族特性" data-text-fit-scope="ancestry-features">
          {data.特性.length ? data.特性.map((feature, index) => <article className="ancestry-feature" key={`${feature.名称}:${index}`}>
            <h2>
              <span className="ancestry-feature-name">{feature.名称 || "未命名特性"}</span>
              {feature.原名?.trim() ? <small>{feature.原名}</small> : null}
            </h2>
            <RestrictedMarkdown value={feature.描述} />
          </article>) : <div className="ancestry-empty">尚未添加种族特性</div>}
        </section>
      </div>
      <CardFooter attribution={cardAttribution} />
    </article>}</AncestryCardFrame>;
  },
};
