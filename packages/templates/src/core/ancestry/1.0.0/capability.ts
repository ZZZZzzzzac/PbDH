import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";
import { temporaryAncestryTemplate, type TemporaryAncestryData, type TemporaryAncestryFeature } from "../0.0.0-dev.1/capability.ts";

export type AncestryFeature = TemporaryAncestryFeature;
export type AncestryData = TemporaryAncestryData;

function upgrade(data: unknown): AncestryData {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Ancestry Template upgrade requires an object");
  return structuredClone(data) as AncestryData;
}

export const ancestryTemplate = deepFreeze<TemplateCoreCapability<AncestryData>>({
  ...temporaryAncestryTemplate,
  version: "1.0.0",
  schema,
  rendererRevision: "ancestry-card-r1",
  defaultPresentation: { ...temporaryAncestryTemplate.defaultPresentation, width: "63", height: "88" },
  upgradeFrom: { version: "0.0.0-dev.1", upgrade },
});
