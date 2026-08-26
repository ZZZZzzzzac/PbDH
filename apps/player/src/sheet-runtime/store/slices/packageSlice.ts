import type { PackageIssue } from "../../domain/systemPackage";
import { validateCachedSystemPackage } from "../../domain/systemPackage/cachedPackageValidation";
import type { RuntimePackageAsset } from "../../loaders/assetResolver";
import type { PackageLoadResult } from "../../loaders/systemPackageLoader";
import type { PresetSystemPackage } from "../../loaders/presetSystemPackageLoader";
import type { RuntimeEnvironment } from "../runtimeEnvironment";
import { emptyDerivedState } from "../runtimeStateHelpers";
import type { PackageSlice, RuntimeGet, RuntimeSet, RuntimeSlice, StorageStatus } from "../runtimeTypes";
import {
  activatePackage,
  authorPreviewSessionKey,
  clearCachedPackageAndResetState,
  loadFrameworkColorSchemePreference,
  loadPreviewPackage,
} from "../workflows/packageActivation";

export function createPackageSlice(environment: RuntimeEnvironment): RuntimeSlice<PackageSlice> {
  return (set, get) => ({
    basePackage: null,
    currentPackage: null,
    selectedSkinId: null,
    frameworkColorSchemePreference: "follow-skin",
    packageAssetUrls: {},
    packageIssues: [],
    bootStatus: "idle",
    packageLoadProgress: null,
    packageLoadingPresentation: null,
    storageStatus: "idle",
    importError: null,
    importNotice: null,
    authorPreviewActive: false,

    async initialize(presets = []) {
      set({
        bootStatus: "loading",
        packageLoadProgress: null,
        packageLoadingPresentation: null,
        packageIssues: [],
        importError: null,
        importNotice: null,
        frameworkColorSchemePreference: loadFrameworkColorSchemePreference(environment),
      });

      try {
        if (sessionStorage.getItem(authorPreviewSessionKey) === "active") {
          await restoreAuthorPreview(environment, set);
          return;
        }

        const cachedPackage = await environment.dependencies.storage.loadCurrentSystemPackage();
        if (!cachedPackage) {
          resetToEmptyRuntime(environment, set);
          return;
        }

        const cachedValidation = validateCachedSystemPackage(cachedPackage);
        if (!cachedValidation.ok) {
          await clearCachedPackageAndResetState(environment, set);
          return;
        }

        const cachedAssets = await environment.dependencies.storage
          .loadCurrentPackageAssets(cachedValidation.package.manifest.ID);
        const cacheMetadata = await environment.dependencies.storage
          .loadCurrentSystemPackageCacheMetadata();
        const matchingPreset = presets.find((preset) => preset.id === cachedValidation.package.manifest.ID);
        const presetIsStale = matchingPreset && (
          (cacheMetadata?.source === "preset"
            && cacheMetadata.presetId === matchingPreset.id
            && cacheMetadata.releaseVersion !== matchingPreset.releaseVersion)
          || (cacheMetadata === null && isLegacyPresetCache(matchingPreset, cachedAssets))
        );
        let fallbackIssues: PackageIssue[] = [];

        if (matchingPreset && presetIsStale) {
          set({
            packageLoadProgress: initialPresetProgress(matchingPreset),
            packageLoadingPresentation: matchingPreset.loadingPresentation ?? null,
          });
          const refreshed = await environment.dependencies.loadPresetSystemPackage(
            matchingPreset,
            (packageLoadProgress) => set({ packageLoadProgress }),
          );
          if (refreshed.ok) {
            const loaded = await activatePackage(
              environment,
              refreshed.package,
              refreshed.issues,
              set,
              "idle",
              refreshed.packageAssets ?? [],
            );
            if (!loaded) return;
            await cacheRefreshedPreset(environment, matchingPreset, refreshed, set);
            return;
          }
          fallbackIssues = refreshed.issues.map((issue) => ({
            ...issue,
            level: "warning" as const,
            code: "PRESET_CACHE_REFRESH_FAILED",
            text: `无法刷新预制 System Package，已继续使用本地缓存：${issue.text}`,
          }));
        }

        await activatePackage(environment, cachedValidation.package, fallbackIssues, set, "idle", cachedAssets);
      } catch (error) {
        handleInitializeFailure(environment, error, set);
      }
    },

    async uploadSystemPackageFromFile(file) {
      await importSystemPackage(
        environment,
        set,
        get,
        () => environment.dependencies.loadSystemPackageFromFile(file),
        "saveCurrentSystemPackage (extension) failed",
      );
    },

    async uploadSystemPackageFromDirectory(files) {
      await importSystemPackage(
        environment,
        set,
        get,
        () => environment.dependencies.loadSystemPackageFromDirectory(files),
        "saveCurrentSystemPackage (upload) failed",
      );
    },

    async switchToPresetSystemPackage(preset, forceReload = false) {
      if (!forceReload && get().currentPackage?.manifest.ID === preset.id) return;
      set({
        bootStatus: "loading",
        packageLoadProgress: initialPresetProgress(preset),
        packageLoadingPresentation: preset.loadingPresentation ?? null,
        packageIssues: [],
        importError: null,
        importNotice: null,
      });
      const validation = await environment.dependencies.loadPresetSystemPackage(
        preset,
        (packageLoadProgress) => set({ packageLoadProgress }),
      );
      if (!validation.ok) {
        set((state) => ({
          bootStatus: state.currentPackage ? "ready" : "error",
          packageLoadProgress: null,
          packageLoadingPresentation: null,
          packageIssues: validation.issues,
        }));
        return;
      }
      let packageCacheStatus: StorageStatus = "saved";
      try {
        await environment.dependencies.storage.saveCurrentSystemPackage(
          validation.package,
          validation.packageAssets ?? [],
          presetCacheMetadata(preset),
        );
      } catch (error) {
        console.error("saveCurrentSystemPackage (preset) failed", error);
        packageCacheStatus = "error";
      }
      const loaded = await activatePackage(
        environment,
        validation.package,
        validation.issues,
        set,
        packageCacheStatus,
        validation.packageAssets ?? [],
      );
      if (!loaded) return;
      if (packageCacheStatus === "error") {
        set({ importNotice: "预制系统包已切换，但浏览器无法缓存该系统包。" });
      }
    },

    selectSystemPackageSkin(skinId) {
      const systemPackage = get().currentPackage;
      if (!systemPackage?.skins?.some((skin) => skin.ID === skinId)) return;
      try {
        environment.dependencies.storage.setSystemPackageSkinPreference(systemPackage.manifest.ID, skinId);
      } catch {
        set({ importNotice: "Skin 已切换，但浏览器无法保存该偏好。" });
      }
      set({ selectedSkinId: skinId });
    },

    setFrameworkColorSchemePreference(preference) {
      try {
        environment.dependencies.storage.setFrameworkColorSchemePreference(preference);
      } catch {
        set({ importNotice: "Framework 配色已切换，但浏览器无法保存该偏好。" });
      }
      set({ frameworkColorSchemePreference: preference });
    },

    async enterAuthorPreview(handle) {
      sessionStorage.setItem(authorPreviewSessionKey, "active");
      await environment.dependencies.savePreviewDirectoryHandle(handle);
      await loadPreviewPackage(environment, handle, set);
    },

    exitAuthorPreview() {
      sessionStorage.removeItem(authorPreviewSessionKey);
      set({ authorPreviewActive: false, importNotice: "已退出预览；当前 System Package 保持不变。" });
    },

    clearImportMessage() {
      set({ importError: null, importNotice: null });
    },
  });
}

async function restoreAuthorPreview(environment: RuntimeEnvironment, set: RuntimeSet): Promise<void> {
  const handle = await environment.dependencies.loadPreviewDirectoryHandle();
  if (!handle) {
    set({
      currentPackage: null,
      characterData: null,
      bootStatus: "error",
      authorPreviewActive: true,
      packageIssues: [{
        level: "fatal",
        code: "PREVIEW_DIRECTORY_PERMISSION_REQUIRED",
        text: "Author Preview 开发目录不可用，请重新授权或选择目录。",
      }],
    });
    return;
  }
  const permission = handle.queryPermission ? await handle.queryPermission({ mode: "read" }) : "granted";
  if (permission !== "granted") {
    set({
      currentPackage: null,
      characterData: null,
      bootStatus: "error",
      authorPreviewActive: true,
      packageIssues: [{
        level: "fatal",
        code: "PREVIEW_DIRECTORY_PERMISSION_REQUIRED",
        text: "无法重新读取 Author Preview 开发目录，请重新授权或选择目录。",
      }],
    });
    return;
  }
  await loadPreviewPackage(environment, handle, set);
}

function resetToEmptyRuntime(environment: RuntimeEnvironment, set: RuntimeSet): void {
  environment.activePackageAssetResolver?.revokeAll();
  environment.activePackageAssetResolver = undefined;
  set({
    basePackage: null,
    currentPackage: null,
    resourceCatalog: null,
    installedResourceExtensions: [],
    resourceExtensionImport: null,
    pendingResourceExtensionReplacement: null,
    pendingResourceExtensionConversion: null,
    pendingResourceFormatSelection: null,
    pendingResourceExtensionRemoval: null,
    resourceReferenceIssues: [],
    packageAssetUrls: {},
    characterData: null,
    characterSaves: [],
    activeCharacterSaveId: null,
    ...emptyDerivedState(),
    packageIssues: [],
    bootStatus: "ready",
    storageStatus: "idle",
  });
}

async function importSystemPackage(
  environment: RuntimeEnvironment,
  set: RuntimeSet,
  get: RuntimeGet,
  load: () => Promise<PackageLoadResult>,
  errorScope: string,
): Promise<void> {
  set({
    bootStatus: "loading",
    packageLoadProgress: null,
    packageLoadingPresentation: null,
    packageIssues: [],
    importError: null,
    importNotice: null,
  });
  const validation = await load();
  if (!validation.ok) {
    set({ bootStatus: get().currentPackage ? "ready" : "error", packageIssues: validation.issues });
    return;
  }

  let packageCacheStatus: StorageStatus = "idle";
  try {
    await environment.dependencies.storage.saveCurrentSystemPackage(
      validation.package,
      validation.packageAssets ?? [],
      { source: "imported" },
    );
  } catch (error) {
    console.error(errorScope, error);
    packageCacheStatus = "error";
  }
  await activatePackage(
    environment,
    validation.package,
    validation.issues,
    set,
    packageCacheStatus,
    validation.packageAssets ?? [],
  );
}

async function cacheRefreshedPreset(
  environment: RuntimeEnvironment,
  preset: PresetSystemPackage,
  refreshed: Extract<PackageLoadResult, { ok: true }>,
  set: RuntimeSet,
): Promise<void> {
  try {
    await environment.dependencies.storage.saveCurrentSystemPackage(
      refreshed.package,
      refreshed.packageAssets ?? [],
      presetCacheMetadata(preset),
    );
    set({ storageStatus: "saved", importNotice: `已更新预制 System Package：${preset.name}` });
  } catch (error) {
    console.error("saveCurrentSystemPackage (preset refresh) failed", error);
    set({ storageStatus: "error", importNotice: "预制 System Package 已更新，但浏览器无法缓存最新版本。" });
  }
}

function handleInitializeFailure(environment: RuntimeEnvironment, error: unknown, set: RuntimeSet): void {
  const message = error instanceof Error ? error.message : String(error);
  environment.activePackageAssetResolver?.revokeAll();
  environment.activePackageAssetResolver = undefined;
  set({
    basePackage: null,
    currentPackage: null,
    resourceCatalog: null,
    installedResourceExtensions: [],
    resourceExtensionImport: null,
    pendingResourceExtensionReplacement: null,
    pendingResourceExtensionConversion: null,
    pendingResourceFormatSelection: null,
    pendingResourceExtensionRemoval: null,
    resourceReferenceIssues: [],
    packageAssetUrls: {},
    characterData: null,
    characterSaves: [],
    activeCharacterSaveId: null,
    ...emptyDerivedState(),
    packageIssues: [{
      level: "error",
      code: "INITIALIZE_FAILED",
      text: `初始化时出错：${message}，请检查浏览器存储或重新上传系统包。`,
      path: "boot",
    }],
    bootStatus: "error",
    storageStatus: "error",
    importError: message,
    importNotice: null,
  });
}

function initialPresetProgress(preset: PresetSystemPackage) {
  return { completed: 0, total: preset.metadataFileCount };
}

function presetCacheMetadata(preset: PresetSystemPackage) {
  return { source: "preset" as const, presetId: preset.id, releaseVersion: preset.releaseVersion };
}

function isLegacyPresetCache(preset: PresetSystemPackage, packageAssets: RuntimePackageAsset[]): boolean {
  if (packageAssets.length === 0) return false;
  const presetPath = `/system-packages/${encodeURIComponent(preset.directory)}/`;
  return packageAssets.every((asset) => typeof asset.staticUrl === "string" && asset.staticUrl.includes(presetPath));
}
