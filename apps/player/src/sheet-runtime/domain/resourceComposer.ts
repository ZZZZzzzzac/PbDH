import type { TabletopResourceCopy } from "@pbdh/contract-runtime";
import type { ResourceLibraryEntry } from "./resourceLibrary";
import type { ResourceComposerModule } from "./systemPackage";

export interface CompositeResource extends ResourceLibraryEntry {
  composerModuleId: string;
}

export type ResourceComposerSelections = Record<string, ResourceLibraryEntry>;

export function composeResource(module: ResourceComposerModule, selections: ResourceComposerSelections): CompositeResource | null {
  if (module.来源槽位.some((slot) => !selections[slot.ID])) return null;
  const ID = `composite:${module.ID}`;
  const fields: Record<string, string> = { ID };
  const selectedEntries = module.来源槽位.map((slot) => selections[slot.ID]!);
  const allSame = selectedEntries.every((entry) => entry.ID === selectedEntries[0]?.ID);
  for (const mapping of module.输出字段) {
    fields[mapping.字段] = selections[mapping.来源槽位ID]?.fields[mapping.来源字段] ?? "";
  }
  if (module.选择关系输出) {
    const inheritedValue = allSame && module.选择关系输出.全部相同时来源字段
      ? selections[module.来源槽位[0].ID].fields[module.选择关系输出.全部相同时来源字段]?.trim()
      : "";
    fields[module.选择关系输出.字段] = allSame
      ? inheritedValue || module.选择关系输出.全部相同时
      : module.选择关系输出.不全相同时;
  }
  const resourceCopy = composeCanonicalResourceCopy(selectedEntries, fields, allSame);
  return {
    ID,
    composerModuleId: module.ID,
    fields,
    ...(resourceCopy ? { resourceCopy } : {}),
  };
}

function composeCanonicalResourceCopy(
  entries: ResourceLibraryEntry[],
  fields: Record<string, string>,
  allSame: boolean,
): TabletopResourceCopy | undefined {
  const first = entries[0]?.resourceCopy;
  if (!first) return undefined;
  if (allSame) return structuredClone(first);
  if (first.template.id !== "种族" || entries.some((entry) =>
    entry.resourceCopy?.template.id !== first.template.id
    || entry.resourceCopy.template.version !== first.template.version)) return undefined;

  const features = entries.flatMap((entry, index) => {
    const sourceFeatures = Array.isArray(entry.resourceCopy?.data.特性)
      ? entry.resourceCopy.data.特性
      : [];
    const feature = sourceFeatures[index];
    return isRecord(feature) ? [structuredClone(feature)] : [];
  });
  const names = entries.map((entry) => text(entry.resourceCopy?.data.名称 || entry.fields.名称)).filter(Boolean);
  const originalNames = entries.map((entry) => text(entry.resourceCopy?.data.原文)).filter(Boolean);
  return {
    source: null,
    template: structuredClone(first.template),
    presentation: {
      ...structuredClone(first.presentation),
      mode: fields.卡牌显示方式 === "image" || fields.卡牌显示方式 === "split"
        ? fields.卡牌显示方式
        : "text",
    },
    data: {
      名称: names.join(" / "),
      ...(originalNames.length > 0 ? { 原文: originalNames.join(" / ") } : {}),
      类型: text(first.data.类型) || "种族",
      简介: "",
      特性: features,
    },
    labels: [...new Set(entries.flatMap((entry) => entry.resourceCopy?.labels ?? []))],
    media: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
