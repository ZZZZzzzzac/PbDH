import { useRuntimeStore } from "../store/runtimeStore";
import type { CheckboxState, CountableState, SheetValue } from "../domain/characterData";

export function useTextModuleState(moduleId: string, defaultValue = "") {
  const rawValue = useRuntimeStore((state) => state.characterData?.character.values[moduleId]);
  const updateModuleValue = useRuntimeStore((state) => state.updateModuleValue);
  const value = typeof rawValue === "string" ? rawValue : defaultValue;

  return [value, (nextValue: string) => updateModuleValue(moduleId, nextValue)] as const;
}

export function readCheckboxState(rawValue: SheetValue | undefined, fallback: CheckboxState): CheckboxState {
  if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) && !("kind" in rawValue)) {
    return { ...fallback, ...(rawValue as Record<string, boolean>) };
  }

  return fallback;
}

export function readCountableState(rawValue: SheetValue | undefined, fallback: CountableState): CountableState {
  if (rawValue && typeof rawValue === "object" && "current" in rawValue) {
    return { ...fallback, ...(rawValue as Partial<CountableState>) };
  }

  return fallback;
}
