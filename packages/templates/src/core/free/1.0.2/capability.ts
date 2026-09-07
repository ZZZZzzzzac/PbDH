import schema from "./schema.json";
import { upgradeFrom101 } from "./upgrade.ts";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type FreeContentBlock = {
  名称: string;
  原文?: string;
  描述: string;
};

export type FreeData = {
  名称: string;
  原文?: string;
  类型: string;
  简介: string;
  内容: FreeContentBlock[];
  [key: string]: string | FreeContentBlock[] | undefined;
};

export const freeFixedFieldNames = ["名称", "原文", "类型", "简介", "内容"] as const;
const freeFixedFieldNameSet = new Set<string>(freeFixedFieldNames);

export function freeFieldEntries(data: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(data).flatMap(([key, value]) =>
    !freeFixedFieldNameSet.has(key) && typeof value === "string" ? [[key, value]] : []);
}

const defaultData: FreeData = {
  名称: "",
  原文: "",
  类型: "自由",
  简介: "",
  内容: [],
};

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export const freeTemplate = deepFreeze<TemplateCoreCapability<FreeData>>({
  id: "自由",
  version: "1.0.2",
  state: "published",
  schema,
  defaultData,
  proposeResourceId(data) {
    return normalize(data.名称 || "未命名自由资源").normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || "未命名自由资源");
    const summary = normalize(data.简介 || data.内容[0]?.描述 || "");
    const searchText = [data.名称, data.原文, data.类型, data.简介, ...freeFieldEntries(data).flat(), ...data.内容.flatMap((block) => [block.名称, block.原文, block.描述])]
      .map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: {
    mode: "text", fixedRatio: true,
  },
    rendererRevision: "free-card-r5",
  upgrades: [upgradeFrom101],
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() {
      return {};
    },
    commands: [],
    replacements: [],
  },
});
