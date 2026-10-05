// iframe 掷骰仅消费 PbDH 当前存档；Dice 不需要保存属性或经历。
export const traits = ["敏捷", "力量", "灵巧", "本能", "风度", "知识"] as const;
export type Trait = typeof traits[number];
export const traitModules: Record<string, Trait> = { agility: "敏捷", strength: "力量", finesse: "灵巧", instinct: "本能", presence: "风度", knowledge: "知识" };
export interface Experience { name: string; modifier: number }
export interface RollData { traits: Record<Trait, number | null>; experiences: Experience[]; experienceRevision: string; experienceError: string }
export interface RollOptions { mode: "action" | "reaction"; edge: "normal" | "adv" | "dis"; modifier: string; difficulty: string; reason: string; experienceIndices: number[]; experienceRevision: string }
export interface RollRequest { trait: Trait; options: RollOptions; expression?: string }
export const emptyRollData = (): RollData => ({ traits: Object.fromEntries(traits.map(t => [t, null])) as RollData["traits"], experiences: [], experienceRevision: experienceRevision([]), experienceError: "" });
export function experienceRevision(items: Experience[]): string {
  let hash = 5381;
  const text = JSON.stringify(items);
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(16).padStart(8, "0");
}
function integer(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && /^[+-]?\d+$/.test(raw.trim()) ? Number(raw) : NaN;
  return Number.isSafeInteger(n) && Math.abs(n) <= 1_000_000 ? n : null;
}
export function readPlayerRollData(values: Record<string, unknown>): RollData {
  const data = emptyRollData();
  for (const [id, trait] of Object.entries(traitModules)) data.traits[trait] = integer(values[id]);
  try {
    for (let slot = 1; slot <= 5; slot++) {
      const raw = values["experience-" + slot];
      const name = typeof raw === "string" ? raw.trim() : "";
      if (!name) continue;
      const modifier = integer(values["experience-modifier-" + slot]);
      if (name.length > 60 || /[\u0000-\u001f\u007f]/.test(name) || modifier === null || Math.abs(modifier) > 20) throw Error();
      data.experiences.push({ name, modifier });
    }
  } catch { data.experienceError = "请检查 PbDH 经历名称和整数修正。"; data.experiences = []; }
  data.experienceRevision = experienceRevision(data.experiences);
  return data;
}
function numberOption(raw: string, label: string, integerOnly = false): number | null {
  const text = raw.trim(); if (!text) return null;
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) throw Error(label + "必须是数字。");
  const n = Number(text);
  if (!Number.isFinite(n) || Math.abs(n) > 1_000_000 || (integerOnly && (!Number.isSafeInteger(n) || n < 0))) throw Error(label + "超出范围。");
  return n;
}
export function rollCommand(request: RollRequest, data: RollData, hope: number | null): string {
  const { trait, options: o } = request;
  if (!traits.includes(trait) || data.traits[trait] === null) throw Error("PbDH 尚未填写此特质。明确的 0 可以掷骰。");
  if (!["action", "reaction"].includes(o.mode) || !["normal", "adv", "dis"].includes(o.edge)) throw Error("掷骰模式无效。");
  const modifier = numberOption(o.modifier, "修正");
  const difficulty = numberOption(o.difficulty, "难度", true);
  const reason = o.reason.trim();
  if (/[\u0000-\u001f\u007f]/.test(reason) || reason.length > 200) throw Error("原因须为不超过 200 字的单行文字。");
  const indices = o.experienceIndices;
  if (indices.length) {
    if (data.experienceError || data.experienceRevision !== o.experienceRevision) throw Error("经历已变化，请重新勾选。");
    if (indices.length > 5 || new Set(indices).size !== indices.length || indices.some(n => !Number.isInteger(n) || n < 1 || !data.experiences[n - 1])) throw Error("经历选择无效。");
    if (hope === null || hope < indices.length) throw Error("希望不足，无法使用所选经历。");
  }
  let arithmetic = String(data.traits[trait]);
  for (const n of [...indices.map(i => data.experiences[i - 1]!.modifier), modifier ?? 0]) if (n) arithmetic += (n > 0 ? "+" : "") + n;
  const parts = [o.mode === "reaction" ? ".ddr" : ".dd", arithmetic];
  if (o.edge !== "normal") parts.push(o.edge);
  if (indices.length) parts.push(indices.length === 1 ? "hope" : "hope" + indices.length);
  if (difficulty !== null) parts.push("dc" + difficulty);
  const labels = [trait, ...indices.map(i => data.experiences[i - 1]!.name), reason].filter(Boolean).join(" · ");
  parts.push("--", labels);
  const command = request.expression?.trim() || parts.join(" ");
  if (!/^\.ddr?(?:\s|$)/.test(command) || /[\u0000-\u001f\u007f]/.test(command) || command.length > 1000) throw Error("手动公式只接受单行 .dd / .ddr 指令。");
  if (indices.length && command !== parts.join(" ")) throw Error("使用经历时请通过选项调整公式，或取消勾选后手动编辑。");
  return command;
}
