import type { CharacterData } from "../domain/characterData";
import type { ResourceExtension } from "../domain/resourceExtension";
import type { SystemPackage } from "../domain/systemPackage";
import type { RuntimePackageAsset } from "../loaders/assetResolver";

export type SystemPackageCacheMetadata =
  | { source: "preset"; presetId: string; releaseVersion: string }
  | { source: "imported" | "author-preview" };

export interface CharacterSaveSummary {
  id: string;
  packageId: string;
  name: string;
  updatedAt: string;
  syncScope?: "local-only" | "cloud";
  syncState?: "clean" | "pending" | "conflict";
}

export interface CharacterSaveRecord extends CharacterSaveSummary {
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
  loadCharacterSave(packageId: string, saveId: string): Promise<CharacterData | null>;
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
  loadCharacterSave: unavailable,
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
