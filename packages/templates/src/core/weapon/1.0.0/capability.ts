import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type WeaponData = {
  名称: string; 类型: string; 属性: string; 距离: string; 伤害: string; 负荷: string;
  伤害类型: string; 描述: string; 风味描述: string; 位阶: string;
};

const defaultData: WeaponData = {
  名称: "", 类型: "武器", 属性: "", 距离: "", 伤害: "", 负荷: "", 伤害类型: "",
  描述: "", 风味描述: "", 位阶: "",
};

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export const weaponTemplate = deepFreeze<TemplateCoreCapability<WeaponData>>({
  id: "武器",
  version: "1.0.0",
  state: "development",
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
