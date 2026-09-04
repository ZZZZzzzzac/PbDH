import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { CardFooter, RestrictedMarkdown, SingleLineTextFit, TextFitContainer } from "@pbdh/resource-renderer/react";
import type { ReactNode } from "react";

import { itemTemplate, type ItemData } from "../../../core/index.ts";

export const itemRendererStyles = `
.item-card-frame{position:relative;width:63px;height:88px;overflow:hidden}.item-card{--item-font-size:15px;box-sizing:border-box;position:absolute;inset:0 auto auto 0;width:360px;height:502.857px;transform:scale(.175);transform-origin:top left;overflow:hidden;display:flex;flex-direction:column;border:3px solid #21150f;background:#eee4d0;color:#1d1713;font-family:"Noto Sans SC",sans-serif}.item-card *{box-sizing:border-box}.item-card-header{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;padding:15px;background:#251a14;color:#fff4df;border-bottom:3px solid #b88a57}.item-card-header-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.32}.item-card-header>*:not(.item-card-header-image){position:relative}.item-card-title{margin:0;font:900 var(--item-title-font-size,32px)/1.05 Georgia,"Noto Serif SC",serif}.item-card-original{margin:4px 0 0;color:#d6bea0;font-size:11px}.item-card-side{text-align:right}.item-card-type{color:#e6c99f;font-size:12px;font-weight:800;letter-spacing:.1em}.item-card-roll{margin-top:5px;font:900 23px/1 Georgia,serif}.item-card-body{min-height:0;flex:1;display:flex;flex-direction:column;gap:10px;padding:14px 15px 28px}.item-card-feature{min-height:0;flex:1;padding:10px;border:1px solid #c4a477;background:#f8f0df;font-size:var(--item-font-size);line-height:1.5}.item-card-feature h2{margin:0 0 7px;color:#641f1d;font-size:18px}.item-card-summary{flex:none;padding:9px 10px;border-left:4px solid #7b2924;background:#e3d1b6;font-style:italic}.item-card-image{width:100%;height:100%;background:#251a14}.item-card-image img{width:100%;height:100%;object-fit:cover}.item-card-missing{height:100%;display:grid;place-items:center;color:#d8c4a5}
`;

export const itemRendererRevision: RendererRevisionCapability<ItemData, Record<string, string>, ReactNode> = {
  revision: "item-card-r1", templateId: "物品", templateVersion: "1.0.0", requiredMediaSlots: [], optionalMediaSlots: ["portrait"],
  defaultState: (data) => itemTemplate.tabletop.defaultState(data),
  validateState: (value): value is Record<string, string> => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0,
  styles: itemRendererStyles,
  render({ data, presentation, assets, attribution }) {
    if (presentation.mode === "image") return <div className="item-card-frame"><article className="item-card is-image" data-renderer-revision="item-card-r1" data-template-id="物品"><div className="item-card-image">{assets.portrait ? <img src={assets.portrait} alt={data.名称} /> : <div className="item-card-missing">缺少主图</div>}</div></article></div>;
    return <div className="item-card-frame"><article className="item-card" data-renderer-revision="item-card-r1" data-template-id="物品">
      <header className="item-card-header">{presentation.mode === "split" && assets.portrait ? <img className="item-card-header-image" src={assets.portrait} alt="" /> : null}<div><SingleLineTextFit className="item-card-title" contentKey={data.名称} minFontSizePx={9} maxFontSizePx={32} cssVariable="--item-title-font-size">{data.名称 || "未命名物品"}</SingleLineTextFit>{data.原文?.trim() ? <p className="item-card-original">{data.原文}</p> : null}</div><div className="item-card-side"><div className="item-card-type">{data.类型 || "物品"}</div>{data.掷骰 ? <div className="item-card-roll">{data.掷骰}</div> : null}</div></header>
      <div className="item-card-body"><TextFitContainer className="item-card-feature" contentKey={data.特性描述} enabled={presentation.fixedRatio} minFontSizePx={11} maxFontSizePx={15} cssVariable="--item-font-size"><h2>特性</h2><RestrictedMarkdown value={data.特性描述} /></TextFitContainer>{data.简介 ? <RestrictedMarkdown className="item-card-summary" value={data.简介} /> : null}</div>
      <CardFooter attribution={attribution ?? { artworkCredit: "", sourceLabel: "" }} />
    </article></div>;
  },
};
