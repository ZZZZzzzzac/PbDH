import {
  materializeResourceConversion,
  type ResourceConversionMaterialization,
  type TemporaryResourceBatch,
} from "@pbdh/resource-conversion";
import { currentTemplates } from "@pbdh/templates/core";

export type CreatorResourceConversionCandidate = ResourceConversionMaterialization;

export async function materializeCreatorResourceConversion(
  batch: TemporaryResourceBatch,
): Promise<CreatorResourceConversionCandidate> {
  return materializeResourceConversion({
    batch,
    targets: [],
    diagnosticNamespace: "creator",
    templates: currentTemplates,
  });
}
