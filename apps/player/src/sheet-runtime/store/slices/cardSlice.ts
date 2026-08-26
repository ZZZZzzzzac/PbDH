import {
  addCardIndicator,
  bringCardInstanceToFront,
  clampCardWidth,
  deleteCardInstance,
  flipCardInstance,
  placeCardInstancesInNextTidySlots,
  restoreCardTableLayout,
  rotateCardInstance,
  setCardInstanceUpright,
  tidyCardTable,
  transitionCardIndicator,
  updateCardInstancePosition,
  updateCardInstanceState,
} from "../../domain/cardEngine";
import type { CharacterData } from "../../domain/characterData";
import { generateId } from "../../utils";
import type { RuntimeEnvironment } from "../runtimeEnvironment";
import type { CardSlice, RuntimeGet, RuntimeSet, RuntimeSlice } from "../runtimeTypes";
import { scheduleAutosave } from "../workflows/autosave";

export function createCardSlice(environment: RuntimeEnvironment): RuntimeSlice<CardSlice> {
  return (set, get) => ({
    cardTableCardWidths: {},
    cardTableSurfaceHeights: {},
    pendingCardTablePlacements: {},

    updateCardInstancePosition(instanceId, xPct, yPct) {
      updateCardAndAutosave(environment, get, set, (data) =>
        updateCardInstancePosition(data, instanceId, xPct, yPct));
    },

    bringCardInstanceToFront(instanceId) {
      updateCardAndAutosave(environment, get, set, (data) =>
        bringCardInstanceToFront(data, instanceId));
    },

    updateCardInstanceState(instanceId, cardState) {
      updateCardAndAutosave(environment, get, set, (data) =>
        updateCardInstanceState(data, instanceId, cardState));
    },

    flipCardInstance(instanceId) {
      updateCardAndAutosave(environment, get, set, (data) =>
        flipCardInstance(data, instanceId));
    },

    rotateCardInstance(instanceId, quarterTurns) {
      updateCardAndAutosave(environment, get, set, (data) =>
        rotateCardInstance(data, instanceId, quarterTurns));
    },

    setCardInstanceUpright(instanceId) {
      updateCardAndAutosave(environment, get, set, (data) =>
        setCardInstanceUpright(data, instanceId));
    },

    addCardIndicator(instanceId) {
      updateCardAndAutosave(environment, get, set, (data) =>
        addCardIndicator(data, instanceId, generateId("card-indicator-")));
    },

    transitionCardIndicator(instanceId, indicatorId, direction) {
      updateCardAndAutosave(environment, get, set, (data) =>
        transitionCardIndicator(data, instanceId, indicatorId, direction));
    },

    tidyCardTable(tableModuleId, layout) {
      updateCardAndAutosave(environment, get, set, (data) =>
        tidyCardTable(data, tableModuleId, layout));
    },

    restoreCardTableLayout(tableModuleId, snapshot) {
      updateCardAndAutosave(environment, get, set, (data) =>
        restoreCardTableLayout(data, tableModuleId, snapshot));
    },

    placePendingCardInstances(tableModuleId, layout) {
      const state = get();
      const instanceIds = state.pendingCardTablePlacements[tableModuleId];
      if (!instanceIds?.length) return;
      const nextPending = { ...state.pendingCardTablePlacements };
      delete nextPending[tableModuleId];
      if (!state.characterData) {
        set({ pendingCardTablePlacements: nextPending });
        return;
      }
      set({
        characterData: placeCardInstancesInNextTidySlots(state.characterData, tableModuleId, instanceIds, layout),
        pendingCardTablePlacements: nextPending,
        importError: null,
        importNotice: null,
      });
      scheduleAutosave(environment, () => get().characterData, (storageStatus) => set({ storageStatus }));
    },

    setCardTableCardWidth(tableModuleId, widthPx) {
      set((state) => ({
        cardTableCardWidths: {
          ...state.cardTableCardWidths,
          [tableModuleId]: clampCardWidth(widthPx),
        },
      }));
    },

    setCardTableSurfaceHeight(tableModuleId, heightPx) {
      const packageId = get().currentPackage?.manifest.ID;
      if (packageId) {
        try {
          environment.dependencies.storage.setCardTableSurfaceHeight(packageId, tableModuleId, heightPx);
        } catch (error) {
          console.error("setCardTableSurfaceHeight failed", error);
        }
      }
      set((state) => {
        const nextHeights = { ...state.cardTableSurfaceHeights };
        if (heightPx === null) delete nextHeights[tableModuleId];
        else nextHeights[tableModuleId] = Math.max(420, Math.round(heightPx));
        return { cardTableSurfaceHeights: nextHeights };
      });
    },

    deleteCardInstance(instanceId) {
      updateCardAndAutosave(environment, get, set, (data) =>
        deleteCardInstance(data, instanceId));
    },
  });
}

function updateCardAndAutosave(
  environment: RuntimeEnvironment,
  get: RuntimeGet,
  set: RuntimeSet,
  update: (data: CharacterData) => CharacterData,
): void {
  const data = get().characterData;
  if (!data) return;
  set({
    characterData: update(data),
    importError: null,
    importNotice: null,
  });
  scheduleAutosave(environment, () => get().characterData, (storageStatus) => set({ storageStatus }));
}
