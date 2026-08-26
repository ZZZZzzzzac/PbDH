import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type TemporaryEnvironmentFeature = { 名称: string; 类型: string; 描述: string; 引导问题: string };
export type TemporaryEnvironmentData = {
  名称: string;
  位阶: string;
  种类: string;
  简介: string;
  趋向: string;
  难度: string;
  潜在敌人: string;
  特性: TemporaryEnvironmentFeature[];
};

const defaultData: TemporaryEnvironmentData = {
  名称: "", 位阶: "", 种类: "", 简介: "", 趋向: "", 难度: "", 潜在敌人: "", 特性: [],
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export const temporaryEnvironmentTemplate = deepFreeze<TemplateCoreCapability<TemporaryEnvironmentData>>({
  id: "环境",
  version: "0.0.0-dev.1",
  state: "development",
  schema,
  defaultData,
  proposeResourceId(data) {
    return normalize(data.名称 || "未命名环境").normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || "未命名环境");
    const summary = [data.位阶, data.种类, data.难度 ? `难度 ${data.难度}` : ""]
      .map(normalize).filter(Boolean).join(" · ");
    const searchText = [data.名称, data.位阶, data.种类, data.简介, data.趋向, data.难度, data.潜在敌人,
      ...data.特性.flatMap((feature) => [feature.名称, feature.类型, feature.描述, feature.引导问题])]
      .map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { width: "90", height: "142", unit: "mm", mode: "text", fixedRatio: true },
  rendererRevision: "temporary-environment-r0",
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() {
      return {};
    },
    commands: [], replacements: [],
  },
  upgradeFrom: null,
});
