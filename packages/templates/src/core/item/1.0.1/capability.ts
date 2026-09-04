import schema from "./schema.json";
import { upgradeFrom100 } from "./upgrade.ts";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type ItemData = {
  名称: string; 原文?: string; 类型: string; 掷骰: string; 特性描述: string; 简介: string;
};

const defaultData: ItemData = { 名称: "", 原文: "", 类型: "物品", 掷骰: "", 特性描述: "", 简介: "" };

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export const itemTemplate = deepFreeze<TemplateCoreCapability<ItemData>>({
  id: "物品",
  version: "1.0.1",
  state: "published",
  schema,
  defaultData,
  proposeResourceId(data) {
    return normalize(data.名称 || "未命名物品").normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || "未命名物品");
    const summary = [data.类型, data.掷骰].map(normalize).filter(Boolean).join(" · ");
    const searchText = Object.values(data).map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { mode: "text", fixedRatio: true },
  rendererRevision: "item-card-r2",
  upgrades: [upgradeFrom100],
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() { return {}; },
    commands: [],
    replacements: [],
  },
});
