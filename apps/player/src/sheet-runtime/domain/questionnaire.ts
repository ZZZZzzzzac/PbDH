import type { ResourceLibraryEntry } from "./resourceLibrary";
import { findResourceLibraryEntry } from "./resourceLibrary";
import { questionnaireResultSchema, type QuestionnaireResult } from "./questionnaireContract";
export * from "./questionnaireContract";
import {
  findModule,
  findResourceLibrary,
  getOtherResourceLibraries,
  getResourcePickerLinks,
  type SystemPackage,
} from "./systemPackage";

export interface ResolvedQuestionnaireSelection {
  sourceModuleId: string;
  libraryId: string;
  entries: ResourceLibraryEntry[];
}

export interface MissingQuestionnaireResource {
  sourceModuleId: string;
  libraryId: string;
  entryId: string;
}

export type QuestionnaireResultResolution =
  | {
    ok: true;
    result: QuestionnaireResult;
    selections: ResolvedQuestionnaireSelection[];
    missingResources: MissingQuestionnaireResource[];
  }
  | { ok: false; error: string };

export const questionnaireResultMaxBytes = 64 * 1024;

export function resolveQuestionnaireResult(input: unknown, systemPackage: SystemPackage): QuestionnaireResultResolution {
  let serialized: string;
  try {
    serialized = JSON.stringify(input);
  } catch {
    return { ok: false, error: "问卷结果无法序列化。" };
  }
  if (new TextEncoder().encode(serialized).byteLength > questionnaireResultMaxBytes) {
    return { ok: false, error: "问卷结果超过 64 KiB 限制。" };
  }

  const parsed = questionnaireResultSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: `问卷结果格式无效：${parsed.error.issues[0]?.message ?? "未知错误"}` };
  }

  const selections: ResolvedQuestionnaireSelection[] = [];
  const missingResources: MissingQuestionnaireResource[] = [];
  for (const interaction of parsed.data.interactions) {
    const module = findModule(systemPackage, interaction.sourceModuleId);
    if (module?.类型 !== "resourcePicker") {
      return { ok: false, error: `问卷引用的 Resource Picker 不存在：${interaction.sourceModuleId}` };
    }
    if (!module.多选 && interaction.entryIds.length !== 1) {
      return { ok: false, error: `Resource Picker ${module.ID} 只允许单选。` };
    }

    const linkedLibraryIds = module.资源库 === "其他"
      ? getOtherResourceLibraries(systemPackage).map((library) => library.ID)
      : getResourcePickerLinks(module).map((link) => link.ID);
    if (!linkedLibraryIds.includes(interaction.libraryId)) {
      return { ok: false, error: `Resource Picker ${module.ID} 未链接 Resource Library ${interaction.libraryId}。` };
    }

    const library = findResourceLibrary(systemPackage, interaction.libraryId);
    if (!library) {
      return { ok: false, error: `Resource Library 不存在：${interaction.libraryId}` };
    }
    const entries: ResourceLibraryEntry[] = [];
    for (const entryId of interaction.entryIds) {
      const entry = findResourceLibraryEntry(library, entryId);
      if (!entry) {
        missingResources.push({
          sourceModuleId: module.ID,
          libraryId: library.ID,
          entryId,
        });
        continue;
      }
      entries.push(entry);
    }
    if (entries.length > 0) selections.push({ sourceModuleId: module.ID, libraryId: library.ID, entries });
  }

  return { ok: true, result: parsed.data, selections, missingResources };
}
