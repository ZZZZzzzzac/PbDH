import { create } from "zustand";
import {
  configureRuntimeEnvironment,
  createRuntimeEnvironment,
  resetRuntimeEnvironment,
  type RuntimeEnvironment,
} from "./runtimeEnvironment";
import { createCardSlice } from "./slices/cardSlice";
import { createCharacterImportSlice } from "./slices/characterImportSlice";
import { createCharacterSlice } from "./slices/characterSlice";
import { createPackageSlice } from "./slices/packageSlice";
import { createQuestionnaireSlice } from "./slices/questionnaireSlice";
import { createResourceExtensionSlice } from "./slices/resourceExtensionSlice";
import { createValidationSlice } from "./slices/validationSlice";
import type { RuntimeDependencies, RuntimeState } from "./runtimeTypes";

export { autosaveDelayMs } from "./workflows/autosave";
export type {
  FrameworkColorSchemePreference,
  PendingCharacterConversion,
  PendingCharacterFormatSelection,
  PendingQuestionnaireResult,
  PendingResourceExtensionConversion,
  PendingResourceExtensionRemoval,
  PendingResourceExtensionReplacement,
  PendingResourceFormatSelection,
  ResourceExtensionDifference,
  ResourceExtensionImportState,
} from "./runtimeTypes";

const runtimeEnvironment = createRuntimeEnvironment();

function createRuntimeStore(environment: RuntimeEnvironment) {
  return create<RuntimeState>()((...store) => ({
    ...createPackageSlice(environment)(...store),
    ...createResourceExtensionSlice(environment)(...store),
    ...createCharacterSlice(environment)(...store),
    ...createQuestionnaireSlice(environment)(...store),
    ...createCardSlice(environment)(...store),
    ...createValidationSlice(environment)(...store),
    ...createCharacterImportSlice(environment)(...store),
  }));
}

export const useRuntimeStore = createRuntimeStore(runtimeEnvironment);

export function configureRuntimeDependencies(dependencies: Partial<RuntimeDependencies>) {
  configureRuntimeEnvironment(runtimeEnvironment, dependencies);
}

export function resetRuntimeDependencies() {
  resetRuntimeEnvironment(runtimeEnvironment);
}
