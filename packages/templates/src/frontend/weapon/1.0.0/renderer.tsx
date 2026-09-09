import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { CardFooter, RestrictedMarkdown, SingleLineTextFit, TextFitContainer } from "@pbdh/resource-renderer/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import {
  weaponTemplate,
  type WeaponData,
} from "../../../core/weapon/1.0.0/capability.ts";
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
.weapon-card{--ink:#21150f;--bone:#eee4d0;--oxblood:#641f1d;position:absolute;inset:0 auto auto 0;box-sizing:border-box;width:360px;height:502.857px;overflow:hidden;display:flex;flex-direction:column;background:var(--bone);color:var(--ink);font-family:"Noto Sans SC",sans-serif;border:1px solid #21150f;transform:scale(.175);transform-origin:top left}.weapon-card *{box-sizing:border-box}.weapon-card.is-fluid{height:auto;min-height:502.857px;overflow:visible}.weapon-header{flex:none;padding:10px 14px;background:#251a14;color:#fff4df;border-bottom:3px solid #b88a57}.weapon-title-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:20px}.weapon-title-stack{min-width:0}.weapon-title{width:100%;margin:0;color:#fff4df;font:800 var(--weapon-title-font-size,36px)/1 "Noto Sans SC",sans-serif;white-space:nowrap;overflow:hidden}.weapon-original{margin:5px 0 0;color:#d8ba91;font:650 13px/1.2 "Noto Sans SC",sans-serif;overflow-wrap:anywhere}.weapon-title-meta{display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-end;gap:4px;color:#f4dfbc;font:650 15px/1.15 "Noto Sans SC",sans-serif;white-space:nowrap;text-align:right}.weapon-art{position:relative;height:170px;flex:none;overflow:hidden;display:grid;place-items:center;background:#251a14}.weapon-art img{width:100%;height:100%;display:block;object-fit:cover}.weapon-image-missing{color:#f4dfbc;font:650 11px/1.3 "Noto Sans SC",sans-serif}.weapon-body{min-height:0;flex:1;display:flex;flex-direction:column;padding:18px 20px 0;overflow:hidden}.weapon-stats{flex:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-block:1px solid #bfa47d}.weapon-stat{padding:10px 4px 8px;display:flex;flex-direction:column;align-items:center;text-align:center}.weapon-stat b{color:var(--oxblood);font:800 28px/1.05 "Noto Sans SC",sans-serif}.weapon-stat span{margin-top:3px;color:#725443;font:650 9px/1.2 "Noto Sans SC",sans-serif}.weapon-details{flex:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:18px;margin:5px 0 10px}.weapon-detail{display:flex;align-items:baseline;gap:8px;color:#6f5745;font:650 10px/1.2 "Noto Sans SC",sans-serif}.weapon-detail b{color:var(--oxblood);font:800 11px/1.2 "Noto Sans SC",sans-serif}.weapon-description{min-height:0;flex:1;display:flex;flex-direction:column;overflow:hidden}.weapon-feature{flex:none;padding:6px;background:#f7ebd6;border:1px solid #d4b78d;border-radius:4px}.weapon-feature h2{margin:0;display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;color:var(--oxblood);font:800 18px/1.2 "Noto Sans SC",sans-serif}.weapon-feature h2 small{color:#725747;font:650 13px/1.25 "Noto Sans SC",sans-serif}.weapon-feature h2::after{content:"";min-width:20px;flex:1;height:1px;background:#b88a57}.weapon-feature p,.weapon-feature [data-restricted-markdown]{margin:5px 0 0;overflow:visible;color:var(--ink);font:500 var(--weapon-content-font-size,15px)/1.42 "Noto Sans SC",sans-serif}.weapon-flavor[data-restricted-markdown]{margin-top:auto;color:#725443;font-style:italic}.weapon-card.is-image .weapon-header,.weapon-card.is-image .weapon-body{display:none}.weapon-card.is-image .weapon-art{height:100%}.weapon-card.is-image.is-fluid .weapon-art,.weapon-card.is-image.is-fluid .weapon-art img{height:auto}.weapon-card.is-text .weapon-art{display:none}.weapon-card.is-split .weapon-header{position:absolute;z-index:2;inset:0;height:auto;display:flex;flex-direction:column;justify-content:flex-end;background:linear-gradient(180deg,#1d131000 10%,#1d131061 42%,#1d1310e8 100%);border-bottom:3px solid #b88a57;text-shadow:0 1px 2px #0e0907}.weapon-card.is-split .weapon-art{order:-1}.weapon-card.is-fluid .weapon-body{flex:none;overflow:visible}.weapon-card.is-fluid .weapon-description{flex:none;overflow:visible}.weapon-card>.pbdh-card-footer{color:#725747;background:var(--bone);border-top:1px solid #d4b78d}.weapon-card.is-image>.pbdh-card-footer{display:none}.weapon-card-frame{position:relative;width:63px;height:88px;overflow:hidden}.weapon-card-frame.is-fluid{overflow:visible}
`;

const weaponScale = .175;
const fixedWeaponNativeHeight = 502.857;

function WeaponCardFrame({
  fixedRatio,
  children,
}: {
  fixedRatio: boolean;
  children: (cardRef: React.RefObject<HTMLElement | null>) => ReactNode;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const [nativeHeight, setNativeHeight] = useState(fixedRatio ? fixedWeaponNativeHeight : 568);

  useLayoutEffect(() => {
    if (fixedRatio) {
      setNativeHeight(fixedWeaponNativeHeight);
      return;
    }
    const card = cardRef.current;
    if (!card) return;
    const updateHeight = () => setNativeHeight(card.offsetHeight);
    const observer = new ResizeObserver(updateHeight);
    observer.observe(card);
    updateHeight();
    return () => observer.disconnect();
  }, [fixedRatio]);

  return <div
    className={`weapon-card-frame${fixedRatio ? "" : " is-fluid"}`}
    style={{ height: `${fixedRatio ? 88 : nativeHeight * weaponScale}px` }}
  >{children(cardRef)}</div>;
}

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
      <div className="weapon-title-row"><div className="weapon-title-stack"><SingleLineTextFit className="weapon-title" contentKey={data.名称} minFontSizePx={10} maxFontSizePx={36} cssVariable="--weapon-title-font-size">{data.名称}</SingleLineTextFit>{data.原文?.trim() ? <p className="weapon-original">{data.原文}</p> : null}</div><span className="weapon-title-meta"><span>位阶 {data.位阶}</span><span>{data.类型}</span></span></div>
    </header>;
    return <WeaponCardFrame fixedRatio={presentation.fixedRatio}>{(cardRef) => <article ref={cardRef} className={cardClass} data-renderer-revision="weapon-card-r2" data-presentation-mode={mode}>
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
          <TextFitContainer className="weapon-description" contentKey={`${data.特性名称}\0${data.特性原文 ?? ""}\0${data.特性描述}\0${data.简介}`} enabled={presentation.fixedRatio} minFontSizePx={11} maxFontSizePx={15} cssVariable="--weapon-content-font-size">
            <section className="weapon-feature"><h2><RestrictedMarkdown inline value={data.特性名称 || "特性"} />{data.特性原文?.trim() ? <small>{data.特性原文}</small> : null}</h2><RestrictedMarkdown value={data.特性描述} /></section>
            {data.简介 && <RestrictedMarkdown className="weapon-flavor" value={data.简介} />}
          </TextFitContainer>
        </div>
        <CardFooter attribution={attribution ?? { artworkCredit: "", sourceLabel: "" }} />
      </>}
    </article>}</WeaponCardFrame>;
  },
};
