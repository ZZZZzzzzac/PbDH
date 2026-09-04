import schema from "./schema.json";
import { upgradeFrom100 } from "./upgrade.ts";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type ProfessionData = {
  名称: string; 原文?: string; 类型: string; 简介: string; 领域: string[]; 生命点: string; 闪避值: string; 职业物品: string;
  希望特性: { 特性名称: string; 特性原文?: string; 特性描述: string }; 特性: Array<{ 特性名称: string; 特性原文?: string; 特性描述: string }>;
  推荐初始属性: { 敏捷: string; 力量: string; 灵巧: string; 本能: string; 风度: string; 知识: string }; 推荐初始武器: string;
  推荐初始护甲: string; 背景问题: string[]; 关系问题: string[];
};

const defaultData: ProfessionData = {
  名称: "", 原文: "", 类型: "职业", 简介: "", 领域: [], 生命点: "", 闪避值: "", 职业物品: "",
  希望特性: { 特性名称: "", 特性原文: "", 特性描述: "" }, 特性: [],
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
  version: "1.0.1",
  state: "published",
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
    const searchText = [...Object.values(data), ...features.flatMap((feature) => [feature.特性名称, feature.特性原文, feature.特性描述])].flatMap(searchableValues)
      .map(String).map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { mode: "text", fixedRatio: false },
  rendererRevision: "profession-card-r3",
  upgrades: [upgradeFrom100],
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() { return {}; },
    commands: [],
    replacements: [],
  },
});
