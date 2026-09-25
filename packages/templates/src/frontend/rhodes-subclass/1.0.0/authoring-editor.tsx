import { ArrayItemActions, moveArrayItem, EditorInput, EditorTextarea } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

const rhodesLevelOptions = ["预备", "正式", "资深", "精英X", "精英Y"];
const rhodesStageOptions = ["T1", "T2", "T3", "T4X", "T4Y"];
const rhodesOverrideFields = ["子职提升", "子职特性", "职业特性", "希望特性"];

export function RhodesSubclassAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  const features = Array.isArray(data.特性) ? data.特性 as Record<string, unknown>[] : [];
  const emptyFeature = { 特性名称: "新特性", 特性原文: "", 特性描述: "" };
  const field = (path: string, options?: readonly string[]) => (
    <EditorInput label={path} value={data[path]} options={options} onChange={(value) => onValue(path, value)} />
  );
  const updateFeature = (index: number, path: string, value: string) => onValue("特性", features.map((feature, rowIndex) => rowIndex === index ? { ...feature, [path]: value } : feature));

  return <div className="template-owned-editor rhodes-subclass-editor">
    <style>{standardEditorStyles + `.rhodes-subclass-editor .rhodes-subclass-basics{grid-template-columns:repeat(3,minmax(0,1fr))}.rhodes-subclass-editor .rhodes-subclass-overrides{grid-template-columns:repeat(2,minmax(0,1fr))}.rhodes-subclass-editor .rhodes-subclass-features{container-type:inline-size;display:flex;flex-direction:column;gap:8px}.rhodes-subclass-features h3{margin:0;color:#6f2024;font-size:16px}.rhodes-subclass-feature{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.3fr) auto;gap:8px;padding:8px 10px;border:1px solid #d8cec0;background:#fffaf2}.rhodes-subclass-feature>.template-editor-field:nth-of-type(3){grid-column:1/-1}@container(max-width:520px){.rhodes-subclass-feature{grid-template-columns:repeat(2,minmax(0,1fr))}.rhodes-subclass-feature>.template-editor-field:nth-of-type(3){grid-column:1/-1}}@media(max-width:760px){.rhodes-subclass-editor .rhodes-subclass-basics,.rhodes-subclass-editor .rhodes-subclass-overrides{grid-template-columns:minmax(0,1fr)}}`}</style>
    <section className="rhodes-subclass-basics">{field("名称")}{field("原文")}{field("类型")}{field("主职")}{field("等级", rhodesLevelOptions)}{field("阶段", rhodesStageOptions)}{field("施法属性")}{field("推荐次领域")}{field("武器原型")}</section>
    <section className="rhodes-subclass-overrides">{rhodesOverrideFields.map((path) => <EditorTextarea key={path} label={path} value={data[path]} onChange={(value) => onValue(path, value)} />)}</section>
    <section className="rhodes-subclass-features"><header><h3>特性</h3><button type="button" onClick={() => onValue("特性", [...features, { ...emptyFeature }])}>＋ 新增</button></header>
      {features.map((feature, index) => <article className="rhodes-subclass-feature" key={index}>
        <EditorInput label="特性名称" value={feature.特性名称} onChange={(value) => updateFeature(index, "特性名称", value)} />
        <EditorInput label="特性原文" value={feature.特性原文} onChange={(value) => updateFeature(index, "特性原文", value)} />
        <ArrayItemActions item={feature} index={index} count={features.length} onClear={() => onValue("特性", features.map((item, rowIndex) => rowIndex === index ? { ...emptyFeature } : item))} onDelete={() => onValue("特性", features.filter((_, row) => row !== index))} onMove={(offset) => onValue("特性", moveArrayItem(features, index, offset))} />
        <EditorTextarea label="特性描述" value={feature.特性描述} onChange={(value) => updateFeature(index, "特性描述", value)} />

      </article>)}
    </section>
    <section className="template-editor-span-all"><EditorTextarea label="简介" value={data.简介} onChange={(value) => onValue("简介", value)} /></section>
  </div>;
}

export const rhodesSubclassAuthoring: TemplateAuthoringCapability = {
  templateId: "罗德岛子职",
  templateVersion: "1.0.0",
  replacements: "after",
  Editor: RhodesSubclassAuthoringEditor,
};
