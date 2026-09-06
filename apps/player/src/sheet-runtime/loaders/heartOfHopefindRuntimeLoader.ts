import type { SystemPackageDocument } from "@pbdh/contract-runtime";

import presetJson from "../../heart-of-hopefind-preset.generated.json";
import type { ResourceLibrary as PlatformResourceLibrary } from "../../resources/resource-library.ts";
import {
  buildSheetResourceLibraryInputs,
  buildSheetRuntimeMediaAssets,
  type PlatformMediaReferenceResolver,
} from "../adapters/platformResourceLibraries.ts";
import {
  loadPresetSystemPackage,
  type PresetLoadProgress,
  type PresetSystemPackage,
} from "./presetSystemPackageLoader.ts";
import type { PackageLoadResult } from "./systemPackageLoader.ts";

const heartOfHopefindPreset = presetJson as PresetSystemPackage;

export async function loadHeartOfHopefindRuntimePackage(input: {
  currentSystem: SystemPackageDocument;
  installedPackages: PlatformResourceLibrary;
  baseUrl?: string;
  fetchFile?: typeof fetch;
  resolveMediaReference?: PlatformMediaReferenceResolver;
  onProgress?: (progress: PresetLoadProgress) => void;
  releaseVersion?: string;
}): Promise<PackageLoadResult> {
  return loadPresetSystemPackage(
    {
      ...heartOfHopefindPreset,
      releaseVersion: input.releaseVersion ?? heartOfHopefindPreset.releaseVersion,
    },
    input.baseUrl ?? import.meta.env.BASE_URL,
    input.fetchFile ?? fetch,
    input.onProgress,
    {
      resourceLibraries: buildSheetResourceLibraryInputs({
        currentSystem: input.currentSystem,
        installedPackages: input.installedPackages,
        resolveMediaReference: input.resolveMediaReference,
      }),
      packageAssets: buildSheetRuntimeMediaAssets(input.installedPackages),
    },
  );
}

export { heartOfHopefindPreset };
