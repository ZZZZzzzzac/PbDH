import type { SystemPackageDocument } from "@pbdh/contract-runtime";

import daggerheartSystemJson from "./daggerheart-core-system.generated.json";
import heartOfHopefindSystemJson from "./heart-of-hopefind-system.generated.json";
import type { ResourceLibrary } from "./resources/resource-library.ts";
import {
  daggerheartCorePreset,
  loadDaggerheartCoreRuntimePackage,
} from "./sheet-runtime/loaders/daggerheartCoreRuntimeLoader.ts";
import {
  heartOfHopefindPreset,
  loadHeartOfHopefindRuntimePackage,
} from "./sheet-runtime/loaders/heartOfHopefindRuntimeLoader.ts";
import type { PresetSystemPackage } from "./sheet-runtime/loaders/presetSystemPackageLoader.ts";
import type { PackageLoadResult } from "./sheet-runtime/loaders/systemPackageLoader.ts";

export type PlayerSystemPackageCatalogEntry = {
  system: SystemPackageDocument;
  preset: PresetSystemPackage;
  load(input: {
    currentSystem: SystemPackageDocument;
    installedPackages: ResourceLibrary;
    baseUrl?: string;
    fetchFile?: typeof fetch;
  }): Promise<PackageLoadResult>;
};

export const playerSystemPackageCatalog: readonly PlayerSystemPackageCatalogEntry[] = [
  {
    system: daggerheartSystemJson as SystemPackageDocument,
    preset: daggerheartCorePreset,
    load: loadDaggerheartCoreRuntimePackage,
  },
  {
    system: heartOfHopefindSystemJson as SystemPackageDocument,
    preset: heartOfHopefindPreset,
    load: loadHeartOfHopefindRuntimePackage,
  },
];

export const defaultPlayerSystemPackage = playerSystemPackageCatalog[0]!;

export function findPlayerSystemPackage(packageId: string | undefined) {
  return playerSystemPackageCatalog.find((entry) => entry.system.package.id === packageId);
}
