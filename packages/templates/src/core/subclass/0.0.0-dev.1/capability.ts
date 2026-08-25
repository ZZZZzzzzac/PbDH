import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type TemporarySubclassData = {
  名称: string;
  主职: string;
  等级: "基础" | "进阶" | "精通";
  施法属性: string;
  描述: string;
  风味描述: string;
};

const defaultData: TemporarySubclassData = {
  名称: "", 主职: "", 等级: "基础", 施法属性: "", 描述: "", 风味描述: "",
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export const temporarySubclassTemplate = deepFreeze<TemplateCoreCapability<TemporarySubclassData>>({
  id: "子职业",
  version: "0.0.0-dev.1",
  state: "development",
  schema,
  defaultData,
  proposeResourceId(data) {
    return `${normalize(data.主职)}:${normalize(data.名称 || "未命名子职业")}:${data.等级}`
      .normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || "未命名子职业");
    const summary = [data.主职, data.等级, data.施法属性].map(normalize).filter(Boolean).join(" · ");
    const searchText = Object.values(data).map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { width: "90", height: "142", unit: "mm", mode: "text", fixedRatio: true },
  rendererRevision: "temporary-subclass-r0",
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
