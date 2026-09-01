import { useState } from "react";

import { EditorInput, EditorTextarea, textValue } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

export function FreeAuthoringEditor({ data, onValue }: TemplateAuthoringEditorProps) {
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const blocks = Array.isArray(data.内容) ? data.内容 as Record<string, unknown>[] : [];
  const update = (index: number, path: string, value: string) => onValue("内容", blocks.map((item, row) => row === index ? { ...item, [path]: value } : item));
  return <div className="template-owned-editor free-editor"><style>{standardEditorStyles + `.free-editor section{grid-template-columns:repeat(2,minmax(0,1fr))}.free-block{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;padding:8px 10px;border:1px solid #d8cec0;background:#fffaf2}.free-block>.template-editor-field:nth-of-type(2){grid-column:1/-1}.free-block-action{height:34px;min-height:34px;align-self:end}.free-block-confirm{grid-column:1/-1;display:flex;align-items:center;justify-content:flex-end;gap:8px;color:#7c2025;font-size:13px}@media(max-width:760px){.free-block{grid-template-columns:minmax(0,1fr)}.free-block>.template-editor-field:nth-of-type(2){grid-column:1}.free-block-action{width:100%}}`}</style>
    <section><EditorInput label="名称" value={data.名称} onChange={(value) => onValue("名称", value)} /><EditorInput label="类型" value={data.类型} onChange={(value) => onValue("类型", value)} /></section>
    <section><header><h3>内容块</h3><button type="button" onClick={() => onValue("内容", [...blocks, { 标题: "新内容", 正文: "" }])}>＋ 新增</button></header>{blocks.map((block, index) => <article className="free-block" key={index}><EditorInput label="标题" value={block.标题} onChange={(value) => update(index, "标题", value)} /><button type="button" className="free-block-action" onClick={() => onValue("内容", blocks.map((item, row) => row === index ? { 标题: "新内容", 正文: "" } : item))}>清空</button><button type="button" className="free-block-action" onClick={() => setPendingDelete(index)}>删除</button><EditorTextarea label="正文" value={block.正文} onChange={(value) => update(index, "正文", value)} />{pendingDelete === index ? <div className="free-block-confirm"><span>确认删除“{textValue(block.标题)}”？</span><button type="button" onClick={() => setPendingDelete(null)}>取消</button><button type="button" onClick={() => { onValue("内容", blocks.filter((_, row) => row !== index)); setPendingDelete(null); }}>确认删除</button></div> : null}</article>)}</section>
  </div>;
}
export const freeAuthoring: TemplateAuthoringCapability = { templateId: "自由", templateVersion: "1.0.0", Editor: FreeAuthoringEditor };
