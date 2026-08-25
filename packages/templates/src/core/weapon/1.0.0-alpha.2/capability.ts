import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type WeaponDataV2 = {
  名称: string;
  类型: string;
  属性: string;
  距离: string;
  伤害: string;
  负荷: string;
  伤害类型: string;
  描述: string;
  风味描述: string;
  位阶: string;
};

const defaultData: WeaponDataV2 = {
  名称: "",
  类型: "主武器",
  属性: "",
  距离: "",
  伤害: "",
  负荷: "",
  伤害类型: "",
  描述: "",
  风味描述: "",
  位阶: "",
};

function normalizeSearchPart(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function upgrade(data: unknown): WeaponDataV2 {
  const source = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};
  return Object.fromEntries(Object.keys(defaultData).map((key) => [
    key,
    key === "风味描述" ? "" : typeof source[key] === "string" ? source[key] : defaultData[key as keyof WeaponDataV2],
  ])) as WeaponDataV2;
}

export const weaponTemplateV2 = deepFreeze<TemplateCoreCapability<WeaponDataV2>>({
  id: "武器",
  version: "1.0.0-alpha.2",
  state: "development",
  schema,
  defaultData,
  proposeResourceId(data) {
    const candidate = normalizeSearchPart(data.名称 || "未命名武器");
    return candidate.normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalizeSearchPart(data.名称 || "未命名武器");
    const summary = [data.类型, data.属性, data.距离, data.伤害]
      .map(normalizeSearchPart)
      .filter(Boolean)
      .join(" · ");
    const searchText = Object.values(data).map(normalizeSearchPart).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [
    { id: "portrait", label: "主图", required: false, accepts: ["image/webp"] },
  ],
  defaultPresentation: {
    width: "90",
    height: "142",
    unit: "mm",
    mode: "text",
    fixedRatio: true,
  },
  rendererRevision: "weapon-card-r2",
  tabletop: {
    stateSchema: { type: "object", properties: {}, additionalProperties: false },
    defaultState() {
      return {};
    },
    commands: [],
    replacements: [],
  },
  upgradeFrom: { version: "1.0.0-alpha.1", upgrade },
});
