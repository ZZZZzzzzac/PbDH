import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type TemporaryDomainData = {
  名称: string;
  领域: string;
  等级: string;
  属性: string;
  回想: string;
  描述: string;
  风味描述: string;
};

const defaultData: TemporaryDomainData = {
  名称: "", 领域: "", 等级: "", 属性: "", 回想: "", 描述: "", 风味描述: "",
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export const temporaryDomainTemplate = deepFreeze<TemplateCoreCapability<TemporaryDomainData>>({
  id: "领域卡",
  version: "0.0.0-dev.1",
  state: "development",
  schema,
  defaultData,
  proposeResourceId(data) {
    return `${normalize(data.领域)}:${normalize(data.名称 || "未命名领域卡")}`.normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || "未命名领域卡");
    const summary = [data.领域, data.等级 ? `${data.等级}级` : "", data.属性, data.回想 ? `${data.回想}⚡` : ""]
      .map(normalize).filter(Boolean).join(" · ");
    const searchText = Object.values(data).map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { width: "63", height: "88", unit: "mm", mode: "text", fixedRatio: true },
  rendererRevision: "temporary-domain-r0",
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() {
      return {};
    },
    commands: [], replacements: [],
  },
  upgradeFrom: null,
});
