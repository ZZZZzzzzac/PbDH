import { useState, type FormEvent } from "react";

import "./styles.css";

export type PublicationFormValue = {
  title: string;
  summary: string;
  language: string;
  tags: string[];
  licenseId: string;
};

export type PublicationLicenseOption = {
  id: string;
  label: string;
};

export function PublicationDialog({
  heading,
  submitLabel,
  packageName,
  packageVersion,
  resourceCount,
  coverUrl,
  value,
  licenseOptions,
  licenseReadOnly = false,
  busy = false,
  onChange,
  onChooseCover,
  onClose,
  onSubmit,
}: {
  heading: string;
  submitLabel: string;
  packageName: string;
  packageVersion: string;
  resourceCount: number;
  coverUrl: string;
  value: PublicationFormValue;
  licenseOptions: PublicationLicenseOption[];
  licenseReadOnly?: boolean;
  busy?: boolean;
  onChange: (value: PublicationFormValue) => void;
  onChooseCover?: () => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!busy) onSubmit();
  }

  return <div className="pbdh-publication-backdrop" role="presentation" onMouseDown={onClose}>
    <form className="pbdh-publication-dialog" role="dialog" aria-modal="true" aria-labelledby="pbdh-publication-heading" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="pbdh-publication-heading">{heading}</h2><button type="button" aria-label="关闭" onClick={onClose}><CloseIcon /></button></header>
      <div className="pbdh-publication-package-summary"><PackageIcon /><span><strong>{packageName}</strong><small>版本 {packageVersion} · {resourceCount} 项资源</small></span><b>完整资源包</b></div>
      <div className="pbdh-publication-fields">
        <div className="pbdh-publication-cover-field"><strong>封面</strong><div className="pbdh-publication-cover-preview">{coverUrl ? <img src={coverUrl} alt="资源包封面" /> : <ImageIcon />}</div><button type="button" disabled={!onChooseCover} onClick={onChooseCover}><UploadIcon />上传</button></div>
        <div className="pbdh-publication-copy-fields">
          <Field label="标题" value={value.title} onChange={(title) => onChange({ ...value, title })} />
          <Field multiline label="简介" value={value.summary} onChange={(summary) => onChange({ ...value, summary })} />
          <div className="pbdh-publication-meta-fields">
            <Field label="内容语言" value={value.language} onChange={(language) => onChange({ ...value, language })} />
            <label><span>许可类型</span><select disabled={licenseReadOnly} value={value.licenseId} onChange={(event) => onChange({ ...value, licenseId: event.target.value })}>{licenseOptions.map((license) => <option key={license.id} value={license.id}>{license.label}</option>)}</select></label>
          </div>
          <TagEditor tags={value.tags} onChange={(tags) => onChange({ ...value, tags })} />
        </div>
      </div>
      <footer><button type="button" onClick={onClose}>取消</button><button type="submit" className="primary" disabled={busy}>{submitLabel}</button></footer>
    </form>
  </div>;
}

function Field({ label, value, multiline = false, onChange }: { label: string; value: string; multiline?: boolean; onChange: (value: string) => void }) {
  return <label className={multiline ? "multiline" : undefined}><span>{label}</span>{multiline
    ? <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    : <input value={value} onChange={(event) => onChange(event.target.value)} />}</label>;
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  function add() {
    const value = draft.trim();
    if (value && !tags.includes(value)) onChange([...tags, value]);
    setDraft("");
  }
  return <label className="pbdh-publication-tag-field"><span>发现标签</span><div>
    {tags.map((tag) => <b key={tag}>{tag}<button type="button" aria-label={`删除标签${tag}`} onClick={() => onChange(tags.filter((item) => item !== tag))}>×</button></b>)}
    <input value={draft} aria-label="新增标签" onChange={(event) => setDraft(event.target.value)} onBlur={add} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} />
  </div></label>;
}

function PackageIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4Z"/><path d="M12 11v10"/></svg>; }
function ImageIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/></svg>; }
function UploadIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 20h14"/></svg>; }
function CloseIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>; }
