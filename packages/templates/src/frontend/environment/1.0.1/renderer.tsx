import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { CardFooter, RestrictedMarkdown, SingleLineTextFit, TextFitContainer } from "@pbdh/resource-renderer/react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { environmentTemplate, type EnvironmentData } from "../../../core/environment/1.0.1/capability.ts";

export type EnvironmentRuntimeState = Record<string, never>;

function isEnvironmentState(value: unknown): value is EnvironmentRuntimeState {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

export const environmentRendererStyles = `
.environment-card-frame{position:relative;width:63px;height:88px;overflow:hidden}.environment-card-frame.is-fluid{overflow:visible}
.environment-card{--ink:#1d1713;--bone:#eee4d0;--oxblood:#641f1d;--brass:#b88a57;box-sizing:border-box;position:absolute;inset:0 auto auto 0;width:360px;height:502.857px;transform:scale(.175);transform-origin:top left;overflow:hidden;display:flex;flex-direction:column;background:var(--bone);color:var(--ink);border:3px solid #21150f;font-family:"Noto Sans SC",sans-serif}.environment-card *{box-sizing:border-box}.environment-card.is-fluid{height:auto;min-height:100%;overflow:visible}
.environment-header{padding:10px 14px;position:relative;z-index:2;flex:none;background:#251a14;color:#fff4df;border-bottom:3px solid var(--brass)}.environment-header-columns{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:16px}.environment-identity{min-width:0}.environment-title{margin:0;overflow:hidden;color:#fff4df;font:800 var(--environment-title-font-size,36px)/1 "Noto Sans SC",sans-serif;white-space:nowrap}.environment-original{margin:6px 0 0;color:#d8ba91;font:650 10px/1.2 "Noto Sans SC",sans-serif;letter-spacing:.06em}.environment-taxonomy{display:flex;min-width:102px;flex-direction:column;align-items:flex-end;text-align:right}.environment-type{color:#f4dfbc;font:700 15px/1.2 "Noto Sans SC",sans-serif;letter-spacing:.08em}.environment-kicker{display:flex;gap:10px;margin-top:9px;color:#d8ba91;font:650 10px/1.2 "Noto Sans SC",sans-serif;letter-spacing:.07em}.environment-kicker span+span::before{content:"·";margin-right:10px;color:var(--brass)}
.environment-art{height:170px;flex:none;overflow:hidden;background:#251a14}.environment-art img{width:100%;height:100%;display:block;object-fit:cover}.environment-image-missing{height:100%;display:grid;place-items:center;color:#f4dfbc;font:650 11px/1.3 "Noto Sans SC",sans-serif}.environment-card.is-text .environment-art{display:none}.environment-card.is-split .environment-header{position:absolute;inset:0 0 auto;height:170px;display:flex;flex-direction:column;justify-content:flex-end;background:linear-gradient(180deg,#1d131000 10%,#1d131061 42%,#1d1310e8 100%);text-shadow:0 1px 2px #0e0907}.environment-card.is-split .environment-art{order:-1}.environment-card.is-image .environment-header,.environment-card.is-image .environment-body{display:none}.environment-card.is-image .environment-art{height:100%}.environment-card.is-image.is-fluid .environment-art,.environment-card.is-image.is-fluid .environment-art img{height:auto}
.environment-body{min-height:0;flex:1;display:flex;flex-direction:column;overflow:hidden}.environment-card.is-fluid .environment-body{flex:none;overflow:visible}
.environment-scene{display:grid;grid-template-columns:76px minmax(0,1fr);flex:none;background:#efe3cf;border-bottom:1px solid #d4b78d}.environment-difficulty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px 8px;background:var(--oxblood);color:#fff4df}.environment-difficulty-label{font:800 12px/1.15 "Noto Sans SC",sans-serif;letter-spacing:.14em;writing-mode:vertical-rl}.environment-difficulty b{margin:12px 0;color:#fff4df;font:900 42px/.9 Georgia,"Noto Serif SC",serif}.environment-difficulty small{color:#dcbda0;font:650 8px/1.1 "Noto Sans SC",sans-serif;letter-spacing:.11em;writing-mode:vertical-rl}.environment-record{margin:0;padding:6px 18px}.environment-record>div+div{margin-top:0;padding-top:6px;border-top:1px solid #c6af8d}.environment-record dt{margin:0 0 5px;color:var(--oxblood);font:800 12px/1.2 "Noto Sans SC",sans-serif;letter-spacing:.08em}.environment-record dd{margin:0;white-space:pre-wrap;color:var(--ink);font:450 var(--environment-content-font-size,15px)/1.45 "Noto Sans SC",sans-serif}.environment-record .environment-intro{font-weight:650}
.environment-features-wrap{padding:12px 11px 14px}.environment-feature-heading{display:flex;align-items:center;gap:8px;margin:0 0 7px;color:var(--oxblood);font:800 13px/1 "Noto Sans SC",sans-serif;letter-spacing:.08em}.environment-feature-heading::after{content:"";height:2px;flex:1;background:var(--brass)}.environment-features{min-height:0;flex:1;overflow:hidden;display:flex;flex-direction:column;gap:6px}.environment-card.is-fluid .environment-features{flex:none;overflow:visible}.environment-feature{padding:6px;display:grid;grid-template-columns:76px minmax(0,1fr);align-items:start;gap:8px;background:#f7ebd6;border:1px solid #d4b78d;border-radius:4px}.environment-feature-identity{min-width:0;padding-right:7px}.environment-feature h2{margin:0;color:var(--oxblood);font:800 calc(var(--environment-content-font-size,15px) + 3px)/1.2 "Noto Sans SC",sans-serif}.environment-feature-type{display:block;margin-top:2px;color:#87504b;font:650 var(--environment-content-font-size,15px)/1.2 "Noto Sans SC",sans-serif}.environment-feature small{display:block;margin-top:3px;color:#5e4637;font:650 max(8px,calc(var(--environment-content-font-size,15px) - 3px))/1.2 "Noto Sans SC",sans-serif}.environment-feature-copy{min-width:0}.environment-feature-copy>[data-restricted-markdown]{margin:0;color:var(--ink);font:450 var(--environment-content-font-size,15px)/1.35 "Noto Sans SC",sans-serif}.environment-question{grid-column:1/-1;margin:0!important;padding-top:6px;border-top:1px solid #d4b78d;color:#5e4637!important;font-style:italic!important}.environment-question strong{color:var(--oxblood);font-style:normal}.environment-card>.pbdh-card-footer{color:#725747;background:var(--bone);border-top:1px solid #d4b78d}.environment-card.is-image>.pbdh-card-footer{display:none}
.environment-card.is-split{height:auto;min-height:0;overflow:visible}.environment-card.is-split .environment-art{position:relative;height:auto;overflow:visible}.environment-card.is-split .environment-art img{width:100%;height:auto;object-fit:contain}.environment-card.is-split.has-portrait .environment-header{inset:auto 0 0;height:auto;min-height:74px;background:linear-gradient(180deg,#1d131000 0%,#1d1310b8 48%,#1d1310f5 100%)}.environment-card.is-split:not(.has-portrait) .environment-header{position:relative;height:auto;background:#251a14}.environment-card.is-split:not(.has-portrait) .environment-art{min-height:74px}
.environment-card.is-split.has-fixed-base{height:var(--split-fixed-native-height)}
`;

const environmentScale = .175;
const fixedEnvironmentNativeHeight = 502.857;

function EnvironmentCardFrame({
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
  const [nativeHeight, setNativeHeight] = useState(fixedRatio ? fixedEnvironmentNativeHeight : 568);

  useLayoutEffect(() => {
    if (fixedRatio) {
      setNativeHeight(fixedEnvironmentNativeHeight);
      return;
    }
    const card = cardRef.current;
    if (!card) return;
    const image = card.querySelector("img");
    const updateHeight = () => setNativeHeight(splitFixed ? fixedEnvironmentNativeHeight + (image?.offsetHeight ?? 0) : card.offsetHeight);
    const observer = new ResizeObserver(updateHeight);
    observer.observe(card);
    if (image) observer.observe(image);
    updateHeight();
    return () => observer.disconnect();
  }, [fixedRatio, splitFixed, imageKey]);

  return <div
    className={`environment-card-frame${fixedRatio ? "" : " is-fluid"}`}
    style={{ height: `${fixedRatio ? 88 : nativeHeight * environmentScale}px`, "--split-fixed-native-height": `${nativeHeight}px` } as CSSProperties}
  >{children(cardRef)}</div>;
}

export const environmentRendererRevision: RendererRevisionCapability<EnvironmentData, EnvironmentRuntimeState, ReactNode> = {
  revision: "environment-card-r3",
  templateId: "环境",
  templateVersion: "1.0.1",
  requiredMediaSlots: [],
  optionalMediaSlots: ["portrait"],
  defaultState(data) {
    return environmentTemplate.tabletop.defaultState(data) as EnvironmentRuntimeState;
  },
  validateState: isEnvironmentState,
  styles: environmentRendererStyles,
  render({ data, presentation, assets, attribution }) {
    const portrait = assets.portrait;
    const fixedSurface = presentation.fixedRatio && presentation.mode !== "split";
    const header = <header className="environment-header">
      <div className="environment-header-columns">
        <div className="environment-identity"><SingleLineTextFit className="environment-title" contentKey={data.名称} minFontSizePx={10} maxFontSizePx={36} cssVariable="--environment-title-font-size">{data.名称 || "未命名环境"}</SingleLineTextFit>{data.原文?.trim() ? <p className="environment-original">{data.原文}</p> : null}</div>
        <div className="environment-taxonomy"><span className="environment-type">{data.类型 || "环境"}</span><div className="environment-kicker"><span>{data.位阶 ? `位阶 ${data.位阶}` : ""}</span><span>{data.种类}</span></div></div>
      </div>
    </header>;
    const splitFixed = presentation.fixedRatio && presentation.mode === "split";
    return <EnvironmentCardFrame fixedRatio={fixedSurface} splitFixed={splitFixed} imageKey={portrait}>{(cardRef) => <article ref={cardRef} className={["environment-card", `is-${presentation.mode}`, fixedSurface ? "" : "is-fluid", splitFixed ? "has-fixed-base" : "", portrait ? "has-portrait" : ""].filter(Boolean).join(" ")} data-renderer-revision="environment-card-r3">
      {presentation.mode === "text" ? header : null}
      {(presentation.mode === "split" || presentation.mode === "image") && <div className="environment-art">
        {portrait ? <img src={portrait} alt={data.名称} /> : <div className="environment-image-missing" role="status">缺少主图</div>}
        {presentation.mode === "split" ? header : null}
      </div>}
      <div className="environment-body">
        <section className="environment-scene" aria-label="环境资料">
          <div className="environment-difficulty"><span className="environment-difficulty-label">难度</span><b>{data.难度 || "—"}</b><small>DIFFICULTY</small></div>
          <dl className="environment-record">
            {data.简介?.trim() ? <div><dt>简介</dt><dd className="environment-intro"><RestrictedMarkdown inline value={data.简介} /></dd></div> : null}
            {data.趋向?.trim() ? <div><dt>趋向</dt><dd><RestrictedMarkdown inline value={data.趋向} /></dd></div> : null}
            {data.潜在敌人?.trim() ? <div><dt>潜在敌人</dt><dd><RestrictedMarkdown inline value={data.潜在敌人} /></dd></div> : null}
          </dl>
        </section>
        <div className="environment-features-wrap"><h2 className="environment-feature-heading">环境特性 / FEATURES</h2><TextFitContainer className="environment-features" contentKey={JSON.stringify(data.特性)} enabled={fixedSurface} cssVariable="--environment-content-font-size">{data.特性.map((feature, index) => <section className="environment-feature" key={`${feature.特性名称}:${index}`}>
          <div className="environment-feature-identity"><h2>{feature.特性名称 || "未命名特性"}</h2><span className="environment-feature-type">{feature.特性类型}</span>{feature.特性原文?.trim() ? <small>{feature.特性原文}</small> : null}</div>
          <div className="environment-feature-copy">{feature.特性描述 && <RestrictedMarkdown value={feature.特性描述} />}</div>
          {feature.引导问题 && <p className="environment-question"><RestrictedMarkdown inline value={feature.引导问题} /></p>}
        </section>)}</TextFitContainer></div>
      </div>
      {presentation.mode !== "image" ? <CardFooter attribution={attribution ?? { artworkCredit: "", sourceLabel: "" }} /> : null}
    </article>}</EnvironmentCardFrame>;
  },
};
