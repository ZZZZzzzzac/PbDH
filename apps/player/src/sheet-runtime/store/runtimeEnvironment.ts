import { runValidationChecks } from "../domain/validationRunner";
import { createRuntimeAssetResolver, type RuntimeAssetResolver } from "../loaders/assetResolver";
import { unconfiguredRuntimeStorage } from "../storage/runtimeStorage";
import type { RuntimeDependencies, RuntimePackageLoadResult } from "./runtimeTypes";

export interface RuntimeEnvironment {
  dependencies: RuntimeDependencies;
  autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  autosaveWrite: Promise<void>;
  activePackageAssetResolver: RuntimeAssetResolver | undefined;
  pendingSystemPackageImportResult: Extract<RuntimePackageLoadResult, { ok: true }> | undefined;
}

// 未配置的宿主解释不了资源库：直接加载会把「没有资源库」当成系统包自身的错误。
// 默认依赖因此不加载任何系统包，只返回一条明确的失败，避免伪造 MISSING_RESOURCE_LIBRARY_REFERENCE。
const loadUnconfiguredSystemPackage = async (): Promise<RuntimePackageLoadResult> => ({
  ok: false,
  issues: [{
    level: "fatal",
    code: "RUNTIME_DEPENDENCIES_NOT_CONFIGURED",
    text: "Player Runtime 依赖尚未配置，无法加载系统包；请等待初始化完成后重试。",
  }],
});

export const defaultRuntimeDependencies: RuntimeDependencies = {
  loadSystemPackageFromFile: loadUnconfiguredSystemPackage,
  loadSystemPackageFromDirectory: loadUnconfiguredSystemPackage,
  loadSystemPackageFromDirectoryHandle: loadUnconfiguredSystemPackage,
  loadPresetSystemPackage: loadUnconfiguredSystemPackage,
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
