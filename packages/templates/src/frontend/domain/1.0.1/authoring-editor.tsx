import { EditorInput, EditorTextarea } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

export function DomainAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  const field = (path: string) => (
    <EditorInput label={path} value={data[path]} onChange={(value) => onValue(path, value)} />
  );

  return <div className="template-owned-editor domain-editor">
    <style>{standardEditorStyles + `.domain-editor section{grid-template-columns:repeat(12,minmax(0,1fr))}.domain-editor-basics>*{grid-column:span 4}.domain-editor-rules>*{grid-column:span 3}@media(max-width:760px){.domain-editor section{grid-template-columns:minmax(0,1fr)}.domain-editor section>*{grid-column:1!important}}`}</style>
    <section className="domain-editor-basics">{field("名称")}<EditorInput label="原文" value={data.原文} onChange={(value) => onValue("原文", value)} />{field("类型")}</section>
    <section className="domain-editor-rules">{field("领域")}{field("等级")}<EditorInput label="属性" value={data.属性} options={["法术", "能力", "术典"]} onChange={(value) => onValue("属性", value)} />{field("回想")}</section>
    <section>
      <div className="template-editor-span-all"><EditorTextarea label="特性描述" value={data.特性描述} onChange={(value) => onValue("特性描述", value)} /></div>
      <div className="template-editor-span-all"><EditorTextarea label="简介" value={data.简介} onChange={(value) => onValue("简介", value)} /></div>
    </section>
  </div>;
}

export const domainAuthoring: TemplateAuthoringCapability = {
  templateId: "领域卡",
  templateVersion: "1.0.1",
  Editor: DomainAuthoringEditor,
};
