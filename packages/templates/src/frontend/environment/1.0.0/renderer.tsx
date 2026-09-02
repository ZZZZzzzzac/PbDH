import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { CardFooter, RestrictedMarkdown, SingleLineTextFit, TextFitContainer } from "@pbdh/resource-renderer/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { environmentTemplate, type EnvironmentData } from "../../../core/index.ts";

export type EnvironmentRuntimeState = Record<string, never>;

function isEnvironmentState(value: unknown): value is EnvironmentRuntimeState {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

export const environmentRendererStyles = `
.environment-card{--ink:#1d1713;--bone:#eee4d0;--oxblood:#641f1d;box-sizing:border-box;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;background:var(--bone);color:var(--ink);border:1px solid #21150f;font-family:"Noto Sans SC",sans-serif}.environment-card *{box-sizing:border-box}.environment-card.is-fluid{height:auto;min-height:100%;overflow:visible}.environment-header{padding:10px 14px;background:#251a14;color:#fff4df;border-bottom:3px solid #b88a57}.environment-kicker{display:flex;justify-content:space-between;gap:6%;color:#f4dfbc;font:650 10px/1.2 "Noto Sans SC",sans-serif;letter-spacing:.1em}.environment-title{margin:3% 0 0;overflow:hidden;font:800 var(--environment-title-font-size,clamp(20px,8cqw,36px))/1 "Noto Sans SC",sans-serif;white-space:nowrap}.environment-original{margin:2% 0 0;color:#d8ba91;font:650 9px/1.2 "Noto Sans SC",sans-serif;letter-spacing:.06em}.environment-art{height:32%;overflow:hidden;background:#251a14}.environment-art img{width:100%;height:100%;display:block;object-fit:cover}.environment-image-missing{height:100%;display:grid;place-items:center;color:#f4dfbc;font:650 11px/1.3 "Noto Sans SC",sans-serif}.environment-body{padding:5% 7%;display:flex;min-height:0;flex:1;flex-direction:column;gap:4%;overflow:auto}.environment-intro,.environment-note,.environment-feature p{margin:0;white-space:pre-wrap;font:450 clamp(9px,3.1cqw,14px)/1.4 "Noto Sans SC",sans-serif}.environment-intro{padding:4%;background:#f7ebd6;border:1px solid #d4b78d;border-radius:4px;color:#5e4637;font-style:italic}.environment-meta{display:grid;grid-template-columns:1fr 1fr;border:1px solid #ad8b68;background:#f7ebd6}.environment-meta div{padding:5%;border-right:1px solid #ad8b68}.environment-meta div:last-child{border-right:0}.environment-meta dt{color:#725443;font:650 9px/1.2 "Noto Sans SC",sans-serif}.environment-meta dd{margin:2% 0 0;color:var(--oxblood);font-weight:800}.environment-note strong{color:var(--oxblood)}.environment-features{display:flex;flex-direction:column;gap:4%}.environment-feature{padding:4%;background:#f7ebd6;border:1px solid #d4b78d;border-radius:4px}.environment-feature h2{display:flex;align-items:center;gap:8px;margin:0;color:var(--oxblood);font:800 clamp(12px,4cqw,18px)/1.2 "Noto Sans SC",sans-serif}.environment-feature h2::after{content:"";flex:1;height:1px;background:#b88a57}.environment-feature h2 span{color:#87504b;font:650 9px/1.3 "Noto Sans SC",sans-serif}.environment-feature small{display:block;margin:1% 0;color:#725443;font-weight:650}.environment-question{margin-top:2%!important;color:#5e4637;font-style:italic}.environment-card.is-image .environment-header,.environment-card.is-image .environment-body{display:none}.environment-card.is-image .environment-art{height:100%}.environment-card.is-image.is-fluid .environment-art,.environment-card.is-image.is-fluid .environment-art img{height:auto}.environment-card.is-text .environment-art{display:none}
.environment-intro[data-restricted-markdown],.environment-feature [data-restricted-markdown]{font:450 clamp(9px,3.1cqw,14px)/1.4 "Noto Sans SC",sans-serif}
.environment-body{overflow:hidden}.environment-card.is-fluid .environment-body{flex:none;overflow:visible}.environment-features{min-height:0;flex:1;overflow:hidden}.environment-card.is-fluid .environment-features{flex:none;overflow:visible}.environment-feature{flex:none}.environment-intro,.environment-note,.environment-feature p,.environment-intro[data-restricted-markdown],.environment-feature [data-restricted-markdown]{font-size:var(--environment-content-font-size,15px)}.environment-card>.pbdh-card-footer{color:#725747;background:var(--bone);border-top:1px solid #d4b78d}.environment-card.is-image>.pbdh-card-footer{display:none}
.environment-card{position:relative}.environment-title-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:6%}.environment-title-row .environment-title{min-width:0}.environment-type{color:#f4dfbc;font:650 clamp(10px,3.5cqw,15px)/1.2 "Noto Sans SC",sans-serif;text-align:right}.environment-card.is-split .environment-header{position:absolute;z-index:2;inset:0 0 auto;height:32%;display:flex;flex-direction:column;justify-content:flex-end;background:linear-gradient(180deg,#1d131000 10%,#1d131061 42%,#1d1310e8 100%);text-shadow:0 1px 2px #0e0907}.environment-card.is-split .environment-art{order:-1}
.environment-card-frame{position:relative;width:63px;height:88px;overflow:hidden}.environment-card-frame.is-fluid{overflow:visible}.environment-card{position:absolute;inset:0 auto auto 0;width:360px;height:502.857px;transform:scale(.175);transform-origin:top left}.environment-card.is-fluid{height:auto}
`;

const environmentScale = .175;
const fixedEnvironmentNativeHeight = 502.857;

function EnvironmentCardFrame({
  fixedRatio,
  children,
}: {
  fixedRatio: boolean;
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
    const updateHeight = () => setNativeHeight(card.offsetHeight);
    const observer = new ResizeObserver(updateHeight);
    observer.observe(card);
    updateHeight();
    return () => observer.disconnect();
  }, [fixedRatio]);

  return <div
    className={`environment-card-frame${fixedRatio ? "" : " is-fluid"}`}
    style={{ height: `${fixedRatio ? 88 : nativeHeight * environmentScale}px` }}
  >{children(cardRef)}</div>;
}

export const environmentRendererRevision: RendererRevisionCapability<EnvironmentData, EnvironmentRuntimeState, ReactNode> = {
  revision: "environment-card-r1",
  templateId: "环境",
  templateVersion: "1.0.0",
  requiredMediaSlots: [],
  optionalMediaSlots: ["portrait"],
  defaultState(data) {
    return environmentTemplate.tabletop.defaultState(data) as EnvironmentRuntimeState;
  },
  validateState: isEnvironmentState,
  styles: environmentRendererStyles,
  render({ data, presentation, assets, attribution }) {
    const portrait = assets.portrait;
    return <EnvironmentCardFrame fixedRatio={presentation.fixedRatio}>{(cardRef) => <article ref={cardRef} className={["environment-card", `is-${presentation.mode}`, presentation.fixedRatio ? "" : "is-fluid"].filter(Boolean).join(" ")} data-renderer-revision="environment-card-r1">
      <header className="environment-header">
        <div className="environment-title-row"><SingleLineTextFit className="environment-title" contentKey={data.名称} minFontSizePx={10} maxFontSizePx={36} cssVariable="--environment-title-font-size">{data.名称 || "未命名环境"}</SingleLineTextFit><span className="environment-type">{data.类型 || "环境"}</span></div>
        <div className="environment-kicker"><span>{data.种类}</span><span>{data.位阶 ? `位阶 ${data.位阶}` : ""}</span></div>
        {data.原文?.trim() ? <p className="environment-original">{data.原文}</p> : null}
      </header>
      {(presentation.mode === "split" || presentation.mode === "image") && <div className="environment-art">
        {portrait ? <img src={portrait} alt={data.名称} /> : <div className="environment-image-missing" role="status">缺少主图</div>}
      </div>}
      <div className="environment-body">
        {data.简介 && <RestrictedMarkdown className="environment-intro" value={data.简介} />}
        <dl className="environment-meta"><div><dt>难度</dt><dd>{data.难度 || "—"}</dd></div><div><dt>趋向</dt><dd>{data.趋向 || "—"}</dd></div></dl>
        {data.潜在敌人 && <p className="environment-note"><strong>潜在敌人：</strong><RestrictedMarkdown inline value={data.潜在敌人} /></p>}
        <TextFitContainer className="environment-features" contentKey={JSON.stringify(data.特性)} enabled={presentation.fixedRatio && presentation.mode !== "image"} cssVariable="--environment-content-font-size">{data.特性.map((feature, index) => <section className="environment-feature" key={`${feature.名称}:${index}`}>
          <h2>{feature.名称 || "未命名特性"}<span>{feature.类型}</span></h2>
          {feature.原名?.trim() ? <small>{feature.原名}</small> : null}
          {feature.描述 && <RestrictedMarkdown value={feature.描述} />}
          {feature.引导问题 && <p className="environment-question"><strong>引导问题：</strong><RestrictedMarkdown inline value={feature.引导问题} /></p>}
        </section>)}</TextFitContainer>
      </div>
      {presentation.mode !== "image" ? <CardFooter attribution={attribution ?? { artworkCredit: "", sourceLabel: "" }} /> : null}
    </article>}</EnvironmentCardFrame>;
  },
};
