import { createCardInstance } from "./cardEngine";
import { updateResourceSelectionSnapshot, type CharacterData } from "./characterData";
import {
  applyDependencyResultToCharacterData,
  evaluateDependencies,
  hasRebuildableDependencies,
  rebuildDerivedDependencies,
  type DependencyEvaluationResult,
} from "./dependencyEngine";
import type { ResourceLibraryEntry } from "./resourceLibrary";
import { findCardTableResourceLibrarySource, type SystemPackage } from "./systemPackage";

export interface ResourceSelectionDraftResult {
  characterData: CharacterData;
  interactionResult: DependencyEvaluationResult;
  derivedResult: DependencyEvaluationResult;
  shouldPersist: boolean;
}

export function applyResourceSelectionToDraft(
  characterData: CharacterData,
  systemPackage: SystemPackage,
  moduleId: string,
  libraryId: string,
  entries: ResourceLibraryEntry[],
): ResourceSelectionDraftResult {
  const shouldPersistSelection = hasRebuildableDependencies(systemPackage, moduleId);
  const dataWithSnapshot = shouldPersistSelection
    ? updateResourceSelectionSnapshot(characterData, moduleId, libraryId, entries.map((entry) => entry.ID))
    : characterData;
  const interactionResult = evaluateDependencies(dataWithSnapshot, systemPackage, {
    type: "resourceSelected",
    sourceModuleId: moduleId,
    libraryId,
    selectedEntries: entries,
  });

  let nextData = applyDependencyResultToCharacterData(dataWithSnapshot, interactionResult);
  for (const instruction of interactionResult.cardCreationInstructions) {
    if (!instruction.libraryId) continue;
    nextData = createCardInstancesFromSelection(
      nextData,
      systemPackage,
      instruction.moduleId,
      instruction.libraryId,
      instruction.entries,
    );
  }
  const derivedResult = rebuildDerivedDependencies(nextData, systemPackage);
  return {
    characterData: nextData,
    interactionResult,
    derivedResult,
    shouldPersist: shouldPersistSelection
      || Object.keys(interactionResult.dataPatches).length > 0
      || interactionResult.cardCreationInstructions.length > 0,
  };
}

function createCardInstancesFromSelection(
  data: CharacterData,
  systemPackage: SystemPackage,
  moduleId: string,
  libraryId: string,
  entries: ResourceLibraryEntry[],
): CharacterData {
  const sourceModule = systemPackage.modules.find((module) => module.ID === moduleId);
  if (sourceModule?.类型 !== "resourcePicker" || !sourceModule.创建卡牌) return data;
  const cardCreation = sourceModule.创建卡牌;
  const targetTable = systemPackage.modules.find((module) => module.ID === cardCreation.卡牌桌面模块ID);
  if (targetTable?.类型 !== "cardTable" || !findCardTableResourceLibrarySource(systemPackage, targetTable, libraryId)) return data;
  return entries.reduce((nextData, entry) => createCardInstance(nextData, {
    instanceId: crypto.randomUUID(),
    tableModuleId: cardCreation.卡牌桌面模块ID,
    libraryId,
    definitionId: entry.ID,
    state: cardCreation.默认状态 ?? targetTable.状态选项?.[0],
  }), data);
}
