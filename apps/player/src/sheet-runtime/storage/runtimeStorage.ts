import type { ResourcePackageCandidate, SystemPackageDocument } from "@pbdh/contract-runtime";

import type { CharacterData } from "../domain/characterData";
import type { ResourceExtension } from "../domain/resourceExtension";
import type { SystemPackage } from "../domain/systemPackage";
import type { RuntimePackageAsset } from "../loaders/assetResolver";

export type SystemPackageCacheMetadata =
  | { source: "preset"; presetId: string; releaseVersion: string }
  | {
    source: "imported";
    systemDocument?: SystemPackageDocument;
    embeddedResources?: ResourcePackageCandidate[];
  }
  | { source: "author-preview" };

export interface SystemPackageCacheSnapshot {
  systemPackage: SystemPackage;
  packageAssets: RuntimePackageAsset[];
  metadata: SystemPackageCacheMetadata;
}

export interface RuntimeCacheStore<T> {
  load(id: string): Promise<T | null>;
  save(id: string, value: T): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface CharacterSaveSummary {
  id: string;
  packageId: string;
  systemPackageVersion: string;
  name: string;
  updatedAt: string;
  characterDataVersion: string;
  syncScope?: "local-only" | "cloud";
  syncState?: "clean" | "pending" | "conflict";
}

export interface CharacterDataMigrationCandidate {
  saveId: string;
  saveName: string;
  sourceUpdatedAt: string;
  fromVersion: string;
  toVersion: string;
  characterData: Record<string, unknown>;
  steps: Array<{ fromVersion: string; toVersion: string; script: string }>;
}

export type CharacterSaveMigrationPreparation =
  | { status: "current" }
  | { status: "ready"; candidate: CharacterDataMigrationCandidate }
  | { status: "error"; message: string };

export interface PackageScriptConsentCandidate {
  packageId: string;
  packageVersion: string;
  packageName: string;
  scripts: Array<{ label: string; path: string; digest: string }>;
}

export type PackageScriptConsentPreparation =
  | { status: "current" }
  | { status: "required"; candidate: PackageScriptConsentCandidate };

export interface CharacterSaveRecord extends Omit<CharacterSaveSummary, "characterDataVersion" | "systemPackageVersion"> {
  data: CharacterData;
}

export interface RuntimeStorage {
  loadCurrentSystemPackage(): Promise<SystemPackage | null>;
  loadCurrentSystemPackageCacheMetadata(): Promise<SystemPackageCacheMetadata | null>;
  saveCurrentSystemPackage(
    systemPackage: SystemPackage,
    packageAssets?: RuntimePackageAsset[],
    cacheMetadata?: SystemPackageCacheMetadata,
  ): Promise<void>;
  clearCurrentSystemPackage(): Promise<void>;
  loadCurrentPackageAssets(packageId: string): Promise<RuntimePackageAsset[]>;
  loadCurrentCharacterData(packageId: string): Promise<CharacterData | null>;
  saveCurrentCharacterData(data: CharacterData): Promise<void>;
  listCharacterSaves(packageId: string): Promise<CharacterSaveSummary[]>;
  listAllCharacterSaves(): Promise<CharacterSaveSummary[]>;
  loadCharacterSave(packageId: string, saveId: string): Promise<CharacterData | null>;
  prepareCharacterSaveMigration(packageId: string, saveId: string): Promise<CharacterSaveMigrationPreparation>;
  commitCharacterSaveMigration(packageId: string, candidate: CharacterDataMigrationCandidate): Promise<CharacterData>;
  preparePackageScriptConsent(systemPackage: SystemPackage): Promise<PackageScriptConsentPreparation>;
  approvePackageScripts(candidate: PackageScriptConsentCandidate): Promise<void>;
  saveCharacterSave(record: CharacterSaveRecord): Promise<void>;
  renameCharacterSave(packageId: string, saveId: string, name: string): Promise<void>;
  deleteCharacterSave(packageId: string, saveId: string): Promise<void>;
  loadActiveCharacterSaveId(packageId: string): Promise<string | null>;
  setActiveCharacterSaveId(packageId: string, saveId: string): Promise<void>;
  loadSystemPackageSkinPreference(packageId: string): string | null;
  setSystemPackageSkinPreference(packageId: string, skinId: string): void;
  loadCardTableSurfaceHeights(packageId: string): Record<string, number>;
  setCardTableSurfaceHeight(packageId: string, tableModuleId: string, heightPx: number | null): void;
  loadFrameworkColorSchemePreference(): "follow-skin" | "light" | "dark";
  setFrameworkColorSchemePreference(preference: "follow-skin" | "light" | "dark"): void;
  listResourceExtensions(targetSystemPackageId: string): Promise<ResourceExtension[]>;
  loadResourceExtensionAssets(targetSystemPackageId: string): Promise<RuntimePackageAsset[]>;
  saveResourceExtension(extension: ResourceExtension, assets?: RuntimePackageAsset[]): Promise<void>;
  deleteResourceExtension(targetSystemPackageId: string, extensionId: string): Promise<void>;
}

const unavailable = () => Promise.reject(new Error("Player Runtime storage has not been configured."));

export const unconfiguredRuntimeStorage: RuntimeStorage = {
  loadCurrentSystemPackage: unavailable,
  loadCurrentSystemPackageCacheMetadata: unavailable,
  saveCurrentSystemPackage: unavailable,
  clearCurrentSystemPackage: unavailable,
  loadCurrentPackageAssets: unavailable,
  loadCurrentCharacterData: unavailable,
  saveCurrentCharacterData: unavailable,
  listCharacterSaves: unavailable,
  listAllCharacterSaves: unavailable,
  loadCharacterSave: unavailable,
  prepareCharacterSaveMigration: unavailable,
  commitCharacterSaveMigration: unavailable,
  preparePackageScriptConsent: unavailable,
  approvePackageScripts: unavailable,
  saveCharacterSave: unavailable,
  renameCharacterSave: unavailable,
  deleteCharacterSave: unavailable,
  loadActiveCharacterSaveId: unavailable,
  setActiveCharacterSaveId: unavailable,
  loadSystemPackageSkinPreference: () => null,
  setSystemPackageSkinPreference: () => undefined,
  loadCardTableSurfaceHeights: () => ({}),
  setCardTableSurfaceHeight: () => undefined,
  loadFrameworkColorSchemePreference: () => "follow-skin",
  setFrameworkColorSchemePreference: () => undefined,
  listResourceExtensions: unavailable,
  loadResourceExtensionAssets: unavailable,
  saveResourceExtension: unavailable,
  deleteResourceExtension: unavailable,
};
