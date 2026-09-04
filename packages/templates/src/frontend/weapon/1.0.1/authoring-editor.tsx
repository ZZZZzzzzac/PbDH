import { EditorInput, EditorTextarea } from "../../authoring-primitives.tsx";
import { weaponFeaturePresets } from "../../feature-presets.ts";
import { standardEditorStyles } from "../../standard-editor-styles.ts";
import type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "../../types.ts";

export const weaponTraitOptions = ["敏捷", "力量", "灵巧", "本能", "风度", "知识"] as const;
export const weaponRangeOptions = ["近战", "邻近", "近距离", "远距离", "极远"] as const;
export const weaponBurdenOptions = ["单手", "双手"] as const;
export const weaponDamageTypeOptions = ["物理", "魔法"] as const;
export const weaponTypeOptions = ["主武器", "副武器"] as const;

export function WeaponAuthoringEditor({ data, onValue, onData }: TemplateAuthoringEditorProps) {
  const field = (path: string, options?: readonly string[]) => (
    <EditorInput label={path} value={data[path]} options={options} onChange={(value) => onValue(path, value)} />
  );
  const selectFeature = (label: string) => {
    const preset = weaponFeaturePresets.find((item) => item.label === label);
    if (!preset) return;
    onData?.({ ...data, 特性名称: preset.name, 特性原文: preset.original, 特性描述: preset.description });
  };

  return <div className="template-owned-editor weapon-editor">
    <style>{standardEditorStyles + `.weapon-editor .identity,.weapon-editor .feature{grid-template-columns:repeat(2,minmax(0,1fr))}.weapon-editor .combat{grid-template-columns:repeat(6,minmax(0,1fr))}.weapon-editor .combat>:nth-child(-n+3){grid-column:span 2}.weapon-editor .combat>:nth-child(n+4){grid-column:span 3}@media(max-width:760px){.weapon-editor .combat>*{grid-column:1!important}}`}</style>
    <section className="identity">
      {field("名称")}<EditorInput label="原文" value={data.原文} onChange={(value) => onValue("原文", value)} />{field("位阶")}{field("类型", weaponTypeOptions)}
      <div className="template-editor-span-all"><EditorTextarea label="简介" value={data.简介} onChange={(value) => onValue("简介", value)} /></div>
    </section>
    <section className="combat">{field("属性", weaponTraitOptions)}{field("距离", weaponRangeOptions)}{field("负荷", weaponBurdenOptions)}{field("伤害")}{field("伤害类型", weaponDamageTypeOptions)}</section>
    <section className="feature"><EditorInput label="特性名称" value={data.特性名称} options={weaponFeaturePresets.map((item) => item.label)} onOptionSelect={selectFeature} onChange={(value) => onValue("特性名称", value)} /><EditorInput label="特性原文" value={data.特性原文} onChange={(value) => onValue("特性原文", value)} /><div className="template-editor-span-all"><EditorTextarea label="特性描述" value={data.特性描述} onChange={(value) => onValue("特性描述", value)} /></div></section>
  </div>;
}

export const weaponAuthoring: TemplateAuthoringCapability = {
  templateId: "武器",
  templateVersion: "1.0.1",
  Editor: WeaponAuthoringEditor,
};
