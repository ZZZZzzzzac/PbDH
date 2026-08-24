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
  upgradeFrom: null,
});
