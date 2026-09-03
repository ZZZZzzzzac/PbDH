import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { CardFooter, RestrictedMarkdown, SingleLineTextFit, useContainerTextFit } from "@pbdh/resource-renderer/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type ReferenceCardModel = {
  title: string;
  originalTitle?: string;
  kicker: string;
  headerValue?: string;
  meta?: readonly string[];
  stats?: readonly { label: string; value: string }[];
  summary?: string;
  sections?: readonly { title: string; originalTitle?: string; body: string; hideTitle?: boolean }[];
  flavor?: string;
};

export type EmptyRuntimeState = Record<string, string>;

function isEmptyState(value: unknown): value is EmptyRuntimeState {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

export const referenceCardStyles = `
.reference-card-frame{position:relative;width:63px;height:88px;overflow:hidden}.reference-card-frame.is-fluid{overflow:visible}.reference-card{--reference-media-height:96px;--ink:#1d1713;--bone:#eee4d0;--oxblood:#641f1d;box-sizing:border-box;position:absolute;inset:0 auto auto 0;width:360px;height:502.857px;transform:scale(.175);transform-origin:top left;overflow:hidden;display:flex;flex-direction:column;background:var(--bone);color:var(--ink);border:3px solid #21150f;font-family:"Noto Sans SC",sans-serif}.reference-card *{box-sizing:border-box}.reference-card.is-text{--reference-media-height:0px}.reference-card.is-fluid{height:auto;overflow:visible}.reference-card.is-split.is-fluid{min-height:568px}.reference-card-art{position:relative;flex:none;overflow:hidden;display:flex;flex-direction:column;background:#251a14;border-bottom:3px solid #b88a57}.reference-card-art::before{content:"";height:var(--reference-media-height);flex:none}.reference-card-art img{position:absolute;z-index:0;inset:0 0 auto;width:100%;height:var(--reference-media-height);display:block;object-fit:cover}.reference-card-art::after{content:"";position:absolute;z-index:1;inset:0 0 auto;height:var(--reference-media-height);background:linear-gradient(180deg,transparent 50%,#1d1310e6 100%)}.reference-card.is-text .reference-card-art::after{display:none}.reference-card.is-split .reference-card-art img{height:100%}.reference-card.is-split .reference-card-art::after{height:100%;background:linear-gradient(180deg,#1d131000 12%,#1d131052 38%,#1d1310c7 68%,#1d1310f5 100%)}.reference-card.is-split .reference-card-header{text-shadow:0 1px 2px #0e0907}.reference-card-art.is-image-only,.reference-card.is-image .reference-card-art{height:100%;border-bottom:0}.reference-card-art.is-image-only::before,.reference-card.is-image .reference-card-art::before{display:none}.reference-card-art.is-image-only img,.reference-card.is-image .reference-card-art img{position:static;height:100%}.reference-card.is-image.is-fluid .reference-card-art{height:auto}.reference-card.is-image.is-fluid .reference-card-art img{height:auto}.reference-card.is-image .reference-card-art::after{display:none}.reference-card-image-missing{width:100%;height:100%;display:grid;place-items:center;color:#f8f3ea;font:700 16px/1.3 "Noto Sans SC",sans-serif}.reference-card-header{position:relative;z-index:2;padding:10px 14px;display:flex;flex-direction:column;color:#fff4df;pointer-events:none}.reference-card-title-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:14px}.reference-card-title{min-width:0;min-height:32px;margin:0;display:flex;align-items:flex-end;overflow:hidden;color:#fff4df;font:800 var(--reference-card-title-font-size,32px)/1 "Noto Sans SC",sans-serif;white-space:nowrap}.reference-card-kicker{min-width:72px;color:#f4dfbc;font:650 17px/1.25 "Noto Sans SC",sans-serif;text-align:right}.reference-card-original-title{margin:5px 0 0;color:#d8ba91;font:650 11.5px/1.25 "Noto Sans SC",sans-serif;letter-spacing:.025em}.reference-card-split-header{display:grid;grid-template-columns:minmax(0,1fr) 72px;column-gap:14px;align-items:start}.reference-card-header-main,.reference-card-header-side{display:flex;flex-direction:column}.reference-card-header-main{min-width:0}.reference-card-header-side{width:72px}.reference-card-header-side .reference-card-kicker{min-width:0}.reference-card-header-value{color:#f4dfbc;font:650 17px/1.25 "Noto Sans SC",sans-serif;text-align:right}.reference-card-meta{margin-top:7px;display:flex;flex-wrap:wrap;gap:4px}.reference-card-meta span{padding:2px 6px;background:#f4dfbc17;border:1px solid #f4dfbc52;color:#e6c99f;font:650 10px/1.2 "Noto Sans SC",sans-serif}.reference-card-summary{margin:8px 0 0;color:#dcb299;font:italic 500 14px/1.4 "Noto Sans SC",sans-serif;white-space:pre-wrap;overflow-wrap:anywhere}.reference-card-body{min-height:0;flex:1 1 0;padding:14px 10px;display:flex;flex-direction:column;gap:7px;overflow:hidden}.reference-card-stats{display:grid;flex:none;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));border:1px solid #ad8b68;background:#f7ebd6}.reference-card-stat{padding:8px 4px;display:flex;flex-direction:column;align-items:center;text-align:center;border-right:1px solid #ad8b68}.reference-card-stat:last-child{border-right:0}.reference-card-stat b{color:var(--oxblood);font:800 24px/1.15 "Noto Sans SC",sans-serif}.reference-card-stat span{font:650 10px/1.2 "Noto Sans SC",sans-serif;color:#725443}.reference-card-sections{min-height:0;display:flex;flex:1 1 auto;flex-direction:column;gap:7px;overflow:hidden}.reference-card-section{padding:6px;flex:none;background:#f7ebd6;border:1px solid #d4b78d;border-radius:4px}.reference-card-section h2{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;margin:0 0 8px;color:var(--oxblood);font:800 19px/1.25 "Noto Sans SC",sans-serif}.reference-card-section-title{min-width:0}.reference-card-section h2 small{color:#725747;font:650 12px/1.25 "Noto Sans SC",sans-serif;letter-spacing:.025em}.reference-card-section h2::after{content:"";min-width:20px;flex:1;height:1px;background:#b88a57}.reference-card-section [data-restricted-markdown]{min-width:0;overflow:hidden;color:var(--ink);font:450 var(--reference-card-content-font-size,15px)/1.45 "Noto Sans SC",sans-serif}.reference-card-flavor{margin:0;color:#725443;font:italic 500 14px/1.4 "Noto Sans SC",sans-serif;white-space:pre-wrap}.reference-card>.pbdh-card-footer{color:#725747;background:var(--bone);border-top:1px solid #d4b78d}.reference-card.is-fluid .reference-card-body,.reference-card.is-fluid .reference-card-sections,.reference-card.is-fluid .reference-card-section{flex:none;overflow:visible}
`;

const referenceCardScale = .175;
const fixedReferenceCardNativeHeight = 502.857;

function ReferenceCardFrame({ fixedRatio, children }: { fixedRatio: boolean; children: (cardRef: React.RefObject<HTMLElement | null>) => ReactNode }) {
  const cardRef = useRef<HTMLElement>(null);
  const [nativeHeight, setNativeHeight] = useState(fixedRatio ? fixedReferenceCardNativeHeight : 568);
  useLayoutEffect(() => {
    if (fixedRatio) {
      setNativeHeight(fixedReferenceCardNativeHeight);
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
  return <div className={`reference-card-frame${fixedRatio ? "" : " is-fluid"}`} style={{ height: `${fixedRatio ? 88 : nativeHeight * referenceCardScale}px` }}>{children(cardRef)}</div>;
}

function ReferenceCard({ model, revision, templateId, presentation, portrait, attribution }: {
  model: ReferenceCardModel;
  revision: string;
  templateId: string;
  presentation: { mode: "text" | "split" | "image"; fixedRatio: boolean };
  portrait?: string;
  attribution: { artworkCredit: string; sourceLabel: string };
}) {
  const sectionsRef = useRef<HTMLDivElement>(null);
  const fitContentKey = JSON.stringify(model);
  const originalTitle = model.originalTitle?.trim() ?? "";
  const headerValue = model.headerValue?.trim() ?? "";
  useContainerTextFit(sectionsRef, fitContentKey, {
    enabled: presentation.fixedRatio && presentation.mode !== "image",
    minFontSizePx: 11,
    maxFontSizePx: 15,
    cssVariable: "--reference-card-content-font-size",
  });
  const cardClass = ["reference-card", `is-${presentation.mode}`, presentation.fixedRatio ? "" : "is-fluid"].filter(Boolean).join(" ");
  if (presentation.mode === "image") return <ReferenceCardFrame fixedRatio={presentation.fixedRatio}>{(cardRef) => <article ref={cardRef} className={cardClass} data-renderer-revision={revision} data-template-id={templateId}><div className="reference-card-art is-image-only">{portrait ? <img src={portrait} alt={model.title} /> : <div className="reference-card-image-missing" role="status">缺少主图</div>}</div></article>}</ReferenceCardFrame>;
  return <ReferenceCardFrame fixedRatio={presentation.fixedRatio}>{(cardRef) => <article ref={cardRef} className={cardClass} data-renderer-revision={revision} data-template-id={templateId}>
    <div className="reference-card-art">
      {presentation.mode === "split" && portrait ? <img src={portrait} alt="" /> : null}
      <header className="reference-card-header">
        {model.headerValue !== undefined
          ? <div className="reference-card-split-header"><div className="reference-card-header-main"><SingleLineTextFit className="reference-card-title" contentKey={model.title} minFontSizePx={9} maxFontSizePx={32} cssVariable="--reference-card-title-font-size">{model.title}</SingleLineTextFit>{originalTitle ? <p className="reference-card-original-title">{originalTitle}</p> : null}</div><div className="reference-card-header-side"><div className="reference-card-kicker">{model.kicker}</div>{headerValue ? <div className="reference-card-header-value">{headerValue}</div> : null}</div></div>
          : <><div className="reference-card-title-row"><SingleLineTextFit className="reference-card-title" contentKey={model.title} minFontSizePx={9} maxFontSizePx={32} cssVariable="--reference-card-title-font-size">{model.title}</SingleLineTextFit><div className="reference-card-kicker">{model.kicker}</div></div>{originalTitle ? <p className="reference-card-original-title">{originalTitle}</p> : null}</>}
        {model.meta?.length ? <div className="reference-card-meta">{model.meta.filter(Boolean).map((item) => <span key={item}>{item}</span>)}</div> : null}
        {model.summary && <RestrictedMarkdown className="reference-card-summary" value={model.summary} />}
      </header>
    </div>
    <div className="reference-card-body">
      {model.stats?.length ? <section className="reference-card-stats" aria-label={`${model.kicker}数据`}>{model.stats.filter((item) => item.value).map((item) => <div className="reference-card-stat" key={item.label}><b>{item.value}</b><span>{item.label}</span></div>)}</section> : null}
      <div className="reference-card-sections" ref={sectionsRef} data-text-fit-scope="reference-card-sections">
        {model.sections?.filter((section) => section.body).map((section) => <section className="reference-card-section" key={section.title}>{section.hideTitle ? null : <h2><span className="reference-card-section-title">{section.title}</span>{section.originalTitle?.trim() ? <small>{section.originalTitle}</small> : null}</h2>}<RestrictedMarkdown value={section.body} /></section>)}
      </div>
      {model.flavor && <RestrictedMarkdown className="reference-card-flavor" value={model.flavor} />}
    </div>
    <CardFooter attribution={attribution} />
  </article>}</ReferenceCardFrame>;
}

export function createReferenceCardRenderer<TData extends Record<string, unknown>>(input: {
  revision: string;
  templateId: string;
  templateVersion: string;
  defaultState: (data: TData) => EmptyRuntimeState;
  model: (data: TData) => ReferenceCardModel;
  styles?: string;
}): RendererRevisionCapability<TData, EmptyRuntimeState, ReactNode> {
  return {
    revision: input.revision,
    templateId: input.templateId,
    templateVersion: input.templateVersion,
    requiredMediaSlots: [],
    optionalMediaSlots: ["portrait"],
    defaultState: input.defaultState,
    validateState: isEmptyState,
    styles: input.styles ?? referenceCardStyles,
    render({ data, presentation, assets, attribution }) {
      const model = input.model(data);
      const portrait = assets.portrait;
      return <ReferenceCard model={model} revision={input.revision} templateId={input.templateId} presentation={presentation} portrait={portrait} attribution={attribution ?? { artworkCredit: "", sourceLabel: "" }} />;
    },
  };
}
