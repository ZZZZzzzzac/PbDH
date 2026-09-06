import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { CardFooter, RestrictedMarkdown, SingleLineTextFit, TextFitContainer } from "@pbdh/resource-renderer/react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { communityTemplate, type CommunityData } from "../../../core/community/1.0.1/capability.ts";

const scale = .175;
const fixedHeight = 502.857;

function CommunityFrame({ fixedRatio, splitFixed = false, imageKey, children }: { fixedRatio: boolean; splitFixed?: boolean; imageKey?: string; children: (ref: React.RefObject<HTMLElement | null>) => ReactNode }) {
  const cardRef = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(fixedRatio ? fixedHeight : 568);
  useLayoutEffect(() => {
    if (fixedRatio || !cardRef.current) return;
    const card = cardRef.current;
    const image = card.querySelector("img");
    const update = () => setHeight(splitFixed ? fixedHeight + (image?.offsetHeight ?? 0) : card.offsetHeight);
    const observer = new ResizeObserver(update);
    observer.observe(card);
    if (image) observer.observe(image);
    update();
    return () => observer.disconnect();
  }, [fixedRatio, splitFixed, imageKey]);
  return <div className={`community-card-frame${fixedRatio ? "" : " is-fluid"}`} style={{ height: `${(fixedRatio ? fixedHeight : height) * scale}px`, "--split-fixed-native-height": `${height}px` } as CSSProperties}>{children(cardRef)}</div>;
}

export const communityRendererStyles = `
.community-card-frame{position:relative;width:63px;height:88px;overflow:hidden}.community-card-frame.is-fluid{overflow:visible}.community-card{--community-font-size:15px;box-sizing:border-box;position:absolute;inset:0 auto auto 0;width:360px;height:502.857px;transform:scale(.175);transform-origin:top left;overflow:hidden;display:flex;flex-direction:column;border:3px solid #21150f;background:#eee4d0;color:#1d1713;font-family:"Noto Sans SC",sans-serif}.community-card *{box-sizing:border-box}.community-card.is-fluid{height:auto;min-height:568px;overflow:visible}.community-card-art{position:relative;flex:none;min-height:96px;overflow:hidden;background:#251a14;border-bottom:3px solid #b88a57}.community-card.is-text .community-card-art{min-height:0}.community-card-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.62}.community-card-art:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent,#1d1310e8)}.community-card-header{position:relative;z-index:1;padding:15px;color:#fff4df}.community-card-title-row{display:flex;align-items:flex-end;gap:12px}.community-card-title{min-width:0;flex:1;margin:0;font:900 var(--community-title-font-size,32px)/1.2 Georgia,"Noto Serif SC",serif}.community-card-kicker{flex:none;color:#e6c99f;font-size:12px;font-weight:800;letter-spacing:.12em}.community-card-original{margin:4px 0 0;color:#d6bea0;font-size:11px}.community-card-summary{margin:8px 0 0;color:#dcb299;font:italic 500 14px/1.4 "Noto Sans SC",sans-serif;overflow-wrap:anywhere}.community-card-body{min-height:0;flex:1;display:flex;flex-direction:column;gap:10px;padding:14px 15px 28px}.community-card-sections{min-height:0;display:flex;flex:1;flex-direction:column;gap:8px;font-size:var(--community-font-size);line-height:1.45}.community-card-section{padding:10px;border:1px solid #c4a477;background:#f8f0df}.community-card-section h2{display:flex;align-items:baseline;gap:7px;margin:0 0 6px;color:#641f1d;font-size:18px}.community-card-section h2 small{color:#765e4c;font-size:10px}.community-card-image{height:100%;background:#251a14}.community-card-image img{width:100%;height:100%;object-fit:cover}.community-card-missing{height:100%;display:grid;place-items:center;color:#d8c4a5}
.community-card.is-split{height:auto;min-height:0;overflow:visible}.community-card.is-split .community-card-art{min-height:0;overflow:visible;border-bottom:0}.community-card.is-split .community-card-art:after{display:none}.community-card.is-split .community-card-art img{position:static;width:100%;height:auto;object-fit:contain;opacity:1}.community-card.is-split.has-portrait .community-card-header{position:absolute;inset:auto 0 0;background:linear-gradient(180deg,#1d131000 0%,#1d1310b8 48%,#1d1310f5 100%)}.community-card.is-split:not(.has-portrait) .community-card-header{background:#251a14;border-bottom:3px solid #b88a57}
	.community-card.is-split.has-fixed-base{height:var(--split-fixed-native-height)}
	`;

export const communityRendererRevision: RendererRevisionCapability<CommunityData, Record<string, string>, ReactNode> = {
  revision: "community-card-r2", templateId: "社群", templateVersion: "1.0.1", requiredMediaSlots: [], optionalMediaSlots: ["portrait"],
  defaultState: (data) => communityTemplate.tabletop.defaultState(data),
  validateState: (value): value is Record<string, string> => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0,
  styles: communityRendererStyles,
  render({ data, presentation, assets, attribution }) {
    const fixedSurface = presentation.fixedRatio && presentation.mode !== "split";
    const cardClass = `community-card is-${presentation.mode}${fixedSurface ? "" : " is-fluid"}${assets.portrait ? " has-portrait" : ""}`;
    if (presentation.mode === "image") return <CommunityFrame fixedRatio={presentation.fixedRatio}>{(ref) => <article ref={ref} className={cardClass} data-renderer-revision="community-card-r2" data-template-id="社群"><div className="community-card-image">{assets.portrait ? <img src={assets.portrait} alt={data.名称} /> : <div className="community-card-missing">缺少主图</div>}</div></article>}</CommunityFrame>;
    return <CommunityFrame fixedRatio={fixedSurface} splitFixed={presentation.fixedRatio && presentation.mode === "split"} imageKey={assets.portrait}>{(ref) => <article ref={ref} className={`${cardClass}${presentation.fixedRatio && presentation.mode === "split" ? " has-fixed-base" : ""}`} data-renderer-revision="community-card-r2" data-template-id="社群">
      <div className="community-card-art">{presentation.mode === "split" && assets.portrait ? <img src={assets.portrait} alt="" /> : null}<header className="community-card-header"><div className="community-card-title-row"><SingleLineTextFit className="community-card-title" contentKey={data.名称} minFontSizePx={9} maxFontSizePx={32} cssVariable="--community-title-font-size">{data.名称 || "未命名社群"}</SingleLineTextFit><span className="community-card-kicker">{data.类型 || "社群"}</span></div>{data.原文?.trim() ? <p className="community-card-original">{data.原文}</p> : null}{data.简介 ? <RestrictedMarkdown className="community-card-summary" inline value={data.简介} /> : null}</header></div>
      <div className="community-card-body"><TextFitContainer className="community-card-sections" contentKey={JSON.stringify(data)} enabled={fixedSurface} minFontSizePx={11} maxFontSizePx={15} cssVariable="--community-font-size">{data.性格 ? <section className="community-card-section"><h2>性格</h2><RestrictedMarkdown value={data.性格} /></section> : null}{data.特性.特性描述 ? <section className="community-card-section"><h2><span>{data.特性.特性名称 || "社群特性"}</span>{data.特性.特性原文?.trim() ? <small>{data.特性.特性原文}</small> : null}</h2><RestrictedMarkdown value={data.特性.特性描述} /></section> : null}</TextFitContainer></div>
      <CardFooter attribution={attribution ?? { artworkCredit: "", sourceLabel: "" }} />
    </article>}</CommunityFrame>;
  },
};
