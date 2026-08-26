import { createCardInstance } from "../domain/cardEngine";
import {
  type CharacterData,
  type PlayerImageData,
  createEmptyCharacterData,
  migrateCharacterResourceReferences,
} from "../domain/characterData";
import { type DependencyEvaluationResult } from "../domain/dependencyEngine";
import type { ResourceLibraryEntry, ResourceLibraryQuery } from "../domain/resourceLibrary";
import type { CompositeResource } from "../domain/resourceComposer";
import { findCardTableResourceLibrarySource, type SystemPackage } from "../domain/systemPackage";
import type { CharacterSaveSummary, RuntimeStorage } from "../storage/runtimeStorage";

export interface DependencyMergeState {
  derivedReadOnlyDisplayContent: Record<string, string>;
  derivedTextPlaceholders: Record<string, string>;
  moduleVisibility: Record<string, boolean>;
  pageVisibility: Record<string, boolean>;
  resourcePickerDefaultQueries: Record<string, ResourceLibraryQuery>;
}

export function warnDependencyIssues(result: DependencyEvaluationResult) {
  for (const warning of result.warnings) {
    console.warn(warning);
  }
}

export function ensureCardState(data: CharacterData | null, systemPackage?: SystemPackage): CharacterData | null {
  if (!data) {
    return null;
  }

  const normalized = {
    ...data,
    cards: {
      instances: (data.cards?.instances ?? []).map((instance) => {
        const legacy = instance as typeof instance & { libraryId?: string; definitionId?: string };
        if (instance.definitionRef || !legacy.libraryId || !legacy.definitionId) return instance;
        const { libraryId, definitionId, ...current } = legacy;
        return { ...current, definitionRef: { type: "resourceLibrary" as const, libraryId, entryId: definitionId } };
      }),
    },
    compositeResources: data.compositeResources ?? {},
    resourceSelections: data.resourceSelections ?? {},
  };
  return systemPackage ? migrateCharacterResourceReferences(normalized, systemPackage) : normalized;
}

export function dependencyRuntimeStateFromResult(result: DependencyEvaluationResult): DependencyMergeState {
  return {
    derivedReadOnlyDisplayContent: result.readOnlyDisplayContent,
    derivedTextPlaceholders: result.textPlaceholders,
    moduleVisibility: result.moduleVisibility,
    pageVisibility: result.pageVisibility,
    resourcePickerDefaultQueries: result.resourcePickerDefaultQueries,
  };
}

export async function loadActiveCharacterForPackage(
  systemPackage: SystemPackage,
  storage: RuntimeStorage,
): Promise<{
  characterData: CharacterData;
  characterSaves: CharacterSaveSummary[];
  activeCharacterSaveId: string;
}> {
  const packageId = systemPackage.manifest.ID;
  let characterSaves = await storage.listCharacterSaves(packageId);
  let activeCharacterSaveId = await storage.loadActiveCharacterSaveId(packageId);

  if (!activeCharacterSaveId || !characterSaves.some((save) => save.id === activeCharacterSaveId)) {
    activeCharacterSaveId = characterSaves[0]?.id ?? null;
  }

  if (activeCharacterSaveId) {
    const saved = ensureCardState(await storage.loadCharacterSave(packageId, activeCharacterSaveId), systemPackage);
    if (saved) {
      await storage.setActiveCharacterSaveId(packageId, activeCharacterSaveId);
      return {
        characterData: saved,
        characterSaves,
        activeCharacterSaveId,
      };
    }
  }

  const characterData = createEmptyCharacterData(systemPackage);
  await storage.saveCharacterSave({
    id: characterData.character.id,
    packageId,
    name: "未命名角色",
    updatedAt: characterData.updatedAt,
    data: characterData,
  });
  await storage.setActiveCharacterSaveId(packageId, characterData.character.id);
  characterSaves = await storage.listCharacterSaves(packageId);
  return {
    characterData,
    characterSaves,
    activeCharacterSaveId: characterData.character.id,
  };
}

export function createCardInstancesFromSelection(
  data: CharacterData,
  systemPackage: SystemPackage,
  moduleId: string,
  libraryId: string,
  entries: ResourceLibraryEntry[],
): CharacterData {
  const sourceModule = systemPackage.modules.find((module) => module.ID === moduleId);
  if (sourceModule?.类型 !== "resourcePicker" || !sourceModule.创建卡牌) {
    return data;
  }
  const cardCreation = sourceModule.创建卡牌;
  const targetTable = systemPackage.modules.find((module) => module.ID === cardCreation.卡牌桌面模块ID);
  if (targetTable?.类型 !== "cardTable" || !findCardTableResourceLibrarySource(systemPackage, targetTable, libraryId)) {
    return data;
  }

  return entries.reduce(
    (nextData, entry) =>
      createCardInstance(nextData, {
        instanceId: crypto.randomUUID(),
        tableModuleId: cardCreation.卡牌桌面模块ID,
        libraryId,
        definitionId: entry.ID,
        state: cardCreation.默认状态 ?? targetTable.状态选项?.[0],
      }),
    data,
  );
}

export function queueNewCardInstancePlacements(
  pending: Record<string, string[]>,
  previousData: CharacterData,
  nextData: CharacterData,
): Record<string, string[]> {
  const previousIds = new Set(previousData.cards.instances.map((instance) => instance.instanceId));
  const additions = nextData.cards.instances.filter((instance) => !previousIds.has(instance.instanceId));
  if (additions.length === 0) return pending;

  const nextPending = { ...pending };
  for (const instance of additions) {
    nextPending[instance.tableModuleId] = [
      ...(nextPending[instance.tableModuleId] ?? []),
      instance.instanceId,
    ];
  }
  return nextPending;
}

export function hasCardCreationTarget(systemPackage: SystemPackage, moduleId: string): boolean {
  const sourceModule = systemPackage.modules.find((module) => module.ID === moduleId);
  return (sourceModule?.类型 === "resourcePicker" || sourceModule?.类型 === "resourceComposer") && Boolean(sourceModule.创建卡牌);
}

export function createCardInstanceFromComposite(
  data: CharacterData,
  systemPackage: SystemPackage,
  moduleId: string,
  composite: CompositeResource,
): CharacterData {
  const sourceModule = systemPackage.modules.find((module) => module.ID === moduleId);
  if (sourceModule?.类型 !== "resourceComposer" || !sourceModule.创建卡牌) return data;
  const targetTable = systemPackage.modules.find((module) => module.ID === sourceModule.创建卡牌?.卡牌桌面模块ID);
  if (targetTable?.类型 !== "cardTable" || !targetTable.资源来源.some((source) => source.类型 === "resourceComposer" && source.ID === moduleId)) return data;
  const reference = { type: "compositeResource" as const, compositeResourceId: composite.ID };
  const exists = data.cards.instances.some((instance) => instance.tableModuleId === targetTable.ID
    && instance.definitionRef.type === "compositeResource"
    && instance.definitionRef.compositeResourceId === composite.ID);
  if (exists) return data;
  return createCardInstance(data, {
    instanceId: crypto.randomUUID(),
    tableModuleId: targetTable.ID,
    definitionRef: reference,
    state: sourceModule.创建卡牌.默认状态 ?? targetTable.状态选项?.[0],
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
