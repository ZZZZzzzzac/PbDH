import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { CardFooter, RestrictedMarkdown, SingleLineTextFit, TextFitContainer } from "@pbdh/resource-renderer/react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { rhodesSubclassTemplate, type RhodesSubclassData } from "../../../core/rhodes-subclass/1.0.0/capability.ts";

const rhodesSubclassScale = .175;
const fixedRhodesSubclassHeight = 502.857;
const rhodesSubclassRevision = "rhodes-subclass-card-r1";

function RhodesSubclassFrame({ fixedRatio, splitFixed = false, imageKey, children }: { fixedRatio: boolean; splitFixed?: boolean; imageKey?: string; children: (ref: React.RefObject<HTMLElement | null>) => ReactNode }) {
  const cardRef = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(fixedRhodesSubclassHeight);
  useLayoutEffect(() => {
    if (fixedRatio || !cardRef.current) return;
    const card = cardRef.current;
    const image = card.querySelector("img");
    const update = () => setHeight(splitFixed ? fixedRhodesSubclassHeight + (image?.offsetHeight ?? 0) : card.offsetHeight);
    const observer = new ResizeObserver(update);
    observer.observe(card);
    if (image) observer.observe(image);
    update();
    return () => observer.disconnect();
  }, [fixedRatio, splitFixed, imageKey]);
  return <div className={`rhodes-subclass-card-frame${fixedRatio ? "" : " is-fluid"}`} style={{ height: `${(fixedRatio ? fixedRhodesSubclassHeight : height) * rhodesSubclassScale}px`, "--split-fixed-native-height": `${height}px` } as CSSProperties}>{children(cardRef)}</div>;
}

export const rhodesSubclassRendererStyles = `
.rhodes-subclass-card-frame{position:relative;width:63px;height:88px;overflow:hidden}.rhodes-subclass-card{--rhodes-subclass-font-size:15px;box-sizing:border-box;position:absolute;inset:0 auto auto 0;width:360px;height:502.857px;transform:scale(.175);transform-origin:top left;overflow:hidden;display:flex;flex-direction:column;border:3px solid #21150f;background:#e9e2d2;color:#1d1713;font-family:"Noto Sans SC",sans-serif}.rhodes-subclass-card *{box-sizing:border-box}.rhodes-subclass-card-header{position:relative;overflow:hidden;padding:15px;background:#1d242c;color:#eef3f7;border-bottom:3px solid #7f95a8}.rhodes-subclass-card-header-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.32}.rhodes-subclass-card-header>*:not(.rhodes-subclass-card-header-image){position:relative}.rhodes-subclass-card-title-row{display:flex;align-items:flex-end;gap:12px}.rhodes-subclass-card-title{min-width:0;flex:1;margin:0;font:900 var(--rhodes-subclass-title-font-size,32px)/1.2 Georgia,"Noto Serif SC",serif}.rhodes-subclass-card-type{color:#bcd0df;font-size:12px;font-weight:800}.rhodes-subclass-card-original{margin:4px 0 0;color:#c3d3de;font-size:11px}.rhodes-subclass-card-summary{margin:8px 0 0;color:#c8b79c;font:italic 500 14px/1.4 "Noto Sans SC",sans-serif;overflow-wrap:anywhere}.rhodes-subclass-card-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid #b6b3a6}.rhodes-subclass-card-stat{display:grid;place-items:center;padding:9px 4px;border-right:1px solid #c8c5b8}.rhodes-subclass-card-stat:last-child{border-right:0}.rhodes-subclass-card-stat b{color:#2c4a63;font-size:17px}.rhodes-subclass-card-stat span{color:#5c5a50;font-size:9px}.rhodes-subclass-card-body{min-height:0;flex:1;display:flex;flex-direction:column;gap:8px;padding:12px 15px 28px}.rhodes-subclass-card-profile{display:flex;flex-direction:column;gap:5px}.rhodes-subclass-card-profile-row{display:grid;grid-template-columns:82px minmax(0,1fr);gap:8px;padding:5px 8px;border-left:3px solid #7f95a8;background:#f5f2e9}.rhodes-subclass-card-profile-row span{color:#2c4a63;font-size:11px;font-weight:800}.rhodes-subclass-card-profile-row p{margin:0;font-size:12px;line-height:1.4;overflow-wrap:anywhere}.rhodes-subclass-card-features{min-height:0;flex:1;display:flex;flex-direction:column;gap:8px;font-size:var(--rhodes-subclass-font-size);line-height:1.45}.rhodes-subclass-card-feature{padding:9px 10px;border:1px solid #b3b0a0;background:#f8f6ee}.rhodes-subclass-card-feature h2{display:flex;align-items:baseline;gap:7px;margin:0 0 6px;color:#2c4a63;font-size:18px}.rhodes-subclass-card-feature h2 small{color:#63615a;font-size:10px}.rhodes-subclass-card-overrides{display:flex;flex-direction:column;gap:6px}.rhodes-subclass-card-override{padding:7px 9px;border:1px dashed #7f95a8;background:#eef1ee}.rhodes-subclass-card-override h3{margin:0 0 4px;color:#2c4a63;font-size:12px}
.rhodes-subclass-card-frame.is-fluid{overflow:visible}.rhodes-subclass-card-art{position:relative;flex:none;background:#1d242c}.rhodes-subclass-card-art>img{display:block;width:100%;height:auto;object-fit:contain}.rhodes-subclass-card.is-fluid{height:auto;overflow:visible}.rhodes-subclass-card.is-split{min-height:0}.rhodes-subclass-card.is-split.has-portrait .rhodes-subclass-card-header{position:absolute;inset:auto 0 0;width:100%;background:linear-gradient(180deg,#131a2100 0%,#131a21b8 48%,#131a21f5 100%);border-bottom:0}.rhodes-subclass-card.is-split:not(.has-portrait) .rhodes-subclass-card-header{background:#1d242c}
.rhodes-subclass-card.is-split.has-fixed-base{height:var(--split-fixed-native-height)}
`;

export const rhodesSubclassRendererRevision: RendererRevisionCapability<RhodesSubclassData, Record<string, string>, ReactNode> = {
  revision: rhodesSubclassRevision, templateId: "罗德岛子职", templateVersion: "1.0.0", requiredMediaSlots: [], optionalMediaSlots: ["portrait"],
  defaultState: (data) => rhodesSubclassTemplate.tabletop.defaultState(data),
  validateState: (value): value is Record<string, string> => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0,
  styles: rhodesSubclassRendererStyles,
  render({ data, presentation, assets, attribution }) {
    if (presentation.mode === "image") return <RhodesSubclassFrame fixedRatio={presentation.fixedRatio}>{(ref) => <article ref={ref} className="rhodes-subclass-card is-image" data-renderer-revision={rhodesSubclassRevision} data-template-id="罗德岛子职">{assets.portrait ? <img src={assets.portrait} alt={data.名称} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}</article>}</RhodesSubclassFrame>;
    const stats = [["主职", data.主职], ["阶段", data.阶段], ["等级", data.等级], ["施法属性", data.施法属性]];
    const profileFields: ReadonlyArray<[string, string | undefined]> = [["武器原型", data.武器原型], ["推荐次领域", data.推荐次领域], ["子职提升", data.子职提升]];
    const overrideFields: ReadonlyArray<[string, string | undefined]> = [["子职特性", data.子职特性], ["职业特性", data.职业特性], ["希望特性", data.希望特性]];
    const profile = profileFields.filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));
    const overrides = overrideFields.filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));
    const fixedSurface = presentation.fixedRatio && presentation.mode !== "split";
    return <RhodesSubclassFrame fixedRatio={fixedSurface} splitFixed={presentation.fixedRatio && presentation.mode === "split"} imageKey={assets.portrait}>{(ref) => <article ref={ref} className={`rhodes-subclass-card is-${presentation.mode}${fixedSurface ? "" : " is-fluid"}${presentation.fixedRatio && presentation.mode === "split" ? " has-fixed-base" : ""}${assets.portrait ? " has-portrait" : ""}`} data-renderer-revision={rhodesSubclassRevision} data-template-id="罗德岛子职">
      <div className="rhodes-subclass-card-art">{presentation.mode === "split" && assets.portrait ? <img src={assets.portrait} alt="" /> : null}<header className="rhodes-subclass-card-header"><div className="rhodes-subclass-card-title-row"><SingleLineTextFit className="rhodes-subclass-card-title" contentKey={data.名称} minFontSizePx={9} maxFontSizePx={32} cssVariable="--rhodes-subclass-title-font-size">{data.名称 || "未命名子职"}</SingleLineTextFit><span className="rhodes-subclass-card-type">{data.类型 || "子职"}</span></div>{data.原文?.trim() ? <p className="rhodes-subclass-card-original">{data.原文}</p> : null}{data.简介?.trim() ? <RestrictedMarkdown className="rhodes-subclass-card-summary" inline value={data.简介} /> : null}</header></div>
      <section className="rhodes-subclass-card-stats">{stats.map(([label, value]) => <div className="rhodes-subclass-card-stat" key={label}><b>{value}</b><span>{label}</span></div>)}</section>
      <div className="rhodes-subclass-card-body">{profile.length ? <section className="rhodes-subclass-card-profile">{profile.map(([label, value]) => <div className="rhodes-subclass-card-profile-row" key={label}><span>{label}</span><p>{value}</p></div>)}</section> : null}<TextFitContainer className="rhodes-subclass-card-features" contentKey={JSON.stringify(data.特性)} enabled={fixedSurface} minFontSizePx={11} maxFontSizePx={15} cssVariable="--rhodes-subclass-font-size">{data.特性.map((feature, index) => <section className="rhodes-subclass-card-feature" key={`${feature.特性名称}:${index}`}><h2><span>{feature.特性名称 || "未命名特性"}</span>{feature.特性原文?.trim() ? <small>{feature.特性原文}</small> : null}</h2><RestrictedMarkdown value={feature.特性描述} /></section>)}</TextFitContainer>{overrides.length ? <section className="rhodes-subclass-card-overrides">{overrides.map(([label, value]) => <section className="rhodes-subclass-card-override" key={label}><h3>{label}</h3><RestrictedMarkdown value={value} /></section>)}</section> : null}</div>
      <CardFooter attribution={attribution ?? { artworkCredit: "", sourceLabel: "" }} />
    </article>}</RhodesSubclassFrame>;
  },
};
