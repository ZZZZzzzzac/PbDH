import { EditorInput, EditorTextarea } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

export function ArmorAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  const field = (path: string, label: string) => (
    <EditorInput label={label} value={data[path]} onChange={(value) => onValue(path, value)} />
  );

  return <div className="template-owned-editor armor-editor">
    <style>{standardEditorStyles + `.armor-editor section{grid-template-columns:repeat(3,minmax(0,1fr))}`}</style>
    <section>{field("名称", "名称")}{field("类型", "类型")}{field("位阶", "位阶")}</section>
    <section>{field("护甲值", "护甲值")}{field("重度伤害阈值", "重度伤害阈值")}{field("严重伤害阈值", "严重伤害阈值")}</section>
    <section>
      <div className="template-editor-span-all"><EditorTextarea label="特性" value={data.描述} onChange={(value) => onValue("描述", value)} /></div>
      <div className="template-editor-span-all"><EditorTextarea label="风味描述" value={data.风味描述} onChange={(value) => onValue("风味描述", value)} /></div>
    </section>
  </div>;
}

export const armorAuthoring: TemplateAuthoringCapability = {
  templateId: "护甲",
  templateVersion: "1.0.0",
  Editor: ArmorAuthoringEditor,
};
