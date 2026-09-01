import type { ResourceCatalogSlice, RuntimeSlice } from "../runtimeTypes";

export function createResourceCatalogSlice(): RuntimeSlice<ResourceCatalogSlice> {
  return () => ({
    resourceCatalog: null,
    installedResourceExtensions: [],
    resourceReferenceIssues: [],
  });
}
