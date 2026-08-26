import { applyEffectiveResourceCatalog, createEffectiveResourceCatalog } from "../../domain/effectiveResourceCatalog";
import type { PackageIssue, SystemPackage } from "../../domain/systemPackage";
import { createRuntimeAssetResolver, type RuntimePackageAsset } from "../../loaders/assetResolver";
import { loadActiveCharacterForPackage } from "../runtimeHelpers";
import type { RuntimeEnvironment } from "../runtimeEnvironment";
import { collectStaleResourceReferenceIssues, emptyDerivedState, rebuildDependencyRuntimeState } from "../runtimeStateHelpers";
import type { FrameworkColorSchemePreference, RuntimeSet, StorageStatus } from "../runtimeTypes";

export const authorPreviewSessionKey = "pbdh-author-preview";

export function resolveSkinPreference(
  environment: RuntimeEnvironment,
  systemPackage: SystemPackage,
): { skinId: string | null; fellBack: boolean } {
  const skins = systemPackage.skins ?? [];
  if (skins.length === 0) return { skinId: null, fellBack: false };
  let preferred: string | null = null;
  try {
    preferred = environment.dependencies.storage.loadSystemPackageSkinPreference(systemPackage.manifest.ID);
  } catch (error) {
    console.error("loadSystemPackageSkinPreference failed", error);
  }
  if (preferred && skins.some((skin) => skin.ID === preferred)) {
    return { skinId: preferred, fellBack: false };
  }
  return { skinId: systemPackage.defaultSkin ?? skins[0].ID, fellBack: preferred !== null };
}

export function loadFrameworkColorSchemePreference(
  environment: RuntimeEnvironment,
): FrameworkColorSchemePreference {
  try {
    return environment.dependencies.storage.loadFrameworkColorSchemePreference();
  } catch (error) {
    console.error("loadFrameworkColorSchemePreference failed", error);
    return "follow-skin";
  }
}

function loadCardTableSurfaceHeights(
  environment: RuntimeEnvironment,
  packageId: string,
): Record<string, number> {
  try {
    return environment.dependencies.storage.loadCardTableSurfaceHeights(packageId);
  } catch (error) {
    console.error("loadCardTableSurfaceHeights failed", error);
    return {};
  }
}

export async function activatePackage(
  environment: RuntimeEnvironment,
  systemPackage: SystemPackage,
  issues: PackageIssue[],
  set: RuntimeSet,
  storageStatus: StorageStatus = "idle",
  packageAssets?: RuntimePackageAsset[],
): Promise<boolean> {
  let nextAssetResolver;
  try {
    const assets = packageAssets
      ?? await environment.dependencies.storage.loadCurrentPackageAssets(systemPackage.manifest.ID);
    const installedResourceExtensions = await environment.dependencies.storage
      .listResourceExtensions(systemPackage.manifest.ID);
    const extensionAssets = await environment.dependencies.storage
      .loadResourceExtensionAssets(systemPackage.manifest.ID);
    nextAssetResolver = createRuntimeAssetResolver([...assets, ...extensionAssets]);
    const resourceCatalog = createEffectiveResourceCatalog(systemPackage, installedResourceExtensions);
    const effectivePackage = applyEffectiveResourceCatalog(systemPackage, resourceCatalog);
    const loaded = await loadActiveCharacterForPackage(effectivePackage, environment.dependencies.storage);
    const skinPreference = resolveSkinPreference(environment, systemPackage);
    const cardTableSurfaceHeights = loadCardTableSurfaceHeights(environment, systemPackage.manifest.ID);

    set({
      basePackage: systemPackage,
      currentPackage: effectivePackage,
      selectedSkinId: skinPreference.skinId,
      resourceCatalog,
      installedResourceExtensions,
      resourceExtensionImport: null,
      pendingResourceExtensionReplacement: null,
      pendingResourceExtensionConversion: null,
      pendingResourceFormatSelection: null,
      pendingResourceExtensionRemoval: null,
      pendingQuestionnaireResult: null,
      resourceReferenceIssues: collectStaleResourceReferenceIssues(loaded.characterData, resourceCatalog),
      packageAssetUrls: nextAssetResolver.urls,
      characterData: loaded.characterData,
      characterSaves: loaded.characterSaves,
      activeCharacterSaveId: loaded.activeCharacterSaveId,
      ...emptyDerivedState(),
      cardTableSurfaceHeights,
      ...rebuildDependencyRuntimeState(loaded.characterData, effectivePackage),
      packageIssues: issues,
      bootStatus: "ready",
      packageLoadProgress: null,
      packageLoadingPresentation: null,
      storageStatus,
      ...(skinPreference.fellBack
        ? { importNotice: `此前选择的 Skin 已不存在，已回退到默认 Skin：${skinPreference.skinId}` }
        : {}),
    });
    environment.activePackageAssetResolver?.revokeAll();
    environment.activePackageAssetResolver = nextAssetResolver;
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    nextAssetResolver?.revokeAll();
    set({
      packageIssues: [...issues, {
        level: "error",
        code: "PACKAGE_LOAD_FAILED",
        text: `加载 System Package 时出错：${message}`,
        path: "boot",
      }],
      bootStatus: environment.activePackageAssetResolver ? "ready" : "error",
      packageLoadProgress: null,
      packageLoadingPresentation: null,
      storageStatus: "error",
      importError: message,
      importNotice: null,
    });
    return false;
  }
}

export async function loadPreviewPackage(
  environment: RuntimeEnvironment,
  handle: Parameters<RuntimeEnvironment["dependencies"]["loadSystemPackageFromDirectoryHandle"]>[0],
  set: RuntimeSet,
): Promise<void> {
  set({
    bootStatus: "loading",
    packageIssues: [],
    importError: null,
    importNotice: null,
    authorPreviewActive: true,
  });
  const validation = await environment.dependencies.loadSystemPackageFromDirectoryHandle(handle);
  if (!validation.ok) {
    environment.activePackageAssetResolver?.revokeAll();
    environment.activePackageAssetResolver = undefined;
    set({
      currentPackage: null,
      packageAssetUrls: {},
      characterData: null,
      characterSaves: [],
      activeCharacterSaveId: null,
      ...emptyDerivedState(),
      bootStatus: "error",
      packageIssues: validation.issues,
      authorPreviewActive: true,
    });
    return;
  }

  let storageStatus: StorageStatus = "idle";
  try {
    await environment.dependencies.storage.saveCurrentSystemPackage(
      validation.package,
      validation.packageAssets ?? [],
      { source: "author-preview" },
    );
  } catch (error) {
    console.error("saveCurrentSystemPackage failed", error);
    storageStatus = "error";
  }
  await activatePackage(
    environment,
    validation.package,
    validation.issues,
    set,
    storageStatus,
    validation.packageAssets ?? [],
  );
}

export async function clearCachedPackageAndResetState(
  environment: RuntimeEnvironment,
  set: RuntimeSet,
): Promise<void> {
  environment.activePackageAssetResolver?.revokeAll();
  environment.activePackageAssetResolver = undefined;
  let storageStatus: StorageStatus = "idle";
  try {
    await environment.dependencies.storage.clearCurrentSystemPackage();
  } catch (error) {
    console.error("clearCurrentSystemPackage failed", error);
    storageStatus = "error";
  }

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
    pendingQuestionnaireResult: null,
    resourceReferenceIssues: [],
    packageAssetUrls: {},
    characterData: null,
    characterSaves: [],
    activeCharacterSaveId: null,
    ...emptyDerivedState(),
    cardTableSurfaceHeights: {},
    packageIssues: [],
    bootStatus: "ready",
    packageLoadProgress: null,
    packageLoadingPresentation: null,
    storageStatus,
    importNotice: storageStatus === "error"
      ? "缓存的 System Package 读取失败，已回到空白状态。请在浏览器中清理站点数据后重新上传系统包。"
      : "缓存的 System Package 已失效，已清除。请重新上传系统包。",
  });
}
