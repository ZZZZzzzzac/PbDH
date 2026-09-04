import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type ArmorData = {
  名称: string; 原文?: string; 类型: string; 护甲值: string; 重度伤害阈值: string; 严重伤害阈值: string;
  特性名称: string; 特性原文?: string; 特性描述: string; 简介: string; 位阶: string;
};

const defaultData: ArmorData = {
  名称: "", 原文: "", 类型: "护甲", 护甲值: "", 重度伤害阈值: "", 严重伤害阈值: "",
  特性名称: "", 特性原文: "", 特性描述: "", 简介: "", 位阶: "",
};

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export const armorTemplate = deepFreeze<TemplateCoreCapability<ArmorData>>({
  id: "护甲",
  version: "1.0.0",
  state: "published",
  schema,
  defaultData,
  proposeResourceId(data) {
    return normalize(data.名称 || "未命名护甲").normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || "未命名护甲");
    const summary = [data.护甲值, data.重度伤害阈值, data.严重伤害阈值]
      .map(normalize).filter(Boolean).join(" · ");
    const searchText = Object.values(data).map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { mode: "text", fixedRatio: true },
  rendererRevision: "armor-card-r1",
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() { return {}; },
    commands: [],
    replacements: [],
  },
});
