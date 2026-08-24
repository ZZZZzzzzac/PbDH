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
  upgradeFrom: null,
});
