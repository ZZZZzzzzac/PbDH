import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";
import {
  temporaryEnvironmentTemplate,
  type TemporaryEnvironmentData,
} from "../0.0.0-dev.1/capability.ts";

export type EnvironmentFeature = {
  名称: string;
  原名: string;
  类型: string;
  描述: string;
  引导问题: string;
};

export type EnvironmentData = Omit<TemporaryEnvironmentData, "特性"> & {
  原文: string;
  特性: EnvironmentFeature[];
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function upgradeLegacyEnvironment(data: unknown): EnvironmentData {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Environment Template upgrade requires an object");
  }
  const legacy = structuredClone(data) as TemporaryEnvironmentData;
  if (!Array.isArray(legacy.特性)) {
    throw new Error("Environment Template upgrade requires feature data");
  }
  return {
    ...legacy,
    原文: "",
    特性: legacy.特性.map((feature) => ({ ...feature, 原名: "" })),
  };
}

const defaultData: EnvironmentData = {
  名称: "",
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
  version: "1.0.0",
  state: "development",
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
      data.名称, data.原文, data.位阶, data.种类, data.简介, data.趋向, data.难度, data.潜在敌人,
      ...data.特性.flatMap((feature) => [feature.名称, feature.原名, feature.类型, feature.描述, feature.引导问题]),
    ].map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { width: "63", height: "88", unit: "mm", mode: "text", fixedRatio: true },
  rendererRevision: "environment-card-r1",
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() {
      return {};
    },
    commands: [],
    replacements: [],
  },
  upgradeFrom: {
    version: temporaryEnvironmentTemplate.version,
    upgrade: upgradeLegacyEnvironment,
  },
});
