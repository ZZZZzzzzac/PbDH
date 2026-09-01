import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { RestrictedMarkdown } from "@pbdh/resource-renderer/react";
import type { ReactNode } from "react";

import { environmentTemplate, type EnvironmentData } from "../../../core/index.ts";

export type EnvironmentRuntimeState = Record<string, never>;

function isEnvironmentState(value: unknown): value is EnvironmentRuntimeState {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

export const environmentRendererStyles = `
.environment-card{--ink:#1d1713;--bone:#eee4d0;--oxblood:#641f1d;box-sizing:border-box;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;background:var(--bone);color:var(--ink);border:1px solid #21150f;font-family:"Noto Sans SC",sans-serif}.environment-card *{box-sizing:border-box}.environment-card.is-fluid{height:auto;min-height:100%;overflow:visible}.environment-header{padding:7% 8% 6%;background:#251a14;color:#fff4df;border-bottom:3px solid #b88a57}.environment-kicker{display:flex;justify-content:space-between;gap:6%;color:#f4dfbc;font:650 10px/1.2 "Noto Sans SC",sans-serif;letter-spacing:.1em}.environment-title{margin:3% 0 0;overflow:hidden;font:800 clamp(20px,8cqw,36px)/1 "Noto Sans SC",sans-serif;text-overflow:ellipsis;white-space:nowrap}.environment-original{margin:2% 0 0;color:#d8ba91;font:650 9px/1.2 "Noto Sans SC",sans-serif;letter-spacing:.06em}.environment-art{height:32%;overflow:hidden;background:#251a14}.environment-art img{width:100%;height:100%;display:block;object-fit:cover}.environment-image-missing{height:100%;display:grid;place-items:center;color:#f4dfbc;font:650 11px/1.3 "Noto Sans SC",sans-serif}.environment-body{padding:5% 7%;display:flex;min-height:0;flex:1;flex-direction:column;gap:4%;overflow:auto}.environment-intro,.environment-note,.environment-feature p{margin:0;white-space:pre-wrap;font:450 clamp(9px,3.1cqw,14px)/1.4 "Noto Sans SC",sans-serif}.environment-intro{padding:4%;background:#f7ebd6;border:1px solid #d4b78d;border-radius:4px;color:#5e4637;font-style:italic}.environment-meta{display:grid;grid-template-columns:1fr 1fr;border:1px solid #ad8b68;background:#f7ebd6}.environment-meta div{padding:5%;border-right:1px solid #ad8b68}.environment-meta div:last-child{border-right:0}.environment-meta dt{color:#725443;font:650 9px/1.2 "Noto Sans SC",sans-serif}.environment-meta dd{margin:2% 0 0;color:var(--oxblood);font-weight:800}.environment-note strong{color:var(--oxblood)}.environment-features{display:flex;flex-direction:column;gap:4%}.environment-feature{padding:4%;background:#f7ebd6;border:1px solid #d4b78d;border-radius:4px}.environment-feature h2{display:flex;align-items:center;gap:8px;margin:0;color:var(--oxblood);font:800 clamp(12px,4cqw,18px)/1.2 "Noto Sans SC",sans-serif}.environment-feature h2::after{content:"";flex:1;height:1px;background:#b88a57}.environment-feature h2 span{color:#87504b;font:650 9px/1.3 "Noto Sans SC",sans-serif}.environment-feature small{display:block;margin:1% 0;color:#725443;font-weight:650}.environment-question{margin-top:2%!important;color:#5e4637;font-style:italic}.environment-card.is-image .environment-header,.environment-card.is-image .environment-body{display:none}.environment-card.is-image .environment-art{height:100%}.environment-card.is-image.is-fluid .environment-art,.environment-card.is-image.is-fluid .environment-art img{height:auto}.environment-card.is-text .environment-art{display:none}
.environment-intro[data-restricted-markdown],.environment-feature [data-restricted-markdown]{font:450 clamp(9px,3.1cqw,14px)/1.4 "Noto Sans SC",sans-serif}
`;

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
  render({ data, presentation, assets }) {
    const portrait = assets.portrait;
    return <article className={["environment-card", `is-${presentation.mode}`, presentation.fixedRatio ? "" : "is-fluid"].filter(Boolean).join(" ")} data-renderer-revision="environment-card-r1">
      <header className="environment-header">
        <div className="environment-kicker"><span>{[data.类型 || "环境", data.种类].filter(Boolean).join(" · ")}</span><span>位阶 {data.位阶}</span></div>
        <h1 className="environment-title">{data.名称 || "未命名环境"}</h1>
        {data.原文?.trim() ? <p className="environment-original">{data.原文}</p> : null}
      </header>
      {(presentation.mode === "split" || presentation.mode === "image") && <div className="environment-art">
        {portrait ? <img src={portrait} alt={data.名称} /> : <div className="environment-image-missing" role="status">缺少主图</div>}
      </div>}
      <div className="environment-body">
        {data.简介 && <RestrictedMarkdown className="environment-intro" value={data.简介} />}
        <dl className="environment-meta"><div><dt>难度</dt><dd>{data.难度 || "—"}</dd></div><div><dt>趋向</dt><dd>{data.趋向 || "—"}</dd></div></dl>
        {data.潜在敌人 && <p className="environment-note"><strong>潜在敌人：</strong><RestrictedMarkdown inline value={data.潜在敌人} /></p>}
        <div className="environment-features">{data.特性.map((feature, index) => <section className="environment-feature" key={`${feature.名称}:${index}`}>
          <h2>{feature.名称 || "未命名特性"}<span>{feature.类型}</span></h2>
          {feature.原名?.trim() ? <small>{feature.原名}</small> : null}
          {feature.描述 && <RestrictedMarkdown value={feature.描述} />}
          {feature.引导问题 && <p className="environment-question"><strong>引导问题：</strong><RestrictedMarkdown inline value={feature.引导问题} /></p>}
        </section>)}</div>
      </div>
    </article>;
  },
};
