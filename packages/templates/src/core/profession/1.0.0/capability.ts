import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";
import { temporaryProfessionTemplate, type TemporaryProfessionData } from "../0.0.0-dev.1/capability.ts";

export type ProfessionData = TemporaryProfessionData;

function upgrade(data: unknown): ProfessionData {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Profession Template upgrade requires an object");
  return structuredClone(data) as ProfessionData;
}

export const professionTemplate = deepFreeze<TemplateCoreCapability<ProfessionData>>({
  ...temporaryProfessionTemplate,
  version: "1.0.0",
  schema,
  rendererRevision: "profession-card-r1",
  defaultPresentation: { ...temporaryProfessionTemplate.defaultPresentation, width: "63", height: "88" },
  upgradeFrom: { version: "0.0.0-dev.1", upgrade },
});
