import { useState } from "react";

import { EditorInput, EditorTextarea, textValue } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

export function SubclassAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const features = Array.isArray(data.特性) ? data.特性 as Record<string, unknown>[] : [];
  const emptyFeature = { 特性名称: "新特性", 特性原文: "", 特性描述: "" };
  const field = (path: string, options?: readonly string[]) => (
    <EditorInput label={path} value={data[path]} options={options} onChange={(value) => onValue(path, value)} />
  );
  const updateFeature = (index: number, path: string, value: string) => onValue("特性", features.map((feature, rowIndex) => rowIndex === index ? { ...feature, [path]: value } : feature));

  return <div className="template-owned-editor subclass-editor">
    <style>{standardEditorStyles + `.subclass-editor .subclass-basics{grid-template-columns:repeat(3,minmax(0,1fr))}.subclass-editor .subclass-features{container-type:inline-size;display:flex;flex-direction:column;gap:8px}.subclass-features>header{display:flex;align-items:center;justify-content:space-between}.subclass-features h3{margin:0;color:#6f2024;font-size:16px}.subclass-feature{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.3fr) auto auto;gap:8px;padding:8px 10px;border:1px solid #d8cec0;background:#fffaf2}.subclass-feature>.template-editor-field:nth-of-type(3){grid-column:1/-1}.subclass-feature-action{height:34px;min-height:34px;align-self:end}.subclass-feature-confirm{grid-column:1/-1;display:flex;align-items:center;justify-content:flex-end;gap:8px;color:#7c2025;font-size:13px}@container(max-width:520px){.subclass-feature{grid-template-columns:repeat(2,minmax(0,1fr))}.subclass-feature-action{width:100%}.subclass-feature>.template-editor-field:nth-of-type(3){grid-column:1/-1}}@media(max-width:760px){.subclass-editor .subclass-basics{grid-template-columns:minmax(0,1fr)}}`}</style>
    <section className="subclass-basics">{field("名称")}<EditorInput label="原文" value={data.原文} onChange={(value) => onValue("原文", value)} />{field("类型")}{field("主职")}{field("等级", ["基础", "进阶", "精通"])}{field("施法属性")}</section>
    <section className="subclass-features"><header><h3>特性</h3><button type="button" onClick={() => onValue("特性", [...features, { ...emptyFeature }])}>＋ 新增</button></header>
      {features.map((feature, index) => <article className="subclass-feature" key={index}>
        <EditorInput label="特性名称" value={feature.特性名称} onChange={(value) => updateFeature(index, "特性名称", value)} />
        <EditorInput label="特性原文" value={feature.特性原文} onChange={(value) => updateFeature(index, "特性原文", value)} />
        <button type="button" className="subclass-feature-action" onClick={() => onValue("特性", features.map((item, rowIndex) => rowIndex === index ? { ...emptyFeature } : item))}>清空</button>
        <button type="button" className="subclass-feature-action" onClick={() => setPendingDelete(index)}>删除</button>
        <EditorTextarea label="特性描述" value={feature.特性描述} onChange={(value) => updateFeature(index, "特性描述", value)} />
        {pendingDelete === index ? <div className="subclass-feature-confirm"><span>确认删除“{textValue(feature.特性名称)}”？</span><button type="button" onClick={() => setPendingDelete(null)}>取消</button><button type="button" onClick={() => { onValue("特性", features.filter((_, rowIndex) => rowIndex !== index)); setPendingDelete(null); }}>确认删除</button></div> : null}
      </article>)}
    </section>
    <section>
      <div className="template-editor-span-all"><EditorTextarea label="简介" value={data.简介} onChange={(value) => onValue("简介", value)} /></div>
    </section>
  </div>;
}

export const subclassAuthoring: TemplateAuthoringCapability = {
  templateId: "子职业",
  templateVersion: "1.0.0",
  Editor: SubclassAuthoringEditor,
};
