import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";
import { sharedTabletopReplacements } from "../../shared-replacements.ts";

/**
 * 罗德岛旅记（tttri）子职：一个主职子职在某一阶段（T1–T4Y）的卡面。
 * 与 daggerheart 的「子职业」模板互不共用：这里的阶段、武器原型与三特性覆盖字段由 tttri 的 Sheet 逻辑消费。
 */
export type RhodesSubclassData = {
  名称: string; 原文?: string; 类型: string; 主职: string; 等级: string; 阶段: string; 施法属性: string;
  推荐次领域?: string; 武器原型: string; 子职提升?: string;
  子职特性?: string; 职业特性?: string; 希望特性?: string;
  特性: Array<{ 特性名称: string; 特性原文?: string; 特性描述: string }>; 简介: string;
};

const defaultData: RhodesSubclassData = {
  名称: "", 原文: "", 类型: "子职", 主职: "", 等级: "", 阶段: "", 施法属性: "",
  推荐次领域: "", 武器原型: "", 子职提升: "", 子职特性: "", 职业特性: "", 希望特性: "",
  特性: [], 简介: "",
};

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export const rhodesSubclassTemplate = deepFreeze<TemplateCoreCapability<RhodesSubclassData>>({
  id: "罗德岛子职",
  version: "1.0.0",
  state: "published",
  schema,
  defaultData,
  proposeResourceId(data) {
    return `子职:${normalize(data.主职)}:${normalize(data.名称 || "未命名子职")}:${normalize(data.阶段)}`
      .normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || "未命名罗德岛子职");
    const summary = [data.主职, data.阶段, data.等级, data.施法属性].map(normalize).filter(Boolean).join(" · ");
    const features = Array.isArray(data.特性) ? data.特性 : [];
    const searchText = [
      data.名称, data.原文, data.类型, data.主职, data.等级, data.阶段, data.施法属性,
      data.推荐次领域, data.武器原型, data.子职提升, data.子职特性, data.职业特性, data.希望特性, data.简介,
      ...features.flatMap((feature) => [feature.特性名称, feature.特性原文, feature.特性描述]),
    ].map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { mode: "text", fixedRatio: true },
  rendererRevision: "rhodes-subclass-card-r1",
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() { return {}; },
    commands: [],
    replacements: sharedTabletopReplacements,
  },
});
