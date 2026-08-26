import type { CachedPackageValidationResult, SystemPackage } from "./contract";

const cachedValidModuleTypes = new Set(["freeText", "longText", "countableResource", "checkboxResource", "readOnlyDisplay", "imageField", "cardTable", "resourcePicker", "resourceComposer", "selectionGroup"]);

export function validateCachedSystemPackage(input: unknown): CachedPackageValidationResult {
  if (typeof input !== "object" || input === null) {
    return { ok: false, issues: [{ level: "fatal", code: "CACHED_PACKAGE_INVALID", text: "缓存的 System Package 数据格式不正确。" }] };
  }
  const obj = input as Record<string, unknown>;
  if (!obj.manifest || typeof obj.manifest !== "object" || !(obj.manifest as Record<string, unknown>).ID) {
    return { ok: false, issues: [{ level: "fatal", code: "CACHED_PACKAGE_INCOMPLETE", text: "缓存的 System Package 缺少 manifest.ID。" }] };
  }
  if (!Array.isArray(obj.modules) || obj.modules.length === 0) {
    return { ok: false, issues: [{ level: "fatal", code: "CACHED_PACKAGE_INCOMPLETE", text: "缓存的 System Package 缺少 modules。" }] };
  }
  for (const [index, module] of obj.modules.entries()) {
    if (typeof module !== "object" || module === null || !(module as Record<string, unknown>).类型) {
      return { ok: false, issues: [{ level: "fatal", code: "CACHED_PACKAGE_INVALID_MODULE", text: `缓存的 System Package 第 ${index} 个模块缺少 类型 字段。` }] };
    }
    if (!cachedValidModuleTypes.has((module as Record<string, unknown>).类型 as string)) {
      return { ok: false, issues: [{ level: "fatal", code: "CACHED_PACKAGE_INVALID_MODULE_TYPE", text: `缓存的 System Package 第 ${index} 个模块类型 ${(module as Record<string, unknown>).类型} 无效。` }] };
    }
  }
  return { ok: true, package: input as SystemPackage };
}
