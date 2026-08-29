import {
  createEmptyCharacterData,
  updateCharacterValue,
  updatePlayerImage,
  removePlayerImage as removePlayerImageData,
  type CharacterData,
  type PlayerImageData,
} from "../../domain/characterData";
import { createBrowserImageAdmission, playerAvatarPolicy } from "@pbdh/media-admission";
import { applyDependencyResultToCharacterData, evaluateDependencies, rebuildDerivedDependencies } from "../../domain/dependencyEngine";
import { composeResource } from "../../domain/resourceComposer";
import { applyResourceSelectionToDraft } from "../../domain/resourceSelection";
import {
  createCardInstanceFromComposite,
  dependencyRuntimeStateFromResult,
  ensureCardState,
  fileToDataUrl,
  queueNewCardInstancePlacements,
  warnDependencyIssues,
} from "../runtimeHelpers";
import type { RuntimeEnvironment } from "../runtimeEnvironment";
import {
  collectStaleResourceReferenceIssues,
  emptyDerivedState,
  isCountableStateValue,
  isPlayerImageValue,
  rebuildDependencyRuntimeState,
} from "../runtimeStateHelpers";
import type { CharacterSlice, RuntimeSlice } from "../runtimeTypes";
import { flushPendingAutosave, saveCharacterDataImmediately, scheduleAutosave } from "../workflows/autosave";

export function createCharacterSlice(environment: RuntimeEnvironment): RuntimeSlice<CharacterSlice> {
  return (set, get) => ({
    characterData: null,
    characterSaves: [],
    allCharacterSaves: [],
    activeCharacterSaveId: null,
    pendingCharacterDataMigration: null,
    derivedReadOnlyDisplayContent: {},
    derivedTextPlaceholders: {},
    moduleVisibility: {},
    pageVisibility: {},
    resourcePickerDefaultQueries: {},

    async createCharacterSave(name = "未命名角色") {
      const currentPackage = get().currentPackage;
      if (!currentPackage) return;
      const characterData = createEmptyCharacterData(currentPackage);
      await environment.dependencies.storage.saveCharacterSave({
        id: characterData.character.id,
        packageId: characterData.systemPackage.id,
        name,
        updatedAt: characterData.updatedAt,
        data: characterData,
      });
      await environment.dependencies.storage
        .setActiveCharacterSaveId(characterData.systemPackage.id, characterData.character.id);
      set({
        characterData,
        characterSaves: await environment.dependencies.storage
          .listCharacterSaves(characterData.systemPackage.id),
        allCharacterSaves: await environment.dependencies.storage.listAllCharacterSaves(),
        activeCharacterSaveId: characterData.character.id,
        ...emptyDerivedState(),
        ...rebuildDependencyRuntimeState(characterData, currentPackage),
        importError: null,
        importNotice: null,
        validationIssues: [],
        validationStatus: "idle",
        resourceReferenceIssues: [],
        pendingQuestionnaireResult: null,
      });
    },

    async switchCharacterSave(saveId) {
      const currentPackage = get().currentPackage;
      if (!currentPackage || saveId === get().activeCharacterSaveId) return;
      try {
        await flushPendingAutosave(
          environment,
          get().characterData,
          get().activeCharacterSaveId,
          get().characterSaves,
        );
      } catch (error) {
        console.error("flushPendingAutosave failed before switchCharacterSave", error);
        set({ storageStatus: "error" });
      }

      const preparation = await environment.dependencies.storage.prepareCharacterSaveMigration(currentPackage.manifest.ID, saveId);
      if (preparation.status === "error") {
        set({ storageStatus: "error", importError: preparation.message });
        return;
      }
      if (preparation.status === "ready") {
        set({ pendingCharacterDataMigration: preparation.candidate, importError: null, importNotice: null });
        return;
      }
      const characterData = await environment.dependencies.storage
        .loadCharacterSave(currentPackage.manifest.ID, saveId);
      if (!characterData) {
        set({ storageStatus: "error" });
        return;
      }
      await environment.dependencies.storage.setActiveCharacterSaveId(currentPackage.manifest.ID, saveId);
      const normalizedData = ensureCardState(characterData, currentPackage)!;
      set({
        characterData: normalizedData,
        activeCharacterSaveId: saveId,
        ...emptyDerivedState(),
        ...rebuildDependencyRuntimeState(normalizedData, currentPackage),
        importError: null,
        importNotice: null,
        storageStatus: "idle",
        resourceReferenceIssues: get().resourceCatalog
          ? collectStaleResourceReferenceIssues(normalizedData, get().resourceCatalog!)
          : [],
        pendingQuestionnaireResult: null,
        pendingCharacterDataMigration: null,
      });
    },

    async confirmCharacterDataMigration() {
      const pending = get().pendingCharacterDataMigration;
      const currentPackage = get().currentPackage;
      if (!pending || !currentPackage) return;
      try {
        const characterData = await environment.dependencies.storage.commitCharacterSaveMigration(
          currentPackage.manifest.ID,
          pending,
        );
        await environment.dependencies.storage.setActiveCharacterSaveId(currentPackage.manifest.ID, pending.saveId);
        const normalizedData = ensureCardState(characterData, currentPackage)!;
        set({
          characterData: normalizedData,
          activeCharacterSaveId: pending.saveId,
          characterSaves: await environment.dependencies.storage.listCharacterSaves(currentPackage.manifest.ID),
          allCharacterSaves: await environment.dependencies.storage.listAllCharacterSaves(),
          pendingCharacterDataMigration: null,
          ...emptyDerivedState(),
          ...rebuildDependencyRuntimeState(normalizedData, currentPackage),
          storageStatus: "saved",
          importError: null,
          importNotice: `人物存档已从 ${pending.fromVersion} 升级到 ${pending.toVersion}。`,
        });
      } catch (error) {
        set({ storageStatus: "error", importError: error instanceof Error ? error.message : String(error) });
      }
    },

    cancelCharacterDataMigration() {
      set({ pendingCharacterDataMigration: null });
    },

    async renameCharacterSave(saveId, name) {
      const currentPackage = get().currentPackage;
      if (!currentPackage || !name.trim()) return;
      await environment.dependencies.storage
        .renameCharacterSave(currentPackage.manifest.ID, saveId, name.trim());
      set({
        characterSaves: await environment.dependencies.storage
          .listCharacterSaves(currentPackage.manifest.ID),
        allCharacterSaves: await environment.dependencies.storage.listAllCharacterSaves(),
        importError: null,
        importNotice: null,
      });
    },

    async duplicateCharacterSave(saveId, name) {
      const currentPackage = get().currentPackage;
      const source = currentPackage
        ? await environment.dependencies.storage.loadCharacterSave(currentPackage.manifest.ID, saveId)
        : null;
      if (!currentPackage || !source) return;
      const now = new Date().toISOString();
      const duplicateId = crypto.randomUUID();
      const sourceSummary = get().characterSaves.find((save) => save.id === saveId);
      const data: CharacterData = {
        ...source,
        character: { ...source.character, id: duplicateId },
        updatedAt: now,
      };
      await environment.dependencies.storage.saveCharacterSave({
        id: duplicateId,
        packageId: currentPackage.manifest.ID,
        name: name?.trim() || `${sourceSummary?.name ?? "未命名角色"} 副本`,
        updatedAt: now,
        data,
      });
      await environment.dependencies.storage
        .setActiveCharacterSaveId(currentPackage.manifest.ID, duplicateId);
      set({
        characterData: data,
        activeCharacterSaveId: duplicateId,
        ...emptyDerivedState(),
        ...rebuildDependencyRuntimeState(data, currentPackage),
        characterSaves: await environment.dependencies.storage
          .listCharacterSaves(currentPackage.manifest.ID),
        allCharacterSaves: await environment.dependencies.storage.listAllCharacterSaves(),
        validationIssues: [],
        validationStatus: "idle",
        importError: null,
        importNotice: null,
        pendingQuestionnaireResult: null,
      });
    },

    async deleteCharacterSave(saveId) {
      const currentPackage = get().currentPackage;
      if (!currentPackage) return;
      await environment.dependencies.storage.deleteCharacterSave(currentPackage.manifest.ID, saveId);
      const remaining = await environment.dependencies.storage
        .listCharacterSaves(currentPackage.manifest.ID);
      const allCharacterSaves = await environment.dependencies.storage.listAllCharacterSaves();
      const nextSave = remaining[0];
      if (!nextSave) {
        await get().createCharacterSave();
        return;
      }
      const nextData = await environment.dependencies.storage
        .loadCharacterSave(currentPackage.manifest.ID, nextSave.id);
      await environment.dependencies.storage
        .setActiveCharacterSaveId(currentPackage.manifest.ID, nextSave.id);
      const normalizedData = ensureCardState(nextData)!;
      set({
        characterData: normalizedData,
        characterSaves: remaining,
        allCharacterSaves,
        activeCharacterSaveId: nextSave.id,
        ...emptyDerivedState(),
        ...rebuildDependencyRuntimeState(normalizedData, currentPackage),
        validationIssues: [],
        validationStatus: "idle",
        importError: null,
        importNotice: null,
        pendingQuestionnaireResult: null,
      });
    },

    updateModuleValue(moduleId, value) {
      const characterData = get().characterData;
      const currentPackage = get().currentPackage;
      if (!characterData) return;
      const dataWithValue = updateCharacterValue(characterData, moduleId, value);
      const module = currentPackage?.modules.find((candidate) => candidate.ID === moduleId);
      if (currentPackage && module?.类型 === "countableResource" && isCountableStateValue(value)) {
        const result = evaluateDependencies(dataWithValue, currentPackage, {
          type: "countableChanged",
          sourceModuleId: moduleId,
          countableState: value,
        });
        warnDependencyIssues(result);
        const nextData = applyDependencyResultToCharacterData(dataWithValue, result);
        const derivedResult = rebuildDerivedDependencies(nextData, currentPackage);
        warnDependencyIssues(derivedResult);
        set({
          characterData: nextData,
          ...dependencyRuntimeStateFromResult(derivedResult),
          importError: null,
          importNotice: null,
        });
      } else {
        set({ characterData: dataWithValue, importError: null, importNotice: null });
      }
      scheduleAutosave(environment, () => get().characterData, (storageStatus) => set({ storageStatus }));
    },

    commitFreeTextChange(moduleId, value) {
      const currentPackage = get().currentPackage;
      const characterData = get().characterData;
      const module = currentPackage?.modules.find((candidate) => candidate.ID === moduleId);
      if (!currentPackage || !characterData || module?.类型 !== "freeText") return;
      const result = evaluateDependencies(characterData, currentPackage, {
        type: "freeTextChanged",
        sourceModuleId: moduleId,
        value,
      });
      warnDependencyIssues(result);
      const derivedResult = rebuildDerivedDependencies(characterData, currentPackage);
      warnDependencyIssues(derivedResult);
      set({
        ...dependencyRuntimeStateFromResult(derivedResult),
        importError: null,
        importNotice: null,
      });
    },

    commitResourceSelection(moduleId, libraryId, entries) {
      const currentPackage = get().currentPackage;
      const characterData = get().characterData;
      if (!currentPackage || !characterData) return;
      const applied = applyResourceSelectionToDraft(
        characterData,
        currentPackage,
        moduleId,
        libraryId,
        entries,
      );
      warnDependencyIssues(applied.interactionResult);
      warnDependencyIssues(applied.derivedResult);
      set({
        characterData: applied.characterData,
        pendingCardTablePlacements: queueNewCardInstancePlacements(
          get().pendingCardTablePlacements,
          characterData,
          applied.characterData,
        ),
        ...dependencyRuntimeStateFromResult(applied.derivedResult),
        importError: null,
        importNotice: null,
        pendingQuestionnaireResult: null,
      });
      if (applied.shouldPersist) {
        scheduleAutosave(environment, () => get().characterData, (storageStatus) => set({ storageStatus }));
      }
    },

    commitResourceComposition(moduleId, selections) {
      const currentPackage = get().currentPackage;
      const characterData = get().characterData;
      const module = currentPackage?.modules.find((candidate) => candidate.ID === moduleId);
      if (!currentPackage || !characterData || module?.类型 !== "resourceComposer") return;
      const composite = composeResource(module, selections);
      if (!composite) return;
      const withComposite: CharacterData = {
        ...characterData,
        compositeResources: { ...characterData.compositeResources, [moduleId]: composite },
        updatedAt: new Date().toISOString(),
      };
      const result = evaluateDependencies(withComposite, currentPackage, {
        type: "resourceSelected",
        sourceModuleId: moduleId,
        selectedEntries: [composite],
      });
      warnDependencyIssues(result);
      let nextData = applyDependencyResultToCharacterData(withComposite, result);
      if (result.cardCreationInstructions.length > 0) {
        nextData = createCardInstanceFromComposite(nextData, currentPackage, moduleId, composite);
      }
      const derivedResult = rebuildDerivedDependencies(nextData, currentPackage);
      warnDependencyIssues(derivedResult);
      set({
        characterData: nextData,
        pendingCardTablePlacements: queueNewCardInstancePlacements(
          get().pendingCardTablePlacements,
          characterData,
          nextData,
        ),
        ...dependencyRuntimeStateFromResult(derivedResult),
        importError: null,
        importNotice: null,
      });
      saveCharacterDataImmediately(
        environment,
        nextData,
        get().activeCharacterSaveId,
        get().characterSaves,
        (storageStatus) => set({ storageStatus }),
      );
    },

    commitCheckboxChange(moduleId, optionId, checked, checkboxState) {
      const currentPackage = get().currentPackage;
      const characterData = get().characterData;
      if (!currentPackage || !characterData) return;
      const dataWithCheckboxState = updateCharacterValue(characterData, moduleId, checkboxState);
      const result = evaluateDependencies(dataWithCheckboxState, currentPackage, {
        type: "checkboxChanged",
        sourceModuleId: moduleId,
        optionId,
        checked,
        checkboxState,
      });
      warnDependencyIssues(result);
      const nextData = applyDependencyResultToCharacterData(dataWithCheckboxState, result);
      const derivedResult = rebuildDerivedDependencies(nextData, currentPackage);
      warnDependencyIssues(derivedResult);
      set({
        characterData: nextData,
        ...dependencyRuntimeStateFromResult(derivedResult),
        importError: null,
        importNotice: null,
      });
      scheduleAutosave(environment, () => get().characterData, (storageStatus) => set({ storageStatus }));
    },

    async uploadPlayerImage(moduleId, file, selection) {
      if (!get().characterData) return;
      const admitted = await createBrowserImageAdmission().admit(file, playerAvatarPolicy, selection);
      const normalizedFile = new File([admitted.blob], `${admitted.id.slice("sha256:".length)}.webp`, {
        type: admitted.mediaType,
      });
      const image: PlayerImageData = {
        id: admitted.id,
        name: file.name || undefined,
        mimeType: admitted.mediaType,
        dataUrl: await fileToDataUrl(normalizedFile),
        width: admitted.width,
        height: admitted.height,
      };
      set((state) => ({
        characterData: state.characterData
          ? updatePlayerImage(state.characterData, moduleId, image)
          : null,
        importError: null,
        importNotice: null,
      }));
      scheduleAutosave(environment, () => get().characterData, (storageStatus) => set({ storageStatus }));
    },

    async removePlayerImage(moduleId) {
      const data = get().characterData;
      const value = data?.character.values[moduleId];
      if (!data || !isPlayerImageValue(value)) return;
      set({ characterData: removePlayerImageData(data, moduleId) });
      scheduleAutosave(environment, () => get().characterData, (storageStatus) => set({ storageStatus }));
    },
  });
}
