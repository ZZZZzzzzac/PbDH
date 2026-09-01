import { EditorInput, EditorTextarea } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

export function AncestryAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  const features = Array.isArray(data.特性) ? data.特性 as Record<string, unknown>[] : [];
  const update = (index: number, path: string, value: string) => onValue("特性", features.map((item, row) => row === index ? { ...item, [path]: value } : item));
  return <div className="template-owned-editor ancestry-editor"><style>{standardEditorStyles + `.ancestry-editor section{grid-template-columns:repeat(2,minmax(0,1fr))}.ancestry-feature{grid-column:1/-1;display:grid;grid-template-columns:1fr 2fr;gap:8px}`}</style>
    <section><EditorInput label="名称" value={data.名称} onChange={(value) => onValue("名称", value)} /><EditorInput label="类型" value={data.类型} onChange={(value) => onValue("类型", value)} /><div className="template-editor-span-all"><EditorTextarea label="简介" value={data.简介} onChange={(value) => onValue("简介", value)} /></div></section>
    <section><header><h3>种族特性</h3><button type="button" onClick={() => onValue("特性", [...features, { 名称: "新特性", 描述: "" }])}>＋ 新增</button></header>{features.map((feature, index) => <article className="ancestry-feature" key={index}><EditorInput label="名称" value={feature.名称} onChange={(value) => update(index, "名称", value)} /><EditorTextarea label="描述" value={feature.描述} onChange={(value) => update(index, "描述", value)} /><button type="button" onClick={() => onValue("特性", features.filter((_, row) => row !== index))}>删除</button></article>)}</section>
  </div>;
}
export const ancestryAuthoring: TemplateAuthoringCapability = { templateId: "种族", templateVersion: "1.0.0", Editor: AncestryAuthoringEditor };
