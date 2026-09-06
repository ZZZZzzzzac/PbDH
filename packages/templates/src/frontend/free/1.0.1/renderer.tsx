import type { RendererRevisionCapability, SurfaceAttribution, SurfacePresentation } from "@pbdh/resource-renderer/core";
import { CardFooter, RestrictedMarkdown, SingleLineTextFit, useContainerTextFit } from "@pbdh/resource-renderer/react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { freeFieldEntries, freeTemplate, type FreeData } from "../../../core/free/1.0.1/capability.ts";

export type FreeRuntimeState = Record<string, never>;

function isFreeState(value: unknown): value is FreeRuntimeState {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

export const freeRendererStyles = `
.free-card{--ink:#1d1713;--bone:#eee4d0;--oxblood:#641f1d;box-sizing:border-box;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;background:var(--bone);color:var(--ink);border:1px solid #21150f;font-family:"Noto Sans SC",sans-serif}.free-card *{box-sizing:border-box}.free-card.is-fluid{height:auto;min-height:100%;overflow:visible}.free-header{padding:10px 14px;background:#251a14;color:#fff4df;border-bottom:3px solid #b88a57}.free-type{margin:0 0 2%;color:#f4dfbc;font:650 clamp(9px,3cqw,13px)/1.2 "Noto Sans SC",sans-serif;letter-spacing:.1em}.free-title{margin:0;overflow:hidden;font:800 var(--free-title-font-size,clamp(20px,8cqw,36px))/1.2 "Noto Sans SC",sans-serif;white-space:nowrap}.free-content{padding:6% 7%;display:flex;min-height:0;flex:1;flex-direction:column;gap:4%;overflow:auto}.free-block{padding:6px;background:#f7ebd6;border:1px solid #d4b78d;border-radius:4px}.free-block h2{display:flex;align-items:center;gap:8px;margin:0 0 2%;color:var(--oxblood);font:800 clamp(11px,3.6cqw,16px)/1.2 "Noto Sans SC",sans-serif}.free-block h2::after{content:"";flex:1;height:1px;background:#b88a57}.free-block p{margin:0;white-space:pre-wrap;font:450 clamp(10px,3.4cqw,15px)/1.42 "Noto Sans SC",sans-serif}.free-art{height:170px;flex:none;background:#251a14;overflow:hidden}.free-art img{width:100%;height:100%;display:block;object-fit:cover}.free-image-missing{height:100%;display:grid;place-items:center;color:#f4dfbc;font:650 11px/1.3 "Noto Sans SC",sans-serif}.free-card.is-image .free-header,.free-card.is-image .free-content{display:none}.free-card.is-image .free-art{height:100%}.free-card.is-image.is-fluid .free-art,.free-card.is-image.is-fluid .free-art img{height:auto}.free-card.is-text .free-art{display:none}
.free-block [data-restricted-markdown]{font:450 clamp(10px,3.4cqw,15px)/1.42 "Noto Sans SC",sans-serif}
.free-original{margin:2% 0 0;color:#d8ba91;font:650 clamp(10px,3.25cqw,13px)/1.25 "Noto Sans SC",sans-serif}.free-content{overflow:hidden}.free-card.is-fluid .free-content{flex:none;overflow:visible}.free-block{flex:none}.free-block h2{flex-wrap:wrap;align-items:baseline;font-size:clamp(15px,5cqw,21px)}.free-block h2 small{color:#725747;font:650 clamp(10px,3.25cqw,13px)/1.25 "Noto Sans SC",sans-serif}.free-block p,.free-block [data-restricted-markdown]{font-size:var(--free-content-font-size,15px)}.free-card>.pbdh-card-footer{color:#725747;background:var(--bone);border-top:1px solid #d4b78d}.free-art{position:relative}.free-art>.pbdh-card-footer.is-overlay{position:absolute;z-index:2;inset:auto 0 0;color:#fff4df;background:linear-gradient(180deg,#1d131000,#1d1310dc);text-shadow:0 1px 2px #0e0907}.free-card.is-image>.pbdh-card-footer{display:none}
.free-card{position:relative}.free-title-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:6%}.free-title-row .free-title{min-width:0}.free-type{margin:0;color:#f4dfbc;font:650 clamp(10px,3.5cqw,15px)/1.2 "Noto Sans SC",sans-serif;text-align:right}.free-card.is-split .free-header{position:absolute;z-index:2;inset:0 0 auto;height:170px;display:flex;flex-direction:column;justify-content:flex-end;background:linear-gradient(180deg,#1d131000 10%,#1d131061 42%,#1d1310e8 100%);text-shadow:0 1px 2px #0e0907}.free-card.is-split .free-art{order:-1}
.free-card-frame{position:relative;width:63px;height:88px;overflow:hidden}.free-card-frame.is-fluid{overflow:visible}.free-card{position:absolute;inset:0 auto auto 0;width:360px;height:502.857px;transform:scale(.175);transform-origin:top left}.free-card.is-fluid{height:auto}
.free-card.is-split{height:auto;min-height:0;overflow:visible}.free-card.is-split .free-art{position:relative;height:auto;overflow:visible}.free-card.is-split .free-art img{width:100%;height:auto;object-fit:contain}.free-card.is-split.has-portrait .free-header{inset:auto 0 0;height:auto;min-height:74px;background:linear-gradient(180deg,#1d131000 0%,#1d1310b8 48%,#1d1310f5 100%)}.free-card.is-split:not(.has-portrait) .free-header{position:relative;height:auto;background:#251a14}.free-card.is-split:not(.has-portrait) .free-art{min-height:74px}
.free-card.is-split.has-fixed-base{height:var(--split-fixed-native-height)}
.free-summary[data-restricted-markdown]{margin:2% 0 0;color:#dcb299;font:italic 500 clamp(10px,3.5cqw,14px)/1.4 "Noto Sans SC",sans-serif;overflow-wrap:anywhere}.free-fields{display:flex;flex-wrap:wrap;gap:5px;margin:0}.free-field-tag{display:inline-flex;max-width:100%;align-items:baseline;gap:3px;padding:3px 7px;border:1px solid #c9a876;border-radius:999px;background:#ead9bc;color:var(--ink);font:600 clamp(10px,3.1cqw,13px)/1.3 "Noto Sans SC",sans-serif;overflow-wrap:anywhere}.free-field-tag b{color:var(--oxblood);font-weight:800}.free-field-tag b::after{content:":"}
`;

const freeScale = .175;
const fixedFreeNativeHeight = 502.857;

function FreeCard({ data, presentation, portrait, attribution }: {
  data: FreeData;
  presentation: SurfacePresentation;
  portrait?: string;
  attribution: SurfaceAttribution;
}) {
  const fixedSurface = presentation.fixedRatio && presentation.mode !== "split";
  const splitFixed = presentation.fixedRatio && presentation.mode === "split";
  const cardRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [nativeHeight, setNativeHeight] = useState(presentation.fixedRatio ? fixedFreeNativeHeight : 568);
  useContainerTextFit(contentRef, JSON.stringify(data), {
    enabled: fixedSurface && presentation.mode !== "image",
    minFontSizePx: 11,
    maxFontSizePx: 15,
    cssVariable: "--free-content-font-size",
  });

  useLayoutEffect(() => {
    if (fixedSurface) {
      setNativeHeight(fixedFreeNativeHeight);
      return;
    }
    const card = cardRef.current;
    if (!card) return;
    const image = card.querySelector("img");
    const updateHeight = () => setNativeHeight(splitFixed ? fixedFreeNativeHeight + (image?.offsetHeight ?? 0) : card.offsetHeight);
    const observer = new ResizeObserver(updateHeight);
    observer.observe(card);
    if (image) observer.observe(image);
    updateHeight();
    return () => observer.disconnect();
  }, [fixedSurface, splitFixed, portrait]);

  const fields = freeFieldEntries(data).filter(([, value]) => value.trim());

  const header = <header className="free-header">
    <div className="free-title-row"><SingleLineTextFit className="free-title" contentKey={data.名称} minFontSizePx={10} maxFontSizePx={36} cssVariable="--free-title-font-size">{data.名称 || "未命名自由资源"}</SingleLineTextFit><p className="free-type">{data.类型 || "自由"}</p></div>
    {data.原文?.trim() ? <p className="free-original">{data.原文}</p> : null}
    {data.简介 ? <RestrictedMarkdown className="free-summary" inline value={data.简介} /> : null}
  </header>;

  return <div
    className={`free-card-frame${fixedSurface ? "" : " is-fluid"}`}
    style={{ height: `${fixedSurface ? 88 : nativeHeight * freeScale}px`, "--split-fixed-native-height": `${nativeHeight}px` } as CSSProperties}
  ><article ref={cardRef} className={["free-card", `is-${presentation.mode}`, fixedSurface ? "" : "is-fluid", splitFixed ? "has-fixed-base" : "", portrait ? "has-portrait" : ""].filter(Boolean).join(" ")} data-renderer-revision="free-card-r4">
    {presentation.mode === "text" ? header : null}
    {(presentation.mode === "split" || presentation.mode === "image") && <div className="free-art">
      {portrait ? <img src={portrait} alt={data.名称} /> : <div className="free-image-missing" role="status">缺少主图</div>}
      {presentation.mode === "split" ? header : null}
    </div>}
    <div className="free-content" ref={contentRef}>
      {fields.length ? <div className="free-fields">{fields.map(([name, value]) => <span className="free-field-tag" key={name}><b>{name}</b><span>{value}</span></span>)}</div> : null}
      {data.内容.map((block, index) => <section className="free-block" key={`${block.名称}:${index}`}>
        <h2><span>{block.名称}</span>{block.原文?.trim() ? <small>{block.原文}</small> : null}</h2><RestrictedMarkdown value={block.描述} />
      </section>)}
    </div>
    {presentation.mode !== "image" ? <CardFooter attribution={attribution} /> : null}
  </article></div>;
}

export const freeRendererRevision: RendererRevisionCapability<FreeData, FreeRuntimeState, ReactNode> = {
  revision: "free-card-r4",
  templateId: "自由",
  templateVersion: "1.0.1",
  requiredMediaSlots: [],
  optionalMediaSlots: ["portrait"],
  defaultState(data) {
    return freeTemplate.tabletop.defaultState(data) as FreeRuntimeState;
  },
  validateState: isFreeState,
  styles: freeRendererStyles,
  render(input) {
    const { data, presentation, assets, attribution } = input;
    const portrait = assets.portrait;
    return <FreeCard data={data} presentation={presentation} portrait={portrait} attribution={attribution ?? { artworkCredit: "", sourceLabel: "" }} />;
  },
};
