import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type TemporaryItemData = {
  名称: string;
  类型: "物品" | "消耗品";
  掷骰: string;
  描述: string;
  风味描述: string;
};

const defaultData: TemporaryItemData = {
  名称: "",
  类型: "物品",
  掷骰: "",
  描述: "",
  风味描述: "",
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export const temporaryItemTemplate = deepFreeze<TemplateCoreCapability<TemporaryItemData>>({
  id: "物品",
  version: "0.0.0-dev.1",
  state: "development",
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
  defaultPresentation: {
    width: "63", height: "88", unit: "mm", mode: "text", fixedRatio: true,
  },
  rendererRevision: "temporary-item-r0",
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() {
      return {};
    },
    commands: [],
    replacements: [],
  },
  upgradeFrom: null,
});
