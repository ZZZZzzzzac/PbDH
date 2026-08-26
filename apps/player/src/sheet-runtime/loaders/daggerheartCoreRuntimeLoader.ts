import type { SystemPackageDocument } from "@pbdh/contract-runtime";

import presetJson from "../../daggerheart-core-preset.generated.json";
import type { ResourceLibrary as PlatformResourceLibrary } from "../../resources/resource-library.ts";
import {
  buildSheetResourceLibraryInputs,
  buildSheetRuntimeMediaAssets,
  type PlatformMediaReferenceResolver,
} from "../adapters/platformResourceLibraries.ts";
import {
  loadPresetSystemPackage,
  type PresetSystemPackage,
} from "./presetSystemPackageLoader.ts";
import type { PackageLoadResult } from "./systemPackageLoader.ts";

const daggerheartCorePreset = presetJson as PresetSystemPackage;

export async function loadDaggerheartCoreRuntimePackage(input: {
  currentSystem: SystemPackageDocument;
  installedPackages: PlatformResourceLibrary;
  baseUrl?: string;
  fetchFile?: typeof fetch;
  resolveMediaReference?: PlatformMediaReferenceResolver;
}): Promise<PackageLoadResult> {
  const loaded = await loadPresetSystemPackage(
    daggerheartCorePreset,
    input.baseUrl ?? import.meta.env.BASE_URL,
    input.fetchFile ?? fetch,
    undefined,
    {
      resourceLibraries: buildSheetResourceLibraryInputs({
        currentSystem: input.currentSystem,
        installedPackages: input.installedPackages,
        resolveMediaReference: input.resolveMediaReference,
      }),
      packageAssets: buildSheetRuntimeMediaAssets(input.installedPackages),
    },
  );
  return loaded;
}

export { daggerheartCorePreset };
