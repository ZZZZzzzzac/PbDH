import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type ProfessionData = {
  名称: string; 类型: string; 描述: string; 领域: string[]; 生命点: string; 闪避值: string; 职业物品: string;
  希望特性: string; 职业特性: string; 推荐初始属性: Array<Record<string, string>>; 推荐初始武器: string[];
  推荐初始护甲: string; 背景问题: string[]; 关系问题: string[]; 施法属性: string;
};

const defaultData: ProfessionData = {
  名称: "", 类型: "职业", 描述: "", 领域: [], 生命点: "", 闪避值: "", 职业物品: "", 希望特性: "",
  职业特性: "", 推荐初始属性: [], 推荐初始武器: [], 推荐初始护甲: "", 背景问题: [],
  关系问题: [], 施法属性: "",
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
    const searchText = Object.values(data).flatMap(searchableValues)
      .map(String).map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { mode: "text", fixedRatio: true },
  rendererRevision: "profession-card-r1",
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() { return {}; },
    commands: [],
    replacements: [],
  },
});
