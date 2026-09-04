import { EditorInput, EditorTextarea } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

export function CommunityAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  const field = (path: string, label: string) => (
    <EditorInput
      label={label}
      value={path.includes(".") ? (data.特性 as Record<string, unknown>)?.[path.split(".")[1]!] : data[path]}
      onChange={(value) => onValue(path, value)}
    />
  );

  return <div className="template-owned-editor community-editor">
    <style>{standardEditorStyles + `.community-editor section{grid-template-columns:repeat(2,minmax(0,1fr))}.community-editor .community-basics{grid-template-columns:repeat(3,minmax(0,1fr))}`}</style>
    <section className="community-basics">
      {field("名称", "名称")}{field("原文", "原文")}{field("类型", "类型")}
      <div className="template-editor-span-all"><EditorTextarea label="性格" value={data.性格} onChange={(value) => onValue("性格", value)} /></div>
      <div className="template-editor-span-all"><EditorTextarea label="简介" value={data.简介} onChange={(value) => onValue("简介", value)} /></div>
    </section>
    <section>
      {field("特性.特性名称", "特性名称")}{field("特性.特性原文", "特性原文")}
      <div className="template-editor-span-all"><EditorTextarea label="特性描述" value={(data.特性 as Record<string, unknown>)?.特性描述} onChange={(value) => onValue("特性.特性描述", value)} /></div>
    </section>
  </div>;
}

export const communityAuthoring: TemplateAuthoringCapability = {
  templateId: "社群",
  templateVersion: "1.0.1",
  Editor: CommunityAuthoringEditor,
};
