import schema from "./schema.json";
import { deepFreeze, type TemplateCoreCapability } from "../../types";
import { sharedTabletopReplacements } from "../../shared-replacements";

export type HopefindSupplyData = {
  名称: string; 原文?: string; 类型: string; 简介: string; 尺寸: string;
  内容: Array<{ 名称: string; 原文?: string; 描述: string }>;
};
const normalize = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
export function supplyFieldEntries(data: HopefindSupplyData): Array<[string, string]> { return [["尺寸", data.尺寸]]; }
export const hopefindSupplyTemplate = deepFreeze<TemplateCoreCapability<HopefindSupplyData>>({
  id: "寻望物资", version: "1.0.0", state: "published", schema,
  defaultData: { 名称: "", 原文: "", 类型: "物资", 简介: "", 内容: [], 尺寸: "1×1" },
  rendererRevision: "hopefind-supply-card-r1",
  proposeResourceId(data) { return normalize(data.名称 || "未命名寻望物资").normalize("NFC").replaceAll("/", "-"); },
  project(data) {
    return { title: normalize(data.名称 || "未命名寻望物资"), summary: `${data.尺寸} · ${normalize(data.简介)}`,
      searchText: [data.名称, data.类型, data.简介, data.尺寸, ...data.内容.flatMap((block) => [block.名称, block.描述])].map(normalize).join(" ") };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { mode: "text", fixedRatio: true },
  tabletop: { stateSchema: { type: "object", properties: {}, additionalProperties: false }, defaultState() { return {}; }, commands: [], replacements: sharedTabletopReplacements },
});
