import type { ResourceLibraryEntry } from "./resourceLibrary";
import { formatResourceTextTemplate, getResourceTextTemplateFields } from "./resourceTextTemplate";

export interface CardPresentation {
  名称模板?: string;
  描述模板?: string;
  标签字段?: string[];
}

export interface ResolvedCardPresentation {
  name: string;
  description: string;
  tags: string[];
  consumedFields: string[];
}

const defaultNameTemplate = "{{名称}}";
const defaultDescriptionTemplate = "{{描述}}";

export function resolveCardPresentation(
  entry: ResourceLibraryEntry | undefined,
  presentation?: CardPresentation,
  excludedFields: string[] = [],
): ResolvedCardPresentation {
  if (!entry) {
    return { name: "", description: "Card Definition 不存在。", tags: [], consumedFields: [] };
  }

  const nameTemplate = presentation?.名称模板 ?? defaultNameTemplate;
  const descriptionTemplate = presentation?.描述模板 ?? defaultDescriptionTemplate;
  const consumedFields = [...new Set([
    ...getResourceTextTemplateFields(nameTemplate),
    ...getResourceTextTemplateFields(descriptionTemplate),
  ])];
  const excluded = new Set(["ID", ...excludedFields, ...consumedFields]);
  const tagFields = presentation?.标签字段
    ?? Object.keys(entry.fields).filter((field) => !excluded.has(field));

  return {
    name: formatResourceTextTemplate(nameTemplate, entry.fields),
    description: formatResourceTextTemplate(descriptionTemplate, entry.fields),
    tags: tagFields.map((field) => entry.fields[field] ?? "").filter(Boolean),
    consumedFields,
  };
}

export function getCardPresentationFields(presentation?: CardPresentation): string[] {
  return [...new Set([
    ...getResourceTextTemplateFields(presentation?.名称模板 ?? defaultNameTemplate),
    ...getResourceTextTemplateFields(presentation?.描述模板 ?? defaultDescriptionTemplate),
    ...(presentation?.标签字段 ?? []),
  ])];
}
