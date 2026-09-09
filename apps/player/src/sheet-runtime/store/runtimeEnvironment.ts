import { runValidationChecks } from "../domain/validationRunner";
import { createRuntimeAssetResolver, type RuntimeAssetResolver } from "../loaders/assetResolver";
import { unconfiguredRuntimeStorage } from "../storage/runtimeStorage";
import { loadSystemPackageFromDirectoryFiles, loadSystemPackageFromDirectoryHandle, loadSystemPackageFromZipFile } from "../loaders/systemPackageLoader";
import { loadPresetSystemPackage } from "../loaders/presetSystemPackageLoader";
import type { RuntimeDependencies, RuntimePackageLoadResult } from "./runtimeTypes";

export interface RuntimeEnvironment {
  dependencies: RuntimeDependencies;
  autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  autosaveWrite: Promise<void>;
  activePackageAssetResolver: RuntimeAssetResolver | undefined;
  pendingSystemPackageImportResult: Extract<RuntimePackageLoadResult, { ok: true }> | undefined;
}

export const defaultRuntimeDependencies: RuntimeDependencies = {
  loadSystemPackageFromFile: (file) => loadSystemPackageFromZipFile(file),
  loadSystemPackageFromDirectory: (files) => loadSystemPackageFromDirectoryFiles(files),
  loadSystemPackageFromDirectoryHandle: (handle) => loadSystemPackageFromDirectoryHandle(handle),
  loadPresetSystemPackage: (preset, onProgress) => loadPresetSystemPackage(preset, import.meta.env.BASE_URL, fetch, onProgress),
  loadPreviewDirectoryHandle: async () => null,
  savePreviewDirectoryHandle: async () => {
    throw new Error("Author Preview storage has not been configured.");
  },
  storage: unconfiguredRuntimeStorage,
  runValidationChecks,
};

export function createRuntimeEnvironment(): RuntimeEnvironment {
  return {
    dependencies: defaultRuntimeDependencies,
    autosaveTimer: undefined,
    autosaveWrite: Promise.resolve(),
    activePackageAssetResolver: undefined,
    pendingSystemPackageImportResult: undefined,
  };
}

export function configureRuntimeEnvironment(
  environment: RuntimeEnvironment,
  dependencies: Partial<RuntimeDependencies>,
): void {
  environment.dependencies = { ...defaultRuntimeDependencies, ...dependencies };
}

export function resetRuntimeEnvironment(environment: RuntimeEnvironment): void {
  environment.dependencies = defaultRuntimeDependencies;
  if (environment.autosaveTimer) clearTimeout(environment.autosaveTimer);
  environment.autosaveTimer = undefined;
  environment.activePackageAssetResolver?.revokeAll();
  environment.activePackageAssetResolver = undefined;
  environment.pendingSystemPackageImportResult = undefined;
}

export async function reloadRuntimeAssets(
  environment: RuntimeEnvironment,
  packageId: string,
): Promise<RuntimeAssetResolver> {
  environment.activePackageAssetResolver?.revokeAll();
  environment.activePackageAssetResolver = createRuntimeAssetResolver([
    ...await environment.dependencies.storage.loadCurrentPackageAssets(packageId),
    ...await environment.dependencies.storage.loadResourceExtensionAssets(packageId),
  ]);
  return environment.activePackageAssetResolver;
}
