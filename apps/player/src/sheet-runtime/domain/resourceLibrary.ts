import { z } from "zod";
import { isPlainObject } from "../utils";

export const resourceLibraryFieldWidthSchema = z.enum(["compact", "normal", "wide", "fill"]);

export const resourceLibraryFieldTemplateSchema = z.object({
  键: z.string().min(1),
  标签: z.string().min(1).optional(),
  默认显示: z.boolean().optional(),
  可筛选: z.boolean().optional(),
  可排序: z.boolean().optional(),
  可搜索: z.boolean().optional(),
  列宽: resourceLibraryFieldWidthSchema.optional(),
});

export const resourceLibraryReferenceSchema = z.object({
  ID: z.string().min(1),
  名称: z.string().min(1),
  路径: z.string().min(1),
});

export const resourceLibraryPackageInputSchema = resourceLibraryReferenceSchema.extend({
  entries: z.unknown(),
});

export const resourceLibraryFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  visible: z.boolean(),
  filterable: z.boolean(),
  sortable: z.boolean(),
  searchable: z.boolean().default(true),
  width: resourceLibraryFieldWidthSchema.optional(),
});

export const resourceLibraryEntrySchema = z.object({
  ID: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  fields: z.record(z.string(), z.string()),
});

export const resourceLibrarySchema = z.object({
  ID: z.string().min(1),
  名称: z.string().min(1),
  路径: z.string().min(1),
  fields: z.array(resourceLibraryFieldSchema),
  entries: z.array(resourceLibraryEntrySchema),
});

export type ResourceLibraryFieldTemplate = z.infer<typeof resourceLibraryFieldTemplateSchema>;
export type ResourceLibraryFieldWidth = z.infer<typeof resourceLibraryFieldWidthSchema>;
export type ResourceLibraryReference = z.infer<typeof resourceLibraryReferenceSchema>;
export type ResourceLibraryPackageInput = z.infer<typeof resourceLibraryPackageInputSchema>;
export type ResourceLibraryField = z.infer<typeof resourceLibraryFieldSchema>;
export type ResourceLibraryEntry = z.infer<typeof resourceLibraryEntrySchema>;
export type ResourceLibrary = z.infer<typeof resourceLibrarySchema>;

export type ResourceLibraryIssue = {
  level: "fatal" | "error";
  code: string;
  text: string;
  path?: string;
};

export type ResourceLibraryQuery = {
  keywords?: string;
  filters?: Record<string, string[]>;
  sort?: {
    field: string;
    direction?: "asc" | "desc";
  };
};

export type ResourceLibraryNormalizationResult =
  | { ok: true; resourceLibraries: ResourceLibrary[] }
  | { ok: false; issues: ResourceLibraryIssue[] };

export function normalizeResourceLibraries(inputs: ResourceLibraryPackageInput[]): ResourceLibraryNormalizationResult {
  const issues: ResourceLibraryIssue[] = [];
  const libraries: ResourceLibrary[] = [];
  const libraryIds = new Set<string>();

  inputs.forEach((input, libraryIndex) => {
    if (libraryIds.has(input.ID)) {
      issues.push({
        level: "error",
        code: "DUPLICATE_RESOURCE_LIBRARY_ID",
        text: `Resource Library ID 重复：${input.ID}`,
        path: `resourceLibraries.${libraryIndex}.ID`,
      });
      return;
    }
    libraryIds.add(input.ID);

    const normalized = normalizeResourceLibrary(input, libraryIndex);
    if (normalized.ok) {
      libraries.push(normalized.library);
    } else {
      issues.push(...normalized.issues);
    }
  });

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, resourceLibraries: libraries };
}

function normalizeResourceLibrary(
  input: ResourceLibraryPackageInput,
  libraryIndex: number,
): { ok: true; library: ResourceLibrary } | { ok: false; issues: ResourceLibraryIssue[] } {
  if (!Array.isArray(input.entries)) {
    return {
      ok: false,
      issues: [
        {
          level: "error",
          code: "RESOURCE_LIBRARY_NOT_ARRAY",
          text: `Resource Library 必须是 JSON 对象数组：${input.ID}`,
          path: `resourceLibraries.${libraryIndex}.entries`,
        },
      ],
    };
  }

  const issues: ResourceLibraryIssue[] = [];
  const entryIds = new Set<string>();
  const rawEntries: Array<Record<string, unknown>> = [];
  const fieldKeys: string[] = [];
  const complexFieldKeys = new Set<string>();

  input.entries.forEach((entry, entryIndex) => {
    if (!isPlainObject(entry)) {
      issues.push({
        level: "error",
        code: "RESOURCE_LIBRARY_ENTRY_NOT_OBJECT",
        text: `Resource Library 条目必须是 JSON 对象：${input.ID}`,
        path: `resourceLibraries.${libraryIndex}.entries.${entryIndex}`,
      });
      return;
    }

    const idValue = entry.ID;
    if (typeof idValue !== "string" || idValue.trim() === "") {
      issues.push({
        level: "error",
        code: "RESOURCE_ENTRY_ID_MISSING",
        text: `Resource Library 条目缺少稳定 ID：${input.ID}`,
        path: `resourceLibraries.${libraryIndex}.entries.${entryIndex}.ID`,
      });
      return;
    }

    if (entryIds.has(idValue)) {
      issues.push({
        level: "error",
        code: "DUPLICATE_RESOURCE_ENTRY_ID",
        text: `Resource Library 条目 ID 重复：${idValue}`,
        path: `resourceLibraries.${libraryIndex}.entries.${entryIndex}.ID`,
      });
      return;
    }
    entryIds.add(idValue);

    for (const [key, value] of Object.entries(entry)) {
      if (!fieldKeys.includes(key)) {
        fieldKeys.push(key);
      }
      if (isComplexResourceValue(value)) {
        complexFieldKeys.add(key);
      }
    }

    rawEntries.push(entry);
  });

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const claimedIds = new Set(entryIds);
  const aliasesByEntry = rawEntries.map((entry, entryIndex) => {
    const aliases = normalizeResourceEntryAliases(entry.旧ID);
    if (!aliases.ok) {
      issues.push({
        level: "error",
        code: "RESOURCE_ENTRY_LEGACY_ID_INVALID",
        text: `Resource Library 条目的旧ID必须是非空字符串或非空字符串数组：${input.ID}`,
        path: `resourceLibraries.${libraryIndex}.entries.${entryIndex}.旧ID`,
      });
      return [];
    }
    for (const alias of aliases.values) {
      if (claimedIds.has(alias)) {
        issues.push({
          level: "error",
          code: "RESOURCE_ENTRY_ID_ALIAS_CONFLICT",
          text: `Resource Library 条目的当前 ID 或旧 ID 冲突：${alias}`,
          path: `resourceLibraries.${libraryIndex}.entries.${entryIndex}.旧ID`,
        });
        continue;
      }
      claimedIds.add(alias);
    }
    return aliases.values;
  });

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const entries = rawEntries.map((entry, entryIndex) => ({
    ID: String(entry.ID),
    ...(aliasesByEntry[entryIndex]?.length ? { aliases: aliasesByEntry[entryIndex] } : {}),
    fields: Object.fromEntries(fieldKeys.map((key) => [key, resourceValueToString(entry[key])])),
  }));
  const fields = fieldKeys.map((key) => buildFieldMetadata(key, complexFieldKeys.has(key), entries.map((entry) => entry.fields[key] ?? "")));

  return {
    ok: true,
    library: {
      ID: input.ID,
      名称: input.名称,
      路径: input.路径,
      fields,
      entries,
    },
  };
}

function buildFieldMetadata(key: string, isComplex: boolean, values: string[]): ResourceLibraryField {
  const hiddenAuthorField = key === "ID";
  return {
    key,
    label: key,
    visible: !hiddenAuthorField,
    filterable: !hiddenAuthorField && !isComplex,
    sortable: !hiddenAuthorField && !isComplex,
    searchable: !hiddenAuthorField && !isComplex,
    width: inferResourceFieldWidth(values),
  };
}

export function getResourceLibraryFields(
  library: ResourceLibrary,
  templates?: ResourceLibraryFieldTemplate[],
): ResourceLibraryField[] {
  if (!templates || templates.length === 0) {
    return library.fields;
  }

  const templatesByKey = new Map(templates.map((template) => [template.键, template]));
  const inferredKeys = new Set(library.fields.map((field) => field.key));
  const mergedFields = library.fields.map((field) =>
    resolveResourceLibraryField(library, field.key, templatesByKey.get(field.key), field),
  );
  const templateOnlyFields = templates
    .filter((template) => !inferredKeys.has(template.键))
    .map((template) => resolveResourceLibraryField(library, template.键, template));

  return [...mergedFields, ...templateOnlyFields];
}

function resolveResourceLibraryField(
  library: ResourceLibrary,
  key: string,
  template?: ResourceLibraryFieldTemplate,
  inferred?: ResourceLibraryField,
): ResourceLibraryField {
  return {
    key,
    label: template?.标签 ?? inferred?.label ?? key,
    visible: template?.默认显示 ?? inferred?.visible ?? true,
    filterable: template?.可筛选 ?? inferred?.filterable ?? true,
    sortable: template?.可排序 ?? inferred?.sortable ?? true,
    searchable: template?.可搜索 ?? template?.默认显示 ?? inferred?.searchable ?? true,
    width: template?.列宽 ?? inferred?.width ?? inferResourceFieldWidth(library.entries.map((entry) => entry.fields[key] ?? "")),
  };
}

export function inferResourceFieldWidth(values: string[] = []): ResourceLibraryFieldWidth {
  const p90Length = percentile(values.map((value) => stringDisplayLength(value)).filter((length) => length > 0), 0.9);
  if (p90Length >= 40) {
    return "fill";
  }
  if (p90Length >= 18) {
    return "wide";
  }
  if (p90Length > 0 && p90Length <= 6) {
    return "compact";
  }
  return "normal";
}

export function queryResourceLibraryEntries(library: ResourceLibrary, query: ResourceLibraryQuery = {}, fields: ResourceLibraryField[] = library.fields): ResourceLibraryEntry[] {
  const filtered = filterResourceLibraryEntries(library.entries, query.filters ?? {});
  const searched = searchResourceLibraryEntries(filtered, query.keywords ?? "", fields.filter((field) => field.searchable).map((field) => field.key));
  return sortResourceLibraryEntries(searched, query.sort);
}

export function searchResourceLibraryEntries(entries: ResourceLibraryEntry[], keywords: string, searchableFieldKeys: string[]): ResourceLibraryEntry[] {
  const terms = keywords.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  if (terms.length === 0) return entries;
  return entries.filter((entry) => {
    const values = searchableFieldKeys.map((key) => (entry.fields[key] ?? "").toLocaleLowerCase());
    return terms.every((term) => values.some((value) => value.includes(term)));
  });
}

export function filterResourceLibraryEntries(
  entries: ResourceLibraryEntry[],
  filters: Record<string, string[]>,
): ResourceLibraryEntry[] {
  const activeFilters = Object.entries(filters)
    .map(([field, values]) => [field, values.filter(Boolean)] as const)
    .filter(([, values]) => values.length > 0);

  if (activeFilters.length === 0) {
    return entries;
  }

  return entries.filter((entry) =>
    activeFilters.every(([field, allowedValues]) => allowedValues.includes(entry.fields[field] ?? "")),
  );
}

export function sortResourceLibraryEntries(
  entries: ResourceLibraryEntry[],
  sort: ResourceLibraryQuery["sort"],
): ResourceLibraryEntry[] {
  if (!sort) {
    return entries;
  }

  const direction = sort.direction === "desc" ? -1 : 1;
  return [...entries].sort((left, right) => direction * compareResourceText(left.fields[sort.field] ?? "", right.fields[sort.field] ?? ""));
}

export function uniqueResourceFieldValues(library: ResourceLibrary, fieldKey: string): string[] {
  return [...new Set(library.entries.map((entry) => entry.fields[fieldKey] ?? "").filter((value) => value !== ""))].sort((left, right) =>
    compareResourceText(left, right),
  );
}

function compareResourceText(left: string, right: string): number {
  return left.localeCompare(right, "zh-Hans", { numeric: true });
}

export function summarizeResourceEntry(entry: ResourceLibraryEntry): string {
  return entry.fields.名称 || entry.ID;
}

export function resourceEntryMatchesId(entry: ResourceLibraryEntry, id: string): boolean {
  return entry.ID === id || Boolean(entry.aliases?.includes(id));
}

export function findResourceLibraryEntry(library: ResourceLibrary | undefined, id: string): ResourceLibraryEntry | undefined {
  return library?.entries.find((entry) => resourceEntryMatchesId(entry, id));
}

export function resourceEntryIdentityIds(entry: ResourceLibraryEntry): string[] {
  return [entry.ID, ...(entry.aliases ?? [])];
}

function resourceValueToString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value);
}

function normalizeResourceEntryAliases(value: unknown): { ok: true; values: string[] } | { ok: false } {
  if (value === undefined || value === null || value === "") return { ok: true, values: [] };
  const values = typeof value === "string" ? [value] : Array.isArray(value) ? value : null;
  if (!values || values.some((item) => typeof item !== "string" || item.trim() === "")) return { ok: false };
  if (new Set(values).size !== values.length) return { ok: false };
  return { ok: true, values };
}

function isComplexResourceValue(value: unknown): boolean {
  return typeof value === "object" && value !== null;
}

function stringDisplayLength(value: string): number {
  return [...value].reduce((length, char) => length + (char.charCodeAt(0) <= 0x7f ? 1 : 2), 0);
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index] ?? 0;
}
