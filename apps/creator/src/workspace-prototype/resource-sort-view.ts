import { useEffect, useMemo, useState } from "react";
import { getTemplateSortingFields } from "@pbdh/templates/core/explorer-sorting";
import { loadTemplateCore, readLoadedTemplateCore } from "@pbdh/templates/core/lazy";
import { compareWorkspaceResources, defaultResourceSortPreferences, type ResourceSortPreferences } from "./resource-sorting.ts";
import { resourceTitle } from "./resource-preview.tsx";
import type { ResourceSortTemplate } from "./resource-sort-menu.tsx";
import type { WorkspaceResource } from "./workspace-model.ts";

const preferenceKey = "pbdh:creator:resource-sort";

export function readResourceSortPreferences(): { preferences: ResourceSortPreferences; warning?: string } {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(preferenceKey) ?? "null");
    if (!value || typeof value !== "object" || !("mode" in value) || !("templates" in value)
      || (value.mode !== "name" && value.mode !== "grouped") || !value.templates || typeof value.templates !== "object" || Array.isArray(value.templates)) return { preferences: defaultResourceSortPreferences };
    const templates: ResourceSortPreferences["templates"] = {};
    for (const [id, fields] of Object.entries(value.templates)) {
      if (!fields || typeof fields !== "object" || Array.isArray(fields)) continue;
      const valid = Object.entries(fields).filter((entry): entry is [string, "asc" | "desc"] => entry[1] === "asc" || entry[1] === "desc");
      Object.defineProperty(templates, id, { value: Object.fromEntries(valid), enumerable: true, writable: true, configurable: true });
    }
    return { preferences: { mode: value.mode, templates } };
  } catch { return { preferences: defaultResourceSortPreferences, warning: "无法读取本机排序偏好，已使用默认排序" }; }
}

export type ResourceViewRow<T> = { kind: "resource"; value: T } | { kind: "group"; templateId: string; count: number };

export function resourceViewRows<T>(items: readonly T[], resourceOf: (item: T) => WorkspaceResource,
  compare: (left: WorkspaceResource, right: WorkspaceResource) => number, grouped: boolean): ResourceViewRow<T>[] {
  const sorted = [...items].sort((left, right) => {
    const a = resourceOf(left), b = resourceOf(right);
    return (grouped ? a.template.id.localeCompare(b.template.id, "zh-CN") : 0) || compare(a, b);
  });
  const counts = new Map<string, number>();
  for (const item of sorted) { const id = resourceOf(item).template.id; counts.set(id, (counts.get(id) ?? 0) + 1); }
  let previous: string | undefined;
  const rows: ResourceViewRow<T>[] = [];
  for (const item of sorted) {
    const id = resourceOf(item).template.id;
    if (grouped && id !== previous) rows.push({ kind: "group", templateId: id, count: counts.get(id)! });
    rows.push({ kind: "resource", value: item });
    previous = id;
  }
  return rows;
}

export function useResourceSort(resources: readonly WorkspaceResource[]) {
  const [initial] = useState(readResourceSortPreferences);
  const [preferences, setPreferences] = useState(initial.preferences);
  const [revision, setRevision] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string>();
  const [storageError, setStorageError] = useState<string | undefined>(initial.warning);
  const referencesKey = JSON.stringify([...new Set(resources.map((resource) => JSON.stringify(resource.template)))].sort());
  const references = useMemo(() => (JSON.parse(referencesKey) as string[]).map((value) => JSON.parse(value) as { id: string; version: string }), [referencesKey]);
  useEffect(() => {
    if (preferences.mode !== "grouped") return;
    let live = true;
    setError(undefined);
    void Promise.all(references.map(async ({ id, version }) => {
      const core = await loadTemplateCore(id, version);
      if (!core) throw new Error(`Unknown template: ${id}@${version}`);
    })).then(() => { if (live) setRevision((value) => value + 1); })
      .catch(() => { if (live) setError("部分模板加载失败，暂按名称排序"); });
    return () => { live = false; };
  }, [references, attempt, preferences.mode]);
  const templates = useMemo(() => {
    const result = new Map<string, ResourceSortTemplate>();
    for (const { id, version } of [...references].sort((a, b) => a.version.localeCompare(b.version, "en", { numeric: true }))) {
      result.set(id, { id, fields: getTemplateSortingFields(id, version) });
    }
    return [...result.values()].filter((template) => template.fields.some((field) => field.key !== "名称"))
      .sort((left, right) => left.id.localeCompare(right.id, "zh-CN"));
  }, [references]);
  const compare = useMemo(() => {
    // 同组统一使用范围内最高已加载精确版本，避免比较方向改变字段规则。
    const cores = new Map<string, NonNullable<ReturnType<typeof readLoadedTemplateCore>>>();
    for (const reference of [...references].sort((a, b) => a.version.localeCompare(b.version, "en", { numeric: true }))) {
      const core = readLoadedTemplateCore(reference.id, reference.version);
      if (core) cores.set(reference.id, core);
    }
    return (left: WorkspaceResource, right: WorkspaceResource) => {
      const byName = () => resourceTitle(left).localeCompare(resourceTitle(right), "zh-CN", { numeric: true, sensitivity: "base" })
        || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
      if (preferences.mode === "name") return byName();
      const core = left.template.id === right.template.id ? cores.get(left.template.id) : undefined;
      return core && getTemplateSortingFields(core.id, core.version).some((field) => field.key !== "名称") ? compareWorkspaceResources(left, right, core, preferences)
        : byName();
    };
  }, [preferences, references, revision]);
  const change = (next: ResourceSortPreferences) => {
    setPreferences(next);
    try { localStorage.setItem(preferenceKey, JSON.stringify(next)); setStorageError(undefined); }
    catch { setStorageError("排序已生效，但本机偏好保存失败"); }
  };
  return { preferences, templates, compare, change, error, storageError, retry: () => setAttempt((value) => value + 1) };
}
