import { useEffect, useId, useRef, useState } from "react";

import type { LocalDocumentSync } from "@pbdh/local-storage";
import { OperationStatus } from "@pbdh/platform-ui";

const iconPaths = {
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"],
  check: ["m5 12 4 4L19 6"],
  chevronDown: ["m6 9 6 6 6-6"],
  chevronRight: ["m9 18 6-6-6-6"],
  cloudAlert: ["M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9Z", "M12 12v3", "M12 17h.01"],
  cloudCheck: ["M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9Z", "m10 15 2 2 4-4"],
  cloudOff: ["m2 2 20 20", "M5.8 5.8A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 2.7-.9", "M10.7 4.2A7 7 0 0 1 15.7 10h1.8a4.5 4.5 0 0 1 4.2 6"],
  cloudUpload: ["M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9Z", "M12 17v-6", "m9 14 3-3 3 3"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
  ellipsis: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  filePlus: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z", "M14 2v6h6", "M12 18v-6", "M9 15h6"],
  folder: ["M3 6h6l2 2h10v11H3Z"],
  folderPlus: ["M3 6h6l2 2h10v11H3Z", "M12 11v6", "M9 14h6"],
  grid: ["M4 4h6v6H4Z", "M14 4h6v6h-6Z", "M4 14h6v6H4Z", "M14 14h6v6h-6Z"],
  grip: ["M9 5h.01", "M15 5h.01", "M9 12h.01", "M15 12h.01", "M9 19h.01", "M15 19h.01"],
  image: ["M3 5h18v14H3Z", "m3 16 5-5 4 4 3-3 3 4", "M14.5 9.5h.01"],
  package: ["m12 3 9 5-9 5-9-5Z", "m3 8 9 5 9-5", "M3 8v9l9 5 9-5V8", "M12 13v9"],
  packagePlus: ["m12 3 9 5-9 5-9-5Z", "M3 8v9l9 5 9-5V8", "M12 13v9", "M17 4v6", "M14 7h6"],
  search: ["m21 21-4.3-4.3", "M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V20h-3v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 14.7a1.7 1.7 0 0 0-1.55-1H5v-3h.09A1.7 1.7 0 0 0 6.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.3 3.8V3h3v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19 8.3a1.7 1.7 0 0 0 1.55 1H21v3h-.09A1.7 1.7 0 0 0 19.4 15Z"],
  trash: ["M3 6h18", "M19 6l-1 14H6L5 6", "M8 6V4h8v2", "M10 11v6", "M14 11v6"],
  upload: ["M12 21V9", "m7 14 5-5 5 5", "M5 3h14"],
  user: ["M20 21a8 8 0 0 0-16 0", "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"],
  x: ["M18 6 6 18", "m6 6 12 12"],
} satisfies Record<string, string[]>;

export function Icon({ name }: { name: keyof typeof iconPaths }) {
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    {iconPaths[name].map((path) => <path key={path} d={path} />)}
  </svg>;
}

export function TemplateMultiSelect({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: readonly string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const label = value.length === 0
    ? "全部卡牌类型"
    : value.length === 1
      ? value[0]!
      : `已选 ${value.length} 类`;

  return <div ref={rootRef} className="workspace-template-filter" onMouseLeave={() => setOpen(false)}>
    <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span>{label}</span><Icon name="chevronDown" />
    </button>
    {open && <div className="workspace-template-filter-menu" role="menu" aria-label="按卡牌类型筛选">
      <label role="menuitemcheckbox" aria-checked={value.length === 0}>
        <input type="checkbox" checked={value.length === 0} onChange={() => onChange([])} />
        <span>全部卡牌类型</span>
      </label>
      {options.map((templateId) => <label key={templateId} role="menuitemcheckbox" aria-checked={value.includes(templateId)}>
        <input
          type="checkbox"
          checked={value.includes(templateId)}
          onChange={() => onChange(value.includes(templateId)
            ? value.filter((candidate) => candidate !== templateId)
            : [...value, templateId])}
        />
        <span>{templateId}</span>
      </label>)}
    </div>}
  </div>;
}

export function Field({
  label,
  value,
  onChange,
  className = "",
  enum: options = [],
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  enum?: readonly string[];
}) {
  const inputId = useId();
  const [enumOpen, setEnumOpen] = useState(false);
  return (
    <div className={`compact-field ${className}`}>
      <label htmlFor={inputId}>{label}</label>
      <span
        className={`compact-field-control${options.length > 0 ? " has-enum" : ""}`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setEnumOpen(false);
        }}
      >
        <input id={inputId} value={value} onChange={(event) => onChange(event.target.value)} />
        {options.length > 0 ? <>
          <button
            type="button"
            className="compact-field-enum-toggle"
            aria-label={`展开${label}选项`}
            aria-expanded={enumOpen}
            onClick={() => setEnumOpen((current) => !current)}
          ><Icon name="chevronDown" /></button>
          {enumOpen ? <span className="compact-field-enum-menu" role="listbox" aria-label={`${label}预设选项`}>
            {options.map((option) => <button
              type="button"
              role="option"
              aria-selected={value === option}
              key={option}
              onClick={() => { onChange(option); setEnumOpen(false); }}
            >{option}</button>)}
          </span> : null}
        </> : null}
      </span>
    </div>
  );
}

export function TextareaField({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`compact-field textarea-field ${className}`}>
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function isCreatorAuthoringInputFocused(): boolean {
  const element = document.activeElement;
  return element instanceof HTMLElement
    && element.closest(".authoring-editor") !== null
    && (element.matches("input, textarea, select") || element.isContentEditable);
}

export function CloudSyncIndicator({ sync, saving = false }: { sync?: LocalDocumentSync; saving?: boolean }) {
  if (saving) return <OperationStatus label="保存中…" />;
  const state = sync?.scope === "cloud" ? sync.state : "local";
  const presentation = {
    local: { icon: "cloudOff" as const, label: "仅保存在此浏览器，不等于云备份" },
    pending: { icon: "cloudUpload" as const, label: "待同步" },
    clean: { icon: "cloudCheck" as const, label: "已同步" },
    conflict: { icon: "cloudAlert" as const, label: "冲突" },
  }[state];
  return <span className={`cloud-sync-state is-${state}`} title={presentation.label} aria-label={presentation.label}>
    <Icon name={presentation.icon} />
  </span>;
}
