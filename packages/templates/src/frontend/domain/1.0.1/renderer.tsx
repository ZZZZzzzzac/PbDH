import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { CardFooter, RestrictedMarkdown, SingleLineTextFit, TextFitContainer } from "@pbdh/resource-renderer/react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { domainTemplate, type DomainData } from "../../../core/domain/1.0.1/capability.ts";

function formatLevel(value: string): string {
  const level = value.trim();
  return level && !level.endsWith("级") ? `${level}级` : level;
}

function formatRecall(value: string): string {
  return value.replaceAll("⚡", "").trim();
}

const domainScale = .175;
const fixedDomainHeight = 502.857;

function DomainFrame({ fixedRatio, splitFixed = false, imageKey, children }: { fixedRatio: boolean; splitFixed?: boolean; imageKey?: string; children: (ref: React.RefObject<HTMLElement | null>) => ReactNode }) {
  const cardRef = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(fixedDomainHeight);
  useLayoutEffect(() => {
    if (fixedRatio || !cardRef.current) return;
    const card = cardRef.current;
    const image = card.querySelector("img");
    const update = () => setHeight(splitFixed ? fixedDomainHeight + (image?.offsetHeight ?? 0) : card.offsetHeight);
    const observer = new ResizeObserver(update);
    observer.observe(card);
    if (image) observer.observe(image);
    update();
    return () => observer.disconnect();
  }, [fixedRatio, splitFixed, imageKey]);
  return <div className={`domain-card-frame${fixedRatio ? "" : " is-fluid"}`} style={{ height: `${(fixedRatio ? fixedDomainHeight : height) * domainScale}px`, "--split-fixed-native-height": `${height}px` } as CSSProperties}>{children(cardRef)}</div>;
}

export const domainRendererStyles = `
.domain-card-frame{position:relative;width:63px;height:88px;overflow:hidden}.domain-card-frame.is-fluid{overflow:visible}.domain-card{--domain-font-size:15px;box-sizing:border-box;position:absolute;inset:0 auto auto 0;width:360px;height:502.857px;transform:scale(.175);transform-origin:top left;overflow:hidden;display:flex;flex-direction:column;border:3px solid #21150f;background:#eee4d0;color:#1d1713;font-family:"Noto Sans SC",sans-serif}.domain-card *{box-sizing:border-box}.domain-card.is-fluid{height:auto;overflow:visible}.domain-card-header{position:relative;overflow:hidden;padding:15px;background:#251a14;color:#fff4df;border-bottom:3px solid #b88a57}.domain-card-title-row{display:flex;align-items:flex-end;gap:12px}.domain-card-title{min-width:0;flex:1;margin:0;font:900 var(--domain-title-font-size,32px)/1.05 Georgia,"Noto Serif SC",serif}.domain-card-type{color:#e6c99f;font-size:12px;font-weight:800}.domain-card-original{margin:4px 0 0;color:#d6bea0;font-size:11px}.domain-card-summary{margin:8px 0 0;color:#dcb299;font:italic 500 14px/1.4 "Noto Sans SC",sans-serif;overflow-wrap:anywhere}.domain-card-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid #bea17b}.domain-card-stat{display:grid;place-items:center;padding:9px 4px;border-right:1px solid #d1b995}.domain-card-stat:last-child{border-right:0}.domain-card-stat b{color:#641f1d;font-size:17px}.domain-card-stat span{color:#725443;font-size:9px}.domain-card-body{min-height:0;flex:1;display:flex;flex-direction:column;gap:10px;padding:14px 16px 28px}.domain-card-feature{min-height:0;flex:1;font-size:var(--domain-font-size);line-height:1.5}.domain-card-image{width:100%;height:100%;background:#251a14}.domain-card-image img{width:100%;height:100%;object-fit:cover}.domain-card-missing{height:100%;display:grid;place-items:center;color:#d8c4a5}.domain-card-art{position:relative;flex:none;background:#251a14}.domain-card-art>img{display:block;width:100%;height:auto;object-fit:contain}.domain-card.is-split{height:auto;min-height:0;overflow:visible}.domain-card.is-split.has-portrait .domain-card-header{position:absolute;inset:auto 0 0;width:100%;background:linear-gradient(180deg,#1d131000 0%,#1d1310b8 48%,#1d1310f5 100%);border-bottom:0}.domain-card.is-split:not(.has-portrait) .domain-card-header{background:#251a14}
	.domain-card.is-split.has-fixed-base{height:var(--split-fixed-native-height)}
	`;

export const domainRendererRevision: RendererRevisionCapability<DomainData, Record<string, string>, ReactNode> = {
  revision: "domain-card-r2", templateId: "领域卡", templateVersion: "1.0.1", requiredMediaSlots: [], optionalMediaSlots: ["portrait"],
  defaultState: (data) => domainTemplate.tabletop.defaultState(data),
  validateState: (value): value is Record<string, string> => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0,
  styles: domainRendererStyles,
  render({ data, presentation, assets, attribution }) {
    const stats = [["领域", data.领域], ["等级", formatLevel(data.等级)], ["属性", data.属性], ["回想", formatRecall(data.回想)]];
    if (presentation.mode === "image") return <DomainFrame fixedRatio={presentation.fixedRatio}>{(ref) => <article ref={ref} className="domain-card is-image" data-renderer-revision="domain-card-r2" data-template-id="领域卡"><div className="domain-card-image">{assets.portrait ? <img src={assets.portrait} alt={data.名称} /> : <div className="domain-card-missing">缺少主图</div>}</div></article>}</DomainFrame>;
    const fixedSurface = presentation.fixedRatio && presentation.mode !== "split";
    return <DomainFrame fixedRatio={fixedSurface} splitFixed={presentation.fixedRatio && presentation.mode === "split"} imageKey={assets.portrait}>{(ref) => <article ref={ref} className={`domain-card is-${presentation.mode}${fixedSurface ? "" : " is-fluid"}${presentation.fixedRatio && presentation.mode === "split" ? " has-fixed-base" : ""}${assets.portrait ? " has-portrait" : ""}`} data-renderer-revision="domain-card-r2" data-template-id="领域卡">
      <div className="domain-card-art">{presentation.mode === "split" && assets.portrait ? <img src={assets.portrait} alt="" /> : null}<header className="domain-card-header"><div className="domain-card-title-row"><SingleLineTextFit className="domain-card-title" contentKey={data.名称} minFontSizePx={9} maxFontSizePx={32} cssVariable="--domain-title-font-size">{data.名称 || "未命名领域卡"}</SingleLineTextFit><span className="domain-card-type">{data.类型 || "领域卡"}</span></div>{data.原文?.trim() ? <p className="domain-card-original">{data.原文}</p> : null}{data.简介 ? <RestrictedMarkdown className="domain-card-summary" inline value={data.简介} /> : null}</header></div>
      <section className="domain-card-stats">{stats.map(([label, value]) => <div className="domain-card-stat" key={label}><b>{value}</b><span>{label}</span></div>)}</section>
      <div className="domain-card-body"><TextFitContainer className="domain-card-feature" contentKey={data.特性描述} enabled={fixedSurface} minFontSizePx={11} maxFontSizePx={15} cssVariable="--domain-font-size"><RestrictedMarkdown value={data.特性描述} /></TextFitContainer></div>
      <CardFooter attribution={attribution ?? { artworkCredit: "", sourceLabel: "" }} />
    </article>}</DomainFrame>;
  },
};
