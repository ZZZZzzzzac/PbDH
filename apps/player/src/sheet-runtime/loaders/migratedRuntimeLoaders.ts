import type { SystemPackageDocument } from "@pbdh/contract-runtime";

import howsMyDrivingResourcesJson from "../../hows-my-driving-legacy-resources.generated.json";
import howsMyDrivingPresetJson from "../../hows-my-driving-preset.generated.json";
import tttriResourcesJson from "../../tttri-legacy-resources.generated.json";
import tttriPresetJson from "../../tttri-preset.generated.json";
import witchyResourcesJson from "../../witchy-legacy-resources.generated.json";
import witchyPresetJson from "../../witchy-preset.generated.json";
import type { ResourceLibrary as PlatformResourceLibrary } from "../../resources/resource-library.ts";
import {
  buildSheetResourceLibraryInputs,
  buildSheetRuntimeMediaAssets,
  sheetRuntimeMediaPath,
  type PlatformMediaReferenceResolver,
} from "../adapters/platformResourceLibraries.ts";
import {
  loadPresetSystemPackage,
  type PresetSystemPackage,
} from "./presetSystemPackageLoader.ts";
import type { PackageLoadResult } from "./systemPackageLoader.ts";

type LegacyLibrary = {
  ID: string;
  名称: string;
  路径: string;
  entries: Array<Record<string, unknown> & { ID: string }>;
};

export const witchyPreset = witchyPresetJson as PresetSystemPackage;
export const howsMyDrivingPreset = howsMyDrivingPresetJson as PresetSystemPackage;
export const tttriPreset = tttriPresetJson as PresetSystemPackage;

export const loadWitchyRuntimePackage = migratedLoader(
  witchyPreset,
  witchyResourcesJson as LegacyLibrary[],
);
export const loadHowsMyDrivingRuntimePackage = migratedLoader(
  howsMyDrivingPreset,
  howsMyDrivingResourcesJson as LegacyLibrary[],
);
export const loadTttriRuntimePackage = migratedLoader(
  tttriPreset,
  tttriResourcesJson as LegacyLibrary[],
);

function migratedLoader(preset: PresetSystemPackage, legacyLibraries: LegacyLibrary[]) {
  return async function load(input: {
    currentSystem: SystemPackageDocument;
    installedPackages: PlatformResourceLibrary;
    baseUrl?: string;
    fetchFile?: typeof fetch;
    resolveMediaReference?: PlatformMediaReferenceResolver;
  }): Promise<PackageLoadResult> {
    const officialPackageId = preset.embeddedResourceIndex[0]?.packageId;
    const externalPackages = new Map([...input.installedPackages].filter(([packageId]) =>
      packageId !== officialPackageId));
    const externalInputs = buildSheetResourceLibraryInputs({
      currentSystem: input.currentSystem,
      installedPackages: externalPackages,
      resolveMediaReference: input.resolveMediaReference,
    });
    const officialPackage = officialPackageId
      ? input.installedPackages.get(officialPackageId)
      : undefined;
    const officialResources = new Map(officialPackage?.document.resources.map((resource) =>
      [resource.id, resource] as const) ?? []);
    const legacyInputs = legacyLibraries.map((library) => ({
      ID: library.ID,
      名称: library.名称,
      路径: library.路径,
      entries: library.entries.map((entry) => {
        const resource = officialResources.get(entry.ID);
        return {
          ...structuredClone(entry),
          ...(resource?.media.portrait ? {
            卡图: input.resolveMediaReference?.({ packageId: officialPackageId!, assetId: resource.media.portrait })
              ?? sheetRuntimeMediaPath(officialPackageId!, resource.media.portrait),
          } : {}),
          ...(resource?.media.back ? {
            卡背: input.resolveMediaReference?.({ packageId: officialPackageId!, assetId: resource.media.back })
              ?? sheetRuntimeMediaPath(officialPackageId!, resource.media.back),
          } : {}),
        };
      }),
    }));
    const mergedInputs = legacyInputs.map((legacy) => ({
      ...legacy,
      entries: [
        ...legacy.entries,
        ...(externalInputs.find((candidate) => candidate.ID === legacy.ID)?.entries ?? []),
      ],
    }));
    const legacyLibraryIds = new Set(legacyInputs.map((library) => library.ID));
    mergedInputs.push(...externalInputs.filter((library) => !legacyLibraryIds.has(library.ID)));

    return loadPresetSystemPackage(
      preset,
      input.baseUrl ?? import.meta.env.BASE_URL,
      input.fetchFile ?? fetch,
      undefined,
      {
        resourceLibraries: mergedInputs,
        packageAssets: buildSheetRuntimeMediaAssets(input.installedPackages),
      },
    );
  };
}
