import { applyEffectiveResourceCatalog, createEffectiveResourceCatalog } from "../../domain/effectiveResourceCatalog";
import { loadResourceExtensionFromFile } from "../../loaders/resourceExtensionLoader";
import { reloadRuntimeAssets, type RuntimeEnvironment } from "../runtimeEnvironment";
import { collectStaleResourceReferenceIssues, rebuildDependencyRuntimeState } from "../runtimeStateHelpers";
import type { ResourceExtensionSlice, RuntimeSlice } from "../runtimeTypes";
import { installResourceExtensionCandidate, resourceImportSuccess } from "../workflows/resourceExtension";

export function createResourceExtensionSlice(
  environment: RuntimeEnvironment,
): RuntimeSlice<ResourceExtensionSlice> {
  return (set, get) => ({
    resourceCatalog: null,
    installedResourceExtensions: [],
    resourceExtensionImport: null,
    pendingResourceExtensionReplacement: null,
    pendingResourceExtensionConversion: null,
    pendingResourceFormatSelection: null,
    pendingResourceExtensionRemoval: null,
    resourceReferenceIssues: [],

    async uploadResourceExtensionFromFile(file) {
      const basePackage = get().basePackage;
      if (!basePackage) {
        set({ resourceExtensionImport: noCurrentPackageError() });
        return;
      }
      const installed = get().installedResourceExtensions;
      const currentCatalog = createEffectiveResourceCatalog(basePackage, installed);
      let loaded;
      try {
        loaded = await loadResourceExtensionFromFile(file, basePackage, {
          extensionIds: installed.map((extension) => extension.ID),
          libraryIds: currentCatalog.resourceLibraries.map((library) => library.ID),
          entryIdsByLibrary: entryIdsByLibrary(currentCatalog),
        });
      } catch {
        set({
          resourceExtensionImport: {
            status: "error",
            issues: [{
              level: "error",
              code: "RESOURCE_EXTENSION_READ_FAILED",
              text: "无法读取 Resource Extension 文件。",
            }],
          },
        });
        return;
      }
      if (!loaded.ok) {
        if ("ambiguousAdapters" in loaded && loaded.ambiguousAdapters.length > 0) {
          set({
            pendingResourceFormatSelection: { file, adapters: loaded.ambiguousAdapters },
            pendingResourceExtensionConversion: null,
            resourceExtensionImport: null,
          });
          return;
        }
        set({ resourceExtensionImport: { status: "error", issues: loaded.issues } });
        return;
      }
      await installResourceExtensionCandidate(environment, loaded, set, get);
    },

    async selectResourceFormatAdapter(adapterId) {
      const pending = get().pendingResourceFormatSelection;
      const basePackage = get().basePackage;
      if (!pending || !basePackage) return;
      const installed = get().installedResourceExtensions;
      const currentCatalog = createEffectiveResourceCatalog(basePackage, installed);
      const loaded = await loadResourceExtensionFromFile(pending.file, basePackage, {
        extensionIds: installed.map((extension) => extension.ID),
        libraryIds: currentCatalog.resourceLibraries.map((library) => library.ID),
        entryIdsByLibrary: entryIdsByLibrary(currentCatalog),
      }, adapterId);
      if (!loaded.ok) {
        set({
          pendingResourceFormatSelection: null,
          resourceExtensionImport: { status: "error", issues: loaded.issues },
        });
        return;
      }
      await installResourceExtensionCandidate(environment, loaded, set, get);
    },

    async confirmResourceExtensionConversion() {
      const pending = get().pendingResourceExtensionConversion;
      if (pending) await installResourceExtensionCandidate(environment, pending.loaded, set, get, true);
    },

    cancelResourceExtensionConversion() {
      set({
        pendingResourceExtensionConversion: null,
        pendingResourceFormatSelection: null,
        resourceExtensionImport: null,
      });
    },

    async confirmResourceExtensionReplacement() {
      const pending = get().pendingResourceExtensionReplacement;
      const basePackage = get().basePackage;
      if (!pending || !basePackage) return;
      const nextExtensions = get().installedResourceExtensions
        .map((extension) => extension.ID === pending.extension.ID ? pending.extension : extension);
      const nextCatalog = createEffectiveResourceCatalog(basePackage, nextExtensions);
      const status = nextCatalog.extensions.find((item) => item.extension.ID === pending.extension.ID);
      if (!status || status.status === "disabled") {
        set({
          pendingResourceExtensionReplacement: null,
          resourceExtensionImport: { status: "error", issues: status?.issues ?? [] },
        });
        return;
      }
      try {
        await environment.dependencies.storage.saveResourceExtension(pending.extension, pending.assets);
        await reloadRuntimeAssets(environment, basePackage.manifest.ID);
      } catch {
        set({
          resourceExtensionImport: {
            status: "error",
            issues: [{
              level: "error",
              code: "RESOURCE_EXTENSION_STORAGE_FAILED",
              text: "Resource Extension 替换失败；运行时保持原版本。",
            }],
          },
        });
        return;
      }
      const effectivePackage = applyEffectiveResourceCatalog(basePackage, nextCatalog);
      const characterData = get().characterData;
      set({
        currentPackage: effectivePackage,
        resourceCatalog: nextCatalog,
        installedResourceExtensions: nextExtensions,
        packageAssetUrls: environment.activePackageAssetResolver?.urls ?? {},
        pendingResourceExtensionReplacement: null,
        pendingQuestionnaireResult: null,
        resourceReferenceIssues: collectStaleResourceReferenceIssues(characterData, nextCatalog),
        ...(characterData ? rebuildDependencyRuntimeState(characterData, effectivePackage) : {}),
        resourceExtensionImport: resourceImportSuccess(
          pending.extension,
          pending.generatedIds,
          pending.normalizedArtifact,
          pending.issues,
        ),
      });
    },

    cancelResourceExtensionReplacement() {
      set({ pendingResourceExtensionReplacement: null });
    },

    requestResourceExtensionRemoval(extensionId) {
      const extension = get().installedResourceExtensions.find((item) => item.ID === extensionId);
      const basePackage = get().basePackage;
      if (!extension || !basePackage) return;
      const nextCatalog = createEffectiveResourceCatalog(
        basePackage,
        get().installedResourceExtensions.filter((item) => item.ID !== extensionId),
      );
      set({
        pendingResourceExtensionRemoval: {
          extensionId,
          extensionName: extension.名称,
          libraries: extension.resourceLibraries.map((library) => ({
            libraryId: library.ID,
            entryCount: library.library.entries.length,
          })),
          imageCount: Object.keys(get().packageAssetUrls)
            .filter((key) => key.startsWith(`resource-extension:${encodeURIComponent(extensionId)}:`)).length,
          staleReferenceCount: collectStaleResourceReferenceIssues(get().characterData, nextCatalog).length,
        },
      });
    },

    async confirmResourceExtensionRemoval() {
      const pending = get().pendingResourceExtensionRemoval;
      const basePackage = get().basePackage;
      if (!pending || !basePackage) return;
      try {
        await environment.dependencies.storage
          .deleteResourceExtension(basePackage.manifest.ID, pending.extensionId);
        await reloadRuntimeAssets(environment, basePackage.manifest.ID);
      } catch {
        set({
          resourceExtensionImport: {
            status: "error",
            issues: [{
              level: "error",
              code: "RESOURCE_EXTENSION_UNINSTALL_FAILED",
              text: "Resource Extension 卸载失败。",
            }],
          },
        });
        return;
      }
      const nextExtensions = get().installedResourceExtensions
        .filter((extension) => extension.ID !== pending.extensionId);
      const nextCatalog = createEffectiveResourceCatalog(basePackage, nextExtensions);
      const effectivePackage = applyEffectiveResourceCatalog(basePackage, nextCatalog);
      const characterData = get().characterData;
      set({
        currentPackage: effectivePackage,
        resourceCatalog: nextCatalog,
        installedResourceExtensions: nextExtensions,
        packageAssetUrls: environment.activePackageAssetResolver?.urls ?? {},
        pendingResourceExtensionRemoval: null,
        pendingQuestionnaireResult: null,
        resourceExtensionImport: null,
        resourceReferenceIssues: collectStaleResourceReferenceIssues(characterData, nextCatalog),
        ...(characterData ? rebuildDependencyRuntimeState(characterData, effectivePackage) : {}),
      });
    },

    cancelResourceExtensionRemoval() {
      set({ pendingResourceExtensionRemoval: null });
    },
  });
}

function entryIdsByLibrary(catalog: ReturnType<typeof createEffectiveResourceCatalog>) {
  return new Map(catalog.resourceLibraries.map((library) => [
    library.ID,
    new Set(library.entries.map((entry) => entry.ID)),
  ]));
}

function noCurrentPackageError() {
  return {
    status: "error" as const,
    issues: [{
      level: "error" as const,
      code: "RESOURCE_EXTENSION_NO_CURRENT_PACKAGE",
      text: "当前没有可用的 System Package。",
    }],
  };
}
