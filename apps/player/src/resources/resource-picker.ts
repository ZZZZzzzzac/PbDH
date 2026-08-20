import type { InstalledResourcePackage, ResourceLibrary } from "./resource-library.ts";

export type ResourcePickerCandidate = {
  key: string;
  installed: InstalledResourcePackage;
  resource: InstalledResourcePackage["document"]["resources"][number];
  fields: Record<string, string>;
};

export type ResourcePickerQuery = {
  keywords?: string;
  filters?: Record<string, string[]>;
  sort?: { field: string; direction: "asc" | "desc" };
};

function textFields(resource: ResourcePickerCandidate["resource"]): Record<string, string> {
  if (!resource.data || typeof resource.data !== "object" || Array.isArray(resource.data)) return {};
  return Object.fromEntries(Object.entries(resource.data).flatMap(([key, value]) =>
    typeof value === "string" ? [[key, value]] : []));
}

export function listResourcePickerCandidates(
  library: ResourceLibrary,
  nativeEntryId: string,
): ResourcePickerCandidate[] {
  return [...library.values()].flatMap((installed) => installed.routes.flatMap((route) => {
    if (route.nativeEntry?.id !== nativeEntryId) return [];
    const fields = textFields(route.resource);
    return [{
      key: `${installed.document.package.id}:${route.resource.id}`,
      installed,
      resource: route.resource,
      fields: { ...fields, 来源: installed.document.package.name },
    }];
  }));
}

export function queryResourcePickerCandidates(
  candidates: ResourcePickerCandidate[],
  query: ResourcePickerQuery,
): ResourcePickerCandidate[] {
  const keywords = query.keywords?.trim().toLocaleLowerCase() ?? "";
  const rows = candidates.filter((candidate) => {
    if (keywords && !Object.values(candidate.fields).some((value) =>
      value.toLocaleLowerCase().includes(keywords))) return false;
    return Object.entries(query.filters ?? {}).every(([field, values]) =>
      values.length === 0 || values.includes(candidate.fields[field] ?? ""));
  });
  if (!query.sort) return rows;
  const { field, direction } = query.sort;
  return rows.sort((left, right) => {
    const order = (left.fields[field] ?? "").localeCompare(
      right.fields[field] ?? "",
      "zh-CN",
      { numeric: true },
    );
    return direction === "asc" ? order : -order;
  });
}

export function uniqueResourcePickerValues(
  candidates: ResourcePickerCandidate[],
  field: string,
): string[] {
  return [...new Set(candidates.map((candidate) => candidate.fields[field]).filter(Boolean) as string[])]
    .sort((left, right) => left.localeCompare(right, "zh-CN", { numeric: true }));
}
