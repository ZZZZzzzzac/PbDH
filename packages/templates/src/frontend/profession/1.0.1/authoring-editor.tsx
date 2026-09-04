import { useState } from "react";

import { EditorInput, EditorTextarea, textValue } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

const attributeNames = ["敏捷", "力量", "灵巧", "本能", "风度", "知识"] as const;

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function listValue(value: unknown): string[] {
  return Array.isArray(value) ? value.map(textValue) : [];
}

export function ProfessionAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const features = Array.isArray(data.特性) ? data.特性 as Record<string, unknown>[] : [];
  const hope = recordValue(data.希望特性);
  const attributes = recordValue(data.推荐初始属性);
  const domains = listValue(data.领域);
  const backgroundQuestions = listValue(data.背景问题);
  const relationshipQuestions = listValue(data.关系问题);
  const emptyFeature = { 特性名称: "新特性", 特性原文: "", 特性描述: "" };
  const updateFeature = (index: number, path: string, value: string) => onValue("特性", features.map((feature, rowIndex) => rowIndex === index ? { ...feature, [path]: value } : feature));
  const updateList = (path: "领域" | "背景问题" | "关系问题", source: string[], index: number, value: string, length: number) => {
    const next = Array.from({ length }, (_, rowIndex) => source[rowIndex] ?? "");
    next[index] = value;
    onValue(path, next);
  };

  return <div className="template-owned-editor profession-editor"><style>{standardEditorStyles + `
    .profession-editor{display:flex;flex-direction:column;gap:10px}
    .profession-editor section{grid-template-columns:repeat(12,minmax(0,1fr))}
    .profession-editor .span-2{grid-column:span 2}.profession-editor .span-3{grid-column:span 3}.profession-editor .span-4{grid-column:span 4}.profession-editor .span-6{grid-column:span 6}.profession-editor .span-12{grid-column:1/-1}
    .profession-editor .profession-hope,.profession-editor .profession-features{container-type:inline-size;display:flex;flex-direction:column;gap:8px}
    .profession-hope-row{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.3fr) auto;gap:8px}.profession-hope-row>.template-editor-field:last-child{grid-column:1/-1}
    .profession-features>header{display:flex;align-items:center;justify-content:space-between}.profession-features h3{margin:0;color:#6f2024;font-size:16px}
    .profession-section-title{margin:0;color:#6f2024;font-size:16px;font-weight:700}
    .profession-feature{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.3fr) auto auto;gap:8px;padding:8px 10px;border:1px solid #d8cec0;background:#fffaf2}
    .profession-feature>.template-editor-field:nth-of-type(3){grid-column:1/-1}.profession-feature-action{height:34px;min-height:34px;align-self:end}
    .profession-feature-confirm{grid-column:1/-1;display:flex;align-items:center;justify-content:flex-end;gap:8px;color:#7c2025;font-size:13px}
    @container(max-width:520px){.profession-hope-row,.profession-feature{grid-template-columns:repeat(2,minmax(0,1fr))}.profession-feature-action{width:100%}.profession-hope-row>.template-editor-field:last-of-type,.profession-feature>.template-editor-field:nth-of-type(3){grid-column:1/-1}}
    @media(max-width:760px){.profession-editor section{grid-template-columns:repeat(2,minmax(0,1fr))}.profession-editor .span-2,.profession-editor .span-3,.profession-editor .span-4,.profession-editor .span-6{grid-column:span 1}.profession-editor .span-12{grid-column:1/-1}}
  `}</style>
    <section>
      <div className="span-4"><EditorInput label="名称" value={data.名称} onChange={(value) => onValue("名称", value)} /></div>
      <div className="span-4"><EditorInput label="原文" value={data.原文} onChange={(value) => onValue("原文", value)} /></div>
      <div className="span-4"><EditorInput label="类型" value={data.类型} onChange={(value) => onValue("类型", value)} /></div>
      <div className="span-3"><EditorInput label="领域1" value={domains[0]} onChange={(value) => updateList("领域", domains, 0, value, 2)} /></div>
      <div className="span-3"><EditorInput label="领域2" value={domains[1]} onChange={(value) => updateList("领域", domains, 1, value, 2)} /></div>
      <div className="span-3"><EditorInput label="生命" value={data.生命点} onChange={(value) => onValue("生命点", value)} /></div>
      <div className="span-3"><EditorInput label="闪避" value={data.闪避值} onChange={(value) => onValue("闪避值", value)} /></div>
    </section>
    <section className="profession-hope">
      <div className="profession-hope-row">
        <EditorInput label="特性名称" value={hope.特性名称} onChange={(value) => onValue("希望特性", { ...hope, 特性名称: value })} />
        <EditorInput label="特性原文" value={hope.特性原文} onChange={(value) => onValue("希望特性", { ...hope, 特性原文: value })} />
        <button type="button" className="profession-feature-action" onClick={() => onValue("希望特性", { 特性名称: "", 特性原文: "", 特性描述: "" })}>清空</button>
        <EditorTextarea label="希望特性描述" value={hope.特性描述} onChange={(value) => onValue("希望特性", { ...hope, 特性描述: value })} />
      </div>
    </section>
    <section className="profession-features"><header><h3>职业特性</h3><button type="button" onClick={() => onValue("特性", [...features, { ...emptyFeature }])}>＋ 新增</button></header>
      {features.map((feature, index) => <article className="profession-feature" key={index}>
        <EditorInput label="特性名称" value={feature.特性名称} onChange={(value) => updateFeature(index, "特性名称", value)} />
        <EditorInput label="特性原文" value={feature.特性原文} onChange={(value) => updateFeature(index, "特性原文", value)} />
        <button type="button" className="profession-feature-action" onClick={() => onValue("特性", features.map((item, rowIndex) => rowIndex === index ? { ...emptyFeature } : item))}>清空</button>
        <button type="button" className="profession-feature-action" onClick={() => setPendingDelete(index)}>删除</button>
        <EditorTextarea label="职业特性描述" value={feature.特性描述} onChange={(value) => updateFeature(index, "特性描述", value)} />
        {pendingDelete === index ? <div className="profession-feature-confirm"><span>确认删除“{textValue(feature.特性名称)}”？</span><button type="button" onClick={() => setPendingDelete(null)}>取消</button><button type="button" onClick={() => { onValue("特性", features.filter((_, rowIndex) => rowIndex !== index)); setPendingDelete(null); }}>确认删除</button></div> : null}
      </article>)}
    </section>
    <section>
      <div className="span-12 profession-section-title">推荐初始属性</div>
      {attributeNames.map((name) => <div className="span-2" key={name}><EditorInput label={name} value={attributes[name]} onChange={(value) => onValue("推荐初始属性", { ...attributes, [name]: value })} /></div>)}
      <div className="span-6"><EditorInput label="推荐初始武器" value={data.推荐初始武器} onChange={(value) => onValue("推荐初始武器", value)} /></div>
      <div className="span-6"><EditorInput label="推荐初始护甲" value={data.推荐初始护甲} onChange={(value) => onValue("推荐初始护甲", value)} /></div>
    </section>
    <section>
      <div className="span-12"><EditorTextarea label="简介" value={data.简介} onChange={(value) => onValue("简介", value)} /></div>
      {[0, 1, 2].map((index) => <div className="span-12" key={`background-${index}`}><EditorInput label={`背景问题${index + 1}`} value={backgroundQuestions[index]} onChange={(value) => updateList("背景问题", backgroundQuestions, index, value, 3)} /></div>)}
      {[0, 1, 2].map((index) => <div className="span-12" key={`relationship-${index}`}><EditorInput label={`关系问题${index + 1}`} value={relationshipQuestions[index]} onChange={(value) => updateList("关系问题", relationshipQuestions, index, value, 3)} /></div>)}
    </section>
  </div>;
}

export const professionAuthoring: TemplateAuthoringCapability = { templateId: "职业", templateVersion: "1.0.1", Editor: ProfessionAuthoringEditor };
