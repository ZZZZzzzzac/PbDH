export const weaponIds = ["primary-weapon-name", "secondary-weapon-name"] as const;
export type WeaponId = typeof weaponIds[number];
export interface WeaponSnapshot { id: WeaponId; text: string; proficiency: number }
export interface DamageValues { proficiency: number; die: string; fixed: number }
// 后续装备/能力可显式注入额外伤害，不解析特性自然语言，也不增加弹窗输入。
export interface DamageAdjustment { diceCountDelta: number; flat: number; extraDice: string }
export interface DamageRequest { weapon: WeaponSnapshot; values: DamageValues; adjustments?: DamageAdjustment[] }
export function weaponLabel(id: WeaponId): string { return id === "primary-weapon-name" ? "主武器" : "副武器"; }
export function weaponName(text: string): string { return text.split(/[｜|]/)[0].replace(/[*_~`]/g, "").trim(); }
export function parseWeapon(text: string) {
  // 只扫描伤害骰条目，不依赖摘要分隔符；允许 D、空格和多位整数。
  const match = /d\s*(\d+)(?:\s*([+-])\s*(\d+))?/i.exec(text);
  if (!match) throw Error("未识别武器伤害，请手动填写伤害骰大小与固定调整值。");
  const sides = Number(match[1]);
  const fixed = (match[2] === "-" ? -1 : 1) * Number(match[3] ?? 0);
  if (!Number.isSafeInteger(sides) || sides < 2 || sides > 1000 || !Number.isSafeInteger(fixed) || Math.abs(fixed) > 1_000_000) throw Error("武器伤害超出范围。");
  return { name: weaponName(text), sides, fixed };
}
export function weaponDamageDefaults(weapon: WeaponSnapshot) {
  let die = "", fixed = 0;
  try { const parsed = parseWeapon(weapon.text); die = "d" + parsed.sides; fixed = parsed.fixed; } catch { /* 无可识别摘要时允许手动填写，不猜测伤害骰。 */ }
  return { proficiency: String(weapon.proficiency), die, fixed: (fixed >= 0 ? "+" : "") + fixed };
}
function extraDiceTerms(raw: string): string {
  const text = raw.replace(/\s/g, "").toLowerCase();
  if (!text) return "";
  if (!/^[+-]?(?:\d{0,3}d\d{1,4})(?:[+-]\d{0,3}d\d{1,4})*$/.test(text)) throw Error("额外骰请输入 1d6+1d4 这类公式。");
  for (const term of text.matchAll(/(\d*)d(\d+)/g)) {
    const count = Number(term[1] || 1), sides = Number(term[2]);
    if (count < 1 || count > 100 || sides < 2 || sides > 1000) throw Error("额外伤害骰超出范围。");
  }
  return /^[+-]/.test(text) ? text : "+" + text;
}
export function damageFormula(request: DamageRequest): string {
  const die = /^d\s*(\d+)$/i.exec(request.values.die.trim());
  if (!die || Number(die[1]) < 2 || Number(die[1]) > 1000) throw Error("伤害骰大小请输入 d6、d8 这类单骰条目。");
  let count = request.values.proficiency, fixed = request.values.fixed, extra = "";
  const adjustments = request.adjustments ?? [];
  if (!Number.isSafeInteger(count) || count < 0 || count > 100) throw Error("熟练值须为 0 至 100 的整数。");
  if (!Number.isSafeInteger(fixed) || Math.abs(fixed) > 1_000_000 || adjustments.length > 20) throw Error("固定调整值须为范围内的整数。");
  for (const effect of adjustments) {
    if (!Number.isSafeInteger(effect.diceCountDelta) || Math.abs(effect.diceCountDelta) > 100 || !Number.isSafeInteger(effect.flat) || Math.abs(effect.flat) > 1_000_000) throw Error("伤害调整值须为范围内的整数。");
    count += effect.diceCountDelta; fixed += effect.flat; extra += extraDiceTerms(effect.extraDice);
  }
  if (count < 0 || count > 100 || Math.abs(fixed) > 1_000_000 || extra.length > 500) throw Error("总伤害公式超出范围。");
  return (count ? count + "d" + Number(die[1]) : "0") + (fixed ? (fixed > 0 ? "+" : "") + fixed : "") + extra;
}
export function damageCommand(request: DamageRequest, latest: WeaponSnapshot): string {
  const source = request.weapon;
  if (!weaponIds.includes(source.id) || source.id !== latest.id || source.text !== latest.text || source.proficiency !== latest.proficiency) throw Error("武器或熟练度已变化，请重新打开伤害助手。");
  return ".r " + damageFormula(request) + " " + weaponLabel(source.id);
}
