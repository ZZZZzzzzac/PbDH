import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { CardFooter, RestrictedMarkdown, SingleLineTextFit, TextFitContainer } from "@pbdh/resource-renderer/react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { armorTemplate, type ArmorData } from "../../../core/armor/1.0.1/capability.ts";

export type ArmorRuntimeState = Record<string, never>;

function isArmorState(value: unknown): value is ArmorRuntimeState {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === 0;
}

export const armorRendererStyles = `
.armor-card{--ink:#1d1713;--bone:#eee4d0;--oxblood:#641f1d;box-sizing:border-box;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;background:var(--bone);color:var(--ink);border:1px solid #21150f;font-family:"Noto Sans SC",sans-serif}.armor-card *{box-sizing:border-box}.armor-card.is-fluid{height:auto;min-height:100%;overflow:visible}.armor-header{flex:none;padding:10px 14px;background:#251a14;color:#fff4df;border-bottom:3px solid #b88a57}.armor-title-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:20px}.armor-title-stack{min-width:0}.armor-title{width:100%;margin:0;overflow:hidden;font:800 var(--armor-title-font-size,36px)/1 "Noto Sans SC",sans-serif;white-space:nowrap}.armor-original{margin:5px 0 0;color:#d8ba91;font:650 13px/1.2 "Noto Sans SC",sans-serif}.armor-title-meta{display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-end;gap:4px;color:#f4dfbc;font:650 15px/1.15 "Noto Sans SC",sans-serif;white-space:nowrap;text-align:right}.armor-art{height:170px;flex:none;overflow:hidden;background:#251a14}.armor-art img{width:100%;height:100%;display:block;object-fit:cover}.armor-image-missing{height:100%;display:grid;place-items:center;color:#f4dfbc;font:650 11px/1.3 "Noto Sans SC",sans-serif}.armor-body{min-height:0;flex:1;display:flex;flex-direction:column;padding:18px 20px 0;overflow:hidden}.armor-stats{flex:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-block:1px solid #bfa47d}.armor-stat{padding:10px 4px 8px;display:flex;flex-direction:column;align-items:center;text-align:center}.armor-stat b{color:var(--oxblood);font:800 28px/1.05 "Noto Sans SC",sans-serif}.armor-stat span{margin-top:3px;color:#725443;font:650 9px/1.2 "Noto Sans SC",sans-serif}.armor-effects{min-height:0;flex:1;display:flex;flex-direction:column;gap:10px;margin-top:10px;overflow:hidden}.armor-feature{flex:none;padding:6px;background:#f7ebd6;border:1px solid #d4b78d;border-radius:4px}.armor-feature h2{display:flex;align-items:baseline;gap:8px;margin:0;color:var(--oxblood);font:800 19px/1.25 "Noto Sans SC",sans-serif}.armor-feature h2::after{content:"";min-width:20px;flex:1;height:1px;background:#b88a57}.armor-feature h2 small{color:#725747;font:650 12px/1.25 "Noto Sans SC",sans-serif;letter-spacing:.025em}.armor-feature h2 [data-restricted-markdown]{color:inherit;font:inherit}.armor-feature p,.armor-feature [data-restricted-markdown]{margin:5px 0 0;white-space:pre-wrap;font:450 var(--armor-content-font-size,15px)/1.45 "Noto Sans SC",sans-serif}.armor-flavor[data-restricted-markdown]{margin:5px 0 0;white-space:pre-wrap;font:500 var(--armor-content-font-size,15px)/1.42 "Noto Sans SC",sans-serif;margin-top:auto;color:#725443;font-style:italic}.armor-card.is-image .armor-header,.armor-card.is-image .armor-body{display:none}.armor-card.is-image .armor-art{height:100%}.armor-card.is-image.is-fluid .armor-art,.armor-card.is-image.is-fluid .armor-art img{height:auto}.armor-card.is-text .armor-art{display:none}.armor-card.is-fluid .armor-body{flex:none;overflow:visible}.armor-card.is-fluid .armor-effects{flex:none;overflow:visible}.armor-card.is-split .armor-header{position:absolute;z-index:2;inset:0 0 auto;height:170px;display:flex;flex-direction:column;justify-content:flex-end;background:linear-gradient(180deg,#1d131000 10%,#1d131061 42%,#1d1310e8 100%);text-shadow:0 1px 2px #0e0907}.armor-card.is-split .armor-art{order:-1}.armor-card>.pbdh-card-footer{color:#725747;background:var(--bone);border-top:1px solid #d4b78d}.armor-card.is-image>.pbdh-card-footer{display:none}
.armor-card-frame{position:relative;width:63px;height:88px;overflow:hidden}.armor-card-frame.is-fluid{overflow:visible}.armor-card{position:absolute;inset:0 auto auto 0;width:360px;height:502.857px;transform:scale(.175);transform-origin:top left}.armor-card.is-fluid{height:auto}
.armor-card.is-split{height:auto;min-height:0;overflow:visible}.armor-card.is-split .armor-art{position:relative;height:auto;overflow:visible}.armor-card.is-split .armor-art img{width:100%;height:auto;object-fit:contain}.armor-card.is-split.has-portrait .armor-header{position:absolute;z-index:2;inset:auto 0 0;width:100%;background:linear-gradient(180deg,#1d131000 0%,#1d1310b8 48%,#1d1310f5 100%);border-bottom:0;text-shadow:0 1px 2px #0e0907}.armor-card.is-split:not(.has-portrait) .armor-header{position:relative;background:#251a14}.armor-card.is-split:not(.has-portrait) .armor-art{height:auto}
.armor-card.is-split.has-fixed-base{height:var(--split-fixed-native-height)}
.armor-header .armor-flavor[data-restricted-markdown]{margin:8px 0 0;color:#dcb299;font:italic 500 14px/1.4 "Noto Sans SC",sans-serif;overflow-wrap:anywhere;white-space:normal}
`;

const armorScale = .175;
const fixedArmorNativeHeight = 502.857;

function ArmorCardFrame({
  fixedRatio,
  splitFixed = false,
  imageKey,
  children,
}: {
  fixedRatio: boolean;
  splitFixed?: boolean;
  imageKey?: string;
  children: (cardRef: React.RefObject<HTMLElement | null>) => ReactNode;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const [nativeHeight, setNativeHeight] = useState(fixedRatio ? fixedArmorNativeHeight : 568);

  useLayoutEffect(() => {
    if (fixedRatio) {
      setNativeHeight(fixedArmorNativeHeight);
      return;
    }
    const card = cardRef.current;
    if (!card) return;
    const image = card.querySelector("img");
    const updateHeight = () => setNativeHeight(splitFixed ? fixedArmorNativeHeight + (image?.offsetHeight ?? 0) : card.offsetHeight);
    const observer = new ResizeObserver(updateHeight);
    observer.observe(card);
    if (image) observer.observe(image);
    updateHeight();
    return () => observer.disconnect();
  }, [fixedRatio, splitFixed, imageKey]);

  return <div
    className={`armor-card-frame${fixedRatio ? "" : " is-fluid"}`}
    style={{ height: `${fixedRatio ? 88 : nativeHeight * armorScale}px`, "--split-fixed-native-height": `${nativeHeight}px` } as CSSProperties}
  >{children(cardRef)}</div>;
}

export const armorRendererRevision: RendererRevisionCapability<ArmorData, ArmorRuntimeState, ReactNode> = {
  revision: "armor-card-r2",
  templateId: "护甲",
  templateVersion: "1.0.1",
  requiredMediaSlots: [],
  optionalMediaSlots: ["portrait"],
  defaultState(data) {
    return armorTemplate.tabletop.defaultState(data) as ArmorRuntimeState;
  },
  validateState: isArmorState,
  styles: armorRendererStyles,
  render({ data, presentation, assets, attribution }) {
    const portrait = assets.portrait;
    const fixedSurface = presentation.fixedRatio && presentation.mode !== "split";
    const header = <header className="armor-header">
      <div className="armor-title-row"><div className="armor-title-stack"><SingleLineTextFit className="armor-title" contentKey={data.名称} minFontSizePx={10} maxFontSizePx={36} cssVariable="--armor-title-font-size">{data.名称 || "未命名护甲"}</SingleLineTextFit>{data.原文?.trim() ? <p className="armor-original">{data.原文}</p> : null}</div><span className="armor-title-meta">{data.位阶 ? <span>位阶 {data.位阶}</span> : null}<span>{data.类型 || "护甲"}</span></span></div>
      {data.简介 ? <RestrictedMarkdown className="armor-flavor" inline value={data.简介} /> : null}
    </header>;
    const splitFixed = presentation.fixedRatio && presentation.mode === "split";
    return <ArmorCardFrame fixedRatio={fixedSurface} splitFixed={splitFixed} imageKey={portrait}>{(cardRef) => <article ref={cardRef} className={["armor-card", `is-${presentation.mode}`, fixedSurface ? "" : "is-fluid", splitFixed ? "has-fixed-base" : "", portrait ? "has-portrait" : ""].filter(Boolean).join(" ")} data-renderer-revision="armor-card-r2">
      {presentation.mode === "text" ? header : null}
      {(presentation.mode === "split" || presentation.mode === "image") && <div className="armor-art">
        {portrait ? <img src={portrait} alt={data.名称} /> : <div className="armor-image-missing" role="status">缺少主图</div>}
        {presentation.mode === "split" ? header : null}
      </div>}
      <div className="armor-body">
        <section className="armor-stats" aria-label="护甲数据">
          <div className="armor-stat"><b>{data.护甲值}</b><span>护甲值</span></div>
          <div className="armor-stat"><b>{data.重度伤害阈值}</b><span>重度阈值</span></div>
          <div className="armor-stat"><b>{data.严重伤害阈值}</b><span>严重阈值</span></div>
        </section>
        <TextFitContainer className="armor-effects" contentKey={`${data.特性名称}\0${data.特性原文 ?? ""}\0${data.特性描述}`} enabled={fixedSurface && presentation.mode !== "image"} cssVariable="--armor-content-font-size">
          {(data.特性名称 || data.特性描述) && <section className="armor-feature"><h2><span><RestrictedMarkdown inline value={data.特性名称 || "护甲特性"} /></span>{data.特性原文?.trim() ? <small>{data.特性原文}</small> : null}</h2><RestrictedMarkdown value={data.特性描述} /></section>}
        </TextFitContainer>
      </div>
      {presentation.mode !== "image" ? <CardFooter attribution={attribution ?? { artworkCredit: "", sourceLabel: "" }} /> : null}
    </article>}</ArmorCardFrame>;
  },
};
