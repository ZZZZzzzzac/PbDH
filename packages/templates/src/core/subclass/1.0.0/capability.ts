import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";
import { temporarySubclassTemplate, type TemporarySubclassData } from "../0.0.0-dev.1/capability.ts";

export type SubclassData = TemporarySubclassData;

function upgrade(data: unknown): SubclassData {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Subclass Template upgrade requires an object");
  return structuredClone(data) as SubclassData;
}

export const subclassTemplate = deepFreeze<TemplateCoreCapability<SubclassData>>({
  ...temporarySubclassTemplate,
  version: "1.0.0",
  schema,
  rendererRevision: "subclass-card-r1",
  upgradeFrom: { version: "0.0.0-dev.1", upgrade },
});
