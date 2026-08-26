import { z } from "zod";
import { generateId } from "../utils";
import { normalizeResourceLibraries, type ResourceLibrary } from "./resourceLibrary";

const metadataNamespaceSchema = z.string().regex(
  /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*){2,}$/u,
  "metadata 键必须使用反向域名式命名空间",
);

export const resourceExtensionDocumentSchema = z.object({
  ID: z.string().min(1).optional(),
  名称: z.string().min(1),
  版本: z.string().min(1),
  目标系统包ID: z.string().min(1),
  resourceLibraries: z.array(z.object({
    ID: z.string().min(1).optional(),
    名称: z.string().min(1),
    entries: z.array(z.record(z.string(), z.unknown())),
  })).min(1),
  metadata: z.record(metadataNamespaceSchema, z.unknown()).optional(),
});

export interface ResourceExtensionContribution {
  ID: string;
  名称: string;
  entries: Array<Record<string, unknown>>;
  library: ResourceLibrary;
}

export interface ResourceExtension {
  ID: string;
  名称: string;
  版本: string;
  目标系统包ID: string;
  metadata?: Record<string, unknown>;
  sourceType: "json" | "zip";
  resourceLibraries: ResourceExtensionContribution[];
}

export interface GeneratedResourceId {
  kind: "extension" | "resourceLibrary" | "resourceEntry";
  path: string;
  value: string;
}

export interface ResourceExtensionIssue {
  level: "error" | "warning";
  code: string;
  text: string;
  path?: string;
}

export interface ResourceExtensionIdContext {
  extensionIds?: Iterable<string>;
  libraryIds?: Iterable<string>;
  entryIdsByLibrary?: ReadonlyMap<string, ReadonlySet<string>>;
  generateId?: (prefix: string) => string;
}

export type ResourceExtensionLoadResult =
  | {
      ok: true;
      extension: ResourceExtension;
      generatedIds: GeneratedResourceId[];
      normalizedJson: string;
    }
  | { ok: false; issues: ResourceExtensionIssue[] };

export function loadResourceExtensionJson(
  text: string,
  currentSystemPackageId: string,
  context: ResourceExtensionIdContext = {},
): ResourceExtensionLoadResult {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return failure("RESOURCE_EXTENSION_JSON_INVALID", "Resource Extension JSON 无法解析。");
  }

  const parsed = resourceExtensionDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        level: "error",
        code: "RESOURCE_EXTENSION_SHAPE_INVALID",
        text: issue.message,
        path: issue.path.join("."),
      })),
    };
  }

  if (parsed.data.目标系统包ID !== currentSystemPackageId) {
    return failure(
      "RESOURCE_EXTENSION_TARGET_MISMATCH",
      `Resource Extension 目标系统包 ${parsed.data.目标系统包ID} 与当前系统包 ${currentSystemPackageId} 不一致。`,
      "目标系统包ID",
    );
  }

  const generatedIds: GeneratedResourceId[] = [];
  const idGenerator = context.generateId ?? generateId;
  const usedExtensionIds = new Set(context.extensionIds ?? []);
  const extensionId = parsed.data.ID ?? generateUniqueId("resource-extension-", usedExtensionIds, idGenerator);
  if (!extensionId) return failure("RESOURCE_EXTENSION_ID_GENERATION_FAILED", "无法生成不冲突的 Resource Extension ID。", "ID");
  if (!parsed.data.ID) generatedIds.push({ kind: "extension", path: "ID", value: extensionId });

  const usedLibraryIds = new Set(context.libraryIds ?? []);
  const candidateLibraryIds = new Set<string>();
  const normalizedInputs: Array<{ ID: string; 名称: string; entries: Array<Record<string, unknown>> }> = [];
  const issues: ResourceExtensionIssue[] = [];

  parsed.data.resourceLibraries.forEach((contribution, contributionIndex) => {
    const libraryPath = `resourceLibraries.${contributionIndex}`;
    const libraryId = contribution.ID ?? generateUniqueId("resource-library-", new Set([...usedLibraryIds, ...candidateLibraryIds]), idGenerator);
    if (!libraryId) {
      issues.push({ level: "error", code: "RESOURCE_LIBRARY_ID_GENERATION_FAILED", text: "无法生成不冲突的 Resource Library ID。", path: `${libraryPath}.ID` });
      return;
    }
    if (!contribution.ID) generatedIds.push({ kind: "resourceLibrary", path: `${libraryPath}.ID`, value: libraryId });
    if (candidateLibraryIds.has(libraryId)) {
      issues.push({ level: "error", code: "DUPLICATE_RESOURCE_LIBRARY_CONTRIBUTION", text: `Resource Extension 重复声明 Resource Library：${libraryId}`, path: `${libraryPath}.ID` });
    }
    candidateLibraryIds.add(libraryId);

    const rawEntries: Array<Record<string, unknown>> = [];
    const explicitIds = new Set<string>();
    contribution.entries.forEach((entry, entryIndex) => {
      if (!isRecord(entry)) {
        issues.push({ level: "error", code: "RESOURCE_EXTENSION_ENTRY_NOT_OBJECT", text: "Resource Extension 条目必须是 JSON 对象。", path: `${libraryPath}.entries.${entryIndex}` });
        return;
      }
      if (typeof entry.ID === "string" && entry.ID.trim()) explicitIds.add(entry.ID);
    });
    const usedEntryIds = new Set([...(context.entryIdsByLibrary?.get(libraryId) ?? []), ...explicitIds]);
    const candidateEntryIds = new Set<string>();

    contribution.entries.forEach((entry, entryIndex) => {
      if (!isRecord(entry)) return;
      const entryPath = `${libraryPath}.entries.${entryIndex}`;
      let entryId = typeof entry.ID === "string" && entry.ID.trim() ? entry.ID : undefined;
      if (!entryId) {
        entryId = generateUniqueId("resource-entry-", new Set([...usedEntryIds, ...candidateEntryIds]), idGenerator);
        if (!entryId) {
          issues.push({ level: "error", code: "RESOURCE_ENTRY_ID_GENERATION_FAILED", text: "无法生成不冲突的 Resource Entry ID。", path: `${entryPath}.ID` });
          return;
        }
        generatedIds.push({ kind: "resourceEntry", path: `${entryPath}.ID`, value: entryId });
      }
      if (candidateEntryIds.has(entryId)) {
        issues.push({ level: "error", code: "DUPLICATE_RESOURCE_ENTRY_ID", text: `Resource Extension 条目 ID 重复：${entryId}`, path: `${entryPath}.ID` });
      }
      candidateEntryIds.add(entryId);
      rawEntries.push({ ...entry, ID: entryId });
    });
    normalizedInputs.push({ ID: libraryId, 名称: contribution.名称, entries: rawEntries });
  });

  if (issues.length > 0) return { ok: false, issues };
  const normalized = normalizeResourceLibraries(normalizedInputs.map((input) => ({ ...input, 路径: `resource-extension:${extensionId}/${input.ID}` })));
  if (!normalized.ok) {
    return { ok: false, issues: normalized.issues.map((issue) => ({ ...issue, level: "error" })) };
  }

  const extension: ResourceExtension = {
    ID: extensionId,
    名称: parsed.data.名称,
    版本: parsed.data.版本,
    目标系统包ID: parsed.data.目标系统包ID,
    ...(parsed.data.metadata !== undefined ? { metadata: parsed.data.metadata } : {}),
    sourceType: "json",
    resourceLibraries: normalizedInputs.map((input, index) => ({ ...input, library: normalized.resourceLibraries[index] })),
  };
  return {
    ok: true,
    extension,
    generatedIds,
    normalizedJson: serializeResourceExtension(extension),
  };
}

export function serializeResourceExtension(extension: ResourceExtension): string {
  return `${JSON.stringify({
    ID: extension.ID,
    名称: extension.名称,
    版本: extension.版本,
    目标系统包ID: extension.目标系统包ID,
    resourceLibraries: extension.resourceLibraries.map(({ ID, 名称, entries }) => ({ ID, 名称, entries })),
    ...(extension.metadata !== undefined ? { metadata: extension.metadata } : {}),
  }, null, 2)}\n`;
}

function generateUniqueId(prefix: string, used: ReadonlySet<string>, generator: (prefix: string) => string): string | undefined {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = generator(prefix);
    if (candidate.trim() && !used.has(candidate)) return candidate;
  }
  return undefined;
}

function failure(code: string, text: string, path?: string): ResourceExtensionLoadResult {
  return { ok: false, issues: [{ level: "error", code, text, path }] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
