import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type WeaponData = {
  名称: string; 原文?: string; 类型: string; 属性: string; 距离: string; 伤害: string; 负荷: string;
  伤害类型: string; 特性名称: string; 特性原文?: string; 特性描述: string; 简介: string; 位阶: string;
};

const defaultData: WeaponData = {
  名称: "", 原文: "", 类型: "主武器", 属性: "", 距离: "", 伤害: "", 负荷: "", 伤害类型: "",
  特性名称: "", 特性原文: "", 特性描述: "", 简介: "", 位阶: "",
};

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export const weaponTemplate = deepFreeze<TemplateCoreCapability<WeaponData>>({
  id: "武器",
  version: "1.0.0",
  state: "published",
  schema,
  defaultData,
  proposeResourceId(data) {
    return normalize(data.名称 || "未命名武器").normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || "未命名武器");
    const summary = [data.类型, data.属性, data.距离, data.伤害].map(normalize).filter(Boolean).join(" · ");
    const searchText = Object.values(data).map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { mode: "text", fixedRatio: true },
  rendererRevision: "weapon-card-r2",
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() { return {}; },
    commands: [],
    replacements: [],
  },
});
