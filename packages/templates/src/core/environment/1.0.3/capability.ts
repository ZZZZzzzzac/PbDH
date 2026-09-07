import schema from "./schema.json";
import { upgradeFrom102 } from "./upgrade.ts";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type EnvironmentFeature = {
  特性名称: string;
  特性原文?: string;
  特性类型: string;
  特性描述: string;
  引导问题: string;
};

export type EnvironmentData = {
  名称: string;
  类型: string;
  原文?: string;
  位阶: string;
  种类: string;
  简介: string;
  趋向: string;
  难度: string;
  潜在敌人: string;
  特性: EnvironmentFeature[];
};

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

const defaultData: EnvironmentData = {
  名称: "",
  类型: "环境",
  原文: "",
  位阶: "1",
  种类: "探索",
  简介: "",
  趋向: "",
  难度: "",
  潜在敌人: "",
  特性: [],
};

export const environmentTemplate = deepFreeze<TemplateCoreCapability<EnvironmentData>>({
  id: "环境",
  version: "1.0.3",
  state: "published",
  schema,
  defaultData,
  proposeResourceId(data) {
    return normalize(data.名称 || "未命名环境").normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || "未命名环境");
    const summary = [data.位阶 ? `位阶 ${data.位阶}` : "", data.种类, data.难度 ? `难度 ${data.难度}` : ""]
      .map(normalize).filter(Boolean).join(" · ");
    const searchText = [
      data.名称, data.类型, data.原文, data.位阶, data.种类, data.简介, data.趋向, data.难度, data.潜在敌人,
      ...data.特性.flatMap((feature) => [feature.特性名称, feature.特性原文, feature.特性类型, feature.特性描述, feature.引导问题]),
    ].map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { mode: "text", fixedRatio: false },
  rendererRevision: "environment-card-r5",
  upgrades: [upgradeFrom102],
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() {
      return {};
    },
    commands: [],
    replacements: [],
  },
});
