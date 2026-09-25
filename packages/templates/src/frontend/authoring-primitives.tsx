import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export const textValue = (value: unknown): string => typeof value === "string" ? value : "";
export const linesValue = (value: unknown): string => Array.isArray(value) ? value.join("\n") : "";
export const parseLines = (value: string): string[] => value.split("\n").map((item) => item.trim()).filter(Boolean);
export const singleEntryMapLines = (value: unknown): string => Array.isArray(value) ? value.flatMap((item) => item && typeof item === "object" && !Array.isArray(item) ? Object.entries(item).map(([key, entry]) => `${key}: ${String(entry)}`) : []).join("\n") : "";
export const parseSingleEntryMapLines = (value: string): Record<string, string>[] => value.split("\n").map((line) => line.split(/:(.*)/su)).filter(([key]) => key?.trim()).map(([key, entry]) => ({ [key!.trim()]: (entry ?? "").trim() }));

/** 仅调整位置，完整保留条目及其字段；不修改传入数组。 */
export function moveArrayItem<T>(items: readonly T[], index: number, offset: -1 | 1): T[] {
  const next = [...items];
  const target = index + offset;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return next;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function ArrayItemActions({ item, index, count, onClear, onDelete, onMove }: {
  item: unknown;
  index: number;
  count: number;
  onClear(): void;
  onDelete(): void;
  onMove(offset: -1 | 1): void;
}) {
  const [confirming, setConfirming] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  // 条目被替换或移动时，不能把确认状态带给同位置的新条目。
  useEffect(() => setConfirming(false), [item]);
  useEffect(() => {
    if (!confirming) return;
    const owner = deleteRef.current?.ownerDocument;
    if (!owner) return;
    const cancelOutside = (event: Event) => {
      if (!event.composedPath().includes(deleteRef.current!)) setConfirming(false);
    };
    const cancelEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirming(false);
    };
    owner.addEventListener("pointerdown", cancelOutside, true);
    owner.addEventListener("click", cancelOutside, true);
    owner.addEventListener("focusin", cancelOutside, true);
    owner.addEventListener("keydown", cancelEscape, true);
    return () => {
      owner.removeEventListener("pointerdown", cancelOutside, true);
      owner.removeEventListener("click", cancelOutside, true);
      owner.removeEventListener("focusin", cancelOutside, true);
      owner.removeEventListener("keydown", cancelEscape, true);
    };
  }, [confirming]);
  const buttonStyle = { minHeight: 34, height: 34, padding: "0 7px", flex: "none" } as const;
  return <div className="template-editor-array-actions" role="group" aria-label={`第 ${index + 1} 项特性操作`}
    style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignSelf: "end", minWidth: 0, gap: 4 }}>
    <button type="button" style={buttonStyle} onClick={() => { setConfirming(false); onClear(); }}>清空</button>
    <button ref={deleteRef} type="button" aria-label={`${confirming ? "确认删除" : "删除"}第 ${index + 1} 项特性`}
      style={{ ...buttonStyle, ...(confirming ? { background: "#8b2d31", borderColor: "#8b2d31", color: "#fff" } : {}) }}
      onClick={() => {
        if (!confirming) { setConfirming(true); return; }
        setConfirming(false);
        onDelete();
      }}>{confirming ? "确认" : "删除"}</button>
    <button type="button" aria-label={`上移第 ${index + 1} 项特性`} disabled={index === 0}
      title="上移" style={{ ...buttonStyle, width: 26, padding: 0, opacity: index === 0 ? 0.4 : 1 }}
      onClick={() => { setConfirming(false); onMove(-1); }}>↑</button>
    <button type="button" aria-label={`下移第 ${index + 1} 项特性`} disabled={index >= count - 1}
      title="下移" style={{ ...buttonStyle, width: 26, padding: 0, opacity: index >= count - 1 ? 0.4 : 1 }}
      onClick={() => { setConfirming(false); onMove(1); }}>↓</button>
  </div>;
}

export function EditorInput({ label, value, onChange, options, onOptionSelect }: { label: string; value: unknown; onChange(value: string): void; options?: readonly string[]; onOptionSelect?(option: string): void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const text = textValue(value);
  return <label className="template-editor-field" htmlFor={id}><span>{label}</span><span className="template-editor-control" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}><input id={id} value={text} onChange={(event) => onChange(event.target.value)} />{options?.length ? <><button type="button" className="template-editor-select-toggle" aria-label={`展开${label}选项`} aria-expanded={open} onClick={() => setOpen((current) => !current)}><i className="template-editor-select-arrow" aria-hidden="true" /></button>{open ? <span className="template-editor-select-menu" role="listbox" aria-label={`${label}预设选项`}>{options.map((option) => <button type="button" role="option" aria-selected={text === option} key={option} onClick={() => { if (onOptionSelect) onOptionSelect(option); else onChange(option); setOpen(false); }}>{option}</button>)}</span> : null}</> : null}</span></label>;
}

function resizeAutoGrowTextarea(textarea: HTMLTextAreaElement): void {
  textarea.style.height = "34px";
  textarea.style.height = `${Math.max(34, textarea.scrollHeight)}px`;
}

export function EditorTextarea({ label, value, onChange }: { label: string; value: unknown; onChange(value: string): void }) {
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const text = textValue(value);
  useLayoutEffect(() => {
    if (textareaRef.current) resizeAutoGrowTextarea(textareaRef.current);
  }, [text]);
  return <label className="template-editor-field" htmlFor={id}><span>{label}</span><textarea
    ref={textareaRef}
    id={id}
    className="is-auto-grow"
    rows={1}
    value={text}
    onInput={(event) => resizeAutoGrowTextarea(event.currentTarget)}
    onChange={(event) => onChange(event.target.value)}
  /></label>;
}

export const authoringControlStyles = `.template-editor-field{min-width:0;display:flex;flex-direction:column;gap:4px;color:#3b302a;font:700 14px/1.3 system-ui,sans-serif}.template-editor-control{position:relative;min-width:0;display:flex}.template-editor-field input,.template-editor-field textarea{box-sizing:border-box;min-width:0;width:100%;height:34px;padding:0 10px;border:1px solid #b9ada0;border-radius:4px;outline:0;color:#3b302a;background:#fffdf8;font:550 15px/1.35 system-ui,sans-serif}.template-editor-field textarea{height:58px;padding-block:8px;resize:vertical}.template-editor-field textarea.is-auto-grow{height:34px;min-height:34px;padding-block:5px;overflow:hidden;resize:none}.template-editor-field input:focus,.template-editor-field textarea:focus{border-color:#8b2d31;box-shadow:0 0 0 2px #8b2d3118}.template-editor-select-toggle{position:absolute;top:1px;right:5px;width:32px;height:32px;display:grid;place-items:center;padding:0;border:0;background:transparent;color:#5f554d;cursor:pointer}.template-editor-select-arrow{width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:7px solid currentColor}.template-editor-select-menu{position:absolute;z-index:30;top:38px;left:0;width:100%;max-height:min(360px,55vh);box-sizing:border-box;display:grid;overflow:auto;padding:4px;border:1px solid #b9ada0;border-radius:4px;background:#fffaf2;box-shadow:0 8px 20px #38271a24}.template-editor-select-menu button{min-height:30px;padding:5px 9px;border:0;background:transparent;color:#3b302a;text-align:left}.template-editor-select-menu button:hover{background:#f1e7d9}`;
