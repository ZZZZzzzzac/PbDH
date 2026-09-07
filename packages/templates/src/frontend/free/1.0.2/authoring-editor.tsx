import { useState } from "react";

import { freeFieldEntries, freeFixedFieldNames } from "../../../core/free/1.0.2/capability.ts";
import { EditorInput, EditorTextarea, textValue } from "../../authoring-primitives.tsx";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

const emptyFeature = { 名称: "", 原文: "", 描述: "" };
const reservedFieldNames = new Set<string>(freeFixedFieldNames);

export function FreeAuthoringEditor({ data, onValue, onData }: TemplateAuthoringEditorProps) {
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const blocks = Array.isArray(data.内容) ? data.内容 as Record<string, unknown>[] : [];
  const fields = freeFieldEntries(data);
  const updateFeature = (index: number, path: string, value: string) => onValue("内容", blocks.map((item, row) => row === index ? { ...item, [path]: value } : item));
  const commitFields = (nextFields: Array<[string, string]>) => {
    if (!onData) return;
    onData({
      名称: textValue(data.名称),
      原文: textValue(data.原文),
      类型: textValue(data.类型),
      简介: textValue(data.简介),
      ...Object.fromEntries(nextFields),
      内容: blocks,
    });
  };
  const nextFieldName = () => {
    let suffix = 1;
    let candidate = "新字段";
    const existing = new Set(fields.map(([name]) => name));
    while (existing.has(candidate) || reservedFieldNames.has(candidate)) {
      suffix += 1;
      candidate = `新字段 ${suffix}`;
    }
    return candidate;
  };
  return <div className="template-owned-editor free-editor"><style>{standardEditorStyles + `.free-editor .free-basics{grid-template-columns:repeat(3,minmax(0,1fr))}.free-editor .free-fields,.free-editor .free-features{container-type:inline-size;display:flex;flex-direction:column;gap:8px}.free-editor-section-header{display:flex;align-items:center;justify-content:space-between}.free-field-row{display:grid;grid-template-columns:minmax(120px,.8fr) minmax(180px,1.5fr) auto auto;gap:8px;padding:8px 10px;border-left:3px solid #b89564;background:#fffaf2}.free-feature-row{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.3fr) auto auto;gap:8px;padding:9px 10px;border:1px solid #d8cec0;background:#fffaf2}.free-feature-description{grid-column:1/-1}.free-row-action{height:34px;min-height:34px;align-self:end}.free-feature-confirm{grid-column:1/-1;display:flex;align-items:center;justify-content:flex-end;gap:8px;color:#7c2025;font-size:13px}.free-empty-row{margin:0;padding:10px;color:#776b61;font-size:13px;text-align:center;border:1px dashed #cfc3b4;background:#fbf7f0}@container(max-width:440px){.free-field-row,.free-feature-row{grid-template-columns:repeat(2,minmax(0,1fr))}.free-row-action{width:100%}.free-feature-description{grid-column:1/-1}}@media(max-width:760px){.free-editor .free-basics{grid-template-columns:minmax(0,1fr)}}`}</style>
    <section className="free-basics"><EditorInput label="名称" value={data.名称} onChange={(value) => onValue("名称", value)} /><EditorInput label="原文" value={data.原文} onChange={(value) => onValue("原文", value)} /><EditorInput label="类型" value={data.类型} onChange={(value) => onValue("类型", value)} /><div className="template-editor-span-all"><EditorTextarea label="简介" value={data.简介} onChange={(value) => onValue("简介", value)} /></div></section>
    <section className="free-fields"><header className="free-editor-section-header"><h3>自由字段</h3><button type="button" disabled={!onData} onClick={() => commitFields([...fields, [nextFieldName(), ""]])}>＋ 新增</button></header>{fields.length ? fields.map(([name, value], index) => <article className="free-field-row" key={`${index}:${name}`}><EditorInput label="字段名" value={name} onChange={(nextName) => { if (nextName !== name && (reservedFieldNames.has(nextName) || fields.some(([fieldName], row) => row !== index && fieldName === nextName))) return; commitFields(fields.map((field, row) => row === index ? [nextName, field[1]] : field)); }} /><EditorInput label="字段值" value={value} onChange={(nextValue) => commitFields(fields.map((field, row) => row === index ? [field[0], nextValue] : field))} /><button type="button" className="free-row-action" disabled={!onData} onClick={() => commitFields(fields.map((field, row) => row === index ? [field[0], ""] : field))}>清空</button><button type="button" className="free-row-action" disabled={!onData} onClick={() => commitFields(fields.filter((_, row) => row !== index))}>删除</button></article>) : <p className="free-empty-row">暂无自由字段</p>}</section>
    <section className="free-features"><header className="free-editor-section-header"><h3>自由特性</h3><button type="button" onClick={() => onValue("内容", [...blocks, { ...emptyFeature }])}>＋ 新增</button></header>{blocks.length ? blocks.map((block, index) => <article className="free-feature-row" key={index}><EditorInput label="名称" value={block.名称} onChange={(value) => updateFeature(index, "名称", value)} /><EditorInput label="原文" value={block.原文} onChange={(value) => updateFeature(index, "原文", value)} /><button type="button" className="free-row-action" onClick={() => onValue("内容", blocks.map((item, row) => row === index ? { ...emptyFeature } : item))}>清空</button><button type="button" className="free-row-action" onClick={() => setPendingDelete(index)}>删除</button><div className="free-feature-description"><EditorTextarea label="描述" value={block.描述} onChange={(value) => updateFeature(index, "描述", value)} /></div>{pendingDelete === index ? <div className="free-feature-confirm"><span>确认删除“{textValue(block.名称)}”？</span><button type="button" onClick={() => setPendingDelete(null)}>取消</button><button type="button" onClick={() => { onValue("内容", blocks.filter((_, row) => row !== index)); setPendingDelete(null); }}>确认删除</button></div> : null}</article>) : <p className="free-empty-row">暂无自由特性</p>}</section>
  </div>;
}
export const freeAuthoring: TemplateAuthoringCapability = { templateId: "自由", templateVersion: "1.0.2", Editor: FreeAuthoringEditor };
