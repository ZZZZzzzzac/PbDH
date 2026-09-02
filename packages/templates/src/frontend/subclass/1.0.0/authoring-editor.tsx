import { EditorInput, EditorTextarea } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

export function SubclassAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  const field = (path: string, options?: readonly string[]) => (
    <EditorInput label={path} value={data[path]} options={options} onChange={(value) => onValue(path, value)} />
  );

  return <div className="template-owned-editor subclass-editor">
    <style>{standardEditorStyles + `.subclass-editor section{grid-template-columns:repeat(3,minmax(0,1fr))}`}</style>
    <section>{field("名称")}<EditorInput label="英文" value={data.原文} onChange={(value) => onValue("原文", value)} />{field("类型")}{field("主职")}{field("等级", ["基础", "进阶", "精通"])}{field("施法属性")}</section>
    <section>
      <div className="template-editor-span-all"><EditorTextarea label="描述" value={data.描述} onChange={(value) => onValue("描述", value)} /></div>
      <div className="template-editor-span-all"><EditorTextarea label="风味描述" value={data.风味描述} onChange={(value) => onValue("风味描述", value)} /></div>
    </section>
  </div>;
}

export const subclassAuthoring: TemplateAuthoringCapability = {
  templateId: "子职业",
  templateVersion: "1.0.0",
  Editor: SubclassAuthoringEditor,
};
