import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type TemporaryArmorData = {
  名称: string;
  类型: string;
  护甲值: string;
  重度伤害阈值: string;
  严重伤害阈值: string;
  描述: string;
  风味描述: string;
  位阶: string;
};

const defaultData: TemporaryArmorData = {
  名称: "",
  类型: "护甲",
  护甲值: "",
  重度伤害阈值: "",
  严重伤害阈值: "",
  描述: "",
  风味描述: "",
  位阶: "",
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export const temporaryArmorTemplate = deepFreeze<TemplateCoreCapability<TemporaryArmorData>>({
  id: "护甲",
  version: "0.0.0-dev.1",
  state: "development",
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
  defaultPresentation: {
    width: "90",
    height: "142",
    unit: "mm",
    mode: "text",
    fixedRatio: true,
  },
  rendererRevision: "temporary-armor-r0",
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
