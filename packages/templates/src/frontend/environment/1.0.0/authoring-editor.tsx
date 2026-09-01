import { EditorInput, EditorTextarea } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

export function EnvironmentAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  const features = Array.isArray(data.特性) ? data.特性 as Record<string, unknown>[] : [];
  const update = (index: number, path: string, value: string) => onValue("特性", features.map((item, row) => row === index ? { ...item, [path]: value } : item));
  const field = (path: string) => <EditorInput label={path} value={data[path]} onChange={(value) => onValue(path, value)} />;
  return <div className="template-owned-editor environment-editor"><style>{standardEditorStyles + `.environment-editor .identity{grid-template-columns:repeat(3,minmax(0,1fr))}.environment-editor .setting{grid-template-columns:repeat(2,minmax(0,1fr))}.environment-feature{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.environment-feature .wide{grid-column:span 3}`}</style>
    <section className="identity">{field("名称")}{field("类型")}{field("原文")}{field("位阶")}{field("种类")}</section>
    <section className="setting"><div className="template-editor-span-all"><EditorTextarea label="简介" value={data.简介} onChange={(value) => onValue("简介", value)} /></div><div className="template-editor-span-all"><EditorTextarea label="趋向" value={data.趋向} onChange={(value) => onValue("趋向", value)} /></div>{field("难度")}<EditorTextarea label="潜在敌人" value={data.潜在敌人} onChange={(value) => onValue("潜在敌人", value)} /></section>
    <section><header><h3>特性</h3><button type="button" onClick={() => onValue("特性", [...features, { 名称: "新特性", 原名: "", 类型: "", 描述: "", 引导问题: "" }])}>＋ 新增</button></header>{features.map((feature, index) => <article className="environment-feature" key={index}><EditorInput label="名称" value={feature.名称} onChange={(value) => update(index, "名称", value)} /><EditorInput label="原名" value={feature.原名} onChange={(value) => update(index, "原名", value)} /><EditorInput label="类型" value={feature.类型} onChange={(value) => update(index, "类型", value)} /><div className="wide"><EditorTextarea label="描述" value={feature.描述} onChange={(value) => update(index, "描述", value)} /></div><div className="wide"><EditorTextarea label="引导问题" value={feature.引导问题} onChange={(value) => update(index, "引导问题", value)} /></div><button type="button" onClick={() => onValue("特性", features.filter((_, row) => row !== index))}>删除</button></article>)}</section>
  </div>;
}
export const environmentAuthoring: TemplateAuthoringCapability = { templateId: "环境", templateVersion: "1.0.0", Editor: EnvironmentAuthoringEditor };
