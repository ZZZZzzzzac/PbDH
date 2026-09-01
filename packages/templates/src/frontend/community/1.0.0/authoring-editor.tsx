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
    <style>{standardEditorStyles + `.community-editor section{grid-template-columns:repeat(2,minmax(0,1fr))}`}</style>
    <section>
      {field("名称", "名称")}{field("类型", "类型")}{field("性格", "性格")}
      <div className="template-editor-span-all"><EditorTextarea label="简介" value={data.简介} onChange={(value) => onValue("简介", value)} /></div>
    </section>
    <section>
      {field("特性.名称", "特性名称")}
      <div className="template-editor-span-all"><EditorTextarea label="特性描述" value={(data.特性 as Record<string, unknown>)?.描述} onChange={(value) => onValue("特性.描述", value)} /></div>
    </section>
  </div>;
}

export const communityAuthoring: TemplateAuthoringCapability = {
  templateId: "社群",
  templateVersion: "1.0.0",
  Editor: CommunityAuthoringEditor,
};
