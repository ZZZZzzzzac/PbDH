import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { RestrictedMarkdown } from "@pbdh/resource-renderer/react";
import type { ReactNode } from "react";

import {
  weaponTemplate,
  type WeaponData,
} from "../../../core/index.ts";
import { splitMarkdownLabel } from "../../markdown.ts";
import { weaponMarkdownStyles } from "../markdown.ts";

export type WeaponRuntimeState = Record<string, never>;
export const weaponCardRenderSource = {
  source: "template-html-css",
  implementation: "packages/templates/src/frontend/weapon/1.0.0/renderer.tsx",
  fixedRatio: { width: 63, height: 88 },
  statNames: ["核心数据 / 属性", "核心数据 / 距离", "核心数据 / 伤害"],
  detailNames: ["规则 / 伤害类型", "规则 / 负荷"],
};
export const weaponRendererStyles = `
.weapon-card{--ink:#21150f;--bone:#eee4d0;--oxblood:#641f1d;box-sizing:border-box;width:63px;height:88px;overflow:hidden;display:flex;flex-direction:column;background:var(--bone);color:var(--ink);font-family:"Noto Sans SC",sans-serif;border:.5px solid #21150f}.weapon-card *{box-sizing:border-box}.weapon-card.is-fluid{height:auto;min-height:88px;overflow:visible}.weapon-header{height:21px;flex:none;display:flex;flex-direction:column;gap:1px;padding:3px;background:#321b18}.weapon-meta{height:3px;display:flex;align-items:center;justify-content:space-between;color:#e7c79a;font:700 1.8px/1.2 "Noto Sans SC",sans-serif}.weapon-title{width:100%;margin:0;color:#fff4df;font:800 5.6px/1.05 "Noto Sans SC",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.weapon-summary,.weapon-flavor{margin:0;color:#d8ba91;font:550 1.8px/1.2 "Noto Sans SC",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.weapon-art{height:20px;flex:none;overflow:hidden;display:grid;place-items:center;background:#321b18}.weapon-art img{width:100%;height:100%;object-fit:cover}.weapon-art.is-image-only{height:100%}.weapon-image-missing{color:#e7c79a;font:550 2.2px/1.25 "Noto Sans SC",sans-serif}.weapon-body{height:67px;min-height:0;display:flex;flex-direction:column;gap:1.5px;padding:2px}.weapon-card.is-split .weapon-body{height:47px}.weapon-stats{height:11px;flex:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px}.weapon-stat{display:flex;flex-direction:column;justify-content:center;align-items:center;background:#f7f0e2;border:.2px solid #c8b89f}.weapon-stat b{color:var(--oxblood);font:800 3.2px/1.05 "Noto Sans SC",sans-serif}.weapon-stat span{color:#725443;font:600 1.5px/1.1 "Noto Sans SC",sans-serif}.weapon-details{height:7px;flex:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px}.weapon-detail{display:flex;align-items:center;justify-content:space-between;padding:0 1.5px;background:var(--oxblood)}.weapon-detail span{color:#e7c79a;font:600 1.45px/1.1 "Noto Sans SC",sans-serif}.weapon-detail b{color:#fff4df;font:800 1.8px/1.1 "Noto Sans SC",sans-serif}.weapon-description{min-height:0;flex:1;display:flex;flex-direction:column;gap:1px;padding:2px;overflow:hidden;background:#f7f0e2;border:.2px solid #c8b89f}.weapon-description h2{margin:0;color:var(--oxblood);font:800 2.7px/1.15 "Noto Sans SC",sans-serif}.weapon-description hr{width:100%;height:.2px;margin:0;border:0;background:#c8b89f}.weapon-description p{margin:0;overflow:hidden;color:var(--ink);font:500 2.1px/1.3 "Noto Sans SC",sans-serif}.weapon-footer{margin:0;color:#725443;font:650 1.25px/1.2 "Noto Sans SC",sans-serif;text-align:center}.weapon-card.is-fluid .weapon-body{height:auto;min-height:67px}.weapon-card.is-fluid .weapon-description{min-height:38px;overflow:visible}
`;

function isWeaponState(value: unknown): value is WeaponRuntimeState {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

export const weaponRendererRevision: RendererRevisionCapability<
  WeaponData,
  WeaponRuntimeState,
  ReactNode
> = {
  revision: "weapon-card-r2",
  templateId: "武器",
  templateVersion: "1.0.0",
  requiredMediaSlots: [],
  optionalMediaSlots: ["portrait"],
  styles: `${weaponRendererStyles}${weaponMarkdownStyles}`,
  defaultState(data) {
    return weaponTemplate.tabletop.defaultState(data) as WeaponRuntimeState;
  },
  validateState: isWeaponState,
  render({ data, presentation, assets }) {
    const feature = splitMarkdownLabel(data.描述, "特性");
    const portrait = assets.portrait;
    const mode = presentation.mode;
    const cardClass = ["weapon-card", `is-${mode}`, presentation.fixedRatio ? "" : "is-fluid"]
      .filter(Boolean).join(" ");
    return <article className={cardClass} data-renderer-revision="weapon-card-r2" data-presentation-mode={mode}>
      {mode === "image" ? <div className="weapon-art is-image-only">
        {portrait ? <img src={portrait} alt={data.名称} /> : <div className="weapon-image-missing" role="status">缺少主图</div>}
      </div> : <>
        <header className="weapon-header">
          <div className="weapon-meta"><span className="weapon-type">{data.类型}</span><span className="weapon-tier">位阶 {data.位阶}</span></div>
          <h1 className="weapon-title">{data.名称}</h1>
          <p className="weapon-summary">{data.属性} · {data.距离} · {data.负荷}</p>
          {data.风味描述 && <RestrictedMarkdown className="weapon-flavor" inline value={data.风味描述} />}
        </header>
        {mode === "split" && <div className="weapon-art">{portrait ? <img src={portrait} alt="" /> : <div className="weapon-image-missing" role="status">缺少主图</div>}</div>}
        <div className="weapon-body">
          <section className="weapon-stats" aria-label="武器数据">
            <div className="weapon-stat"><b>{data.属性}</b><span>属性</span></div>
            <div className="weapon-stat"><b>{data.距离}</b><span>距离</span></div>
            <div className="weapon-stat"><b>{data.伤害}</b><span>伤害</span></div>
          </section>
          <section className="weapon-details" aria-label="伤害与负荷">
            <div className="weapon-detail"><span>伤害类型</span><b>{data.伤害类型}</b></div>
            <div className="weapon-detail"><span>负荷</span><b>{data.负荷}</b></div>
          </section>
          <section className="weapon-description" aria-label="武器游戏效果">
            <h2><RestrictedMarkdown inline value={feature.title} /></h2><hr /><RestrictedMarkdown value={feature.body} />
          </section>
          <p className="weapon-footer">DAGGERHEART CORE · 武器</p>
        </div>
      </>}
    </article>;
  },
};
