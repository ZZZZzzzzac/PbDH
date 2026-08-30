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
.reference-card{box-sizing:border-box;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;background:#eee7d9;color:#211f1b;border:1px solid #756b5a;font-family:Georgia,"Noto Serif SC",serif}.reference-card *{box-sizing:border-box}.reference-card-header{padding:7% 8% 5%;background:#263131;color:#f8f1e4;border-bottom:4px solid #a98448}.reference-card-kicker{font:700 10px/1.2 system-ui,sans-serif;letter-spacing:.14em;color:#dbc69f}.reference-card-title{margin:3% 0 0;font-size:clamp(20px,8cqw,36px);line-height:1}.reference-card-meta{margin-top:4%;display:flex;flex-wrap:wrap;gap:4px}.reference-card-meta span{padding:2px 6px;background:#ffffff1a;border:1px solid #ffffff33;font:700 9px/1.2 system-ui,sans-serif}.reference-card-art{height:34%;overflow:hidden;background:#c8bdab}.reference-card-art img{width:100%;height:100%;object-fit:cover}.reference-card-image-missing{height:100%;display:grid;place-items:center;color:#615a4e}.reference-card-body{padding:6% 8%;display:flex;min-height:0;flex:1;flex-direction:column;gap:4%;overflow:auto}.reference-card-summary,.reference-card-section p,.reference-card-flavor{margin:0;white-space:pre-wrap;font-size:clamp(10px,3.25cqw,15px);line-height:1.45}.reference-card-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(58px,1fr));border:1px solid #8b7b63}.reference-card-stat{padding:7% 4%;display:flex;flex-direction:column;align-items:center;text-align:center;border-right:1px solid #8b7b63}.reference-card-stat:last-child{border-right:0}.reference-card-stat b{font-size:clamp(15px,5.5cqw,25px)}.reference-card-stat span{font:700 9px/1.2 system-ui,sans-serif;color:#6b604f}.reference-card-section h2{margin:0 0 2%;color:#79352b;font-size:clamp(12px,4cqw,18px)}.reference-card-flavor{margin-top:auto;color:#665e52;font-style:italic}.reference-card.is-image .reference-card-header,.reference-card.is-image .reference-card-body{display:none}.reference-card.is-image .reference-card-art{height:100%}.reference-card.is-text .reference-card-art{display:none}
.reference-card-section [data-restricted-markdown]{font-size:clamp(10px,3.25cqw,15px);line-height:1.45}
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
      return <article className={`reference-card is-${presentation.mode}`} data-renderer-revision={input.revision} data-template-id={input.templateId}>
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
