import type { ResourceLibrary, ResourceLibraryField, ResourceLibraryQuery } from "../domain/resourceLibrary";
import { uniqueResourceFieldValues } from "../domain/resourceLibrary";
import { isPlainObject } from "../utils";

export type ResourcePickerQueriesByLibrary = Record<string, ResourceLibraryQuery>;
export type ResourcePickerQueryCache = Record<string, ResourcePickerQueriesByLibrary>;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const resourcePickerQuerySaveDelayMs = 300;

const keyPrefix = "pbdh:player:resource-queries:v1:";
const unsafeKeys = new Set(["__proto__", "constructor", "prototype"]);

export function resourcePickerQueryCacheKey(packageId: string, characterSaveId: string): string {
  return `${keyPrefix}${packageId}:${characterSaveId}`;
}

export function loadResourcePickerQueries(
  packageId: string | null | undefined,
  characterSaveId: string | null | undefined,
  moduleId: string,
  storage?: StorageLike,
): ResourcePickerQueriesByLibrary {
  if (!packageId || !characterSaveId || !isSafeId(moduleId)) return {};
  return readCache(packageId, characterSaveId, storage)[moduleId] ?? {};
}

export function saveResourcePickerQueries(
  packageId: string | null | undefined,
  characterSaveId: string | null | undefined,
  moduleId: string,
  queries: ResourcePickerQueriesByLibrary,
  storage?: StorageLike,
): void {
  if (!packageId || !characterSaveId || !isSafeId(moduleId)) return;
  const target = storage ?? browserStorage();
  if (!target) return;

  // 同一存档下有多个资源选择模块；先读后写，避免后保存的模块覆盖别人的查询。
  const cache = readCache(packageId, characterSaveId, target);
  if (Object.keys(queries).length === 0) delete cache[moduleId];
  else cache[moduleId] = queries;

  try {
    if (Object.keys(cache).length === 0) target.removeItem(resourcePickerQueryCacheKey(packageId, characterSaveId));
    else target.setItem(resourcePickerQueryCacheKey(packageId, characterSaveId), JSON.stringify(cache));
  } catch {
    // localStorage 不可写时放弃缓存，不影响选卡本身。
  }
}

export function removeResourcePickerQueries(
  packageId: string | null | undefined,
  characterSaveId: string | null | undefined,
  storage?: StorageLike,
): void {
  if (!packageId || !characterSaveId) return;
  try {
    (storage ?? browserStorage())?.removeItem(resourcePickerQueryCacheKey(packageId, characterSaveId));
  } catch {
    // 缓存清理失败不阻塞存档删除。
  }
}

/**
 * 丢弃系统包更新或资源库变化后已不存在的筛选项，避免重新打开时被旧条件挡成空表。
 * 保留显式空查询（用户清掉了默认筛选），使其继续覆盖链接上的默认查询。
 */
export function sanitizeResourcePickerQuery(
  query: ResourceLibraryQuery | undefined,
  library: ResourceLibrary,
  fields: ResourceLibraryField[],
): ResourceLibraryQuery | undefined {
  if (!query) return undefined;

  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  const filters: Record<string, string[]> = {};
  for (const [fieldKey, values] of Object.entries(query.filters ?? {})) {
    const field = fieldByKey.get(fieldKey);
    if (!field?.visible || !field.filterable) continue;
    const available = new Set(uniqueResourceFieldValues(library, fieldKey));
    const kept = values.filter((value) => available.has(value));
    if (kept.length > 0) filters[fieldKey] = kept;
  }

  const keywords = query.keywords?.trim() ? query.keywords : undefined;
  const sortField = query.sort ? fieldByKey.get(query.sort.field) : undefined;
  const sort = query.sort && sortField?.visible && sortField.sortable
    ? { field: query.sort.field, ...(query.sort.direction ? { direction: query.sort.direction } : {}) }
    : undefined;
  const hadContent = Boolean(keywords) || Object.keys(query.filters ?? {}).length > 0 || Boolean(query.sort);

  if (!keywords && Object.keys(filters).length === 0 && !sort) {
    return hadContent ? undefined : {};
  }

  return {
    ...(keywords ? { keywords } : {}),
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    ...(sort ? { sort } : {}),
  };
}

function readCache(
  packageId: string,
  characterSaveId: string,
  storage?: StorageLike,
): ResourcePickerQueryCache {
  try {
    const raw = (storage ?? browserStorage())?.getItem(resourcePickerQueryCacheKey(packageId, characterSaveId));
    return raw ? normalizeCache(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

function isSafeId(value: string): boolean {
  return value.length > 0 && !unsafeKeys.has(value);
}

function browserStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function normalizeCache(value: unknown): ResourcePickerQueryCache {
  if (!isPlainObject(value)) return {};

  const cache: ResourcePickerQueryCache = {};
  for (const [moduleId, libraries] of Object.entries(value)) {
    if (!isSafeId(moduleId) || !isPlainObject(libraries)) continue;
    const moduleCache: ResourcePickerQueriesByLibrary = {};
    for (const [libraryId, query] of Object.entries(libraries)) {
      if (!isSafeId(libraryId)) continue;
      const normalized = normalizeQuery(query);
      if (normalized) moduleCache[libraryId] = normalized;
    }
    if (Object.keys(moduleCache).length > 0) cache[moduleId] = moduleCache;
  }
  return cache;
}

function normalizeQuery(value: unknown): ResourceLibraryQuery | undefined {
  if (!isPlainObject(value)) return undefined;
  // 只接受本模块写出的查询形状；杂散的 JSON 对象不应覆盖链接默认查询。
  const hasKeywords = typeof value.keywords === "string";
  const hasFilters = isPlainObject(value.filters);
  const hasSort = isPlainObject(value.sort);
  if (!hasKeywords && !hasFilters && !hasSort) return undefined;

  const filters: Record<string, string[]> = {};
  if (isPlainObject(value.filters)) {
    for (const [field, values] of Object.entries(value.filters)) {
      if (!isSafeId(field) || !Array.isArray(values)) continue;
      const strings = values.filter((item): item is string => typeof item === "string");
      if (strings.length > 0) filters[field] = strings;
    }
  }

  let sort: ResourceLibraryQuery["sort"];
  if (isPlainObject(value.sort) && typeof value.sort.field === "string" && value.sort.field) {
    const direction = value.sort.direction;
    if (direction === undefined || direction === "asc" || direction === "desc") {
      sort = { field: value.sort.field, ...(direction ? { direction } : {}) };
    }
  }

  return {
    ...(typeof value.keywords === "string" ? { keywords: value.keywords } : {}),
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    ...(sort ? { sort } : {}),
  };
}
