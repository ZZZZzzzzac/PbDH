import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";
import {
  adversaryTemplate as legacyAdversaryTemplate,
  type AdversaryData,
} from "../1.0.0-alpha.1/capability.ts";

export type { AdversaryData, AdversaryFeature } from "../1.0.0-alpha.1/capability.ts";

export const adversaryTemplate = deepFreeze<TemplateCoreCapability<AdversaryData>>({
  ...legacyAdversaryTemplate,
  version: "1.0.0",
  state: "development",
  schema,
  defaultPresentation: { ...legacyAdversaryTemplate.defaultPresentation, width: "63", height: "88" },
  tabletop: {
    ...legacyAdversaryTemplate.tabletop,
    replacements: [{ id: "alternate-form", label: "切换形态" }],
    editableDataFields: [
      ["名称"], ["原文"], ["位阶"], ["种类"], ["简介"], ["动机与战术"],
      ["难度"], ["重度伤害阈值"], ["严重伤害阈值"], ["生命点"], ["压力点"],
      ["攻击命中"], ["攻击武器"], ["攻击范围"], ["攻击伤害"], ["攻击属性"], ["经历"],
      ["特性", "*", "名称"], ["特性", "*", "原名"], ["特性", "*", "类型"], ["特性", "*", "特性描述"],
    ],
  },
  upgradeFrom: null,
});
