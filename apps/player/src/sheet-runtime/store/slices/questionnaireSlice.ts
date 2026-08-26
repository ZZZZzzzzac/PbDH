import { rebuildDerivedDependencies } from "../../domain/dependencyEngine";
import { resolveQuestionnaireResult } from "../../domain/questionnaire";
import { applyResourceSelectionToDraft } from "../../domain/resourceSelection";
import { dependencyRuntimeStateFromResult, queueNewCardInstancePlacements, warnDependencyIssues } from "../runtimeHelpers";
import type { RuntimeEnvironment } from "../runtimeEnvironment";
import type { QuestionnaireSlice, RuntimeSlice } from "../runtimeTypes";
import { saveCharacterDataImmediately } from "../workflows/autosave";

export function createQuestionnaireSlice(
  environment: RuntimeEnvironment,
): RuntimeSlice<QuestionnaireSlice> {
  return (set, get) => ({
    pendingQuestionnaireResult: null,

    prepareQuestionnaireResult(questionnaireId, input) {
      const currentPackage = get().currentPackage;
      const characterData = get().characterData;
      const questionnaire = currentPackage?.questionnaireCharacterCreation;
      if (!currentPackage || !characterData || !questionnaire || questionnaire.ID !== questionnaireId) {
        set({
          importError: "问卷结果不属于当前 System Package。",
          importNotice: null,
          pendingQuestionnaireResult: null,
        });
        return;
      }
      const resolved = resolveQuestionnaireResult(input, currentPackage);
      if (!resolved.ok) {
        set({ importError: resolved.error, importNotice: null, pendingQuestionnaireResult: null });
        return;
      }

      let draft = characterData;
      for (const selection of resolved.selections) {
        const applied = applyResourceSelectionToDraft(
          draft,
          currentPackage,
          selection.sourceModuleId,
          selection.libraryId,
          selection.entries,
        );
        warnDependencyIssues(applied.interactionResult);
        warnDependencyIssues(applied.derivedResult);
        draft = applied.characterData;
      }

      set({
        pendingQuestionnaireResult: {
          questionnaireId,
          questionnaireName: questionnaire.名称,
          packageId: currentPackage.manifest.ID,
          characterId: characterData.character.id,
          baseUpdatedAt: characterData.updatedAt,
          selections: resolved.selections.map((selection) => {
            const module = currentPackage.modules
              .find((candidate) => candidate.ID === selection.sourceModuleId);
            const library = currentPackage.resourceLibraries
              ?.find((candidate) => candidate.ID === selection.libraryId);
            return {
              sourceModuleId: selection.sourceModuleId,
              pickerLabel: module?.类型 === "resourcePicker" ? module.按钮文本 : selection.sourceModuleId,
              libraryId: selection.libraryId,
              libraryName: library?.名称 ?? selection.libraryId,
              entries: selection.entries.map((entry) => ({
                id: entry.ID,
                name: entry.fields.名称 || entry.ID,
              })),
            };
          }),
          missingResources: resolved.missingResources.map((missing) => {
            const module = currentPackage.modules
              .find((candidate) => candidate.ID === missing.sourceModuleId);
            const library = currentPackage.resourceLibraries
              ?.find((candidate) => candidate.ID === missing.libraryId);
            return {
              sourceModuleId: missing.sourceModuleId,
              pickerLabel: module?.类型 === "resourcePicker" ? module.按钮文本 : missing.sourceModuleId,
              libraryId: missing.libraryId,
              libraryName: library?.名称 ?? missing.libraryId,
              entryId: missing.entryId,
            };
          }),
          nextCharacterData: draft,
        },
        importError: null,
        importNotice: null,
      });
    },

    confirmQuestionnaireResult() {
      const pending = get().pendingQuestionnaireResult;
      const currentPackage = get().currentPackage;
      const characterData = get().characterData;
      if (!pending || !currentPackage || !characterData) return;
      if (pending.selections.length === 0) {
        set({
          pendingQuestionnaireResult: null,
          importError: "问卷推荐的资源当前均不可用；请安装所需 Resource Extension 后重新运行问卷。",
          importNotice: null,
        });
        return;
      }
      if (pending.packageId !== currentPackage.manifest.ID
        || pending.characterId !== characterData.character.id
        || pending.baseUpdatedAt !== characterData.updatedAt) {
        set({
          pendingQuestionnaireResult: null,
          importError: "问卷结果已过期：System Package 或 Character Save 已发生变化，请重新运行问卷。",
          importNotice: null,
        });
        return;
      }
      const derivedResult = rebuildDerivedDependencies(pending.nextCharacterData, currentPackage);
      warnDependencyIssues(derivedResult);
      set({
        characterData: pending.nextCharacterData,
        pendingCardTablePlacements: queueNewCardInstancePlacements(
          get().pendingCardTablePlacements,
          characterData,
          pending.nextCharacterData,
        ),
        ...dependencyRuntimeStateFromResult(derivedResult),
        pendingQuestionnaireResult: null,
        importError: null,
        importNotice: `${pending.questionnaireName}的 Resource Picker 选择已应用。`,
      });
      saveCharacterDataImmediately(
        environment,
        pending.nextCharacterData,
        get().activeCharacterSaveId,
        get().characterSaves,
        (storageStatus) => set({ storageStatus }),
      );
    },

    cancelQuestionnaireResult() {
      set({ pendingQuestionnaireResult: null, importNotice: "已取消问卷结果；当前 Character Save 未改变。" });
    },
  });
}
