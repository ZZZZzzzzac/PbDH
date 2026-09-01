import { EditorInput, EditorTextarea } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

export function DomainAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  const field = (path: string) => (
    <EditorInput label={path} value={data[path]} onChange={(value) => onValue(path, value)} />
  );

  return <div className="template-owned-editor domain-editor">
    <style>{standardEditorStyles + `.domain-editor section{grid-template-columns:repeat(3,minmax(0,1fr))}`}</style>
    <section>{field("名称")}{field("类型")}{field("领域")}{field("等级")}{field("属性")}{field("回想")}</section>
    <section>
      <div className="template-editor-span-all"><EditorTextarea label="描述" value={data.描述} onChange={(value) => onValue("描述", value)} /></div>
      <div className="template-editor-span-all"><EditorTextarea label="风味描述" value={data.风味描述} onChange={(value) => onValue("风味描述", value)} /></div>
    </section>
  </div>;
}

export const domainAuthoring: TemplateAuthoringCapability = {
  templateId: "领域卡",
  templateVersion: "1.0.0",
  Editor: DomainAuthoringEditor,
};
