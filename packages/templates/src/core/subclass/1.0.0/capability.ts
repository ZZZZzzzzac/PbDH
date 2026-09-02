import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type SubclassData = {
  名称: string; 原文?: string; 类型: string; 主职: string; 等级: string; 施法属性: string; 描述: string; 风味描述: string;
};

const defaultData: SubclassData = { 名称: "", 原文: "", 类型: "子职业", 主职: "", 等级: "", 施法属性: "", 描述: "", 风味描述: "" };

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export const subclassTemplate = deepFreeze<TemplateCoreCapability<SubclassData>>({
  id: "子职业",
  version: "1.0.0",
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
  defaultPresentation: { mode: "text", fixedRatio: true },
  rendererRevision: "subclass-card-r1",
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() { return {}; },
    commands: [],
    replacements: [],
  },
});
