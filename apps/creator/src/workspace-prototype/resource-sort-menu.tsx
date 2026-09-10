import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowDownWideNarrow, Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { ResourceSortPreferences } from "./resource-sorting.ts";
import "./resource-sort-menu.css";

export type ResourceSortTemplate = { id: string; fields: readonly { key: string; label: string }[] };

export function ResourceSortMenu({ templates, preferences, onChange, loading, error, onRetry }: {
  templates: readonly ResourceSortTemplate[];
  preferences: ResourceSortPreferences;
  onChange: (preferences: ResourceSortPreferences) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<"root" | "templates" | "fields">("root");
  const [templateId, setTemplateId] = useState("");
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const template = templates.find((item) => item.id === templateId);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const back = () => setPage(page === "fields" ? "templates" : "root");

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current!.getBoundingClientRect();
      const bounds = panel.current!.getBoundingClientRect();
      const below = anchor.bottom + 4;
      const top = below + bounds.height <= window.innerHeight - 8 ? below : anchor.top - bounds.height - 4;
      setPosition({
        left: Math.max(8, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 8)),
        top: Math.max(8, Math.min(top, window.innerHeight - bounds.height - 8)),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(panel.current!);
    return () => observer.disconnect();
  }, [open, page, templateId, templates, error, loading]);

  useLayoutEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [open, page, templateId]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const scroll = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) setOpen(false);
    };
    const resize = () => setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
    };
  }, [open]);

  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === "Tab") {
      event.preventDefault();
      const controls = [...document.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]')]
        .filter((node) => node.tabIndex >= 0 && !node.matches(":disabled") && !panel.current?.contains(node)
          && !node.closest('[hidden], [inert], [aria-hidden="true"]')
          && getComputedStyle(node).display !== "none" && getComputedStyle(node).visibility !== "hidden");
      const index = controls.indexOf(trigger.current!);
      const target = controls[index + (event.shiftKey ? -1 : 1)] ?? trigger.current;
      setOpen(false);
      target?.focus();
    }
    else if (event.key === "ArrowLeft" && page !== "root") { event.preventDefault(); back(); }
    else if (event.key === "ArrowRight" && (event.target as HTMLElement).getAttribute("aria-haspopup") === "menu") {
      event.preventDefault(); (event.target as HTMLButtonElement).click();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const buttons = [...panel.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  };
  const cycle = (key: string) => {
    const fields = { ...preferences.templates[templateId] };
    const current = fields[key];
    if (current === "desc") delete fields[key];
    else fields[key] = current === "asc" ? "desc" : "asc";
    onChange({ mode: "grouped", templates: { ...preferences.templates, [templateId]: fields } });
  };

  return <>
    <button ref={trigger} className="resource-sort-trigger" type="button" title="排序" aria-label="排序" aria-haspopup="menu" aria-expanded={open}
      onClick={() => { setPage("root"); setOpen(!open); }}
      onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setPage("root"); setOpen(true); } }}>
      <ArrowDownWideNarrow className="icon" />
    </button>
    {open && createPortal(<div ref={panel} className="resource-sort-menu" role="menu" aria-label={page === "root" ? "排序" : page === "templates" ? "分组内排序" : templateId}
      style={position} onKeyDown={keyboard}>
      {page !== "root" && <button type="button" role="menuitem" className="resource-sort-back" onClick={back}><ChevronLeft />{page === "templates" ? "排序" : "分组内排序"}</button>}
      {page === "root" && <>
        {([ ["name", "按名称"], ["grouped", "按类型分组"] ] as const).map(([mode, label]) => <button type="button" role="menuitemradio" aria-checked={preferences.mode === mode} key={mode} onClick={() => onChange({ ...preferences, mode })}><span>{label}</span>{preferences.mode === mode && <Check />}</button>)}
        <button type="button" role="menuitem" aria-haspopup="menu" onClick={() => setPage("templates")}><span>分组内排序</span><ChevronRight /></button>
      </>}
      {page === "templates" && <>
        {templates.map((item) => <button type="button" role="menuitem" aria-haspopup="menu" key={item.id} onClick={() => { setTemplateId(item.id); setPage("fields"); }}><span>{item.id}</span><ChevronRight /></button>)}
        {loading && <p role="status">正在加载排序字段</p>}
        {error && <><p role="alert">{error}</p><button type="button" role="menuitem" onClick={onRetry}>重试</button></>}
        {!loading && !error && templates.length === 0 && <p>没有可排序的模板</p>}
      </>}
      {page === "fields" && <>
        <strong className="resource-sort-template-name">{templateId}</strong>
        {template?.fields.map((field) => <button type="button" role="menuitem" key={field.key} onClick={() => cycle(field.key)}><span>{field.label}</span><small>{preferences.templates[templateId]?.[field.key] === "asc" ? "升序" : preferences.templates[templateId]?.[field.key] === "desc" ? "降序" : "—"}</small></button>)}
        {!template?.fields.length && <p>没有可排序字段</p>}
      </>}
    </div>, document.body)}
  </>;
}
