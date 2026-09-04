import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { CardFooter, RestrictedMarkdown, SingleLineTextFit, TextFitContainer } from "@pbdh/resource-renderer/react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { subclassTemplate, type SubclassData } from "../../../core/subclass/1.0.1/capability.ts";

const subclassScale = .175;
const fixedSubclassHeight = 502.857;

function SubclassFrame({ fixedRatio, splitFixed = false, imageKey, children }: { fixedRatio: boolean; splitFixed?: boolean; imageKey?: string; children: (ref: React.RefObject<HTMLElement | null>) => ReactNode }) {
  const cardRef = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(fixedSubclassHeight);
  useLayoutEffect(() => {
    if (fixedRatio || !cardRef.current) return;
    const card = cardRef.current;
    const image = card.querySelector("img");
    const update = () => setHeight(splitFixed ? fixedSubclassHeight + (image?.offsetHeight ?? 0) : card.offsetHeight);
    const observer = new ResizeObserver(update);
    observer.observe(card);
    if (image) observer.observe(image);
    update();
    return () => observer.disconnect();
  }, [fixedRatio, splitFixed, imageKey]);
  return <div className={`subclass-card-frame${fixedRatio ? "" : " is-fluid"}`} style={{ height: `${(fixedRatio ? fixedSubclassHeight : height) * subclassScale}px`, "--split-fixed-native-height": `${height}px` } as CSSProperties}>{children(cardRef)}</div>;
}

export const subclassRendererStyles = `
.subclass-card-frame{position:relative;width:63px;height:88px;overflow:hidden}.subclass-card{--subclass-font-size:15px;box-sizing:border-box;position:absolute;inset:0 auto auto 0;width:360px;height:502.857px;transform:scale(.175);transform-origin:top left;overflow:hidden;display:flex;flex-direction:column;border:3px solid #21150f;background:#eee4d0;color:#1d1713;font-family:"Noto Sans SC",sans-serif}.subclass-card *{box-sizing:border-box}.subclass-card-header{position:relative;overflow:hidden;padding:15px;background:#251a14;color:#fff4df;border-bottom:3px solid #b88a57}.subclass-card-header-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.32}.subclass-card-header>*:not(.subclass-card-header-image){position:relative}.subclass-card-title-row{display:flex;align-items:flex-end;gap:12px}.subclass-card-title{min-width:0;flex:1;margin:0;font:900 var(--subclass-title-font-size,32px)/1.05 Georgia,"Noto Serif SC",serif}.subclass-card-type{color:#e6c99f;font-size:12px;font-weight:800}.subclass-card-original{margin:4px 0 0;color:#d6bea0;font-size:11px}.subclass-card-summary{margin:8px 0 0;color:#dcb299;font:italic 500 14px/1.4 "Noto Sans SC",sans-serif;overflow-wrap:anywhere}.subclass-card-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-bottom:1px solid #bea17b}.subclass-card-stat{display:grid;place-items:center;padding:9px 4px;border-right:1px solid #d1b995}.subclass-card-stat:last-child{border-right:0}.subclass-card-stat b{color:#641f1d;font-size:17px}.subclass-card-stat span{color:#725443;font-size:9px}.subclass-card-body{min-height:0;flex:1;display:flex;flex-direction:column;gap:8px;padding:12px 15px 28px}.subclass-card-features{min-height:0;flex:1;display:flex;flex-direction:column;gap:8px;font-size:var(--subclass-font-size);line-height:1.45}.subclass-card-feature{padding:9px 10px;border:1px solid #c4a477;background:#f8f0df}.subclass-card-feature h2{display:flex;align-items:baseline;gap:7px;margin:0 0 6px;color:#641f1d;font-size:18px}.subclass-card-feature h2 small{color:#765e4c;font-size:10px}
.subclass-card-frame.is-fluid{overflow:visible}.subclass-card-art{position:relative;flex:none;background:#251a14}.subclass-card-art>img{display:block;width:100%;height:auto;object-fit:contain}.subclass-card.is-fluid{height:auto;overflow:visible}.subclass-card.is-split{min-height:0}.subclass-card.is-split.has-portrait .subclass-card-header{position:absolute;inset:auto 0 0;width:100%;background:linear-gradient(180deg,#1d131000 0%,#1d1310b8 48%,#1d1310f5 100%);border-bottom:0}.subclass-card.is-split:not(.has-portrait) .subclass-card-header{background:#251a14}
	.subclass-card.is-split.has-fixed-base{height:var(--split-fixed-native-height)}
	`;

export const subclassRendererRevision: RendererRevisionCapability<SubclassData, Record<string, string>, ReactNode> = {
  revision: "subclass-card-r3", templateId: "子职业", templateVersion: "1.0.1", requiredMediaSlots: [], optionalMediaSlots: ["portrait"],
  defaultState: (data) => subclassTemplate.tabletop.defaultState(data),
  validateState: (value): value is Record<string, string> => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0,
  styles: subclassRendererStyles,
  render({ data, presentation, assets, attribution }) {
    const stats = [["主职", data.主职], ["阶段", data.等级], ["施法属性", data.施法属性]];
    if (presentation.mode === "image") return <SubclassFrame fixedRatio={presentation.fixedRatio}>{(ref) => <article ref={ref} className="subclass-card is-image" data-renderer-revision="subclass-card-r3" data-template-id="子职业">{assets.portrait ? <img src={assets.portrait} alt={data.名称} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}</article>}</SubclassFrame>;
    const fixedSurface = presentation.fixedRatio && presentation.mode !== "split";
    return <SubclassFrame fixedRatio={fixedSurface} splitFixed={presentation.fixedRatio && presentation.mode === "split"} imageKey={assets.portrait}>{(ref) => <article ref={ref} className={`subclass-card is-${presentation.mode}${fixedSurface ? "" : " is-fluid"}${presentation.fixedRatio && presentation.mode === "split" ? " has-fixed-base" : ""}${assets.portrait ? " has-portrait" : ""}`} data-renderer-revision="subclass-card-r3" data-template-id="子职业">
      <div className="subclass-card-art">{presentation.mode === "split" && assets.portrait ? <img src={assets.portrait} alt="" /> : null}<header className="subclass-card-header"><div className="subclass-card-title-row"><SingleLineTextFit className="subclass-card-title" contentKey={data.名称} minFontSizePx={9} maxFontSizePx={32} cssVariable="--subclass-title-font-size">{data.名称 || "未命名子职业"}</SingleLineTextFit><span className="subclass-card-type">{data.类型 || "子职业"}</span></div>{data.原文?.trim() ? <p className="subclass-card-original">{data.原文}</p> : null}{data.简介 ? <RestrictedMarkdown className="subclass-card-summary" inline value={data.简介} /> : null}</header></div>
      <section className="subclass-card-stats">{stats.map(([label, value]) => <div className="subclass-card-stat" key={label}><b>{value}</b><span>{label}</span></div>)}</section>
      <div className="subclass-card-body"><TextFitContainer className="subclass-card-features" contentKey={JSON.stringify(data.特性)} enabled={fixedSurface} minFontSizePx={11} maxFontSizePx={15} cssVariable="--subclass-font-size">{data.特性.map((feature, index) => <section className="subclass-card-feature" key={`${feature.特性名称}:${index}`}><h2><span>{feature.特性名称 || "未命名特性"}</span>{feature.特性原文?.trim() ? <small>{feature.特性原文}</small> : null}</h2><RestrictedMarkdown value={feature.特性描述} /></section>)}</TextFitContainer></div>
      <CardFooter attribution={attribution ?? { artworkCredit: "", sourceLabel: "" }} />
    </article>}</SubclassFrame>;
  },
};
