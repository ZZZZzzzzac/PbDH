import type { CharacterData } from "./characterData";

// 此映射只属于 Daggerheart Core → 海豹骰的外部格式，不参与平台角色规则或保存。
export function daggerheartSealDiceExperiences(data: CharacterData): string {
  const experiences: { name: string; modifier: number }[] = [];
  for (let slot = 1; slot <= 5; slot += 1) {
    const value = data.character.values[`experience-${slot}`];
    const name = typeof value === "string" ? value.trim() : "";
    if (!name) continue;
    if (name.length > 60 || /[\u0000-\u001f\u007f]/u.test(name)) {
      throw new Error(`经历 ${slot} 的名称须为 1–60 字的单行文字。`);
    }
    const raw = data.character.values[`experience-modifier-${slot}`];
    const modifier = typeof raw === "string" && /^[+-]?\d+$/u.test(raw.trim()) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(modifier) || Math.abs(modifier) > 20) {
      throw new Error(`经历 ${slot} 的修正须为 -20 至 20 的整数。`);
    }
    experiences.push({ name, modifier });
  }
  // 两层字符串：内层为小型版本化 JSON，外层为 DiceScript 字符串字面量。
  // 即使列表为空也导出，重复录卡时清除旧经历。
  // .st 会全局规范化全角符号；先转为 Unicode 转义，避免经历名称被改写。
  const json = JSON.stringify({ schemaVersion: 1, experiences }).replace(/[\u007f-\uffff]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return `DH经历=${JSON.stringify(json)}`;
}
