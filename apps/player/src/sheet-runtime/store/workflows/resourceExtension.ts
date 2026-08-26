import { applyEffectiveResourceCatalog, createEffectiveResourceCatalog } from "../../domain/effectiveResourceCatalog";
import type { ResourceExtension } from "../../domain/resourceExtension";
import type { ResourceExtensionFileLoadResult } from "../../loaders/resourceExtensionLoader";
import { reloadRuntimeAssets, type RuntimeEnvironment } from "../runtimeEnvironment";
import { collectStaleResourceReferenceIssues, rebuildDependencyRuntimeState } from "../runtimeStateHelpers";
import type { ResourceExtensionDifference, RuntimeGet, RuntimeSet } from "../runtimeTypes";

export async function installResourceExtensionCandidate(
  environment: RuntimeEnvironment,
  loaded: Extract<ResourceExtensionFileLoadResult, { ok: true }>,
  set: RuntimeSet,
  get: RuntimeGet,
  conversionConfirmed = false,
): Promise<void> {
  const basePackage = get().basePackage;
  if (!basePackage) return;
  const installed = get().installedResourceExtensions;
  const nextExtensions = [...installed.filter((extension) => extension.ID !== loaded.extension.ID), loaded.extension];
  const nextCatalog = createEffectiveResourceCatalog(basePackage, nextExtensions);
  const candidateStatus = nextCatalog.extensions.find((status) => status.extension.ID === loaded.extension.ID);
  if (!candidateStatus || candidateStatus.status === "disabled") {
    set({
      resourceExtensionImport: {
        status: "error",
        issues: candidateStatus?.issues ?? [{
          level: "error",
          code: "RESOURCE_EXTENSION_INSTALL_FAILED",
          text: "Resource Extension 无法加入有效资源目录。",
        }],
      },
    });
    return;
  }
  if (loaded.conversion && !conversionConfirmed) {
    set({
      pendingResourceExtensionConversion: { loaded },
      pendingResourceFormatSelection: null,
      resourceExtensionImport: null,
    });
    return;
  }

  const previous = installed.find((extension) => extension.ID === loaded.extension.ID);
  if (previous) {
    const storedAssets = await environment.dependencies.storage
      .loadResourceExtensionAssets(basePackage.manifest.ID);
    set({
      pendingResourceExtensionConversion: null,
      pendingResourceExtensionReplacement: {
        extension: loaded.extension,
        assets: loaded.assets,
        generatedIds: loaded.generatedIds,
        normalizedArtifact: loaded.normalizedArtifact,
        issues: loaded.issues,
        differences: resourceExtensionDifferences(previous, loaded.extension),
        previousImageCount: storedAssets.filter((asset) => asset.sourceId === previous.ID).length,
        nextImageCount: loaded.assets.length,
      },
      resourceExtensionImport: null,
    });
    return;
  }

  try {
    await environment.dependencies.storage.saveResourceExtension(loaded.extension, loaded.assets);
  } catch {
    set({
      resourceExtensionImport: {
        status: "error",
        issues: [{
          level: "error",
          code: "RESOURCE_EXTENSION_STORAGE_FAILED",
          text: "Resource Extension 无法写入本地存储。",
        }],
      },
    });
    return;
  }

  const effectivePackage = applyEffectiveResourceCatalog(basePackage, nextCatalog);
  const characterData = get().characterData;
  const assetResolver = await reloadRuntimeAssets(environment, basePackage.manifest.ID);
  set({
    currentPackage: effectivePackage,
    resourceCatalog: nextCatalog,
    installedResourceExtensions: nextExtensions,
    packageAssetUrls: assetResolver.urls,
    ...(characterData ? rebuildDependencyRuntimeState(characterData, effectivePackage) : {}),
    resourceReferenceIssues: collectStaleResourceReferenceIssues(characterData, nextCatalog),
    pendingResourceExtensionConversion: null,
    pendingQuestionnaireResult: null,
    resourceExtensionImport: {
      status: "success",
      extensionId: loaded.extension.ID,
      contributionCount: loaded.extension.resourceLibraries.length,
      entryCount: loaded.extension.resourceLibraries
        .reduce((count, library) => count + library.library.entries.length, 0),
      generatedIds: loaded.generatedIds,
      normalizedArtifact: loaded.normalizedArtifact,
      issues: loaded.issues,
    },
  });
}

export function resourceExtensionDifferences(
  previous: ResourceExtension,
  next: ResourceExtension,
): ResourceExtensionDifference[] {
  const libraryIds = new Set([
    ...previous.resourceLibraries.map((item) => item.ID),
    ...next.resourceLibraries.map((item) => item.ID),
  ]);
  return [...libraryIds].map((libraryId) => {
    const before = new Set(previous.resourceLibraries
      .find((item) => item.ID === libraryId)?.library.entries.map((entry) => entry.ID) ?? []);
    const after = new Set(next.resourceLibraries
      .find((item) => item.ID === libraryId)?.library.entries.map((entry) => entry.ID) ?? []);
    return {
      libraryId,
      added: [...after].filter((id) => !before.has(id)).length,
      removed: [...before].filter((id) => !after.has(id)).length,
      retained: [...after].filter((id) => before.has(id)).length,
    };
  });
}

export function resourceImportSuccess(
  extension: ResourceExtension,
  generatedIds: Parameters<typeof installResourceExtensionCandidate>[1]["generatedIds"],
  normalizedArtifact: Parameters<typeof installResourceExtensionCandidate>[1]["normalizedArtifact"],
  issues: Parameters<typeof installResourceExtensionCandidate>[1]["issues"],
) {
  return {
    status: "success" as const,
    extensionId: extension.ID,
    contributionCount: extension.resourceLibraries.length,
    entryCount: extension.resourceLibraries.reduce((count, library) => count + library.library.entries.length, 0),
    generatedIds,
    normalizedArtifact,
    issues,
  };
}
