import type { TabletopResourceCopy } from "@pbdh/contract-runtime";
import type { ResourceLibraryEntry, ResourceLibrary } from "./resourceLibrary";
import type { ResourceComposerModule } from "./systemPackage";

export interface CompositeResource extends ResourceLibraryEntry {
  composerModuleId: string;
}

export type ResourceComposerSelections = Record<string, ResourceLibraryEntry>;

export function materializeImportedComposite(
  module: ResourceComposerModule,
  fields: Record<string, string>,
  libraries: ResourceLibrary[],
): CompositeResource {
  const composite: CompositeResource = { ID: fields.ID!, composerModuleId: module.ID, fields };
  const entries = libraries.find((library) => library.ID === module.来源槽位[0]?.资源库ID)?.entries ?? [];
  const base = entries.find((entry) => entry.resourceCopy?.template.id === "种族")?.resourceCopy;
  if (!base || !("特性A" in fields) || !("特性B" in fields)) return composite;
  const names = [fields.种族A名称 ?? "", fields.种族B名称 ?? ""];
  if (names[0] && names[0] === names[1]) {
    const matches = entries.filter((entry) => entry.fields.名称 === names[0] && entry.resourceCopy?.template.id === "种族");
    if (matches.length === 1) {
      composite.resourceCopy = structuredClone(matches[0]!.resourceCopy!);
      if (module.选择关系输出) composite.fields[module.选择关系输出.字段] = module.选择关系输出.全部相同时;
      return composite;
    }
  }
  const originals: string[] = [];
  const features = ["A", "B"].map((slot, index) => {
    const matches = entries.filter((entry) => entry.fields.名称 === names[index]);
    const source = matches.length === 1 ? matches[0]?.resourceCopy : undefined;
    originals.push(text(source?.data.原文));
    const feature = Array.isArray(source?.data.特性) ? source.data.特性[index] : undefined;
    const value = fields[`特性${slot}`] ?? "";
    const separator = value.search(/[：:]/u);
    return {
      特性名称: separator < 0 ? value : value.slice(0, separator),
      特性原文: isRecord(feature) ? text(feature.特性原文) : "",
      特性描述: separator < 0 ? "" : value.slice(separator + 1),
    };
  });
  composite.resourceCopy = {
    source: null,
    template: structuredClone(base.template),
    presentation: { ...structuredClone(base.presentation), mode: "text" },
    data: { 名称: names.filter(Boolean).join(" / "), 原文: originals.filter(Boolean).join(" / "), 类型: "种族", 简介: "", 特性: features },
    labels: [], replacements: [], media: {},
  };
  return composite;
}

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
      mode: "text",
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
