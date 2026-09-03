import { EditorInput, EditorTextarea } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

export function ItemAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  return <div className="template-owned-editor item-editor">
    <style>{standardEditorStyles + `.item-editor section{grid-template-columns:repeat(2,minmax(0,1fr))}`}</style>
    <section>
      <EditorInput label="名称" value={data.名称} onChange={(value) => onValue("名称", value)} />
      <EditorInput label="英文" value={data.原文} onChange={(value) => onValue("原文", value)} />
      <EditorInput label="掷骰" value={data.掷骰} onChange={(value) => onValue("掷骰", value)} />
      <EditorInput label="类型" value={data.类型} options={["物品", "消耗品"]} onChange={(value) => onValue("类型", value)} />
    </section>
    <section>
      <div className="template-editor-span-all"><EditorTextarea label="描述" value={data.描述} onChange={(value) => onValue("描述", value)} /></div>
      <div className="template-editor-span-all"><EditorTextarea label="风味描述" value={data.风味描述} onChange={(value) => onValue("风味描述", value)} /></div>
    </section>
  </div>;
}

export const itemAuthoring: TemplateAuthoringCapability = {
  templateId: "物品",
  templateVersion: "1.0.0",
  Editor: ItemAuthoringEditor,
};
