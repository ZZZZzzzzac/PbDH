import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import type { ReactNode } from "react";

import { armorTemplate, type ArmorData } from "../../../core/index.ts";

export type ArmorRuntimeState = Record<string, never>;

function isArmorState(value: unknown): value is ArmorRuntimeState {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === 0;
}

function splitFeature(value: string): { title: string; body: string } {
  const normalized = value.replace(/^:red\[/, "").replace(/\]$/, "");
  const separator = normalized.search(/[:：]/);
  if (separator < 0) return { title: "护甲特性", body: normalized };
  return {
    title: normalized.slice(0, separator).replaceAll("**", "").trim() || "护甲特性",
    body: normalized.slice(separator + 1).trim(),
  };
}

export const armorRendererStyles = `
.armor-card{box-sizing:border-box;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;background:#e9e1d2;color:#201e1a;border:1px solid #756c5d;font-family:Georgia,"Noto Serif SC",serif}.armor-card *{box-sizing:border-box}.armor-header{padding:7% 8% 5%;background:#292f2f;color:#f8f2e7;border-bottom:4px solid #a68145}.armor-meta{display:flex;justify-content:space-between;gap:6%;font:700 10px/1.2 system-ui,sans-serif;letter-spacing:.12em;color:#d8c49f}.armor-title{margin:3% 0 0;font-size:clamp(20px,8cqw,36px);line-height:1}.armor-art{height:34%;overflow:hidden;background:#c7bca8}.armor-art img{width:100%;height:100%;object-fit:cover}.armor-image-missing{height:100%;display:grid;place-items:center;color:#615a4e}.armor-body{padding:6% 8%;display:flex;min-height:0;flex:1;flex-direction:column;gap:5%;overflow:auto}.armor-stats{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #8b7b63}.armor-stat{padding:7% 4%;display:flex;flex-direction:column;align-items:center;text-align:center;border-right:1px solid #8b7b63}.armor-stat:last-child{border-right:0}.armor-stat b{font-size:clamp(17px,6cqw,28px)}.armor-stat span{font:700 9px/1.2 system-ui,sans-serif;color:#6b604f}.armor-feature h2{margin:0;color:#7b2f27;font-size:clamp(12px,4cqw,18px)}.armor-feature p,.armor-flavor{margin:2% 0 0;white-space:pre-wrap;font-size:clamp(10px,3.4cqw,15px);line-height:1.45}.armor-flavor{margin-top:auto;color:#655d51;font-style:italic}.armor-card.is-image .armor-header,.armor-card.is-image .armor-body{display:none}.armor-card.is-image .armor-art{height:100%}.armor-card.is-text .armor-art{display:none}
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
    const feature = splitFeature(data.描述);
    const portrait = assets.portrait;
    return <article className={`armor-card is-${presentation.mode}`} data-renderer-revision="armor-card-r1">
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
        {data.描述 && <section className="armor-feature"><h2>{feature.title}</h2><p>{feature.body}</p></section>}
        {data.风味描述 && <p className="armor-flavor">{data.风味描述}</p>}
      </div>
    </article>;
  },
};
