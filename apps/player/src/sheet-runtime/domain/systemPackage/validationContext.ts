import type { PackageIssue, PackagePage, SheetModule, SystemPackage } from "./contract";

export interface ValidationContext {
  systemPackage: SystemPackage;
  issues: PackageIssue[];
  assetRefs: Set<string>;
  usedAssetRefs: Set<string>;
  moduleById: Map<string, SheetModule>;
  pageById: Map<string, PackagePage>;
  moduleIds: Set<string>;
}

export function createValidationContext(
  systemPackage: SystemPackage,
  issues: PackageIssue[],
): ValidationContext {
  return {
    systemPackage,
    issues,
    assetRefs: new Set((systemPackage.assets ?? []).map((asset) => asset.路径)),
    usedAssetRefs: new Set<string>(),
    moduleById: new Map(systemPackage.modules.map((module) => [module.ID, module])),
    pageById: new Map(systemPackage.pages.map((page) => [page.ID, page])),
    moduleIds: new Set<string>(),
  };
}
