import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { RestrictedMarkdown } from "@pbdh/resource-renderer/react";
import type { ReactNode } from "react";

import { freeTemplate, type FreeData } from "../../../core/index.ts";

export type FreeRuntimeState = Record<string, never>;

function isFreeState(value: unknown): value is FreeRuntimeState {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

export const freeRendererStyles = `
.free-card{--ink:#1d1713;--bone:#eee4d0;--oxblood:#641f1d;box-sizing:border-box;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;background:var(--bone);color:var(--ink);border:1px solid #21150f;font-family:"Noto Sans SC",sans-serif}.free-card *{box-sizing:border-box}.free-card.is-fluid{height:auto;min-height:100%;overflow:visible}.free-header{padding:7% 8% 6%;background:#251a14;color:#fff4df;border-bottom:3px solid #b88a57}.free-type{margin:0 0 2%;color:#f4dfbc;font:650 clamp(9px,3cqw,13px)/1.2 "Noto Sans SC",sans-serif;letter-spacing:.1em}.free-title{margin:0;overflow:hidden;font:800 clamp(20px,8cqw,36px)/1 "Noto Sans SC",sans-serif;text-overflow:ellipsis;white-space:nowrap}.free-content{padding:6% 7%;display:flex;min-height:0;flex:1;flex-direction:column;gap:4%;overflow:auto}.free-block{padding:4%;background:#f7ebd6;border:1px solid #d4b78d;border-radius:4px}.free-block h2{display:flex;align-items:center;gap:8px;margin:0 0 2%;color:var(--oxblood);font:800 clamp(11px,3.6cqw,16px)/1.2 "Noto Sans SC",sans-serif}.free-block h2::after{content:"";flex:1;height:1px;background:#b88a57}.free-block p{margin:0;white-space:pre-wrap;font:450 clamp(10px,3.4cqw,15px)/1.42 "Noto Sans SC",sans-serif}.free-art{height:34%;flex:none;background:#251a14;overflow:hidden}.free-art img{width:100%;height:100%;display:block;object-fit:cover}.free-image-missing{height:100%;display:grid;place-items:center;color:#f4dfbc;font:650 11px/1.3 "Noto Sans SC",sans-serif}.free-card.is-image .free-header,.free-card.is-image .free-content{display:none}.free-card.is-image .free-art{height:100%}.free-card.is-image.is-fluid .free-art,.free-card.is-image.is-fluid .free-art img{height:auto}.free-card.is-text .free-art{display:none}
.free-block [data-restricted-markdown]{font:450 clamp(10px,3.4cqw,15px)/1.42 "Noto Sans SC",sans-serif}
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
    return <article className={["free-card", `is-${presentation.mode}`, presentation.fixedRatio ? "" : "is-fluid"].filter(Boolean).join(" ")} data-renderer-revision="free-card-r1">
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
