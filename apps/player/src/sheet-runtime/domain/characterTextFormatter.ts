import type { CharacterData } from "./characterData";
import type { CharacterTextExport, CharacterTextExportField } from "./characterTextExport";

export function formatCharacterTextExport(
  definition: CharacterTextExport,
  characterData: CharacterData,
): string {
  const fields = definition.字段.flatMap((field) => {
    const value = readIntegerValue(field, characterData.character.values[field.模块ID]);
    return value === undefined ? [] : [replaceAll(field.模板, "{值}", value)];
  });
  return replaceAll(definition.模板, "{字段}", fields.join(definition.字段分隔符)).trim();
}

function readIntegerValue(field: CharacterTextExportField, value: unknown): string | undefined {
  if (field.取值 === "文本") {
    if (typeof value !== "string") return undefined;
    return normalizeInteger(value.trim());
  }
  if (typeof value !== "object" || value === null) return undefined;
  const countable = value as { current?: unknown; max?: unknown };
  return normalizeInteger(field.取值 === "当前值" ? countable.current : countable.max);
}

function normalizeInteger(value: unknown): string | undefined {
  if (typeof value === "number") return Number.isSafeInteger(value) ? String(value) : undefined;
  if (typeof value !== "string" || !/^[+-]?\d+$/u.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) ? String(number) : undefined;
}

function replaceAll(text: string, placeholder: string, value: string): string {
  return text.split(placeholder).join(value);
}
