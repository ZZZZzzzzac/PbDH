import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { CardFooter, RestrictedMarkdown, SingleLineTextFit, TextFitContainer } from "@pbdh/resource-renderer/react";
import type { ReactNode } from "react";

import {
  weaponTemplate,
  type WeaponData,
} from "../../../core/index.ts";
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
.weapon-card{--ink:#21150f;--bone:#eee4d0;--oxblood:#641f1d;box-sizing:border-box;width:63px;height:88px;overflow:hidden;display:flex;flex-direction:column;background:var(--bone);color:var(--ink);font-family:"Noto Sans SC",sans-serif;border:.5px solid #21150f}.weapon-card *{box-sizing:border-box}.weapon-card.is-fluid{height:auto;min-height:88px;overflow:visible}.weapon-header{min-height:21px;flex:none;display:flex;flex-direction:column;gap:1px;padding:1.75px 2.45px;background:#321b18}.weapon-meta{height:3px;display:flex;align-items:center;justify-content:space-between;color:#e7c79a;font:700 1.8px/1.2 "Noto Sans SC",sans-serif}.weapon-title{width:100%;margin:0;color:#fff4df;font:800 var(--weapon-title-font-size,5.6px)/1.05 "Noto Sans SC",sans-serif;overflow-wrap:anywhere}.weapon-original,.weapon-summary,.weapon-flavor{margin:0;color:#d8ba91;font:550 1.8px/1.2 "Noto Sans SC",sans-serif;overflow-wrap:anywhere}.weapon-art{position:relative;height:20px;flex:none;overflow:hidden;display:grid;place-items:center;background:#321b18}.weapon-art img{width:100%;height:100%;object-fit:cover}.weapon-art.is-image-only{height:100%}.weapon-image-missing{color:#e7c79a;font:550 2.2px/1.25 "Noto Sans SC",sans-serif}.weapon-body{height:67px;min-height:0;display:flex;flex-direction:column;gap:1.5px;padding:2px;overflow:hidden}.weapon-card.is-split .weapon-body{height:47px}.weapon-stats{height:11px;flex:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px}.weapon-stat{display:flex;flex-direction:column;justify-content:center;align-items:center;background:#f7f0e2;border:.2px solid #c8b89f}.weapon-stat b{color:var(--oxblood);font:800 3.2px/1.05 "Noto Sans SC",sans-serif}.weapon-stat span{color:#725443;font:600 1.5px/1.1 "Noto Sans SC",sans-serif}.weapon-details{height:7px;flex:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px}.weapon-detail{display:flex;align-items:center;justify-content:space-between;padding:0 1.5px;background:var(--oxblood)}.weapon-detail span{color:#e7c79a;font:600 1.45px/1.1 "Noto Sans SC",sans-serif}.weapon-detail b{color:#fff4df;font:800 1.8px/1.1 "Noto Sans SC",sans-serif}.weapon-description{min-height:0;flex:1;display:flex;flex-direction:column;gap:1px;padding:2px;overflow:hidden;background:#f7f0e2;border:.2px solid #c8b89f}.weapon-description h2{margin:0;display:flex;align-items:baseline;flex-wrap:wrap;gap:1px;color:var(--oxblood);font:800 2.7px/1.15 "Noto Sans SC",sans-serif}.weapon-description h2 small{color:#725747;font:650 1.8px/1.2 "Noto Sans SC",sans-serif}.weapon-description h2::after{content:"";min-width:4px;flex:1;height:.2px;background:#b88a57}.weapon-description p,.weapon-description [data-restricted-markdown]{margin:0;overflow:visible;color:var(--ink);font:500 var(--weapon-content-font-size,2.1px)/1.3 "Noto Sans SC",sans-serif}.weapon-card>.pbdh-card-footer{color:#725443;background:var(--bone);border-top:.2px solid #c8b89f}.weapon-art>.pbdh-card-footer.is-overlay{position:absolute;z-index:2;inset:auto 0 0;color:#fff4df;background:linear-gradient(180deg,#1d131000,#1d1310dc)}.weapon-card.is-fluid .weapon-body{height:auto;min-height:67px;overflow:visible}.weapon-card.is-fluid .weapon-description{min-height:38px;overflow:visible}
.weapon-card{position:relative}.weapon-title-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:2px}.weapon-title-row .weapon-title{min-width:0}.weapon-title-meta{display:flex;align-items:baseline;gap:1px;color:#e7c79a;font:700 1.8px/1.2 "Noto Sans SC",sans-serif;white-space:nowrap;text-align:right}.weapon-body,.weapon-card.is-split .weapon-body{height:auto;flex:1}.weapon-card.is-split .weapon-art{height:34px}.weapon-card.is-split .weapon-header{position:absolute;z-index:2;inset:0;min-height:0;justify-content:flex-end;background:linear-gradient(180deg,#1d131000 8%,#1d13105c 38%,#1d1310ed 100%);text-shadow:0 .2px .4px #0e0907}.weapon-card>.pbdh-card-footer{min-height:3.5px;gap:2px;padding:.5px 2px;font-size:1.5px}.weapon-card.is-image>.pbdh-card-footer{display:none}
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
  render({ data, presentation, assets, attribution }) {
    const portrait = assets.portrait;
    const mode = presentation.mode;
    const cardClass = ["weapon-card", `is-${mode}`, presentation.fixedRatio ? "" : "is-fluid"]
      .filter(Boolean).join(" ");
    const header = <header className="weapon-header">
      <div className="weapon-title-row"><SingleLineTextFit className="weapon-title" contentKey={data.名称} minFontSizePx={1.6} maxFontSizePx={5.6} cssVariable="--weapon-title-font-size">{data.名称}</SingleLineTextFit><span className="weapon-title-meta"><span>位阶 {data.位阶}</span><span>{data.类型}</span></span></div>
      {data.原文?.trim() ? <p className="weapon-original">{data.原文}</p> : null}
      <p className="weapon-summary">{data.属性} · {data.距离} · {data.负荷}</p>
      {data.风味描述 && <RestrictedMarkdown className="weapon-flavor" inline value={data.风味描述} />}
    </header>;
    return <article className={cardClass} data-renderer-revision="weapon-card-r2" data-presentation-mode={mode}>
      {mode === "image" ? <div className="weapon-art is-image-only">
        {portrait ? <img src={portrait} alt={data.名称} /> : <div className="weapon-image-missing" role="status">缺少主图</div>}
      </div> : <>
        {mode === "text" ? header : null}
        {mode === "split" && <div className="weapon-art">{portrait ? <img src={portrait} alt="" /> : <div className="weapon-image-missing" role="status">缺少主图</div>}{header}</div>}
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
          <TextFitContainer className="weapon-description" contentKey={`${data.特性名}\0${data.特性原名 ?? ""}\0${data.特性描述}`} enabled={presentation.fixedRatio} minFontSizePx={1.5} maxFontSizePx={2.1} cssVariable="--weapon-content-font-size">
            <h2><RestrictedMarkdown inline value={data.特性名 || "特性"} />{data.特性原名?.trim() ? <small>{data.特性原名}</small> : null}</h2><RestrictedMarkdown value={data.特性描述} />
          </TextFitContainer>
        </div>
        <CardFooter attribution={attribution ?? { artworkCredit: "", sourceLabel: "" }} />
      </>}
    </article>;
  },
};
