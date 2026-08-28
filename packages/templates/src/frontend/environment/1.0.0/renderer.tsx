import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import type { ReactNode } from "react";

import { environmentTemplate, type EnvironmentData } from "../../../core/index.ts";

export type EnvironmentRuntimeState = Record<string, never>;

function isEnvironmentState(value: unknown): value is EnvironmentRuntimeState {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

export const environmentRendererStyles = `
.environment-card{box-sizing:border-box;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;background:#e8e4d5;color:#20241f;border:1px solid #56624f;font-family:Georgia,"Noto Serif SC",serif}.environment-card *{box-sizing:border-box}.environment-header{padding:7% 8% 5%;background:#26352d;color:#f3f1e7;border-bottom:4px solid #8da36f}.environment-kicker{display:flex;justify-content:space-between;gap:6%;font:700 10px/1.2 system-ui,sans-serif;letter-spacing:.1em;color:#cad5bb}.environment-title{margin:3% 0 0;font-size:clamp(20px,8cqw,36px);line-height:1}.environment-original{margin:2% 0 0;font:600 9px/1.2 system-ui,sans-serif;letter-spacing:.08em;color:#b9c7ad}.environment-art{height:32%;overflow:hidden;background:#aeb99f}.environment-art img{width:100%;height:100%;object-fit:cover}.environment-image-missing{height:100%;display:grid;place-items:center;color:#455042}.environment-body{padding:5% 7%;display:flex;min-height:0;flex:1;flex-direction:column;gap:4%;overflow:auto}.environment-intro,.environment-note,.environment-feature p{margin:0;white-space:pre-wrap;font-size:clamp(9px,3.1cqw,14px);line-height:1.4}.environment-meta{display:grid;grid-template-columns:1fr 1fr;border:1px solid #859078}.environment-meta div{padding:5%;border-right:1px solid #859078}.environment-meta div:last-child{border-right:0}.environment-meta dt{font:700 9px/1.2 system-ui,sans-serif;color:#5c6755}.environment-meta dd{margin:2% 0 0;font-weight:700}.environment-note strong{color:#3f5f42}.environment-features{display:flex;flex-direction:column;gap:4%}.environment-feature{border-top:1px solid #9aa48f;padding-top:3%}.environment-feature h2{display:flex;justify-content:space-between;gap:4%;margin:0;color:#3f5f42;font-size:clamp(12px,4cqw,18px)}.environment-feature h2 span{font:700 9px/1.3 system-ui,sans-serif}.environment-feature small{display:block;margin:1% 0;color:#697263}.environment-question{margin-top:2%!important;font-style:italic;color:#4f594a}.environment-card.is-image .environment-header,.environment-card.is-image .environment-body{display:none}.environment-card.is-image .environment-art{height:100%}.environment-card.is-text .environment-art{display:none}
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
    return <article className={`environment-card is-${presentation.mode}`} data-renderer-revision="environment-card-r1">
      <header className="environment-header">
        <div className="environment-kicker"><span>{data.种类 || "环境"}</span><span>位阶 {data.位阶}</span></div>
        <h1 className="environment-title">{data.名称 || "未命名环境"}</h1>
        {data.原文 && <p className="environment-original">{data.原文}</p>}
      </header>
      {(presentation.mode === "split" || presentation.mode === "image") && <div className="environment-art">
        {portrait ? <img src={portrait} alt={data.名称} /> : <div className="environment-image-missing" role="status">缺少主图</div>}
      </div>}
      <div className="environment-body">
        {data.简介 && <p className="environment-intro">{data.简介}</p>}
        <dl className="environment-meta"><div><dt>难度</dt><dd>{data.难度 || "—"}</dd></div><div><dt>趋向</dt><dd>{data.趋向 || "—"}</dd></div></dl>
        {data.潜在敌人 && <p className="environment-note"><strong>潜在敌人：</strong>{data.潜在敌人}</p>}
        <div className="environment-features">{data.特性.map((feature, index) => <section className="environment-feature" key={`${feature.名称}:${index}`}>
          <h2>{feature.名称 || "未命名特性"}<span>{feature.类型}</span></h2>
          {feature.原名 && <small>{feature.原名}</small>}
          {feature.描述 && <p>{feature.描述}</p>}
          {feature.引导问题 && <p className="environment-question"><strong>引导问题：</strong>{feature.引导问题}</p>}
        </section>)}</div>
      </div>
    </article>;
  },
};
