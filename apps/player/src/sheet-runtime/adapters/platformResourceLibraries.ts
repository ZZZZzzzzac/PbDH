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
  preloadedPackageIds?: ReadonlySet<string>;
}): SystemPackage {
  const packagesToMerge = input.preloadedPackageIds?.size
    ? new Map([...input.installedPackages].filter(([packageId]) => !input.preloadedPackageIds!.has(packageId)))
    : input.installedPackages;
  const platformLibraries = new Map(buildSheetResourceLibraries({
    currentSystem: input.currentSystem,
    installedPackages: packagesToMerge,
  }).map((library) => [library.ID, library]));
  const mergedInputs = (input.basePackage.resourceLibraries ?? []).flatMap((library) => {
    const platform = platformLibraries.get(library.ID);
    if (platform) platformLibraries.delete(library.ID);
    const retainedEntries = library.entries.filter((entry) => {
      const packageId = entry.resourceCopy?.source?.packageId;
      return !isPlatformResourceEntry(entry)
        || (typeof packageId === "string" && input.preloadedPackageIds?.has(packageId));
    });
    const hadReplaceablePlatformEntries = retainedEntries.length !== library.entries.length;
    if (!platform && hadReplaceablePlatformEntries && retainedEntries.length === 0) return [];
    return [resourceLibraryInput(
      library,
      [...retainedEntries, ...(platform?.entries ?? [])],
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
      // 子职选择可读取所属职业的特性；同包优先，跨包只接受唯一匹配。
      if (route.resource.template.id === "子职业" && isRecord(route.resource.data)) {
        const profession = route.resource.data.主职;
        const matches = installed.flatMap((item) => item.document.resources
          .filter((resource) => resource.template.id === "职业" && isRecord(resource.data) && resource.data.名称 === profession)
          .map((resource) => ({ packageId: item.document.package.id, resource })));
        const local = matches.filter((item) => item.packageId === resourcePackage.document.package.id);
        const candidates = local.length ? local : matches;
        entry.职业特性 = candidates.length === 1 && isRecord(candidates[0]!.resource.data)
          ? structuredFeatures(candidates[0]!.resource.data.特性) : "";
      }
      if (route.destination === "other-resources") {
        otherEntries.push(entry);
        continue;
      }
      if (!route.nativeEntry) continue;
      if (!entriesByLibrary.has(route.nativeEntry.id)) {
        nativeEntries.set(route.nativeEntry.id, route.nativeEntry);
        entriesByLibrary.set(route.nativeEntry.id, []);
      }
      entriesByLibrary.get(route.nativeEntry.id)!.push(entry);
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
      replacements: structuredClone(resource.replacements ?? []),
      media: structuredClone(resource.media),
    } satisfies TabletopResourceCopy,
    ...data,
    卡图: resolveMedia(resource.media.portrait),
    卡背: resolveMedia(resource.media.back),
  };

  switch (resource.template.id) {
    case "自由":
      return {
        ...freeTemplateSections(data.内容),
        ...indexedFreeTemplateSections(data.内容),
        ...common,
        特性: freeTemplateFeatures(data.内容),
      };
    case "种族": {
      const rawFeatures: unknown[] = Array.isArray(data.特性) ? data.特性 : [];
      const features = rawFeatures.filter(isRecord);
      const recommendedExperiences = features.map((feature) => {
        const name = stringField(feature.特性名称).trim();
        const modifier = stringField(feature.特性描述).trim();
        return `${name}${modifier}`;
      }).filter(Boolean);
      return {
        ...common,
        类型: "种族",
        特性A: structuredFeature(features[0]),
        特性B: structuredFeature(features[1]),
        推荐经历: recommendedExperiences.join("、"),
        默认种族经历: stringField(features[0]?.特性名称),
        默认种族经历修正: stringField(features[0]?.特性描述),
      };
    }
    case "社群": {
      const feature = isRecord(data.特性) ? data.特性 : undefined;
      return {
        ...common,
        类型: "社群",
        描述: structuredFeature(feature),
        参考出身: stringField(data.性格),
      };
    }
    case "职业": {
      const recommendedAttributes = isRecord(data.推荐初始属性) ? data.推荐初始属性 : undefined;
      const hopeFeature = isRecord(data.希望特性) ? data.希望特性 : undefined;
      return {
        ...common,
        描述: stringField(data.简介),
        希望特性: structuredFeature(hopeFeature),
        特性: structuredFeatures(data.特性),
        职业特性: structuredFeatures(data.特性),
        领域: Array.isArray(data.领域) ? data.领域.map(stringField).filter(Boolean).join(" + ") : stringField(data.领域),
        主领域: Array.isArray(data.领域) ? stringField(data.领域[0]) : stringField(data.领域),
        推荐初始属性: ["敏捷", "力量", "灵巧", "本能", "风度", "知识"]
          .map((name) => [name, stringField(recommendedAttributes?.[name]).trim()] as const)
          .filter(([, score]) => score)
          .map(([name, score]) => `${name} **${score}**`)
          .join(" "),
        背景问题1: arrayItem(data.背景问题, 0),
        背景问题2: arrayItem(data.背景问题, 1),
        背景问题3: arrayItem(data.背景问题, 2),
        关系问题1: arrayItem(data.关系问题, 0),
        关系问题2: arrayItem(data.关系问题, 1),
        关系问题3: arrayItem(data.关系问题, 2),
      };
    }
    case "子职业":
      return {
        ...common,
        描述: subclassFeatures(data.特性),
        推荐副领域: stringField(data.推荐次领域),
      };
    case "领域卡":
      return { ...common, 描述: stringField(data.特性描述) };
    case "护甲":
      return {
        ...common,
        重度阈值: stringField(data.重度伤害阈值),
        严重阈值: stringField(data.严重伤害阈值),
        特性名: stringField(data.特性名称),
        特性: equipmentFeature(data),
      };
    case "武器":
      return { ...common, 特性: equipmentFeature(data) };
    default:
      return common;
  }

  function resolveMedia(assetId: unknown): string {
    return typeof assetId === "string"
      ? resolveMediaReference?.({ packageId, assetId }) ?? sheetRuntimeMediaPath(packageId, assetId)
      : "";
  }
}

function structuredFeatures(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.filter(isRecord).map((feature) => {
    const name = stringField(feature.特性名称).trim();
    const description = stringField(feature.特性描述).trim();
    return name && description ? `${name}：${description}` : name || description;
  }).filter(Boolean).join("\n\n");
}

function structuredFeature(value: Record<string, unknown> | undefined): string {
  if (!value) return "";
  const name = stringField(value.特性名称).trim();
  const description = stringField(value.特性描述).trim();
  return name && description ? `${name}：${description}` : name || description;
}

const subclassFeatures = structuredFeatures;

function equipmentFeature(data: Record<string, unknown>): string {
  return structuredFeature({ 特性名称: data.特性名称, 特性描述: data.特性描述 });
}

function freeTemplateFeatures(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.filter(isRecord).map((feature) => {
    const name = stringField(feature.名称).trim();
    const description = stringField(feature.描述).trim();
    return name && description ? `${name}：${description}` : name || description;
  }).filter(Boolean).join("\n\n");
}

function freeTemplateSections(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) return {};
  return Object.fromEntries(value.flatMap((section) => {
    if (!isRecord(section)) return [];
    const title = stringField(section.名称).trim();
    if (!title) return [];
    return [[title, stringField(section.描述)]];
  }));
}

function indexedFreeTemplateSections(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) return {};
  return Object.fromEntries(value.flatMap((section, index) => {
    if (!isRecord(section)) return [];
    const prefix = `内容${index + 1}`;
    return [
      [`${prefix}名称`, stringField(section.名称)],
      [`${prefix}原文`, stringField(section.原文)],
      [`${prefix}描述`, stringField(section.描述)],
    ];
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
