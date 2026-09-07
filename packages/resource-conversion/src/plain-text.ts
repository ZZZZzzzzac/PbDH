import type { JsonObject, JsonValue, ResourceKind } from "./types.ts";

/** 只在第三方数据映射到当前模板时使用，不改写原始文件或 PBRES。 */
export function normalizePlainTextFields(data: JsonObject, kind: ResourceKind): JsonObject {
  const markdownPaths = new Set([
    "简介", "特性描述", "特性.特性描述", "希望特性.特性描述",
    ...(kind === "adversary" ? ["动机与战术", "经历"] : []),
    ...(kind === "environment" ? ["趋向", "潜在敌人", "特性.引导问题"] : []),
    ...(kind === "community" ? ["性格"] : []),
    ...(kind === "class" ? ["职业物品"] : []),
    ...(kind === "free" ? ["内容.描述"] : []),
    ...(kind === "weapon" || kind === "armor" ? ["特性名称"] : []),
  ]);
  function visit(value: JsonValue, path: string): JsonValue {
    if (typeof value === "string") return markdownPaths.has(path) ? value : markdownToPlainText(value);
    if (Array.isArray(value)) return value.map((item) => visit(item, path));
    if (value && typeof value === "object") return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, visit(item, path ? `${path}.${key}` : key)]),
    );
    return value;
  }
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, visit(value, key)]));
}

export function markdownToPlainText(value: string): string {
  return value
    .replace(/!?(\[([^\]\n]*)\])\([^\n)]*\)/g, "$2")
    .replace(/(`+)([^`\n]+)\1/g, "$2")
    .replace(/(\*{1,3})(?=\S)([^\n]*?\S)\1/g, "$2")
    .replace(/(?<![\p{L}\p{N}_])(_{1,3})(?=\S)([^\n]*?\S)\1(?![\p{L}\p{N}_])/gu, "$2")
    .replace(/~~(?=\S)([^\n]*?\S)~~/g, "$1")
    .replace(/^ {0,3}(?:#{1,6}\s+|>\s?|[-+*]\s+|\d+[.)]\s+)/gm, "")
    .replace(/\\([\\`*{}\[\]()#+.!_>~-])/g, "$1");
}
