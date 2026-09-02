import { EditorInput, EditorTextarea } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

export function WeaponAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  const field = (path: string) => (
    <EditorInput label={path} value={data[path]} onChange={(value) => onValue(path, value)} />
  );

  return <div className="template-owned-editor weapon-editor">
    <style>{standardEditorStyles + `.weapon-editor .identity{grid-template-columns:repeat(2,minmax(0,1fr))}.weapon-editor .combat{grid-template-columns:repeat(3,minmax(0,1fr))}`}</style>
    <section className="identity">
      {field("名称")}<EditorInput label="英文" value={data.原文} onChange={(value) => onValue("原文", value)} />{field("类型")}{field("位阶")}
      <div className="template-editor-span-all"><EditorTextarea label="风味描述" value={data.风味描述} onChange={(value) => onValue("风味描述", value)} /></div>
    </section>
    <section className="combat">{field("属性")}{field("距离")}{field("伤害")}{field("伤害类型")}{field("负荷")}</section>
    <section>{field("特性名")}<EditorInput label="英文" value={data.特性原名} onChange={(value) => onValue("特性原名", value)} /><div className="template-editor-span-all"><EditorTextarea label="特性描述" value={data.特性描述} onChange={(value) => onValue("特性描述", value)} /></div></section>
  </div>;
}

export const weaponAuthoring: TemplateAuthoringCapability = {
  templateId: "武器",
  templateVersion: "1.0.0",
  Editor: WeaponAuthoringEditor,
};
