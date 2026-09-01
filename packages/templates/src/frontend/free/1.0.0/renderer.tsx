import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { RestrictedMarkdown } from "@pbdh/resource-renderer/react";
import type { ReactNode } from "react";

import { freeTemplate, type FreeData } from "../../../core/index.ts";

export type FreeRuntimeState = Record<string, never>;

function isFreeState(value: unknown): value is FreeRuntimeState {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

export const freeRendererStyles = `
.free-card{box-sizing:border-box;width:100%;height:100%;overflow:hidden;padding:7%;display:flex;flex-direction:column;gap:4%;background:#f5f1e8;color:#26231d;border:1px solid #b8ad99;font-family:Georgia,"Noto Serif SC",serif}
.free-card *{box-sizing:border-box}.free-header{border-bottom:1px solid #8f826d;padding-bottom:4%}.free-type{margin:0 0 2%;font:700 clamp(9px,3cqw,13px)/1.2 system-ui,sans-serif;color:#766853}.free-title{margin:0;font-size:clamp(20px,8cqw,36px);line-height:1.05}.free-content{display:flex;flex-direction:column;gap:4%;overflow:auto}.free-block h2{margin:0 0 1%;font:700 clamp(10px,3.3cqw,14px)/1.2 system-ui,sans-serif;color:#766853}.free-block p{margin:0;white-space:pre-wrap;font-size:clamp(10px,3.4cqw,15px);line-height:1.45}.free-art{min-height:36%;border:1px solid #c9bfad;background:#e7dfd0;overflow:hidden}.free-art img{width:100%;height:100%;object-fit:cover}.free-image-missing{height:100%;display:grid;place-items:center;color:#766853}.free-card.is-image .free-header,.free-card.is-image .free-content{display:none}.free-card.is-image .free-art{height:100%}.free-card.is-text .free-art{display:none}
.free-block [data-restricted-markdown]{font-size:clamp(10px,3.4cqw,15px);line-height:1.45}
`;

export const freeRendererRevision: RendererRevisionCapability<FreeData, FreeRuntimeState, ReactNode> = {
  revision: "free-card-r1",
  templateId: "自由",
  templateVersion: "1.0.0",
  requiredMediaSlots: [],
  optionalMediaSlots: ["portrait"],
  defaultState(data) {
    return freeTemplate.tabletop.defaultState(data) as FreeRuntimeState;
  },
  validateState: isFreeState,
  styles: freeRendererStyles,
  render({ data, presentation, assets }) {
    const portrait = assets.portrait;
    return <article className={`free-card is-${presentation.mode}`} data-renderer-revision="free-card-r1">
      <header className="free-header">
        <p className="free-type">{data.类型 || "自由"}</p>
        <h1 className="free-title">{data.名称 || "未命名自由资源"}</h1>
      </header>
      {(presentation.mode === "split" || presentation.mode === "image") && <div className="free-art">
        {portrait ? <img src={portrait} alt={data.名称} /> : <div className="free-image-missing" role="status">缺少主图</div>}
      </div>}
      <div className="free-content">
        {data.内容.map((block, index) => <section className="free-block" key={`${block.标题}:${index}`}>
          <h2>{block.标题}</h2><RestrictedMarkdown value={block.正文} />
        </section>)}
      </div>
    </article>;
  },
};
