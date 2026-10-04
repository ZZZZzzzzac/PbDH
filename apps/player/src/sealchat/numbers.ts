import type { Trait } from "./roll.ts";
export const traitModules: Record<string, Trait> = {
  agility: "敏捷", strength: "力量", finesse: "灵巧", instinct: "本能", presence: "风度", knowledge: "知识",
};
export const numberFields = {
  agility: { attr: "敏捷", min: -1_000_000, max: 1_000_000 },
  strength: { attr: "力量", min: -1_000_000, max: 1_000_000 },
  finesse: { attr: "灵巧", min: -1_000_000, max: 1_000_000 },
  instinct: { attr: "本能", min: -1_000_000, max: 1_000_000 },
  presence: { attr: "风度", min: -1_000_000, max: 1_000_000 },
  knowledge: { attr: "知识", min: -1_000_000, max: 1_000_000 },
  evasion: { attr: "闪避", min: 0, max: 1_000_000 },
  "armor-value": { attr: "护甲上限", min: 0, max: 60 },
  "major-threshold": { attr: "重伤阈值", min: 0, max: 1_000_000 },
  "severe-threshold": { attr: "严重阈值", min: 0, max: 1_000_000 },
} as const;
export type NumberId = keyof typeof numberFields;
export type Numbers = Record<NumberId, number | null>;
export function numberId(id: string): NumberId | null { return Object.hasOwn(numberFields, id) ? id as NumberId : null; }
export function readNumbers(attrs: Record<string, unknown>): Numbers {
  return Object.fromEntries(Object.entries(numberFields).map(([id, field]) => {
    const raw = attrs[field.attr];
    const n = typeof raw === "number" ? raw : typeof raw === "string" && /^[+-]?\d+$/.test(raw.trim()) ? Number(raw) : NaN;
    return [id, Number.isSafeInteger(n) && n >= field.min && n <= field.max ? n : null];
  })) as Numbers;
}
