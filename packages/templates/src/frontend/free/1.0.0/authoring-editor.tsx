import { EditorInput, EditorTextarea } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

export function FreeAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  const blocks = Array.isArray(data.内容) ? data.内容 as Record<string, unknown>[] : [];
  const update = (index: number, path: string, value: string) => onValue("内容", blocks.map((item, row) => row === index ? { ...item, [path]: value } : item));
  return <div className="template-owned-editor free-editor"><style>{standardEditorStyles + `.free-editor section{grid-template-columns:repeat(2,minmax(0,1fr))}.free-block{grid-column:1/-1;display:grid;grid-template-columns:1fr 2fr auto;gap:8px}`}</style>
    <section><EditorInput label="名称" value={data.名称} onChange={(value) => onValue("名称", value)} /><EditorInput label="类型" value={data.类型} onChange={(value) => onValue("类型", value)} /></section>
    <section><header><h3>内容块</h3><button type="button" onClick={() => onValue("内容", [...blocks, { 标题: "新内容", 正文: "" }])}>＋ 新增</button></header>{blocks.map((block, index) => <article className="free-block" key={index}><EditorInput label="标题" value={block.标题} onChange={(value) => update(index, "标题", value)} /><EditorTextarea label="正文" value={block.正文} onChange={(value) => update(index, "正文", value)} /><button type="button" onClick={() => onValue("内容", blocks.filter((_, row) => row !== index))}>删除</button></article>)}</section>
  </div>;
}
export const freeAuthoring: TemplateAuthoringCapability = { templateId: "自由", templateVersion: "1.0.0", Editor: FreeAuthoringEditor };
