import schema from "./schema.json";
import { upgradeFrom100 } from "./upgrade.ts";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type AncestryFeature = { 特性名称: string; 特性原文?: string; 特性描述: string };
export type AncestryData = { 名称: string; 原文?: string; 类型: string; 简介: string; 特性: AncestryFeature[] };

const defaultData: AncestryData = { 名称: "", 原文: "", 类型: "种族", 简介: "", 特性: [] };

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export const ancestryTemplate = deepFreeze<TemplateCoreCapability<AncestryData>>({
  id: "种族",
  version: "1.0.1",
  state: "published",
  schema,
  defaultData,
  proposeResourceId(data) {
    return normalize(data.名称 || "未命名种族").normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || "未命名种族");
    const summary = data.特性.map((feature) => normalize(feature.特性名称)).filter(Boolean).join(" · ");
    const searchText = [data.名称, data.原文, data.类型, data.简介, ...data.特性.flatMap((feature) => [feature.特性名称, feature.特性原文, feature.特性描述])]
      .map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { mode: "text", fixedRatio: true },
  rendererRevision: "ancestry-card-r2",
  upgrades: [upgradeFrom100],
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() { return {}; },
    commands: [],
    replacements: [],
  },
});
