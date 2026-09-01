import { authoringControlStyles, EditorInput, EditorTextarea } from "../../authoring-primitives.tsx";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

const styles = `${authoringControlStyles}
.ancestry-editor{min-width:0;display:flex;flex-direction:column;gap:9px;padding:12px 14px;background:#f1ece4;color:#3b302a;font-family:system-ui,sans-serif}.ancestry-editor-group{min-width:0;display:grid;gap:8px;padding:10px;border:1px solid #d8cec0;border-radius:6px;background:#f8f4ed}.ancestry-identity{grid-template-columns:repeat(3,minmax(0,1fr))}.ancestry-identity>.template-editor-field:last-child{grid-column:1/-1}.ancestry-features{display:flex;flex-direction:column;gap:8px}.ancestry-features>h3{margin:0;color:#6f2024;font-size:16px}.ancestry-editor button{min-height:30px;padding:0 12px;border:1px solid #c9c1b6;border-radius:4px;color:#5f2024;background:#fffdf8;font-weight:700}.ancestry-feature{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:8px;padding:8px 10px;border:1px solid #d8cec0;background:#fffaf2}.ancestry-feature>.template-editor-field:nth-of-type(3){grid-column:1/-1}.ancestry-feature-action{height:34px;min-height:34px;align-self:end}@media(max-width:760px){.ancestry-identity,.ancestry-feature{grid-template-columns:minmax(0,1fr)}.ancestry-identity>.template-editor-field:last-child,.ancestry-feature>.template-editor-field:nth-of-type(3){grid-column:1}.ancestry-feature-action{width:100%}}
`;

const emptyFeature = { 名称: "新特性", 原名: "", 描述: "" };

export function AncestryAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  const sourceFeatures = Array.isArray(data.特性) ? data.特性 as Record<string, unknown>[] : [];
  const features = Array.from({ length: 2 }, (_, index) => sourceFeatures[index] ?? { ...emptyFeature });
  const updateFeature = (index: number, path: string, value: string) => onValue("特性", features.map((item, rowIndex) => rowIndex === index ? { ...item, [path]: value } : item));

  return <div className="ancestry-editor"><style>{styles}</style>
    <section className="ancestry-editor-group ancestry-identity" data-authoring-section="identity">
      <EditorInput label="名称" value={data.名称} onChange={(value) => onValue("名称", value)} />
      <EditorInput label="英文" value={data.原文} onChange={(value) => onValue("原文", value)} />
      <EditorInput label="类型" value={data.类型} onChange={(value) => onValue("类型", value)} />
      <EditorTextarea label="简介" value={data.简介} onChange={(value) => onValue("简介", value)} />
    </section>
    <section className="ancestry-editor-group ancestry-features" data-authoring-section="features"><h3>种族特性</h3>
      {features.map((feature, index) => <article className="ancestry-feature" key={index}>
        <EditorInput label={`特性${index + 1}`} value={feature.名称} onChange={(value) => updateFeature(index, "名称", value)} />
        <EditorInput label="英文" value={feature.原名} onChange={(value) => updateFeature(index, "原名", value)} />
        <button type="button" className="ancestry-feature-action" onClick={() => onValue("特性", features.map((item, rowIndex) => rowIndex === index ? { ...emptyFeature } : item))}>清空</button>
        <EditorTextarea label="描述" value={feature.描述} onChange={(value) => updateFeature(index, "描述", value)} />
      </article>)}
    </section>
  </div>;
}

export const ancestryAuthoring: TemplateAuthoringCapability = {
  templateId: "种族",
  templateVersion: "1.0.0",
  Editor: AncestryAuthoringEditor,
};
