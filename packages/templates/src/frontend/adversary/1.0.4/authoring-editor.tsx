import { useState } from "react";
import { AdversaryStatPresetControl } from "../stat-preset-control.tsx";

import { authoringControlStyles, ArrayItemActions, moveArrayItem, EditorInput, EditorTextarea } from "../../authoring-primitives.tsx";
import { adversaryFeaturePresets } from "../../feature-presets.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

const styles = `${authoringControlStyles}
.adversary-editor{min-width:0;display:flex;flex-direction:column;gap:9px;padding:12px 14px;background:#f1ece4;color:#3b302a;font-family:system-ui,sans-serif}.adversary-editor-group{min-width:0;display:grid;gap:8px;padding:10px;border:1px solid #d8cec0;border-radius:6px;background:#f8f4ed}.adversary-identity{grid-template-columns:repeat(6,minmax(0,1fr))}.adversary-identity>:nth-child(1),.adversary-identity>:nth-child(2){grid-column:span 3}.adversary-identity>:nth-child(n+3){grid-column:span 2}.adversary-description{grid-template-columns:repeat(2,minmax(0,1fr))}.adversary-description>:first-child{grid-column:1/-1}.adversary-combat{grid-template-columns:repeat(5,minmax(0,1fr))}.adversary-features{display:flex;flex-direction:column;gap:8px}.adversary-features>header{display:flex;align-items:center;justify-content:space-between}.adversary-features h3{margin:0;color:#6f2024;font-size:16px}.adversary-editor button:not(.template-editor-select-toggle):not([role=option]){min-height:30px;padding:0 12px;border:1px solid #c9c1b6;border-radius:4px;color:#5f2024;background:#fffdf8;font-weight:700}.adversary-editor .template-editor-select-toggle{display:grid;place-items:center;padding:0;border:0;border-radius:0;background:transparent;font-size:0}.adversary-feature{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.3fr) minmax(0,1fr) auto;gap:8px;padding:8px 10px;border:1px solid #d8cec0;background:#fffaf2}.adversary-feature>.template-editor-field:nth-of-type(4){grid-column:1/-1}@media(max-width:760px){.adversary-identity,.adversary-description,.adversary-combat,.adversary-feature{grid-template-columns:minmax(0,1fr)}.adversary-identity>*,.adversary-description>*,.adversary-feature>.template-editor-field:nth-of-type(4){grid-column:1!important}}
`;

const tierOptions = ["1", "2", "3", "4"];
const kindOptions = ["斗士", "集群", "头目", "杂兵", "远程", "潜伏", "社交", "独狼", "标准", "辅助"];
const rangeOptions = ["近战", "邻近", "近距离", "远距离", "极远"];
const damageTypeOptions = ["物理", "魔法"];
const featureTypeOptions = ["动作", "被动", "反应"];
const emptyFeature = { 特性名称: "新特性", 特性原文: "", 特性类型: "动作", 特性描述: "" };

export function AdversaryAuthoringEditor({ data, onValue, onData }: TemplateAuthoringEditorProps) {
  const features = Array.isArray(data.特性) ? data.特性 as Record<string, unknown>[] : [];
  const field = (path: string, label: string, options?: readonly string[]) => <EditorInput label={label} value={data[path]} options={options} onChange={(value) => onValue(path, value)} />;
  const updateFeature = (index: number, path: string, value: string) => onValue("特性", features.map((item, rowIndex) => rowIndex === index ? { ...item, [path]: value } : item));
  const selectFeature = (index: number, label: string) => {
    const preset = adversaryFeaturePresets.find((item) => item.label === label);
    if (!preset) return;
    onValue("特性", features.map((item, rowIndex) => rowIndex === index ? {
      ...item,
      特性名称: preset.name,
      特性原文: preset.original,
      特性类型: preset.type ?? item.特性类型,
      特性描述: preset.description,
    } : item));
  };

  return <div className="adversary-editor"><style>{styles}</style>
    <section className="adversary-editor-group adversary-identity" data-authoring-section="identity">
      {field("名称", "名称")}{field("原文", "原文")}{field("位阶", "位阶", tierOptions)}{field("种类", "种类", kindOptions)}{field("类型", "类型")}
    </section>
    <section className="adversary-editor-group adversary-description" data-authoring-section="description">
      <EditorTextarea label="简介" value={data.简介} onChange={(value) => onValue("简介", value)} />
      {field("动机与战术", "动机与战术")}{field("经历", "经历")}
    </section>
    <section className="adversary-editor-group adversary-combat" data-authoring-section="combat">
      <AdversaryStatPresetControl data={data} onData={onData} />
      {field("难度", "难度")}{field("重度伤害阈值", "重度阈值")}{field("严重伤害阈值", "严重阈值")}{field("生命点", "生命")}{field("压力点", "压力")}
      {field("攻击命中", "攻击")}{field("攻击武器", "武器")}{field("攻击范围", "范围", rangeOptions)}{field("攻击伤害", "伤害")}{field("攻击属性", "类型", damageTypeOptions)}
    </section>
    <section className="adversary-editor-group adversary-features" data-authoring-section="features"><header><h3>特性</h3><button type="button" onClick={() => onValue("特性", [...features, { ...emptyFeature }])}>＋ 新增</button></header>
      {features.map((feature, index) => <article className="adversary-feature" key={index}>
        <EditorInput label="特性名称" value={feature.特性名称} options={adversaryFeaturePresets.map((item) => item.label)} onOptionSelect={(label) => selectFeature(index, label)} onChange={(value) => updateFeature(index, "特性名称", value)} />
        <EditorInput label="特性原文" value={feature.特性原文} onChange={(value) => updateFeature(index, "特性原文", value)} />
        <EditorInput label="特性类型" value={feature.特性类型} options={featureTypeOptions} onChange={(value) => updateFeature(index, "特性类型", value)} />
        <ArrayItemActions item={feature} index={index} count={features.length} onClear={() => onValue("特性", features.map((item, rowIndex) => rowIndex === index ? { ...emptyFeature } : item))} onDelete={() => onValue("特性", features.filter((_, row) => row !== index))} onMove={(offset) => onValue("特性", moveArrayItem(features, index, offset))} />
        <EditorTextarea label="特性描述" value={feature.特性描述} onChange={(value) => updateFeature(index, "特性描述", value)} />

      </article>)}
    </section>
  </div>;
}

export const adversaryAuthoring: TemplateAuthoringCapability = {
  templateId: "敌人",
  templateVersion: "1.0.4",
  Editor: AdversaryAuthoringEditor,
};
