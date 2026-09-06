import type { SystemPackageDocument } from "@pbdh/contract-runtime";

import howsMyDrivingPresetJson from "../../hows-my-driving-preset.generated.json";
import tttriPresetJson from "../../tttri-preset.generated.json";
import witchyPresetJson from "../../witchy-preset.generated.json";
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

export const witchyPreset = witchyPresetJson as PresetSystemPackage;
export const howsMyDrivingPreset = howsMyDrivingPresetJson as PresetSystemPackage;
export const tttriPreset = tttriPresetJson as PresetSystemPackage;

export const loadWitchyRuntimePackage = migratedLoader(
  witchyPreset,
  { 原型: { id: "archetypes", label: "原型" }, 使魔类型: { id: "familiar-types", label: "使魔类型" } },
);
export const loadHowsMyDrivingRuntimePackage = migratedLoader(
  howsMyDrivingPreset,
  { 原型: { id: "archetypes", label: "原型" }, 行事风格: { id: "approaches", label: "行事风格" }, 座驾: { id: "rides", label: "座驾" } },
  normalizeHowsMyDrivingArchetypes,
);
export const loadTttriRuntimePackage = migratedLoader(
  tttriPreset,
);

type NativeEntryByPathRoot = Record<string, { id: string; label: string }>;

function migratedLoader(
  preset: PresetSystemPackage,
  nativeEntryByPathRoot?: NativeEntryByPathRoot,
  normalizeResourceLibraries?: (
    libraries: ReturnType<typeof buildSheetResourceLibraryInputs>,
  ) => ReturnType<typeof buildSheetResourceLibraryInputs>,
) {
  return async function load(input: {
    currentSystem: SystemPackageDocument;
    installedPackages: PlatformResourceLibrary;
    baseUrl?: string;
    fetchFile?: typeof fetch;
    resolveMediaReference?: PlatformMediaReferenceResolver;
    onProgress?: (progress: PresetLoadProgress) => void;
    releaseVersion?: string;
  }): Promise<PackageLoadResult> {
    const installedPackages = routeOfficialFreeResourcesByPath(
      input.installedPackages,
      preset.embeddedResourceIndex[0]?.packageId,
      nativeEntryByPathRoot,
    );
    const rawResourceLibraries = buildSheetResourceLibraryInputs({
      currentSystem: input.currentSystem,
      installedPackages,
      resolveMediaReference: input.resolveMediaReference,
    });
    const resourceLibraries = normalizeResourceLibraries?.(rawResourceLibraries) ?? rawResourceLibraries;

    return loadPresetSystemPackage(
      {
        ...preset,
        releaseVersion: input.releaseVersion ?? preset.releaseVersion,
      },
      input.baseUrl ?? import.meta.env.BASE_URL,
      input.fetchFile ?? fetch,
      input.onProgress,
      {
        resourceLibraries,
        packageAssets: buildSheetRuntimeMediaAssets(installedPackages),
      },
    );
  };
}

function normalizeHowsMyDrivingArchetypes(
  resourceLibraries: ReturnType<typeof buildSheetResourceLibraryInputs>,
) {
  return resourceLibraries.map((library) => library.ID !== "archetypes" ? library : {
    ...library,
    entries: library.entries.map((entry) => ({
      ...entry,
      内容1名称: entry.内容1名称 ?? entry.增益名称 ?? "",
      内容1描述: entry.内容1描述 ?? entry.增益 ?? "",
      内容2名称: entry.内容2名称 ?? entry.缺陷名称 ?? "",
      内容2描述: entry.内容2描述 ?? entry.缺陷 ?? "",
    })),
  });
}

function routeOfficialFreeResourcesByPath(
  installedPackages: PlatformResourceLibrary,
  officialPackageId: string | undefined,
  nativeEntryByPathRoot: NativeEntryByPathRoot | undefined,
): PlatformResourceLibrary {
  if (!officialPackageId || !nativeEntryByPathRoot) return installedPackages;
  const officialPackage = installedPackages.get(officialPackageId);
  if (!officialPackage) return installedPackages;
  const routes = officialPackage.document.resources.map((resource) => {
    const pathRoot = resource.path.split("/", 1)[0] ?? "";
    const nativeEntry = nativeEntryByPathRoot[pathRoot];
    return nativeEntry
      ? { resource, destination: "native" as const, nativeEntry }
      : { resource, destination: "other-resources" as const, reason: "template-incompatible" as const };
  });
  return new Map(installedPackages).set(officialPackageId, { ...officialPackage, routes });
}
