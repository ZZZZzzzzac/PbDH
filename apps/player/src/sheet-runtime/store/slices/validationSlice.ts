import type { ValidationIssue } from "../../domain/validationRunner";
import type { RuntimeEnvironment } from "../runtimeEnvironment";
import type { RuntimeGet, RuntimeSet, RuntimeSlice, ValidationSlice } from "../runtimeTypes";

export function createValidationSlice(environment: RuntimeEnvironment): RuntimeSlice<ValidationSlice> {
  return (set, get) => ({
    validationIssues: [],
    validationStatus: "idle",

    async runValidationChecks() {
      await executeValidation(environment, get, set);
    },

    async runPreOutputValidation() {
      return executeValidation(environment, get, set);
    },
  });
}

async function executeValidation(
  environment: RuntimeEnvironment,
  get: RuntimeGet,
  set: RuntimeSet,
): Promise<ValidationIssue[]> {
  const currentPackage = get().currentPackage;
  const characterData = get().characterData;
  const checks = currentPackage?.validationChecks ?? [];
  if (!currentPackage || !characterData || checks.length === 0) {
    set({ validationIssues: [], validationStatus: "complete" });
    return [];
  }

  set({ validationStatus: "running" });
  const validationIssues = await environment.dependencies.runValidationChecks({
    characterData,
    resourceLibraries: currentPackage.resourceLibraries ?? [],
    cardState: characterData.cards,
    packageMetadata: {
      id: currentPackage.manifest.ID,
      version: currentPackage.manifest.版本,
    },
    checks,
  });
  set({ validationIssues, validationStatus: "complete" });
  return validationIssues;
}
