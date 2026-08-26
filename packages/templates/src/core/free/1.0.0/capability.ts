import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type FreeContentBlock = {
  标题: string;
  正文: string;
};

export type FreeData = {
  名称: string;
  类型: string;
  简介: string;
  内容: FreeContentBlock[];
};

const defaultData: FreeData = {
  名称: "",
  类型: "自由资源",
  简介: "",
  内容: [],
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export const freeTemplate = deepFreeze<TemplateCoreCapability<FreeData>>({
  id: "自由",
  version: "1.0.0",
  state: "published",
  schema,
  defaultData,
  proposeResourceId(data) {
    return normalize(data.名称 || "未命名自由资源").normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || "未命名自由资源");
    const summary = normalize(data.类型);
    const searchText = [data.名称, data.类型, data.简介, ...data.内容.flatMap((block) => [block.标题, block.正文])]
      .map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: {
    width: "90", height: "142", unit: "mm", mode: "text", fixedRatio: true,
  },
  rendererRevision: "free-card-r1",
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
