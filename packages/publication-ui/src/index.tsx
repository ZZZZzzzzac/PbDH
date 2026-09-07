import { useState, type FormEvent } from "react";
import { OperationStatus } from "@pbdh/platform-ui";

import "./styles.css";

export type ResourcePackageTargetValue = { systemPackageId: string; version: string };
export type ResourcePackageInfoValue = { name: string; version: string; description: string; targets: ResourcePackageTargetValue[] };
export type SystemPackageOption = { id: string; name: string; version: string };
export type PublicationFormValue = { title: string; summary: string; language: string; tags: string[]; licenseId: string };
export type ResourcePackageEditorValue = { package: ResourcePackageInfoValue; publication?: PublicationFormValue };
export type PublicationLicenseOption = { id: string; label: string };

export function ResourcePackageInfoDialog({
  heading, submitLabel, coverUrl = "", value, systemPackageOptions,
  licenseOptions = [], busy = false, busyLabel = "正在处理…", submitDisabled = false,
  onChange, onChooseCover, onClose, onSubmit,
}: {
  heading: string;
  submitLabel: string;
  coverUrl?: string;
  value: ResourcePackageEditorValue;
  systemPackageOptions: readonly SystemPackageOption[];
  licenseOptions?: PublicationLicenseOption[];
  busy?: boolean;
  busyLabel?: string;
  submitDisabled?: boolean;
  onChange: (value: ResourcePackageEditorValue) => void;
  onChooseCover?: () => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const publication = value.publication;
  const changePackage = (nextPackage: ResourcePackageInfoValue) => onChange({ ...value, package: nextPackage });
  const changePublication = (nextPublication: PublicationFormValue) => onChange({ ...value, publication: nextPublication });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!busy) onSubmit();
  }
  function changeName(name: string) {
    onChange({
      package: { ...value.package, name },
      ...(publication ? { publication: { ...publication, title: name } } : {}),
    });
  }
  function changeDescription(description: string) {
    onChange({
      package: { ...value.package, description },
      ...(publication ? { publication: { ...publication, summary: description } } : {}),
    });
  }

  return <div className="pbdh-publication-backdrop" role="presentation" onMouseDown={() => { if (!busy) onClose(); }}>
    <form className="pbdh-publication-dialog" role="dialog" aria-modal="true" aria-labelledby="pbdh-publication-heading" aria-busy={busy} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="pbdh-publication-heading">{heading}</h2><button type="button" aria-label="关闭" disabled={busy} onClick={onClose}><CloseIcon /></button></header>
      <section className={`pbdh-resource-package-fields${publication ? " has-cover" : ""}`} aria-label="资源包信息">
        {publication && <div className="pbdh-publication-cover-field"><strong>封面</strong><div className="pbdh-publication-cover-preview">{coverUrl ? <img src={coverUrl} alt="资源包封面" /> : <ImageIcon />}</div><button type="button" disabled={busy || !onChooseCover} onClick={onChooseCover}><UploadIcon />上传</button></div>}
        <div className="pbdh-publication-copy-fields">
          <Field label="名称" value={value.package.name} disabled={busy} onChange={changeName} />
          <Field label="版本" value={value.package.version} disabled={busy} onChange={(version) => changePackage({ ...value.package, version })} />
          <Field multiline label="简介" value={value.package.description} disabled={busy} onChange={changeDescription} />
          <TargetSystemEditor value={value.package.targets} options={systemPackageOptions} disabled={busy} onChange={(targets) => changePackage({ ...value.package, targets })} />
          {publication && <>
            <div className="pbdh-publication-meta-fields">
              <Field label="内容语言" value={publication.language} disabled={busy} onChange={(language) => changePublication({ ...publication, language })} />
              <LicenseField value={publication.licenseId} options={licenseOptions} disabled={busy} onChange={(licenseId) => changePublication({ ...publication, licenseId })} />
            </div>
            <TagEditor tags={publication.tags} disabled={busy} onChange={(tags) => changePublication({ ...publication, tags })} />
          </>}
        </div>
      </section>
      <footer><button type="button" disabled={busy} onClick={onClose}>取消</button><button type="submit" className="primary" disabled={busy || submitDisabled}>{busy ? <OperationStatus label={busyLabel} /> : submitLabel}</button></footer>
    </form>
  </div>;
}

function LicenseField({ value, options, disabled, onChange }: { value: string; options: readonly PublicationLicenseOption[]; disabled: boolean; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <label className="pbdh-license-field"><span>许可类型</span><div><input disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} /><button type="button" disabled={disabled} aria-label="展开许可类型选项" aria-expanded={open} onClick={() => setOpen((current) => !current)}><i aria-hidden="true" /></button>{open && <span role="listbox" aria-label="许可类型预设选项">{options.map((option) => <button type="button" role="option" aria-selected={value === option.label} key={option.id} onClick={() => { onChange(option.label); setOpen(false); }}>{option.label}</button>)}</span>}</div></label>;
}

export type TemplateUpgradeDialogRow = {
  templateId: string;
  currentVersion: string;
  count: number;
  targetVersions: readonly string[];
};

export type TemplateUpgradeDialogSelection = {
  templateId: string;
  currentVersion: string;
  targetVersion: string;
};

export function TemplateUpgradeDialog({ rows, packageVersion, busy = false, onClose, onSubmit }: {
  rows: readonly TemplateUpgradeDialogRow[];
  packageVersion: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (selections: readonly TemplateUpgradeDialogSelection[]) => void;
}) {
  const [targets, setTargets] = useState(() => Object.fromEntries(rows.map((row) => [
    `${row.templateId}@${row.currentVersion}`,
    row.targetVersions.at(-1) ?? row.currentVersion,
  ])));
  const selections = rows.map((row) => ({
    templateId: row.templateId,
    currentVersion: row.currentVersion,
    targetVersion: targets[`${row.templateId}@${row.currentVersion}`] ?? row.currentVersion,
  }));
  return <div className="pbdh-publication-backdrop" role="presentation" onMouseDown={() => { if (!busy) onClose(); }}><section className="pbdh-template-upgrade-dialog" role="dialog" aria-modal="true" aria-labelledby="pbdh-template-upgrade-heading" aria-busy={busy} onMouseDown={(event) => event.stopPropagation()}><header><h2 id="pbdh-template-upgrade-heading">升级模板</h2><button type="button" aria-label="关闭" disabled={busy} onClick={onClose}><CloseIcon /></button></header>{rows.length > 0 ? <><table><thead><tr><th>模板</th><th>当前版本</th><th>目标版本</th></tr></thead><tbody>{rows.map((row) => { const key = `${row.templateId}@${row.currentVersion}`; return <tr key={key}><td><strong>{row.templateId}</strong>{row.count > 1 && <small>{row.count} 项资源</small>}</td><td>{row.currentVersion}</td><td><select disabled={busy} value={targets[key]} onChange={(event) => setTargets((current) => ({ ...current, [key]: event.target.value }))}>{row.targetVersions.map((version) => <option key={version} value={version}>{version}</option>)}</select></td></tr>; })}</tbody></table><p>升级会生成新的资源包快照，并从当前资源包版本 {packageVersion} 自动提升到满足发布规则的最低版本。</p></> : <p className="pbdh-template-upgrade-empty">当前资源包中的模板均为最新版本。</p>}<footer><button type="button" disabled={busy} onClick={onClose}>取消</button><button type="button" className="primary" disabled={busy || rows.length === 0} onClick={() => onSubmit(selections)}>{busy ? <OperationStatus label="正在升级模板…" /> : "升级"}</button></footer></section></div>;
}

function TargetSystemEditor({ value, options, disabled, onChange }: { value: ResourcePackageTargetValue[]; options: readonly SystemPackageOption[]; disabled: boolean; onChange: (value: ResourcePackageTargetValue[]) => void }) {
  const knownIds = new Set(options.map((option) => option.id));
  const visibleOptions = [...options, ...value.filter((target) => !knownIds.has(target.systemPackageId)).map((target) => ({ id: target.systemPackageId, name: target.systemPackageId, version: target.version }))];
  return <fieldset className="pbdh-target-system-field"><legend>目标系统</legend><div>
    {visibleOptions.map((option) => {
      const selected = value.some((target) => target.systemPackageId === option.id);
      return <label key={option.id}><input type="checkbox" checked={selected} disabled={disabled} onChange={(event) => onChange(event.target.checked
        ? [...value.filter((target) => target.systemPackageId !== option.id), { systemPackageId: option.id, version: option.version }]
        : value.filter((target) => target.systemPackageId !== option.id))} /><span>{option.name}</span><small>{option.version}</small></label>;
    })}
    {visibleOptions.length === 0 && <p>当前没有可选系统。</p>}
  </div><small>可选择多个；未选择时会在市场显示“未指定目标系统”。</small></fieldset>;
}

function Field({ label, value, multiline = false, disabled = false, onChange }: { label: string; value: string; multiline?: boolean; disabled?: boolean; onChange: (value: string) => void }) {
  return <label className={multiline ? "multiline" : undefined}><span>{label}</span>{multiline
    ? <textarea value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    : <input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />}</label>;
}

function TagEditor({ tags, disabled = false, onChange }: { tags: string[]; disabled?: boolean; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  function add() { const value = draft.trim(); if (value && !tags.includes(value)) onChange([...tags, value]); setDraft(""); }
  return <label className="pbdh-publication-tag-field"><span>发现标签</span><div>
    {tags.map((tag) => <b key={tag}>{tag}<button type="button" disabled={disabled} aria-label={`删除标签${tag}`} onClick={() => onChange(tags.filter((item) => item !== tag))}>×</button></b>)}
    <input value={draft} disabled={disabled} aria-label="新增标签" onChange={(event) => setDraft(event.target.value)} onBlur={add} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} />
  </div></label>;
}

function ImageIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/></svg>; }
function UploadIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 20h14"/></svg>; }
function CloseIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>; }
