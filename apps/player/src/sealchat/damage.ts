export const weaponIds = ["primary-weapon-name", "secondary-weapon-name"] as const;
export type WeaponId = typeof weaponIds[number];
export interface WeaponSnapshot { id: WeaponId; text: string; proficiency: number }
// 额外伤害来源在此显式合并；后续装备/能力可注入同一接口，不解析特性自然语言。
export interface DamageAdjustment { diceCountDelta: number; flat: number; extraDice: string }
export interface DamageRequest { weapon: WeaponSnapshot; adjustments: DamageAdjustment[]; reason: string }
export function parseWeapon(text: string) {
  const parts = text.split(/[｜|]/);
  const damage = parts[3]?.trim() ?? "";
  const match = /^(?:1)?d(\d+)(?:\s*([+-])\s*(\d+))?(?:\s*(?:物理|魔法|法术))?$/i.exec(damage);
  if (!match) throw Error("武器伤害须为 d8+3 这类单骰条目，请先编辑武器。");
  const sides = Number(match[1]);
  const fixed = (match[2] === "-" ? -1 : 1) * Number(match[3] ?? 0);
  if (!Number.isSafeInteger(sides) || sides < 2 || sides > 1000 || !Number.isSafeInteger(fixed) || Math.abs(fixed) > 1_000_000) throw Error("武器伤害超出范围。");
  return { name: parts[0].replace(/[*_~\x60]/g, "").trim(), sides, fixed };
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
  const base = parseWeapon(request.weapon.text);
  let count = request.weapon.proficiency, fixed = base.fixed, extra = "";
  if (!Number.isSafeInteger(count) || count < 0 || count > 6 || request.adjustments.length > 20) throw Error("熟练度或伤害来源无效。");
  for (const effect of request.adjustments) {
    if (!Number.isSafeInteger(effect.diceCountDelta) || Math.abs(effect.diceCountDelta) > 100 || !Number.isSafeInteger(effect.flat) || Math.abs(effect.flat) > 1_000_000) throw Error("伤害调整值须为范围内的整数。");
    count += effect.diceCountDelta; fixed += effect.flat; extra += extraDiceTerms(effect.extraDice);
  }
  if (count < 0 || count > 100 || Math.abs(fixed) > 1_000_000 || extra.length > 500) throw Error("总伤害公式超出范围。");
  return (count ? count + "d" + base.sides : "0") + (fixed ? (fixed > 0 ? "+" : "") + fixed : "") + extra;
}
export function damageCommand(request: DamageRequest, latest: WeaponSnapshot): string {
  if (!weaponIds.includes(request.weapon.id) || JSON.stringify(request.weapon) !== JSON.stringify(latest)) throw Error("武器或熟练度已变化，请重新打开伤害助手。");
  const name = parseWeapon(latest.text).name;
  const reason = request.reason.trim();
  if (/[\u0000-\u001f\u007f]/.test(reason + name) || reason.length > 200 || name.length > 100) throw Error("伤害原因或武器名称须为单行文字。");
  return ".r " + damageFormula(request) + " 伤害：" + name + (reason ? " · " + reason : "");
}
