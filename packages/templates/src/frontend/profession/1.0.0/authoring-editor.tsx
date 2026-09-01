import { EditorInput, EditorTextarea, linesValue, parseLines, parseSingleEntryMapLines, singleEntryMapLines } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

export function ProfessionAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  const input = (path: string) => <EditorInput label={path} value={data[path]} onChange={(value) => onValue(path, value)} />;
  const text = (path: string) => <div className="template-editor-span-all"><EditorTextarea label={path} value={data[path]} onChange={(value) => onValue(path, value)} /></div>;
  const lines = (path: string) => <div className="template-editor-span-all"><EditorTextarea label={path} value={linesValue(data[path])} onChange={(value) => onValue(path, parseLines(value))} /></div>;
  return <div className="template-owned-editor profession-editor"><style>{standardEditorStyles + `.profession-editor section{grid-template-columns:repeat(2,minmax(0,1fr))}`}</style>
    <section>{input("名称")}{input("类型")}{text("描述")}{lines("领域")}{input("施法属性")}</section>
    <section>{input("生命点")}{input("闪避值")}{text("职业物品")}{text("希望特性")}{text("职业特性")}</section>
    <section><div className="template-editor-span-all"><EditorTextarea label="推荐初始属性" value={singleEntryMapLines(data.推荐初始属性)} onChange={(value) => onValue("推荐初始属性", parseSingleEntryMapLines(value))} /></div>{lines("推荐初始武器")}{text("推荐初始护甲")}</section>
    <section>{lines("背景问题")}{lines("关系问题")}</section>
  </div>;
}
export const professionAuthoring: TemplateAuthoringCapability = { templateId: "职业", templateVersion: "1.0.0", Editor: ProfessionAuthoringEditor };
