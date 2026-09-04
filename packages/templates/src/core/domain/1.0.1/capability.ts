import schema from "./schema.json";
import { upgradeFrom100 } from "./upgrade.ts";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type DomainData = {
  名称: string; 原文?: string; 类型: string; 领域: string; 等级: string; 属性: string; 回想: string; 特性描述: string; 简介: string;
};

const defaultData: DomainData = { 名称: "", 原文: "", 类型: "领域卡", 领域: "", 等级: "", 属性: "", 回想: "", 特性描述: "", 简介: "" };

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export const domainTemplate = deepFreeze<TemplateCoreCapability<DomainData>>({
  id: "领域卡",
  version: "1.0.1",
  state: "published",
  schema,
  defaultData,
  proposeResourceId(data) {
    return `${normalize(data.领域)}:${normalize(data.名称 || "未命名领域卡")}`.normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || "未命名领域卡");
    const summary = [data.领域, data.等级 ? `${data.等级}级` : "", data.属性, data.回想?.replaceAll("⚡", "")]
      .map(normalize).filter(Boolean).join(" · ");
    const searchText = Object.values(data).map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { mode: "text", fixedRatio: true },
  rendererRevision: "domain-card-r2",
  upgrades: [upgradeFrom100],
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() { return {}; },
    commands: [],
    replacements: [],
  },
});
