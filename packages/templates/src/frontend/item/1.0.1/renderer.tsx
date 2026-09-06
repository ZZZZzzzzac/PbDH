import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { CardFooter, RestrictedMarkdown, SingleLineTextFit, TextFitContainer } from "@pbdh/resource-renderer/react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { itemTemplate, type ItemData } from "../../../core/item/1.0.1/capability.ts";

const itemScale = .175;
const fixedItemHeight = 502.857;

function ItemFrame({ fixedRatio, splitFixed = false, imageKey, children }: { fixedRatio: boolean; splitFixed?: boolean; imageKey?: string; children: (ref: React.RefObject<HTMLElement | null>) => ReactNode }) {
  const cardRef = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(fixedItemHeight);
  useLayoutEffect(() => {
    if (fixedRatio || !cardRef.current) return;
    const card = cardRef.current;
    const image = card.querySelector("img");
    const update = () => setHeight(splitFixed ? fixedItemHeight + (image?.offsetHeight ?? 0) : card.offsetHeight);
    const observer = new ResizeObserver(update);
    observer.observe(card);
    if (image) observer.observe(image);
    update();
    return () => observer.disconnect();
  }, [fixedRatio, splitFixed, imageKey]);
  return <div className={`item-card-frame${fixedRatio ? "" : " is-fluid"}`} style={{ height: `${(fixedRatio ? fixedItemHeight : height) * itemScale}px`, "--split-fixed-native-height": `${height}px` } as CSSProperties}>{children(cardRef)}</div>;
}

export const itemRendererStyles = `
.item-card-frame{position:relative;width:63px;height:88px;overflow:hidden}.item-card-frame.is-fluid{overflow:visible}.item-card{--item-font-size:15px;box-sizing:border-box;position:absolute;inset:0 auto auto 0;width:360px;height:502.857px;transform:scale(.175);transform-origin:top left;overflow:hidden;display:flex;flex-direction:column;border:3px solid #21150f;background:#eee4d0;color:#1d1713;font-family:"Noto Sans SC",sans-serif}.item-card *{box-sizing:border-box}.item-card-header{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;padding:15px;background:#251a14;color:#fff4df;border-bottom:3px solid #b88a57}.item-card-title{margin:0;font:900 var(--item-title-font-size,32px)/1.2 Georgia,"Noto Serif SC",serif}.item-card-original{margin:4px 0 0;color:#d6bea0;font-size:11px}.item-card-side{text-align:right}.item-card-type{color:#e6c99f;font-size:12px;font-weight:800;letter-spacing:.1em}.item-card-roll{margin-top:5px;font:900 23px/1 Georgia,serif}.item-card-summary{grid-column:1/-1;margin:0;color:#dcb299;font:italic 500 14px/1.4 "Noto Sans SC",sans-serif;overflow-wrap:anywhere}.item-card-body{min-height:0;flex:1;display:flex;flex-direction:column;gap:10px;padding:14px 15px 28px}.item-card-feature{min-height:0;flex:none;padding:10px;border:1px solid #c4a477;background:#f8f0df;font-size:var(--item-font-size);line-height:1.5}.item-card-feature h2{margin:0 0 7px;color:#641f1d;font-size:18px}.item-card-image{width:100%;height:100%;background:#251a14}.item-card-image img{width:100%;height:100%;object-fit:cover}.item-card-missing{height:100%;display:grid;place-items:center;color:#d8c4a5}.item-card-art{position:relative;flex:none;background:#251a14}.item-card-art>img{display:block;width:100%;height:auto;object-fit:contain}.item-card.is-fluid{height:auto;overflow:visible}.item-card.is-split{min-height:0}.item-card.is-split.has-portrait .item-card-header{position:absolute;inset:auto 0 0;width:100%;background:linear-gradient(180deg,#1d131000 0%,#1d1310b8 48%,#1d1310f5 100%);border-bottom:0}.item-card.is-split:not(.has-portrait) .item-card-header{background:#251a14}
	.item-card.is-split.has-fixed-base{height:var(--split-fixed-native-height)}
	`;

export const itemRendererRevision: RendererRevisionCapability<ItemData, Record<string, string>, ReactNode> = {
  revision: "item-card-r2", templateId: "物品", templateVersion: "1.0.1", requiredMediaSlots: [], optionalMediaSlots: ["portrait"],
  defaultState: (data) => itemTemplate.tabletop.defaultState(data),
  validateState: (value): value is Record<string, string> => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0,
  styles: itemRendererStyles,
  render({ data, presentation, assets, attribution }) {
    if (presentation.mode === "image") return <ItemFrame fixedRatio={presentation.fixedRatio}>{(ref) => <article ref={ref} className="item-card is-image" data-renderer-revision="item-card-r2" data-template-id="物品"><div className="item-card-image">{assets.portrait ? <img src={assets.portrait} alt={data.名称} /> : <div className="item-card-missing">缺少主图</div>}</div></article>}</ItemFrame>;
    const fixedSurface = presentation.fixedRatio && presentation.mode !== "split";
    return <ItemFrame fixedRatio={fixedSurface} splitFixed={presentation.fixedRatio && presentation.mode === "split"} imageKey={assets.portrait}>{(ref) => <article ref={ref} className={`item-card is-${presentation.mode}${fixedSurface ? "" : " is-fluid"}${presentation.fixedRatio && presentation.mode === "split" ? " has-fixed-base" : ""}${assets.portrait ? " has-portrait" : ""}`} data-renderer-revision="item-card-r2" data-template-id="物品">
      <div className="item-card-art">{presentation.mode === "split" && assets.portrait ? <img src={assets.portrait} alt="" /> : null}<header className="item-card-header"><div><SingleLineTextFit className="item-card-title" contentKey={data.名称} minFontSizePx={9} maxFontSizePx={32} cssVariable="--item-title-font-size">{data.名称 || "未命名物品"}</SingleLineTextFit>{data.原文?.trim() ? <p className="item-card-original">{data.原文}</p> : null}</div><div className="item-card-side"><div className="item-card-type">{data.类型 || "物品"}</div>{data.掷骰 ? <div className="item-card-roll">{data.掷骰}</div> : null}</div>{data.简介 ? <RestrictedMarkdown className="item-card-summary" inline value={data.简介} /> : null}</header></div>
      <div className="item-card-body"><TextFitContainer className="item-card-feature" contentKey={data.特性描述} enabled={fixedSurface} minFontSizePx={11} maxFontSizePx={15} cssVariable="--item-font-size"><h2>特性</h2><RestrictedMarkdown value={data.特性描述} /></TextFitContainer></div>
      <CardFooter attribution={attribution ?? { artworkCredit: "", sourceLabel: "" }} />
    </article>}</ItemFrame>;
  },
};
