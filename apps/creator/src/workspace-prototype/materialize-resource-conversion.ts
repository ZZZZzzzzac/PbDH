import {
  materializeResourceConversion,
  type ResourceMediaNormalizer,
  type ResourceConversionMaterialization,
  type TemporaryResourceBatch,
} from "@pbdh/resource-conversion";
import { admitResourceImageBytes } from "@pbdh/media-admission";
import { currentTemplates } from "@pbdh/templates/core";

export type CreatorResourceConversionCandidate = ResourceConversionMaterialization;

const normalizeImportedResourceMedia: ResourceMediaNormalizer = async ({ bytes, fileName }) => {
  const admitted = await admitResourceImageBytes(bytes, fileName);
  return admitted;
};

export async function materializeCreatorResourceConversion(
  batch: TemporaryResourceBatch,
  normalizeMedia: ResourceMediaNormalizer = normalizeImportedResourceMedia,
): Promise<CreatorResourceConversionCandidate> {
  return materializeResourceConversion({
    batch,
    targets: [],
    diagnosticNamespace: "creator",
    templates: currentTemplates,
    normalizeMedia,
  });
}
