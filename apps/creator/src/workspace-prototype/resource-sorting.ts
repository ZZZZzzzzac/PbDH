import type { TemplateCoreCapability } from "@pbdh/templates/core";
import { getTemplateSortingFields, type TemplateSortField } from "@pbdh/templates/core/explorer-sorting";

import type { WorkspaceResource } from "./workspace-model.ts";

export type ResourceSortPreferences = {
  mode: "name" | "grouped";
  templates: Record<string, Record<string, "asc" | "desc">>;
};

export const defaultResourceSortPreferences: ResourceSortPreferences = {
  mode: "name",
  templates: {},
};

const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
const decimalPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const text = textValue(value);
  if (!text || !decimalPattern.test(text)) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

function compareValues(
  left: string | number | undefined,
  right: string | number | undefined,
  direction: "asc" | "desc",
  values?: readonly string[],
): number {
  // 缺失值的位置不随升降序翻转。
  if (left === undefined) return right === undefined ? 0 : 1;
  if (right === undefined) return -1;
  let result: number;
  if (typeof left === "number" && typeof right === "number") {
    result = left < right ? -1 : left > right ? 1 : 0;
  } else {
    const leftText = String(left);
    const rightText = String(right);
    const leftIndex = values?.indexOf(leftText) ?? -1;
    const rightIndex = values?.indexOf(rightText) ?? -1;
    // 自定义枚举文本仍可排序，排在已声明选项之后、缺失值之前。
    if (leftIndex >= 0 && rightIndex < 0) return -1;
    if (rightIndex >= 0 && leftIndex < 0) return 1;
    result = leftIndex >= 0 && rightIndex >= 0
      ? leftIndex - rightIndex
      : collator.compare(leftText, rightText);
  }
  return direction === "desc" ? -result : result;
}

function fieldValue(data: Record<string, unknown>, field: TemplateSortField) {
  return field.kind === "number" ? numberValue(data[field.key]) : textValue(data[field.key]);
}

// 同一模板组混合精确版本时，调用方须为整组固定同一个 core，不能按比较左值切换。
export function compareWorkspaceResources(
  left: WorkspaceResource,
  right: WorkspaceResource,
  core: TemplateCoreCapability<Record<string, unknown>>,
  preferences: ResourceSortPreferences,
): number {
  const leftData = left.data as Record<string, unknown>;
  const rightData = right.data as Record<string, unknown>;
  if (preferences.mode === "grouped") {
    const enabledFields = preferences.templates[core.id];
    for (const field of getTemplateSortingFields(core.id, core.version)) {
      const direction = enabledFields?.[field.key];
      if (direction !== "asc" && direction !== "desc") continue;
      const result = compareValues(
        fieldValue(leftData, field), fieldValue(rightData, field), direction,
        field.kind === "enum" ? field.values : undefined,
      );
      if (result) return result;
    }
  }
  const nameResult = compareValues(
    textValue(core.project(leftData).title), textValue(core.project(rightData).title), "asc",
  );
  return nameResult || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}
