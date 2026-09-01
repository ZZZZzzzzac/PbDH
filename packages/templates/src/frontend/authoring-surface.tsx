import { useId, useState, type CSSProperties } from "react";

import type {
  AuthoringField,
  AuthoringRepeat,
  TemplateAuthoringCapability,
} from "./types.ts";

const authoringStyles = `
.pbdh-authoring{min-width:0;display:flex;flex-direction:column;gap:10px;padding:12px 14px;background:var(--creator-editor,#f1ece4);color:#3b302a;font-family:system-ui,sans-serif}
.pbdh-authoring-section{width:100%;display:grid;gap:8px 12px;padding:10px;border:1px solid var(--creator-group-border,#d8cec0);border-radius:var(--creator-group-radius,6px);background:var(--creator-group-bg,#f8f4ed)}
.pbdh-authoring-section-title{grid-column:1/-1;margin:0;color:#6f2024;font-size:15px}
.pbdh-authoring-field{min-width:0;min-height:34px;display:flex;align-items:center;gap:8px}
.pbdh-authoring-field>label,.pbdh-authoring-field>span{flex:none;font-size:14px;font-weight:700}
.pbdh-authoring-control{position:relative;min-width:0;display:flex;flex:1 1 0}
.pbdh-authoring-field input,.pbdh-authoring-field textarea{box-sizing:border-box;min-width:0;width:100%;height:32px;padding:0 9px;border:1px solid var(--creator-field-border,#b9ada0);border-radius:var(--creator-field-radius,4px);outline:0;color:#3b302a;background:var(--creator-field-bg,#fffdf8);font:550 14px/1.35 system-ui,sans-serif}
.pbdh-authoring-field textarea{height:56px;padding-block:7px;resize:vertical}
.pbdh-authoring-field input:focus,.pbdh-authoring-field textarea:focus{border-color:#8b2d31;box-shadow:0 0 0 2px #8b2d3118}
.pbdh-authoring-enum-toggle{position:absolute;top:1px;right:1px;width:32px;height:30px;border:0;background:transparent;color:#5f554d;cursor:pointer}
.pbdh-authoring-enum-menu{position:absolute;z-index:30;top:36px;left:0;width:100%;box-sizing:border-box;display:grid;padding:4px;border:1px solid #b9ada0;border-radius:4px;background:#fffaf2;box-shadow:0 8px 20px #38271a24}
.pbdh-authoring-enum-menu button{min-height:30px;padding:5px 9px;border:0;background:transparent;color:#3b302a;text-align:left}
.pbdh-authoring-repeat{grid-column:1/-1;display:grid;gap:8px}
.pbdh-authoring-repeat>header{display:flex;align-items:center;justify-content:space-between}
.pbdh-authoring-repeat h3{margin:0;color:#6f2024;font-size:15px}
.pbdh-authoring-repeat button{min-height:28px;padding:0 9px;border:1px solid #c9c1b6;border-radius:4px;color:#5f2024;background:#fffdf8;font-weight:700}
.pbdh-authoring-repeat-item{position:relative;display:grid;gap:8px;padding:8px 10px;border:1px solid var(--creator-feature-border,#d8cec0);background:var(--creator-feature-bg,#fffaf2)}
.pbdh-authoring-repeat-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:6px}
.pbdh-authoring-delete-confirm{grid-column:1/-1;display:flex;align-items:center;justify-content:flex-end;gap:8px;color:#7c2025;font-size:13px}
@media(max-width:760px){.pbdh-authoring-section,.pbdh-authoring-repeat-item{grid-template-columns:minmax(0,1fr)!important}.pbdh-authoring-field{grid-column:1!important}}
`;

function valueAtPath(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined, data);
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function serializedValue(field: AuthoringField, value: unknown): string {
  if (field.control === "string-list") return Array.isArray(value) ? value.join("\n") : "";
  if (field.control === "string-map") return value && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value).map(([key, item]) => `${key}: ${String(item)}`).join("\n")
    : "";
  if (field.control === "single-entry-map-list") return Array.isArray(value)
    ? value.flatMap((item) => item && typeof item === "object" && !Array.isArray(item)
      ? Object.entries(item).map(([key, entry]) => `${key}: ${String(entry)}`)
      : []).join("\n")
    : "";
  return textValue(value);
}

function parsedValue(field: AuthoringField, text: string): unknown {
  if (field.control === "string-list") return text.split("\n").map((item) => item.trim()).filter(Boolean);
  if (field.control === "string-map") return Object.fromEntries(text.split("\n")
    .map((line) => line.split(/:(.*)/su))
    .filter(([key]) => key?.trim())
    .map(([key, item]) => [key!.trim(), (item ?? "").trim()]));
  if (field.control === "single-entry-map-list") return text.split("\n")
    .map((line) => line.split(/:(.*)/su))
    .filter(([key]) => key?.trim())
    .map(([key, item]) => ({ [key!.trim()]: (item ?? "").trim() }));
  return text;
}

function AuthoringFieldControl({
  field,
  value,
  onChange,
}: {
  field: AuthoringField;
  value: unknown;
  onChange(value: unknown): void;
}) {
  const inputId = useId();
  const [enumOpen, setEnumOpen] = useState(false);
  const text = serializedValue(field, value);
  const multiline = field.control !== "text";
  const style = {
    gridColumn: `span ${field.span ?? 1}`,
    ...(field.labelWidth ? { "--pbdh-authoring-label-width": `${field.labelWidth}px` } : {}),
  } as CSSProperties;

  return <div className="pbdh-authoring-field" style={style}>
    <label htmlFor={inputId} style={field.labelWidth ? { width: field.labelWidth } : undefined}>{field.label}</label>
    <span className="pbdh-authoring-control" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setEnumOpen(false);
    }}>
      {multiline
        ? <textarea id={inputId} value={text} onChange={(event) => onChange(parsedValue(field, event.target.value))} />
        : <input id={inputId} value={text} onChange={(event) => onChange(event.target.value)} />}
      {!multiline && field.enum?.length ? <>
        <button type="button" className="pbdh-authoring-enum-toggle" aria-label={`展开${field.label}选项`} aria-expanded={enumOpen} onClick={() => setEnumOpen((current) => !current)}>⌄</button>
        {enumOpen ? <span className="pbdh-authoring-enum-menu" role="listbox" aria-label={`${field.label}预设选项`}>{field.enum.map((option) => <button type="button" role="option" aria-selected={text === option} key={option} onClick={() => { onChange(option); setEnumOpen(false); }}>{option}</button>)}</span> : null}
      </> : null}
    </span>
  </div>;
}

function RepeatEditor({ repeat, data, onValue }: {
  repeat: AuthoringRepeat;
  data: Record<string, unknown>;
  onValue(path: string, value: unknown): void;
}) {
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const value = valueAtPath(data, repeat.path);
  const rows = Array.isArray(value) ? value as Record<string, unknown>[] : [];
  const nextRows = (index: number, field: AuthoringField, next: unknown) => rows.map((row, rowIndex) => rowIndex === index
    ? { ...row, [field.path]: next }
    : row);
  const emptyItem = () => structuredClone(repeat.itemDefaults ?? Object.fromEntries(repeat.itemFields.map((field) => [field.path, ""])));

  return <section className="pbdh-authoring-repeat">
    <header><h3>{repeat.label}</h3><button type="button" onClick={() => onValue(repeat.path, [...rows, emptyItem()])}>＋ 新增</button></header>
    {rows.map((row, index) => <article className="pbdh-authoring-repeat-item" style={{ gridTemplateColumns: `repeat(${repeat.columns ?? 2}, minmax(0, 1fr))` }} key={index}>
      {repeat.itemFields.map((field) => <AuthoringFieldControl key={field.path} field={field} value={row[field.path]} onChange={(next) => onValue(repeat.path, nextRows(index, field, next))} />)}
      <div className="pbdh-authoring-repeat-actions">
        {repeat.allowClear ? <button type="button" onClick={() => onValue(repeat.path, rows.map((item, rowIndex) => rowIndex === index ? emptyItem() : item))}>清空内容</button> : null}
        <button type="button" onClick={() => repeat.confirmDelete ? setPendingDelete(index) : onValue(repeat.path, rows.filter((_, rowIndex) => rowIndex !== index))}>删除</button>
      </div>
      {pendingDelete === index ? <div className="pbdh-authoring-delete-confirm"><span>确认删除“{textValue(row[repeat.itemFields[0]?.path ?? ""])}”？</span><button type="button" onClick={() => setPendingDelete(null)}>取消</button><button type="button" onClick={() => { onValue(repeat.path, rows.filter((_, rowIndex) => rowIndex !== index)); setPendingDelete(null); }}>确认删除</button></div> : null}
    </article>)}
  </section>;
}

export function TemplateAuthoringSurface({
  authoring,
  data,
  onValue,
}: {
  authoring: TemplateAuthoringCapability;
  data: Record<string, unknown>;
  onValue(path: string, value: unknown): void;
}) {
  const layout = authoring.layout;
  return <section className="pbdh-authoring" data-template-authoring={`${layout.templateId}@${layout.templateVersion}`}>
    <style>{authoringStyles}</style>
    {layout.sections.map((section) => <section
      className="pbdh-authoring-section"
      data-authoring-section={section.id}
      style={{ gridTemplateColumns: `repeat(${section.columns ?? 2}, minmax(0, 1fr))` }}
      key={section.id}
    >
      {section.showLabel ? <h2 className="pbdh-authoring-section-title">{section.label}</h2> : null}
      {section.fields.map((field) => <AuthoringFieldControl key={field.path} field={field} value={valueAtPath(data, field.path)} onChange={(value) => onValue(field.path, value)} />)}
      {section.repeats?.map((repeat) => <RepeatEditor key={repeat.path} repeat={repeat} data={data} onValue={onValue} />)}
    </section>)}
  </section>;
}
