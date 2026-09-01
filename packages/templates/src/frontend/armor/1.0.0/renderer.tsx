import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { RestrictedMarkdown } from "@pbdh/resource-renderer/react";
import type { ReactNode } from "react";

import { armorTemplate, type ArmorData } from "../../../core/index.ts";
import { splitMarkdownLabel } from "../../markdown.ts";

export type ArmorRuntimeState = Record<string, never>;

function isArmorState(value: unknown): value is ArmorRuntimeState {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === 0;
}

export const armorRendererStyles = `
.armor-card{--ink:#1d1713;--bone:#eee4d0;--oxblood:#641f1d;box-sizing:border-box;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;background:var(--bone);color:var(--ink);border:1px solid #21150f;font-family:"Noto Sans SC",sans-serif}.armor-card *{box-sizing:border-box}.armor-card.is-fluid{height:auto;min-height:100%;overflow:visible}.armor-header{padding:7% 8% 6%;background:#251a14;color:#fff4df;border-bottom:3px solid #b88a57}.armor-meta{display:flex;justify-content:space-between;gap:6%;font:650 10px/1.2 "Noto Sans SC",sans-serif;letter-spacing:.1em;color:#f4dfbc}.armor-title{margin:3% 0 0;overflow:hidden;font:800 clamp(20px,8cqw,36px)/1 "Noto Sans SC",sans-serif;text-overflow:ellipsis;white-space:nowrap}.armor-art{height:34%;overflow:hidden;background:#251a14}.armor-art img{width:100%;height:100%;display:block;object-fit:cover}.armor-image-missing{height:100%;display:grid;place-items:center;color:#f4dfbc;font:650 11px/1.3 "Noto Sans SC",sans-serif}.armor-body{padding:6% 7%;display:flex;min-height:0;flex:1;flex-direction:column;gap:5%;overflow:auto}.armor-stats{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #ad8b68;background:#f7ebd6}.armor-stat{padding:7% 4%;display:flex;flex-direction:column;align-items:center;text-align:center;border-right:1px solid #ad8b68}.armor-stat:last-child{border-right:0}.armor-stat b{color:var(--oxblood);font:800 clamp(17px,6cqw,28px)/1.15 "Noto Sans SC",sans-serif}.armor-stat span{font:650 9px/1.2 "Noto Sans SC",sans-serif;color:#725443}.armor-feature{padding:4%;background:#f7ebd6;border:1px solid #d4b78d;border-radius:4px}.armor-feature h2{display:flex;align-items:center;gap:8px;margin:0;color:var(--oxblood);font:800 clamp(12px,4cqw,18px)/1.2 "Noto Sans SC",sans-serif}.armor-feature h2::after{content:"";flex:1;height:1px;background:#b88a57}.armor-feature p,.armor-flavor{margin:2% 0 0;white-space:pre-wrap;font:450 clamp(10px,3.4cqw,15px)/1.42 "Noto Sans SC",sans-serif}.armor-flavor{margin-top:auto;color:#725443;font-style:italic}.armor-card.is-image .armor-header,.armor-card.is-image .armor-body{display:none}.armor-card.is-image .armor-art{height:100%}.armor-card.is-image.is-fluid .armor-art,.armor-card.is-image.is-fluid .armor-art img{height:auto}.armor-card.is-text .armor-art{display:none}
.armor-feature [data-restricted-markdown]{font:450 clamp(10px,3.4cqw,15px)/1.42 "Noto Sans SC",sans-serif}.armor-flavor[data-restricted-markdown]{font:450 clamp(10px,3.4cqw,15px)/1.42 "Noto Sans SC",sans-serif}
`;

export const armorRendererRevision: RendererRevisionCapability<ArmorData, ArmorRuntimeState, ReactNode> = {
  revision: "armor-card-r1",
  templateId: "护甲",
  templateVersion: "1.0.0",
  requiredMediaSlots: [],
  optionalMediaSlots: ["portrait"],
  defaultState(data) {
    return armorTemplate.tabletop.defaultState(data) as ArmorRuntimeState;
  },
  validateState: isArmorState,
  styles: armorRendererStyles,
  render({ data, presentation, assets }) {
    const feature = splitMarkdownLabel(data.描述, "护甲特性");
    const portrait = assets.portrait;
    return <article className={["armor-card", `is-${presentation.mode}`, presentation.fixedRatio ? "" : "is-fluid"].filter(Boolean).join(" ")} data-renderer-revision="armor-card-r1">
      <header className="armor-header">
        <div className="armor-meta"><span>{data.类型 || "护甲"}</span><span>位阶 {data.位阶}</span></div>
        <h1 className="armor-title">{data.名称 || "未命名护甲"}</h1>
      </header>
      {(presentation.mode === "split" || presentation.mode === "image") && <div className="armor-art">
        {portrait ? <img src={portrait} alt={data.名称} /> : <div className="armor-image-missing" role="status">缺少主图</div>}
      </div>}
      <div className="armor-body">
        <section className="armor-stats" aria-label="护甲数据">
          <div className="armor-stat"><b>{data.护甲值}</b><span>护甲值</span></div>
          <div className="armor-stat"><b>{data.重度伤害阈值}</b><span>重度阈值</span></div>
          <div className="armor-stat"><b>{data.严重伤害阈值}</b><span>严重阈值</span></div>
        </section>
        {data.描述 && <section className="armor-feature"><h2><RestrictedMarkdown inline value={feature.title} /></h2><RestrictedMarkdown value={feature.body} /></section>}
        {data.风味描述 && <RestrictedMarkdown className="armor-flavor" value={data.风味描述} />}
      </div>
    </article>;
  },
};
