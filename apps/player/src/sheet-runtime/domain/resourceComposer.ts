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
  for (const mapping of module.输出字段) {
    fields[mapping.字段] = selections[mapping.来源槽位ID]?.fields[mapping.来源字段] ?? "";
  }
  if (module.选择关系输出) {
    const selectedIds = module.来源槽位.map((slot) => selections[slot.ID].ID);
    const allSame = selectedIds.every((entryId) => entryId === selectedIds[0]);
    const inheritedValue = allSame && module.选择关系输出.全部相同时来源字段
      ? selections[module.来源槽位[0].ID].fields[module.选择关系输出.全部相同时来源字段]?.trim()
      : "";
    fields[module.选择关系输出.字段] = allSame
      ? inheritedValue || module.选择关系输出.全部相同时
      : module.选择关系输出.不全相同时;
  }
  return { ID, composerModuleId: module.ID, fields };
}
