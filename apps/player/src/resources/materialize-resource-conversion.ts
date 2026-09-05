import type { SystemPackageDocument } from "@pbdh/contract-runtime";
import {
  materializeResourceConversion,
  type ResourceMediaNormalizer,
  type ResourceConversionMaterialization,
  type TemporaryResourceBatch,
} from "@pbdh/resource-conversion";
import { admitResourceImageBytes } from "@pbdh/media-admission";
import { currentTemplates } from "@pbdh/templates/core";

export type PlayerResourceConversionCandidate = ResourceConversionMaterialization;

const normalizeImportedResourceMedia: ResourceMediaNormalizer = async ({ bytes, fileName }) => {
  const admitted = await admitResourceImageBytes(bytes, fileName);
  return admitted;
};

export async function materializePlayerResourceConversion(
  batch: TemporaryResourceBatch,
  currentSystem: SystemPackageDocument,
  normalizeMedia: ResourceMediaNormalizer = normalizeImportedResourceMedia,
): Promise<PlayerResourceConversionCandidate> {
  return materializeResourceConversion({
    batch,
    targets: [{
      systemPackageId: currentSystem.package.id,
      version: currentSystem.package.version,
    }],
    diagnosticNamespace: "player",
    templates: currentTemplates,
    normalizeMedia,
  });
}
