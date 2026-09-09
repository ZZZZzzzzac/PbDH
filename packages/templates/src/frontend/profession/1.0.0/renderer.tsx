import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import { CardFooter, RestrictedMarkdown, SingleLineTextFit } from "@pbdh/resource-renderer/react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { professionTemplate, type ProfessionData } from "../../../core/profession/1.0.0/capability.ts";

const scale = .175;

function present(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

function ProfessionFrame({ children }: { children: (cardRef: React.RefObject<HTMLElement | null>) => ReactNode }) {
  const cardRef = useRef<HTMLElement>(null);
  const [nativeHeight, setNativeHeight] = useState(720);
  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const updateHeight = () => setNativeHeight(card.offsetHeight);
    const observer = new ResizeObserver(updateHeight);
    observer.observe(card);
    updateHeight();
    return () => observer.disconnect();
  }, []);
  return <div className="reference-card-frame is-fluid profession-card-frame" style={{ height: `${nativeHeight * scale}px` }}>{children(cardRef)}</div>;
}

function ProfessionCard({ data, mode, portrait, attribution }: {
  data: ProfessionData;
  mode: "text" | "split" | "image";
  portrait?: string;
  attribution: { artworkCredit: string; sourceLabel: string };
}) {
  const features = data.特性.filter((feature) => present(feature.特性名称) || present(feature.特性原文) || present(feature.特性描述));
  const hope = data.希望特性;
  const attributes = Object.entries(data.推荐初始属性).filter(([, score]) => present(score));
  const equipment = [data.推荐初始武器, data.推荐初始护甲].filter(present).join(" + ");
  const backgroundQuestions = data.背景问题.filter(present);
  const relationshipQuestions = data.关系问题.filter(present);
  const hasCreation = attributes.length > 0 || present(equipment);
  const cardClass = `reference-card profession-card is-${mode} is-fluid`;

  if (mode === "image") return <ProfessionFrame>{(cardRef) => <article ref={cardRef} className={cardClass} data-renderer-revision="profession-card-r2" data-template-id="职业"><div className="reference-card-art is-image-only">{portrait ? <img src={portrait} alt={data.名称 || "职业主图"} /> : <div className="reference-card-image-missing" role="status">缺少主图</div>}</div></article>}</ProfessionFrame>;

  return <ProfessionFrame>{(cardRef) => <article ref={cardRef} className={cardClass} data-renderer-revision="profession-card-r2" data-template-id="职业">
    <div className="reference-card-art">
      {mode === "split" && portrait ? <img src={portrait} alt="" /> : null}
      <header className="reference-card-header">
        <div className="profession-card-header-columns">
          <div className="profession-card-identity">
            <SingleLineTextFit className="reference-card-title" contentKey={data.名称} minFontSizePx={9} maxFontSizePx={32} cssVariable="--reference-card-title-font-size">{data.名称 || "未命名职业"}</SingleLineTextFit>
            {present(data.原文) ? <p className="reference-card-original-title">{data.原文}</p> : null}
          </div>
          <div className="profession-card-taxonomy">
            <div className="reference-card-kicker">{data.类型 || "职业"}</div>
            {data.领域.filter(present).length > 0 ? <div className="reference-card-meta">{data.领域.filter(present).map((domain) => <span key={domain}>{domain}</span>)}</div> : null}
          </div>
        </div>
      </header>
    </div>
    <div className="reference-card-body">
      {(present(hope.特性名称) || present(hope.特性原文) || present(hope.特性描述) || present(data.生命点) || present(data.闪避值)) ? <div className="profession-card-core">
        {(present(hope.特性名称) || present(hope.特性原文) || present(hope.特性描述)) ? <section className="profession-card-hope"><h2><span>{hope.特性名称 || "希望特性"}</span>{present(hope.特性原文) ? <small>{hope.特性原文}</small> : null}</h2>{present(hope.特性描述) ? <RestrictedMarkdown value={hope.特性描述} /> : null}</section> : null}
        {(present(data.生命点) || present(data.闪避值)) ? <section className="profession-card-vitals" aria-label="职业数据">
          {present(data.生命点) ? <div><b>{data.生命点}</b><span>生命</span></div> : null}
          {present(data.闪避值) ? <div><b>{data.闪避值}</b><span>闪避</span></div> : null}
        </section> : null}
      </div> : null}
      {features.length > 0 ? <section className="profession-card-features" aria-label="职业特性">
        <h2>职业特性 <small>CLASS FEATURES</small></h2>
        {features.map((feature, index) => <article className="reference-card-section" key={`${feature.特性名称}-${index}`}>
          {(present(feature.特性名称) || present(feature.特性原文)) ? <h3><span>{feature.特性名称 || "未命名特性"}</span>{present(feature.特性原文) ? <small>{feature.特性原文}</small> : null}</h3> : null}
          {present(feature.特性描述) ? <RestrictedMarkdown value={feature.特性描述} /> : null}
        </article>)}
      </section> : null}
      {present(data.简介) ? <section className="reference-card-section profession-card-description"><h2>简介</h2><RestrictedMarkdown value={data.简介} /></section> : null}
      {hasCreation ? <section className="reference-card-section profession-card-creation"><h2>创建配置</h2>
        {attributes.length > 0 ? <div className="profession-card-attributes" aria-label="推荐初始属性" style={{ "--profession-attribute-count": attributes.length } as CSSProperties}>
          <div className="profession-card-attribute-names">{attributes.map(([name], index) => <span key={`${name}-${index}`}>{name}</span>)}</div>
          <div className="profession-card-attribute-values">{attributes.map(([name, score], index) => <b key={`${name}-${index}`}>{score}</b>)}</div>
        </div> : null}
        {present(equipment) ? <div className="profession-card-equipment"><b>推荐装备</b><span>{equipment}</span></div> : null}
      </section> : null}
      {present(data.职业物品) ? <section className="reference-card-section"><h2>职业物品</h2><RestrictedMarkdown value={data.职业物品} /></section> : null}
      {backgroundQuestions.length > 0 ? <section className="reference-card-section profession-card-questions"><h2>背景问题</h2><ol>{backgroundQuestions.map((question, index) => <li key={index}>{question}</li>)}</ol></section> : null}
      {relationshipQuestions.length > 0 ? <section className="reference-card-section profession-card-questions"><h2>关系问题</h2><ol>{relationshipQuestions.map((question, index) => <li key={index}>{question}</li>)}</ol></section> : null}
    </div>
    <CardFooter attribution={attribution} />
  </article>}</ProfessionFrame>;
}

const professionBaseStyles = `
.reference-card-frame{position:relative;width:63px;overflow:hidden}.reference-card-frame.is-fluid{overflow:visible}.reference-card{box-sizing:border-box;position:absolute;inset:0 auto auto 0;width:360px;min-height:568px;transform:scale(.175);transform-origin:top left;display:flex;flex-direction:column;border:3px solid #21150f;background:#eee4d0;color:#1d1713;font-family:"Noto Sans SC",sans-serif}.reference-card *{box-sizing:border-box}.reference-card-art{position:relative;flex:none;min-height:96px;overflow:hidden;background:#251a14;border-bottom:3px solid #b88a57}.reference-card.is-text .reference-card-art{min-height:0}.reference-card-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.62}.reference-card-art:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent,#1d1310e8)}.reference-card-header{position:relative;z-index:1;padding:15px;color:#fff4df}.reference-card-title{min-width:0;margin:0;font:900 var(--reference-card-title-font-size,32px)/1.05 Georgia,"Noto Serif SC",serif}.reference-card-original-title{color:#d6bea0;font-size:11px}.reference-card-meta{display:flex;gap:8px}.reference-card-meta span{color:#e6c99f;font-size:11px}.reference-card-body{min-height:0;flex:1;display:flex;flex-direction:column}.reference-card-section{padding:10px;border:1px solid #c4a477;background:#f8f0df;font-size:15px;line-height:1.45}.reference-card-section h2{margin:0 0 6px;color:#641f1d}.reference-card-art.is-image-only{height:568px;border:0}.reference-card-art.is-image-only img{position:static;width:100%;height:100%;object-fit:cover}.reference-card-image-missing{height:100%;display:grid;place-items:center;color:#d8c4a5}
`;

export const professionRendererStyles = professionBaseStyles + `
[data-template-id="职业"].profession-card{height:auto;overflow:visible}
[data-template-id="职业"] .reference-card-art{background:#251713;border-bottom-color:#b78a4f}
[data-template-id="职业"] .profession-card-header-columns{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:16px}
[data-template-id="职业"] .profession-card-identity,[data-template-id="职业"] .profession-card-taxonomy{display:flex;flex-direction:column}
[data-template-id="职业"] .profession-card-identity{min-width:0}
[data-template-id="职业"] .profession-card-taxonomy{align-items:flex-end;gap:7px}
[data-template-id="职业"] .reference-card-kicker{min-width:0;padding:0;border:0;background:none;color:#f4dfbc;font-size:13px;letter-spacing:.08em}
[data-template-id="职业"] .reference-card-original-title{margin:5px 0 0}
[data-template-id="职业"] .profession-card-taxonomy .reference-card-meta{margin:0;justify-content:flex-end;gap:10px}
[data-template-id="职业"] .profession-card-taxonomy .reference-card-meta span{min-width:0;padding:0;border:0;background:none;color:#e6c99f;text-align:right}
[data-template-id="职业"] .reference-card-body{padding:0 11px 12px;gap:8px;flex:none;overflow:visible}
.profession-card-core{display:grid;grid-template-columns:minmax(0,1fr) 74px;gap:8px}
.profession-card-core>:only-child{grid-column:1/-1}
.profession-card-hope{padding:10px;background:#722421;color:#fff4df;border:1px solid #3d1211;box-shadow:inset 0 0 0 1px #d8a563}
.profession-card-hope h2{margin:0 0 6px;display:flex;align-items:baseline;flex-wrap:wrap;gap:7px;color:#fff4df;font:900 18px/1.2 "Noto Sans SC",sans-serif}
.profession-card-hope h2 small{color:#e6c48d;font-size:10px;letter-spacing:.04em}
.profession-card-hope [data-restricted-markdown]{font-size:15px;line-height:1.45}
.profession-card-vitals{display:grid;border:1px solid #a77e4e;background:#f4ead7}
.profession-card-vitals>div{padding:8px 3px;display:grid;place-items:center}
.profession-card-vitals>div+div{border-top:1px solid #a77e4e}
.profession-card-vitals b{color:#641f1d;font:900 27px/1 Georgia,serif}
.profession-card-vitals span{margin-top:3px;color:#725443;font:700 9px/1.1 "Noto Sans SC",sans-serif;letter-spacing:.1em}
.profession-card-features{display:grid;gap:7px}
.profession-card-features>h2{margin:0;display:flex;align-items:baseline;gap:8px;color:#641f1d;font:900 13px/1.2 "Noto Sans SC",sans-serif;letter-spacing:.1em}
.profession-card-features>h2:after{content:"";height:1px;flex:1;background:#ac8255}
.profession-card-features>h2 small{color:#80654c;font-size:9px;letter-spacing:.08em}
.profession-card-features .reference-card-section h3{display:flex;align-items:baseline;flex-wrap:wrap;gap:7px;margin:0 0 6px;color:#641f1d;font:800 18px/1.2 "Noto Sans SC",sans-serif}
.profession-card-features .reference-card-section h3 small{color:#725747;font-size:11px;letter-spacing:.035em}
[data-template-id="职业"] .reference-card-section{border-radius:0}
[data-template-id="职业"] .reference-card-section h2{font-size:16px;margin-bottom:7px}
.profession-card-attributes{overflow:hidden;border:1px solid #c5a77d;background:#efe1c8}
.profession-card-attribute-names,.profession-card-attribute-values{display:grid;grid-template-columns:repeat(var(--profession-attribute-count,6),minmax(0,1fr))}
.profession-card-attribute-names span,.profession-card-attribute-values b{min-width:0;padding:5px 2px;text-align:center;border-right:1px solid #c5a77d}
.profession-card-attribute-names span:last-child,.profession-card-attribute-values b:last-child{border-right:0}
.profession-card-attribute-names span{color:#725443;font-size:10px;font-weight:700}
.profession-card-attribute-values{border-top:1px solid #c5a77d}
.profession-card-attribute-values b{color:#641f1d;font-size:15px}
.profession-card-equipment{margin-top:7px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;padding-top:7px;border-top:1px solid #c5a77d;font-size:14px}
.profession-card-equipment b{color:#725443}
.profession-card-questions ol{margin:0;padding-left:20px}
.profession-card-questions li+li{margin-top:5px}
`;

export const professionRendererRevision: RendererRevisionCapability<ProfessionData, Record<string, string>, ReactNode> = {
  revision: "profession-card-r2",
  templateId: "职业",
  templateVersion: "1.0.0",
  requiredMediaSlots: [],
  optionalMediaSlots: ["portrait"],
  defaultState: (data) => professionTemplate.tabletop.defaultState(data),
  validateState: (value): value is Record<string, string> => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0,
  styles: professionRendererStyles,
  render({ data, presentation, assets, attribution }) {
    return <ProfessionCard data={data} mode={presentation.mode} portrait={assets.portrait} attribution={attribution ?? { artworkCredit: "", sourceLabel: "" }} />;
  },
};
