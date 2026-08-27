import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";
import { temporaryCommunityTemplate, type TemporaryCommunityData } from "../0.0.0-dev.1/capability.ts";

export type CommunityData = TemporaryCommunityData;

function upgrade(data: unknown): CommunityData {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Community Template upgrade requires an object");
  return structuredClone(data) as CommunityData;
}

export const communityTemplate = deepFreeze<TemplateCoreCapability<CommunityData>>({
  ...temporaryCommunityTemplate,
  version: "1.0.0",
  schema,
  rendererRevision: "community-card-r1",
  upgradeFrom: { version: "0.0.0-dev.1", upgrade },
});
