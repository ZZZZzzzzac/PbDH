import {
  armorAuthoringLayout,
  weaponAuthoringLayout,
  type AuthoringLayout,
} from "@pbdh/templates/frontend";
import type {
  AdversaryData,
  AdversaryFeature,
  ArmorData,
  WeaponData,
} from "@pbdh/templates/core";

import { Field, Icon, TextareaField } from "./creator-controls.tsx";

export function AdversaryEditor({
  data,
  openFeatureMenu,
  onField,
  onFeature,
  onAddFeature,
  onToggleFeatureMenu,
  onClearFeature,
  onDeleteFeature,
}: {
  data: AdversaryData;
  openFeatureMenu: number | null;
  onField: (field: Exclude<keyof AdversaryData, "特性">, value: string) => void;
  onFeature: (index: number, field: keyof AdversaryFeature, value: string) => void;
  onAddFeature?: () => void;
  onToggleFeatureMenu?: (index: number) => void;
  onClearFeature?: (index: number) => void;
  onDeleteFeature?: (index: number, name: string) => void;
}) {
  return <section className="authoring-editor">
    <div className="field-group identity-fields">
      <div className="field-row"><Field className="name-field" label="名称" value={data.名称} onChange={(value) => onField("名称", value)} /><Field className="tier-field" label="位阶" value={data.位阶} onChange={(value) => onField("位阶", value)} /></div>
      <div className="field-row"><Field className="name-field" label="英文" value={data.原文} onChange={(value) => onField("原文", value)} /><Field className="tier-field" label="种类" value={data.种类} onChange={(value) => onField("种类", value)} /></div>
      <Field className="full-field" label="简介" value={data.简介} onChange={(value) => onField("简介", value)} />
    </div>
    <div className="field-group combat-fields">
      <div className="field-row"><Field className="motive-field" label="动机与战术" value={data.动机与战术} onChange={(value) => onField("动机与战术", value)} /><Field className="experience-field" label="经历" value={data.经历} onChange={(value) => onField("经历", value)} /></div>
      <div className="field-row dense-row">
        <Field className="value-field" label="生命" value={data.生命点} onChange={(value) => onField("生命点", value)} />
        <Field className="value-field" label="压力" value={data.压力点} onChange={(value) => onField("压力点", value)} />
        <Field className="difficulty-field" label="难度" value={data.难度} onChange={(value) => onField("难度", value)} />
        <Field className="threshold-field" label="重度阈值" value={data.重度伤害阈值} onChange={(value) => onField("重度伤害阈值", value)} />
        <Field className="threshold-field" label="严重阈值" value={data.严重伤害阈值} onChange={(value) => onField("严重伤害阈值", value)} />
      </div>
      <div className="field-row dense-row attack-row">
        <Field className="attack-field" label="攻击" value={data.攻击命中} onChange={(value) => onField("攻击命中", value)} />
        <Field className="weapon-field" label="武器" value={data.攻击武器} onChange={(value) => onField("攻击武器", value)} />
        <Field className="weapon-field" label="范围" value={data.攻击范围} onChange={(value) => onField("攻击范围", value)} />
        <Field className="damage-field" label="伤害" value={data.攻击伤害} onChange={(value) => onField("攻击伤害", value)} />
        <Field className="damage-field" label="类型" value={data.攻击属性} onChange={(value) => onField("攻击属性", value)} />
      </div>
    </div>
    <section className="features-editor">
      <header><h2>特性</h2>{onAddFeature && <button type="button" onClick={onAddFeature}>＋ 新增特性</button>}</header>
      {data.特性.map((feature, index) => <article className="feature-editor" key={`${feature.名称}:${index}`}>
        <div className="feature-line"><Icon name="grip" /><Field className="feature-name" label="特性名" value={feature.名称} onChange={(value) => onFeature(index, "名称", value)} /><Field className="feature-type" label="类型" value={feature.类型} onChange={(value) => onFeature(index, "类型", value)} />{onToggleFeatureMenu && onClearFeature && onDeleteFeature && <div className="feature-actions">
          <button type="button" aria-label={`${feature.名称 || "未命名特性"}菜单`} aria-haspopup="menu" aria-expanded={openFeatureMenu === index} onClick={() => onToggleFeatureMenu(index)}><Icon name="ellipsis" /></button>
          {openFeatureMenu === index && <div className="feature-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => onClearFeature(index)}>清空内容</button>
            <button type="button" role="menuitem" className="delete" onClick={() => onDeleteFeature(index, feature.名称)}>删除特性</button>
          </div>}
        </div>}</div>
        <div className="feature-line description-line"><span /><TextareaField label="描述" value={feature.特性描述} onChange={(value) => onFeature(index, "特性描述", value)} /></div>
      </article>)}
    </section>
  </section>;
}

export function ReplacementEditor({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; name: string }>;
  onChange: (targetResourceId: string | null) => void;
}) {
  return <section className="replacement-editor field-group">
    <h2>换卡</h2>
    <label className="compact-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">不设置</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
    <p>点击桌面上的“{label}”时，现场读取这张目标卡。</p>
  </section>;
}

export function WeaponEditor({ data, onField }: { data: WeaponData; onField: (field: keyof WeaponData, value: string) => void }) {
  return <section className="authoring-editor weapon-authoring-editor">
    {weaponAuthoringLayout.sections.map((section) => <div className={`field-group weapon-field-grid ${section.id}`} key={section.id}>
      {section.fields.map((field) => {
        const key = field.path as keyof WeaponData;
        return field.control === "textarea"
          ? <TextareaField key={field.path} label={field.label} value={data[key]} onChange={(value) => onField(key, value)} />
          : <Field key={field.path} label={field.label} value={data[key]} onChange={(value) => onField(key, value)} />;
      })}
    </div>)}
  </section>;
}

export function ArmorEditor({ data, onField }: { data: ArmorData; onField: (field: keyof ArmorData, value: string) => void }) {
  return <section className="authoring-editor armor-authoring-editor">
    {armorAuthoringLayout.sections.map((section) => <div className={`field-group armor-field-grid ${section.id}`} key={section.id}>
      {section.fields.map((field) => {
        const key = field.path as keyof ArmorData;
        return field.control === "textarea"
          ? <TextareaField key={field.path} label={field.label} value={data[key]} onChange={(value) => onField(key, value)} />
          : <Field key={field.path} label={field.label} value={data[key]} onChange={(value) => onField(key, value)} />;
      })}
    </div>)}
  </section>;
}

function valueAtPath(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined, data);
}

export function StructuredEditor({
  data,
  layout,
  onValue,
}: {
  data: Record<string, unknown>;
  layout: AuthoringLayout;
  onValue: (path: string, value: unknown) => void;
}) {
  return <section className="authoring-editor structured-authoring-editor">
    {layout.sections.map((section) => <div className="field-group structured-field-grid" key={section.id}>
      <h2>{section.label}</h2>
      {section.fields.map((field) => {
        const value = valueAtPath(data, field.path);
        if (field.control === "string-list") return <TextareaField key={field.path} label={field.label} value={Array.isArray(value) ? value.join("\n") : ""} onChange={(text) => onValue(field.path, text.split("\n").map((item) => item.trim()).filter(Boolean))} />;
        if (field.control === "string-map") return <TextareaField key={field.path} label={field.label} value={value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value).map(([key, item]) => `${key}: ${String(item)}`).join("\n") : ""} onChange={(text) => onValue(field.path, Object.fromEntries(text.split("\n").map((line) => line.split(/:(.*)/su)).filter(([key]) => key?.trim()).map(([key, item]) => [key!.trim(), (item ?? "").trim()]))) } />;
        return field.control === "textarea"
          ? <TextareaField key={field.path} label={field.label} value={typeof value === "string" ? value : ""} onChange={(text) => onValue(field.path, text)} />
          : <Field key={field.path} label={field.label} value={typeof value === "string" ? value : ""} enum={field.enum} onChange={(text) => onValue(field.path, text)} />;
      })}
      {section.repeats?.map((repeat) => {
        const items = valueAtPath(data, repeat.path);
        const rows = Array.isArray(items) ? items as Record<string, unknown>[] : [];
        return <section className="structured-repeat" key={repeat.path}><header><h3>{repeat.label}</h3><button type="button" onClick={() => onValue(repeat.path, [...rows, Object.fromEntries(repeat.itemFields.map((field) => [field.path, ""]))])}>＋ 新增</button></header>
          {rows.map((row, index) => <article key={index}>{repeat.itemFields.map((field) => field.control === "textarea"
            ? <TextareaField key={field.path} label={field.label} value={String(row[field.path] ?? "")} onChange={(text) => onValue(repeat.path, rows.map((item, itemIndex) => itemIndex === index ? { ...item, [field.path]: text } : item))} />
            : <Field key={field.path} label={field.label} value={String(row[field.path] ?? "")} enum={field.enum} onChange={(text) => onValue(repeat.path, rows.map((item, itemIndex) => itemIndex === index ? { ...item, [field.path]: text } : item))} />)}<button type="button" className="structured-remove" onClick={() => onValue(repeat.path, rows.filter((_, itemIndex) => itemIndex !== index))}>删除</button></article>)}
        </section>;
      })}
    </div>)}
  </section>;
}

