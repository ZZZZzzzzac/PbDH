// 本项目 sealpack 0.4.7 的命令/经历协议；不依赖或复制宿主实现。
export const traits = ["敏捷", "力量", "灵巧", "本能", "风度", "知识"] as const;
export type Trait = typeof traits[number];
export interface Experience { name: string; modifier: number }
export interface DiceData {
  traits: Record<Trait, number | null>;
  experiences: Experience[];
  experienceRevision: string;
  experienceError: string;
}
export interface RollOptions {
  mode: "action" | "reaction";
  edge: "normal" | "adv" | "dis";
  modifier: string;
  difficulty: string;
  reason: string;
  experienceIndices: number[];
  experienceRevision: string;
}
export interface RollRequest { trait: Trait; options: RollOptions; expression?: string }

export function experienceRevision(items: Experience[]): string {
  let hash = 5381;
  const text = JSON.stringify({ schemaVersion: 1, experiences: items });
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(16).padStart(8, "0");
}

export function readDiceData(attrs: Record<string, unknown>): DiceData {
  const values = Object.fromEntries(traits.map(trait => {
    const raw = attrs[trait];
    const value = typeof raw === "number" ? raw : typeof raw === "string" && /^[+-]?\d+$/.test(raw.trim()) ? Number(raw) : NaN;
    return [trait, Number.isSafeInteger(value) ? value : null];
  })) as Record<Trait, number | null>;
  let experiences: Experience[] = [];
  let experienceError = "";
  try {
    const raw = attrs.DH经历;
    if (raw !== undefined && raw !== null && raw !== "") {
      if (typeof raw !== "string" || raw.length > 4096) throw Error();
      const doc: unknown = JSON.parse(raw);
      if (!doc || typeof doc !== "object" || !("schemaVersion" in doc) || doc.schemaVersion !== 1 || !("experiences" in doc)
          || !Array.isArray(doc.experiences) || doc.experiences.length > 5) throw Error();
      experiences = doc.experiences.map((item: unknown) => {
        if (!item || typeof item !== "object" || !("name" in item) || !("modifier" in item)) throw Error();
        const name = typeof item.name === "string" ? item.name.trim() : "";
        const modifier = typeof item.modifier === "number" ? item.modifier : typeof item.modifier === "string" && /^[+-]?\d+$/.test(item.modifier.trim()) ? Number(item.modifier) : NaN;
        if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name) || !Number.isSafeInteger(modifier) || Math.abs(modifier) > 20) throw Error();
        return { name, modifier };
      });
    }
  } catch { experienceError = "Dice 经历数据无效，请重新导入。"; }
  return { traits: values, experiences, experienceRevision: experienceRevision(experiences), experienceError };
}

function numberOption(raw: string, label: string, integer = false): number | null {
  const text = raw.trim();
  if (!text) return null;
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) throw Error(`${label}必须是数字。`);
  const value = Number(text);
  if (!Number.isFinite(value) || Math.abs(value) > 1_000_000 || (integer && (!Number.isSafeInteger(value) || value < 0))) throw Error(`${label}超出范围。`);
  return value;
}

export function rollCommand(request: RollRequest, data: DiceData, hope: number | null): string {
  const { trait, options: o } = request;
  if (!traits.includes(trait) || data.traits[trait] === null) throw Error("Dice 尚未录入此特质。明确的 0 可以掷骰。");
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
  const parts = [o.mode === "reaction" ? ".ddr" : ".dd", trait];
  if (modifier) parts.push((modifier > 0 ? "+" : "") + modifier);
  if (o.edge !== "normal") parts.push(o.edge);
  if (indices.length) parts.push(`exp=${indices.join(",")}@${o.experienceRevision}`);
  if (difficulty !== null) parts.push(`dc${difficulty}`);
  if (reason) parts.push("--", reason);
  const command = request.expression?.trim() || parts.join(" ");
  if (!/^\.ddr?(?:\s|$)/.test(command) || /[\u0000-\u001f\u007f]/.test(command) || command.length > 1000) throw Error("手动公式只接受单行 .dd / .ddr 指令。");
  if (indices.length && command !== parts.join(" ")) throw Error("使用经历时请通过选项调整公式，或取消勾选后手动编辑。");
  return command;
}
