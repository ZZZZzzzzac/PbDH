import type { SystemPackageDocument } from "@pbdh/contract-runtime";
import {
  materializeResourceConversion,
  type ResourceConversionMaterialization,
  type TemporaryResourceBatch,
} from "@pbdh/resource-conversion";
import { currentTemplates } from "@pbdh/templates/core";

export type PlayerResourceConversionCandidate = ResourceConversionMaterialization;

export async function materializePlayerResourceConversion(
  batch: TemporaryResourceBatch,
  currentSystem: SystemPackageDocument,
): Promise<PlayerResourceConversionCandidate> {
  return materializeResourceConversion({
    batch,
    targets: [{
      systemPackageId: currentSystem.package.id,
      version: currentSystem.package.version,
    }],
    diagnosticNamespace: "player",
    templates: currentTemplates,
  });
}
