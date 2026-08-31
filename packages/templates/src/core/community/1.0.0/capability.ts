import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type CommunityData = {
  名称: string; 简介: string; 性格: string; 特性: { 名称: string; 描述: string };
};

const defaultData: CommunityData = { 名称: "", 简介: "", 性格: "", 特性: { 名称: "", 描述: "" } };

function normalize(value: string): string { return value.trim().replace(/\s+/g, " "); }

export const communityTemplate = deepFreeze<TemplateCoreCapability<CommunityData>>({
  id: "社群",
  version: "1.0.0",
  state: "development",
  schema,
  defaultData,
  proposeResourceId(data) {
    return normalize(data.名称 || "未命名社群").normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || "未命名社群");
    const summary = [data.性格, data.特性.名称].map(normalize).filter(Boolean).join(" · ");
    const searchText = [data.名称, data.简介, data.性格, data.特性.名称, data.特性.描述]
      .map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { mode: "text", fixedRatio: true },
  rendererRevision: "community-card-r1",
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() { return {}; },
    commands: [],
    replacements: [],
  },
});
