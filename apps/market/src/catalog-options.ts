import type { CatalogFacets, CatalogFilters } from "./market-model.ts";
import { knownSystemPackageLabels } from "./system-package-labels.ts";

const systemLabels: Record<string, string> = {
  ...knownSystemPackageLabels,
  __none__: "未指定目标系统",
};

const languageLabels: Record<string, string> = {
  "zh-CN": "简体中文",
  "zh-TW": "繁体中文",
  "en-US": "英语（美国）",
};

export type CatalogOption = { value: string; label: string; count: number };

export function catalogOptions(
  facets: CatalogFacets,
  filters: CatalogFilters,
): Record<keyof CatalogFilters, CatalogOption[]> {
  return {
    templateIds: options(facets.templateIds, filters.templateIds),
    systems: options(facets.systems, filters.systems, systemLabels),
    languages: options(facets.languages, filters.languages, languageLabels),
    categories: options(facets.categories, filters.categories),
  };
}

function options(
  facets: CatalogFacets[keyof CatalogFacets],
  selected: readonly string[],
  labels: Record<string, string> = {},
): CatalogOption[] {
  const counts = new Map(facets.map((facet) => [facet.value, facet.count]));
  return [...new Set([...facets.map((facet) => facet.value), ...selected])]
    .map((value) => ({ value, label: labels[value] ?? value, count: counts.get(value) ?? 0 }));
}
