import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";
import { temporaryDomainTemplate, type TemporaryDomainData } from "../0.0.0-dev.1/capability.ts";

export type DomainData = TemporaryDomainData;

function upgrade(data: unknown): DomainData {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Domain Template upgrade requires an object");
  return structuredClone(data) as DomainData;
}

export const domainTemplate = deepFreeze<TemplateCoreCapability<DomainData>>({
  ...temporaryDomainTemplate,
  version: "1.0.0",
  schema,
  rendererRevision: "domain-card-r1",
  upgradeFrom: { version: "0.0.0-dev.1", upgrade },
});
