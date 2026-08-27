import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";
import {
  temporaryArmorTemplate,
  type TemporaryArmorData,
} from "../0.0.0-dev.1/capability.ts";

export type ArmorData = TemporaryArmorData;

function upgradeLegacyArmor(data: unknown): ArmorData {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Armor Template upgrade requires an object");
  }
  return structuredClone(data) as ArmorData;
}

export const armorTemplate = deepFreeze<TemplateCoreCapability<ArmorData>>({
  ...temporaryArmorTemplate,
  version: "1.0.0",
  state: "development",
  schema,
  rendererRevision: "armor-card-r1",
  upgradeFrom: {
    version: "0.0.0-dev.1",
    upgrade: upgradeLegacyArmor,
  },
});
