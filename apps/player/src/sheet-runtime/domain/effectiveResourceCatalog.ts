import { normalizeResourceLibraries, resourceEntryIdentityIds, type ResourceLibrary, type ResourceLibraryEntry } from "./resourceLibrary";
import type { ResourceExtension, ResourceExtensionIssue } from "./resourceExtension";
import type { SystemPackage } from "./systemPackage";

export type ResourceProvenance =
  | { type: "systemPackage"; id: string; name: string; version: string }
  | { type: "resourceExtension"; id: string; name: string; version: string };

export interface EffectiveResourceContributor {
  source: ResourceProvenance;
  entryCount: number;
}

export interface EffectiveResourceLibrary {
  library: ResourceLibrary;
  contributors: EffectiveResourceContributor[];
  entryProvenance: Record<string, ResourceProvenance>;
}

export interface EffectiveResourceExtensionStatus {
  extension: ResourceExtension;
  status: "active" | "disabled";
  issues: ResourceExtensionIssue[];
}

export interface EffectiveResourceCatalog {
  resourceLibraries: ResourceLibrary[];
  libraries: EffectiveResourceLibrary[];
  extensions: EffectiveResourceExtensionStatus[];
}

interface MutableLibrary {
  ID: string;
  名称: string;
  路径: string;
  entries: ResourceLibraryEntry[];
  contributors: EffectiveResourceContributor[];
  entryProvenance: Record<string, ResourceProvenance>;
}

export function createEffectiveResourceCatalog(systemPackage: SystemPackage, extensions: ResourceExtension[]): EffectiveResourceCatalog {
  const packageSource: ResourceProvenance = {
    type: "systemPackage",
    id: systemPackage.manifest.ID,
    name: systemPackage.manifest.名称,
    version: systemPackage.manifest.版本,
  };
  const libraryOrder: string[] = [];
  const libraries = new Map<string, MutableLibrary>();

  for (const library of systemPackage.resourceLibraries ?? []) {
    libraryOrder.push(library.ID);
    libraries.set(library.ID, {
      ID: library.ID,
      名称: library.名称,
      路径: library.路径,
      entries: [...library.entries],
      contributors: [{ source: packageSource, entryCount: library.entries.length }],
      entryProvenance: Object.fromEntries(library.entries.map((entry) => [entry.ID, packageSource])),
    });
  }

  const statuses: EffectiveResourceExtensionStatus[] = [];
  for (const extension of extensions) {
    const extensionIssues: ResourceExtensionIssue[] = [];
    if (extension.目标系统包ID !== systemPackage.manifest.ID) {
      extensionIssues.push({
        level: "error",
        code: "RESOURCE_EXTENSION_TARGET_MISMATCH",
        text: `Resource Extension ${extension.ID} 不属于当前系统包。`,
        path: "目标系统包ID",
      });
    }

    for (const contribution of extension.resourceLibraries) {
      const existingIds = new Set(libraries.get(contribution.ID)?.entries.flatMap(resourceEntryIdentityIds) ?? []);
      for (const entry of contribution.library.entries) {
        const conflictingId = resourceEntryIdentityIds(entry).find((id) => existingIds.has(id));
        if (conflictingId) {
          extensionIssues.push({
            level: "error",
            code: "RESOURCE_ENTRY_ID_CONFLICT",
            text: `Resource Library ${contribution.ID} 的 Entry 当前 ID 或旧 ID 冲突：${conflictingId}`,
            path: `resourceLibraries.${contribution.ID}.entries.${entry.ID}`,
          });
        }
        for (const id of resourceEntryIdentityIds(entry)) existingIds.add(id);
      }
    }

    if (extensionIssues.length > 0) {
      statuses.push({ extension, status: "disabled", issues: extensionIssues });
      continue;
    }

    const source: ResourceProvenance = { type: "resourceExtension", id: extension.ID, name: extension.名称, version: extension.版本 };
    for (const contribution of extension.resourceLibraries) {
      let target = libraries.get(contribution.ID);
      if (!target) {
        libraryOrder.push(contribution.ID);
        target = {
          ID: contribution.ID,
          名称: contribution.名称,
          路径: contribution.library.路径,
          entries: [],
          contributors: [],
          entryProvenance: {},
        };
        libraries.set(contribution.ID, target);
      }
      target.entries.push(...contribution.library.entries);
      target.contributors.push({ source, entryCount: contribution.library.entries.length });
      for (const entry of contribution.library.entries) target.entryProvenance[entry.ID] = source;
    }
    statuses.push({ extension, status: "active", issues: [] });
  }

  const effectiveLibraries = libraryOrder.map((libraryId) => {
    const source = libraries.get(libraryId)!;
    const normalized = normalizeResourceLibraries([{
      ID: source.ID,
      名称: source.名称,
      路径: source.路径,
      entries: source.entries.map((entry) => ({
        ...qualifyExtensionAssetReferences(entry.fields, source.entryProvenance[entry.ID]),
        ID: entry.ID,
        ...(entry.aliases?.length ? { 旧ID: entry.aliases.length === 1 ? entry.aliases[0] : entry.aliases } : {}),
      })),
    }]);
    if (!normalized.ok) throw new Error(`Effective Resource Catalog normalization failed: ${libraryId}`);
    return {
      library: normalized.resourceLibraries[0],
      contributors: source.contributors,
      entryProvenance: source.entryProvenance,
    };
  });

  return {
    resourceLibraries: effectiveLibraries.map((item) => item.library),
    libraries: effectiveLibraries,
    extensions: statuses,
  };
}

function qualifyExtensionAssetReferences(
  fields: Record<string, string>,
  provenance: ResourceProvenance | undefined,
): Record<string, string> {
  if (provenance?.type !== "resourceExtension") return fields;
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [
    key,
    value.startsWith("assets/")
      ? `resource-extension:${encodeURIComponent(provenance.id)}:${value}`
      : value,
  ]));
}

export function applyEffectiveResourceCatalog(systemPackage: SystemPackage, catalog: EffectiveResourceCatalog): SystemPackage {
  return { ...systemPackage, resourceLibraries: catalog.resourceLibraries };
}

export function findResourceEntryProvenance(catalog: EffectiveResourceCatalog | null, libraryId: string | undefined, entryId: string | undefined): ResourceProvenance | undefined {
  if (!catalog || !libraryId || !entryId) return undefined;
  return catalog.libraries.find((item) => item.library.ID === libraryId)?.entryProvenance[entryId];
}
