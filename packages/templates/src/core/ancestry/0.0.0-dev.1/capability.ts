import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type TemporaryAncestryFeature = { 名称: string; 描述: string };
export type TemporaryAncestryData = {
  名称: string;
  简介: string;
  特性: TemporaryAncestryFeature[];
};

const defaultData: TemporaryAncestryData = { 名称: "", 简介: "", 特性: [] };

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export const temporaryAncestryTemplate = deepFreeze<TemplateCoreCapability<TemporaryAncestryData>>({
  id: "种族",
  version: "0.0.0-dev.1",
  state: "development",
  schema,
  defaultData,
  proposeResourceId(data) {
    return normalize(data.名称 || "未命名种族").normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || "未命名种族");
    const summary = data.特性.map((feature) => normalize(feature.名称)).filter(Boolean).join(" · ");
    const searchText = [data.名称, data.简介, ...data.特性.flatMap((feature) => [feature.名称, feature.描述])]
      .map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { width: "90", height: "142", unit: "mm", mode: "text", fixedRatio: true },
  rendererRevision: "temporary-ancestry-r0",
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
