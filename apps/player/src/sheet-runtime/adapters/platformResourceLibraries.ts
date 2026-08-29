import type {
  SystemPackageDocument,
  TabletopResourceCopy,
} from "@pbdh/contract-runtime";

import type { ResourceLibrary as PlatformResourceLibrary } from "../../resources/resource-library.ts";
import type { RuntimePackageAsset } from "../loaders/assetResolver.ts";
import {
  normalizeResourceLibraries,
  type ResourceLibraryEntry,
  type ResourceLibrary as SheetResourceLibrary,
} from "../domain/resourceLibrary.ts";
import type { SystemPackage } from "../domain/systemPackage.ts";

type PlatformResource = PlatformResourceLibrary extends ReadonlyMap<string, infer Installed>
  ? Installed extends { document: { resources: Array<infer Resource> } }
    ? Resource
    : never
  : never;

const otherResourceLibraryId = "其他";
const otherResourceLibraryName = "其他资源";
const otherResourceLibraryPath = "platform-other-resource-library:其他";

export type PlatformMediaReferenceResolver = (input: {
  packageId: string;
  assetId: string;
}) => string | undefined;

export function buildSheetResourceLibraries(input: {
  currentSystem: SystemPackageDocument;
  installedPackages: PlatformResourceLibrary;
  resolveMediaReference?: PlatformMediaReferenceResolver;
}): SheetResourceLibrary[] {
  const libraryInputs = buildSheetResourceLibraryInputs(input);
  const normalized = normalizeResourceLibraries(libraryInputs);
  if (!normalized.ok) {
    throw new Error(normalized.issues.map((issue) => `${issue.code}: ${issue.text}`).join("\n"));
  }
  return normalized.resourceLibraries;
}

export function replacePlatformResourceLibraries(input: {
  currentSystem: SystemPackageDocument;
  basePackage: SystemPackage;
  installedPackages: PlatformResourceLibrary;
}): SystemPackage {
  const platformLibraries = new Map(buildSheetResourceLibraries({
    currentSystem: input.currentSystem,
    installedPackages: input.installedPackages,
  }).map((library) => [library.ID, library]));
  const mergedInputs = (input.basePackage.resourceLibraries ?? []).flatMap((library) => {
    const platform = platformLibraries.get(library.ID);
    if (platform) platformLibraries.delete(library.ID);
    const staticEntries = library.entries.filter((entry) => !isPlatformResourceEntry(entry));
    const hadPlatformEntries = staticEntries.length !== library.entries.length;
    if (!platform && hadPlatformEntries && staticEntries.length === 0) return [];
    return [resourceLibraryInput(
      library,
      [...staticEntries, ...(platform?.entries ?? [])],
    )];
  });
  mergedInputs.push(...[...platformLibraries.values()].map((library) =>
    resourceLibraryInput(library, library.entries)));
  const normalized = normalizeResourceLibraries(mergedInputs);
  if (!normalized.ok) {
    throw new Error(normalized.issues.map((issue) => `${issue.code}: ${issue.text}`).join("\n"));
  }
  return { ...input.basePackage, resourceLibraries: normalized.resourceLibraries };
}

export function buildSheetResourceLibraryInputs(input: {
  currentSystem: SystemPackageDocument;
  installedPackages: PlatformResourceLibrary;
  resolveMediaReference?: PlatformMediaReferenceResolver;
}) {
  const nativeEntries = new Map(
    input.currentSystem.resourceCompatibility.map((compatibility) => [
      compatibility.nativeEntry.id,
      compatibility.nativeEntry,
    ]),
  );
  const entriesByLibrary = new Map<string, Array<Record<string, unknown>>>(
    [...nativeEntries].map(([id]) => [id, []]),
  );
  const otherEntries: Array<Record<string, unknown>> = [];

  const installed = [...input.installedPackages.values()].sort((left, right) =>
    left.document.package.id.localeCompare(right.document.package.id));
  for (const resourcePackage of installed) {
    const routes = [...resourcePackage.routes].sort((left, right) =>
      left.resource.path.localeCompare(right.resource.path));
    for (const route of routes) {
      const entry = toSheetResourceEntry(
        resourcePackage.document.package.id,
        route.resource,
        input.resolveMediaReference,
      );
      if (route.destination === "other-resources") {
        otherEntries.push(entry);
        continue;
      }
      if (!route.nativeEntry) continue;
      entriesByLibrary.get(route.nativeEntry.id)?.push(entry);
    }
  }

  const nativeLibraries = [...nativeEntries].map(([id, entry]) => ({
    ID: id,
    名称: entry.label,
    路径: `platform-resource-library:${id}`,
    entries: entriesByLibrary.get(id) ?? [],
  }));
  return otherEntries.length > 0
    ? [...nativeLibraries, {
      ID: otherResourceLibraryId,
      名称: otherResourceLibraryName,
      路径: otherResourceLibraryPath,
      entries: otherEntries,
    }]
    : nativeLibraries;
}

function toSheetResourceEntry(
  packageId: string,
  resource: PlatformResource,
  resolveMediaReference?: PlatformMediaReferenceResolver,
  entryId = `${packageId}:${resource.id}`,
): Record<string, unknown> {
  const data = isRecord(resource.data) ? resource.data : {};
  const common = {
    ID: entryId,
    __pbdhResourceCopy: {
      source: { packageId, resourceId: resource.id },
      template: structuredClone(resource.template),
      presentation: structuredClone(resource.presentation),
      data: structuredClone(data),
      labels: [],
      media: structuredClone(resource.media),
    } satisfies TabletopResourceCopy,
    ...data,
    卡牌显示方式: resource.presentation.mode,
    卡图: resolveMedia(resource.media.portrait),
    卡背: resolveMedia(resource.media.back),
  };

  switch (resource.template.id) {
    case "自由":
      return {
        ...freeTemplateSections(data.内容),
        ...common,
      };
    case "种族": {
      const rawFeatures: unknown[] = Array.isArray(data.特性) ? data.特性 : [];
      const features = rawFeatures.filter(isRecord);
      return {
        ...common,
        类型: "种族",
        特性A: stringField(features[0]?.描述),
        特性B: stringField(features[1]?.描述),
      };
    }
    case "社群": {
      const feature = isRecord(data.特性) ? data.特性 : undefined;
      return { ...common, 类型: "社群", 描述: stringField(feature?.描述) };
    }
    case "职业": {
      const recommendedAttributes = isRecord(data.推荐初始属性) ? data.推荐初始属性 : undefined;
      return {
        ...common,
        领域: Array.isArray(data.领域) ? data.领域.map(stringField).filter(Boolean).join(" + ") : stringField(data.领域),
        推荐初始属性: stringField(recommendedAttributes?.说明),
        背景问题1: arrayItem(data.背景问题, 0),
        背景问题2: arrayItem(data.背景问题, 1),
        背景问题3: arrayItem(data.背景问题, 2),
        关系问题1: arrayItem(data.关系问题, 0),
        关系问题2: arrayItem(data.关系问题, 1),
        关系问题3: arrayItem(data.关系问题, 2),
      };
    }
    case "护甲":
      return {
        ...common,
        重度阈值: stringField(data.重度伤害阈值),
        严重阈值: stringField(data.严重伤害阈值),
      };
    default:
      return common;
  }

  function resolveMedia(assetId: unknown): string {
    return typeof assetId === "string"
      ? resolveMediaReference?.({ packageId, assetId }) ?? sheetRuntimeMediaPath(packageId, assetId)
      : "";
  }
}

function freeTemplateSections(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) return {};
  return Object.fromEntries(value.flatMap((section) => {
    if (!isRecord(section)) return [];
    const title = stringField(section.标题).trim();
    if (!title) return [];
    return [[title, stringField(section.正文)]];
  }));
}

export function buildSheetEmbeddedResourceEntry(input: {
  entryId: string;
  libraryId: string;
  resourceCopy: TabletopResourceCopy;
  resolveMediaReference?: PlatformMediaReferenceResolver;
}) {
  const packageId = input.resourceCopy.source?.packageId ?? "embedded-character-save";
  const raw = toSheetResourceEntry(
    packageId,
    {
      id: input.resourceCopy.source?.resourceId ?? input.entryId,
      path: input.entryId,
      template: input.resourceCopy.template,
      presentation: input.resourceCopy.presentation,
      data: input.resourceCopy.data,
      media: input.resourceCopy.media,
    } as PlatformResource,
    input.resolveMediaReference,
    input.entryId,
  );
  const normalized = normalizeResourceLibraries([{
    ID: input.libraryId,
    名称: input.libraryId,
    路径: `character-save:${input.libraryId}`,
    entries: [raw],
  }]);
  if (!normalized.ok) {
    throw new Error(normalized.issues.map((issue) => issue.code).join("\n"));
  }
  return {
    ...normalized.resourceLibraries[0]!.entries[0]!,
    resourceCopy: structuredClone(input.resourceCopy),
  };
}

export function buildSheetRuntimeMediaAssets(
  installedPackages: PlatformResourceLibrary,
): RuntimePackageAsset[] {
  return [...installedPackages.values()].flatMap((resourcePackage) => {
    const runtimeAssetIds = new Set(resourcePackage.routes.flatMap((route) => {
      return [route.resource.media.portrait, route.resource.media.back]
        .filter((assetId): assetId is string => typeof assetId === "string");
    }));
    return resourcePackage.document.assets
      .filter((asset) => runtimeAssetIds.has(asset.id))
      .map((asset) => {
        const bytes = resourcePackage.media.get(asset.id);
        if (!bytes) throw new Error(`已安装资源包缺少媒体：${asset.id}`);
        return {
          路径: sheetRuntimeMediaPath(resourcePackage.document.package.id, asset.id),
          类型: asset.mediaType,
          sourceType: "resourceExtension" as const,
          sourceId: resourcePackage.document.package.id,
          bytes: new Uint8Array(bytes),
        };
      });
  });
}

export function replacePlatformRuntimeMediaAssets(
  currentAssets: RuntimePackageAsset[],
  installedPackages: PlatformResourceLibrary,
): RuntimePackageAsset[] {
  return [
    ...currentAssets.filter((asset) => !asset.路径.startsWith("platform-resources/")),
    ...buildSheetRuntimeMediaAssets(installedPackages),
  ];
}

export function sheetRuntimeMediaPath(packageId: string, assetId: string): string {
  return `platform-resources/${encodeURIComponent(packageId)}/${encodeURIComponent(assetId)}.webp`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function isPlatformResourceEntry(entry: ResourceLibraryEntry): boolean {
  return typeof entry.resourceCopy?.source?.packageId === "string";
}

function resourceLibraryInput(library: SheetResourceLibrary, entries: ResourceLibraryEntry[]) {
  return {
    ID: library.ID,
    名称: library.名称,
    路径: library.路径,
    entries: entries.map((entry) => ({
      ID: entry.ID,
      ...(entry.aliases?.length ? { 旧ID: entry.aliases } : {}),
      ...entry.fields,
      ...(entry.resourceCopy ? { __pbdhResourceCopy: structuredClone(entry.resourceCopy) } : {}),
    })),
  };
}

function arrayItem(value: unknown, index: number): string {
  return Array.isArray(value) ? stringField(value[index]) : "";
}
