import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";
import { temporaryItemTemplate, type TemporaryItemData } from "../0.0.0-dev.1/capability.ts";

export type ItemData = TemporaryItemData;

function upgrade(data: unknown): ItemData {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Item Template upgrade requires an object");
  return structuredClone(data) as ItemData;
}

export const itemTemplate = deepFreeze<TemplateCoreCapability<ItemData>>({
  ...temporaryItemTemplate,
  version: "1.0.0",
  schema,
  rendererRevision: "item-card-r1",
  upgradeFrom: { version: "0.0.0-dev.1", upgrade },
});
