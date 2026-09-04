import schema from "./schema.json";
import { upgradeFrom100 } from "./upgrade.ts";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type SubclassData = {
  名称: string; 原文?: string; 类型: string; 主职: string; 等级: string; 施法属性: string;
  特性: Array<{ 特性名称: string; 特性原文?: string; 特性描述: string }>; 简介: string;
};

const defaultData: SubclassData = { 名称: "", 原文: "", 类型: "子职业", 主职: "", 等级: "", 施法属性: "", 特性: [], 简介: "" };

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export const subclassTemplate = deepFreeze<TemplateCoreCapability<SubclassData>>({
  id: "子职业",
  version: "1.0.1",
  state: "published",
  schema,
  defaultData,
  proposeResourceId(data) {
    return `${normalize(data.主职)}:${normalize(data.名称 || "未命名子职业")}:${data.等级}`
      .normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || "未命名子职业");
    const summary = [data.主职, data.等级, data.施法属性].map(normalize).filter(Boolean).join(" · ");
    const features = Array.isArray(data.特性) ? data.特性 : [];
    const searchText = [data.名称, data.原文, data.类型, data.主职, data.等级, data.施法属性, data.简介,
      ...features.flatMap((feature) => [feature.特性名称, feature.特性原文, feature.特性描述])].map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { mode: "text", fixedRatio: true },
  rendererRevision: "subclass-card-r3",
  upgrades: [upgradeFrom100],
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() { return {}; },
    commands: [],
    replacements: [],
  },
});
