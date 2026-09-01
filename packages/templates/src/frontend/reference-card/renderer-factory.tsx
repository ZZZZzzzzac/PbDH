import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { RestrictedMarkdown } from "@pbdh/resource-renderer/react";
import type { ReactNode } from "react";

export type ReferenceCardModel = {
  title: string;
  kicker: string;
  meta?: readonly string[];
  stats?: readonly { label: string; value: string }[];
  summary?: string;
  sections?: readonly { title: string; body: string }[];
  flavor?: string;
};

export type EmptyRuntimeState = Record<string, string>;

function isEmptyState(value: unknown): value is EmptyRuntimeState {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

export const referenceCardStyles = `
.reference-card{--ink:#1d1713;--bone:#eee4d0;--oxblood:#641f1d;box-sizing:border-box;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;background:var(--bone);color:var(--ink);border:1px solid #21150f;font-family:"Noto Sans SC",sans-serif}.reference-card *{box-sizing:border-box}.reference-card.is-fluid{height:auto;min-height:100%;overflow:visible}.reference-card-header{padding:7% 8% 6%;background:#251a14;color:#fff4df;border-bottom:3px solid #b88a57}.reference-card-kicker{font:650 10px/1.2 "Noto Sans SC",sans-serif;letter-spacing:.12em;color:#f4dfbc}.reference-card-title{margin:3% 0 0;overflow:hidden;font:800 clamp(20px,8cqw,36px)/1 "Noto Sans SC",sans-serif;text-overflow:ellipsis;white-space:nowrap}.reference-card-meta{margin-top:4%;display:flex;flex-wrap:wrap;gap:4px}.reference-card-meta span{padding:2px 6px;background:#f4dfbc17;border:1px solid #f4dfbc52;color:#e6c99f;font:650 9px/1.2 "Noto Sans SC",sans-serif}.reference-card-art{height:34%;overflow:hidden;background:#251a14}.reference-card-art img{width:100%;height:100%;display:block;object-fit:cover}.reference-card-image-missing{height:100%;display:grid;place-items:center;color:#f4dfbc;font:650 11px/1.3 "Noto Sans SC",sans-serif}.reference-card-body{padding:6% 7%;display:flex;min-height:0;flex:1;flex-direction:column;gap:4%;overflow:auto}.reference-card-summary,.reference-card-section p,.reference-card-flavor{margin:0;white-space:pre-wrap;font:450 clamp(10px,3.25cqw,15px)/1.42 "Noto Sans SC",sans-serif}.reference-card-summary{padding:4%;background:#f7ebd6;border:1px solid #d4b78d;border-radius:4px;color:#5e4637;font-style:italic}.reference-card-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(58px,1fr));border:1px solid #ad8b68;background:#f7ebd6}.reference-card-stat{padding:7% 4%;display:flex;flex-direction:column;align-items:center;text-align:center;border-right:1px solid #ad8b68}.reference-card-stat:last-child{border-right:0}.reference-card-stat b{color:var(--oxblood);font:800 clamp(15px,5.5cqw,25px)/1.15 "Noto Sans SC",sans-serif}.reference-card-stat span{font:650 9px/1.2 "Noto Sans SC",sans-serif;color:#725443}.reference-card-section{padding:4%;background:#f7ebd6;border:1px solid #d4b78d;border-radius:4px}.reference-card-section h2{display:flex;align-items:center;gap:8px;margin:0 0 2%;color:var(--oxblood);font:800 clamp(12px,4cqw,18px)/1.2 "Noto Sans SC",sans-serif}.reference-card-section h2::after{content:"";flex:1;height:1px;background:#b88a57}.reference-card-flavor{margin-top:auto;color:#725443;font-style:italic}.reference-card.is-image .reference-card-header,.reference-card.is-image .reference-card-body{display:none}.reference-card.is-image .reference-card-art{height:100%}.reference-card.is-image.is-fluid .reference-card-art,.reference-card.is-image.is-fluid .reference-card-art img{height:auto}.reference-card.is-text .reference-card-art{display:none}
.reference-card-section [data-restricted-markdown]{font:450 clamp(10px,3.25cqw,15px)/1.42 "Noto Sans SC",sans-serif}
`;

export function createReferenceCardRenderer<TData extends Record<string, unknown>>(input: {
  revision: string;
  templateId: string;
  templateVersion: string;
  defaultState: (data: TData) => EmptyRuntimeState;
  model: (data: TData) => ReferenceCardModel;
}): RendererRevisionCapability<TData, EmptyRuntimeState, ReactNode> {
  return {
    revision: input.revision,
    templateId: input.templateId,
    templateVersion: input.templateVersion,
    requiredMediaSlots: [],
    optionalMediaSlots: ["portrait"],
    defaultState: input.defaultState,
    validateState: isEmptyState,
    styles: referenceCardStyles,
    render({ data, presentation, assets }) {
      const model = input.model(data);
      const portrait = assets.portrait;
      return <article className={["reference-card", `is-${presentation.mode}`, presentation.fixedRatio ? "" : "is-fluid"].filter(Boolean).join(" ")} data-renderer-revision={input.revision} data-template-id={input.templateId}>
        <header className="reference-card-header">
          <div className="reference-card-kicker">{model.kicker}</div>
          <h1 className="reference-card-title">{model.title}</h1>
          {model.meta?.length ? <div className="reference-card-meta">{model.meta.filter(Boolean).map((item) => <span key={item}>{item}</span>)}</div> : null}
        </header>
        {(presentation.mode === "split" || presentation.mode === "image") && <div className="reference-card-art">
          {portrait ? <img src={portrait} alt={model.title} /> : <div className="reference-card-image-missing" role="status">缺少主图</div>}
        </div>}
        <div className="reference-card-body">
          {model.summary && <RestrictedMarkdown className="reference-card-summary" value={model.summary} />}
          {model.stats?.length ? <section className="reference-card-stats" aria-label={`${model.kicker}数据`}>{model.stats.filter((item) => item.value).map((item) => <div className="reference-card-stat" key={item.label}><b>{item.value}</b><span>{item.label}</span></div>)}</section> : null}
          {model.sections?.filter((section) => section.body).map((section) => <section className="reference-card-section" key={section.title}><h2>{section.title}</h2><RestrictedMarkdown value={section.body} /></section>)}
          {model.flavor && <RestrictedMarkdown className="reference-card-flavor" value={model.flavor} />}
        </div>
      </article>;
    },
  };
}
