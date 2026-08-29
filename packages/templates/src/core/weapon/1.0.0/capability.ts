import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";
import {
  weaponTemplate as legacyWeaponTemplate,
  type WeaponData,
} from "../1.0.0-alpha.1/capability.ts";

export type { WeaponData } from "../1.0.0-alpha.1/capability.ts";

export const weaponTemplate = deepFreeze<TemplateCoreCapability<WeaponData>>({
  ...legacyWeaponTemplate,
  version: "1.0.0",
  state: "development",
  schema,
  defaultPresentation: { ...legacyWeaponTemplate.defaultPresentation, width: "63", height: "88" },
  tabletop: {
    ...legacyWeaponTemplate.tabletop,
    editableDataFields: [
      ["名称"], ["类型"], ["属性"], ["距离"], ["伤害"], ["负荷"], ["伤害类型"], ["描述"], ["位阶"],
    ],
  },
  upgradeFrom: null,
});
