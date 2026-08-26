import type { ResourceLibrary } from "../resourceLibrary";
import type {
  DependencyCondition,
  PackageIssue,
  SheetModule,
  SystemPackage,
} from "./contract";
import { findResourceLibrary, getResourcePickerLinks } from "./htmlTemplate";

export function collectDuplicateIdIssues<T extends { ID: string }>(
  values: T[],
  entityName: string,
  code: string,
  pathPrefix: string,
  issues: PackageIssue[],
): void {
  const firstIndexById = new Map<string, number>();
  values.forEach((value, index) => {
    const firstIndex = firstIndexById.get(value.ID);
    if (firstIndex !== undefined) {
      issues.push({
        level: "error",
        code,
        text: `${entityName} ID 重复：${value.ID}（首次声明于索引 ${firstIndex}）`,
        path: `${pathPrefix}.${index}.ID`,
        evidence: [
          { label: "duplicateId", value: value.ID },
          { label: "firstIndex", value: firstIndex },
          { label: "duplicateIndex", value: index },
        ],
      });
      return;
    }
    firstIndexById.set(value.ID, index);
  });
}

export function validateSelectedResourceField(
  systemPackage: SystemPackage,
  sourceModule: SheetModule | undefined,
  field: string,
  path: string,
  dependencyId: string,
  issues: PackageIssue[],
): void {
  if (sourceModule?.类型 === "resourcePicker") {
    for (const link of getResourcePickerLinks(sourceModule)) {
      validateResourceLibraryField(
        findResourceLibrary(systemPackage, link.ID),
        field,
        path,
        dependencyId,
        sourceModule.ID,
        issues,
      );
    }
    return;
  }

  if (sourceModule?.类型 === "resourceComposer" && field !== "ID"
    && !sourceModule.输出字段.some((mapping) => mapping.字段 === field)
    && sourceModule.选择关系输出?.字段 !== field) {
    issues.push({
      level: "error",
      code: "MISSING_RESOURCE_FIELD_REFERENCE",
      text: `Dependency Rule ${dependencyId} 引用了 Resource Composer ${sourceModule.ID} 中不存在的输出字段 ${field}`,
      path,
      evidence: [{ label: "referencedField", value: field }, {
        label: "knownFields",
        value: [
          ...sourceModule.输出字段.map((mapping) => mapping.字段),
          ...(sourceModule.选择关系输出 ? [sourceModule.选择关系输出.字段] : []),
        ],
      }],
    });
  }
}

export function validateResourceLibraryField(
  library: ResourceLibrary | undefined,
  field: string,
  path: string,
  dependencyId: string,
  moduleId: string,
  issues: PackageIssue[],
): void {
  if (!library || library.fields.some((candidate) => candidate.key === field)) return;
  const knownFields = library.fields.map((candidate) => candidate.key);
  issues.push({
    level: "error",
    code: "MISSING_RESOURCE_FIELD_REFERENCE",
    text: `Dependency Rule ${dependencyId} 的模块 ${moduleId} 引用了 Resource Library ${library.ID} 中不存在的字段 ${field}；已知字段：${knownFields.join("、")}`,
    path,
    evidence: [{ label: "referencedField", value: field }, { label: "knownFields", value: knownFields }],
  });
}

export function isResourceCondition(
  condition: DependencyCondition | undefined,
): condition is Extract<DependencyCondition, {
  类型: "selectedResourceFieldEquals" | "selectedResourceFieldIn" | "selectedResourceFieldNotEquals";
}> {
  return condition?.类型 === "selectedResourceFieldEquals"
    || condition?.类型 === "selectedResourceFieldIn"
    || condition?.类型 === "selectedResourceFieldNotEquals";
}

export function isCheckboxCondition(
  condition: DependencyCondition | undefined,
): condition is Extract<DependencyCondition, {
  类型: "checkboxOptionChecked" | "checkboxOptionUnchecked";
}> {
  return condition?.类型 === "checkboxOptionChecked" || condition?.类型 === "checkboxOptionUnchecked";
}
