import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type ProfessionData = {
  名称: string; 原文?: string; 类型: string; 风味描述: string; 领域: string[]; 生命点: string; 闪避值: string; 职业物品: string;
  希望特性: { 名称: string; 原名?: string; 特性描述: string }; 特性: Array<{ 名称: string; 原名?: string; 特性描述: string }>;
  推荐初始属性: { 敏捷: string; 力量: string; 灵巧: string; 本能: string; 风度: string; 知识: string }; 推荐初始武器: string;
  推荐初始护甲: string; 背景问题: string[]; 关系问题: string[];
};

const professionAttributeNames = ["敏捷", "力量", "灵巧", "本能", "风度", "知识"] as const;

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function namedFeature(value: unknown): { 名称: string; 原名: string; 特性描述: string } {
  const source = record(value);
  if (Object.keys(source).length > 0) return { 名称: text(source.名称), 原名: text(source.原名), 特性描述: text(source.特性描述 ?? source.描述) };
  const raw = text(value).trim();
  const marker = /^(?::red\[)?(?:\*\*)?([^*：:\]]+)(?:\*\*)?(?:\])?[：:]\s*/u.exec(raw);
  return marker
    ? { 名称: marker[1]!.trim(), 原名: "", 特性描述: raw.slice(marker[0].length).trim() }
    : { 名称: "", 原名: "", 特性描述: raw };
}

function namedFeatures(value: unknown): Array<{ 名称: string; 原名: string; 特性描述: string }> {
  if (Array.isArray(value)) return value.map(namedFeature);
  const source = text(value).trim();
  if (!source) return [];
  const markers = [...source.matchAll(/(?:^|\n\n?)(?::red\[)?(?:\*\*)?([^*：:\]\n]+)(?:\*\*)?(?:\])?[：:]\s*/gu)];
  if (markers.length === 0) return [namedFeature(source)];
  return markers.map((marker, index) => ({
    名称: marker[1]!.trim(), 原名: "",
    特性描述: source.slice(marker.index! + marker[0].length, markers[index + 1]?.index ?? source.length).trim(),
  }));
}

/** 将开发期旧职业字段收敛为当前 1.0.0 结构，供本地草稿与旧导入继续编辑。 */
export function normalizeProfessionData(value: unknown): ProfessionData {
  const source = record(value);
  const attributeSource = source.推荐初始属性;
  const attributeEntries = Array.isArray(attributeSource)
    ? attributeSource.flatMap((item) => Object.entries(record(item)))
    : Object.entries(record(attributeSource));
  const attributes = Object.fromEntries(professionAttributeNames.map((name) => [name, ""])) as ProfessionData["推荐初始属性"];
  for (const [name, score] of attributeEntries) {
    if (professionAttributeNames.includes(name as typeof professionAttributeNames[number])) attributes[name as keyof typeof attributes] = text(score);
  }
  if (attributeEntries.length === 0) {
    for (const match of text(attributeSource).matchAll(/([^\s<>]+)\s+\*\*([^*]+)\*\*/gu)) {
      const name = match[1] as keyof typeof attributes;
      if (professionAttributeNames.includes(name)) attributes[name] = match[2]!;
    }
  }
  const list = (current: unknown, prefix: string) => Array.isArray(current)
    ? current.map(text)
    : [1, 2, 3].map((index) => text(source[`${prefix}${index}`])).filter(Boolean);
  const domains = Array.isArray(source.领域) ? source.领域.map(text) : text(source.领域).split("+").map((item) => item.trim()).filter(Boolean);
  const weapons = Array.isArray(source.推荐初始武器) ? source.推荐初始武器.map(text) : text(source.推荐初始武器).split("+");
  return {
    名称: text(source.名称), 原文: text(source.原文 ?? source.英文 ?? source.原名), 类型: text(source.类型 || "职业"),
    风味描述: text(source.风味描述 ?? source.描述), 领域: domains.slice(0, 2), 生命点: text(source.生命点), 闪避值: text(source.闪避值),
    职业物品: text(source.职业物品), 希望特性: namedFeature(source.希望特性), 特性: namedFeatures(source.特性 ?? source.职业特性),
    推荐初始属性: attributes, 推荐初始武器: weapons.map((item) => item.trim()).filter(Boolean).join(" + "), 推荐初始护甲: text(source.推荐初始护甲),
    背景问题: list(source.背景问题, "背景问题"), 关系问题: list(source.关系问题, "关系问题"),
  };
}

export function professionDataNeedsMigration(value: unknown): boolean {
  const source = record(value);
  return typeof source.希望特性 === "string" || !Array.isArray(source.特性) || Array.isArray(source.推荐初始属性)
    || Array.isArray(source.推荐初始武器) || typeof source.领域 === "string" || (!("风味描述" in source) && "描述" in source)
    || (!Array.isArray(source.背景问题) && "背景问题1" in source) || (!Array.isArray(source.关系问题) && "关系问题1" in source);
}

const defaultData: ProfessionData = {
  名称: "", 原文: "", 类型: "职业", 风味描述: "", 领域: [], 生命点: "", 闪避值: "", 职业物品: "",
  希望特性: { 名称: "", 原名: "", 特性描述: "" }, 特性: [],
  推荐初始属性: { 敏捷: "", 力量: "", 灵巧: "", 本能: "", 风度: "", 知识: "" }, 推荐初始武器: "", 推荐初始护甲: "", 背景问题: [],
  关系问题: [],
};

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function searchableValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(searchableValues);
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => [key, ...searchableValues(item)]);
  return [String(value ?? "")];
}

export const professionTemplate = deepFreeze<TemplateCoreCapability<ProfessionData>>({
  id: "职业",
  version: "1.0.0",
  state: "development",
  schema,
  defaultData,
  proposeResourceId(data) {
    return normalize(data.名称 || "未命名职业").normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || "未命名职业");
    const summary = [...data.领域, `生命 ${data.生命点}`, `闪避 ${data.闪避值}`]
      .map(normalize).filter((value) => !value.endsWith(" ")).join(" · ");
    const features = Array.isArray(data.特性) ? data.特性 : [];
    const searchText = [...Object.values(data), ...features.flatMap((feature) => [feature.名称, feature.原名, feature.特性描述])].flatMap(searchableValues)
      .map(String).map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { mode: "text", fixedRatio: false },
  rendererRevision: "profession-card-r2",
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() { return {}; },
    commands: [],
    replacements: [],
  },
});
