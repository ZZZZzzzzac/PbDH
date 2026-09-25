import { createCardInstance } from "./cardEngine";
import { gridSize } from "./gridLayout";
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
  return entries.reduce((nextData, entry) => {
    const grid = targetTable.网格布局;
    if (grid?.大件记录模块ID && !gridSize(entry.fields[grid.尺寸字段])) {
      const id = grid.大件记录模块ID;
      const previous = nextData.character.values[id];
      const description = [entry.fields.名称, entry.fields.简介, entry.fields.内容2描述].filter(Boolean).join(" · ");
      return { ...nextData, character: { ...nextData.character, values: { ...nextData.character.values,
        [id]: [typeof previous === "string" ? previous : "", description].filter(Boolean).join("\n\n"),
      } } };
    }
    const instanceId = crypto.randomUUID();
    // 格子物资领取时即固定副本，后续资源更新不能改变已装包物品的尺寸。
    const entryId = targetTable.网格布局 ? `grid:${instanceId}` : entry.ID;
    const snapshot = targetTable.网格布局 ? { ...nextData, embeddedResourceEntries: {
      ...nextData.embeddedResourceEntries, [entryId]: { libraryId, entry: { ...structuredClone(entry), ID: entryId }, resourceCopy: structuredClone(entry.resourceCopy) },
    } } : nextData;
    return createCardInstance(snapshot, {
    instanceId,
    tableModuleId: cardCreation.卡牌桌面模块ID,
    libraryId,
    definitionId: entryId,
    state: cardCreation.默认状态 ?? targetTable.状态选项?.[0],
    });
  }, data);
}
