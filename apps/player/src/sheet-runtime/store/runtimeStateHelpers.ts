import type { CountableState, CharacterData, PlayerImageValue, SheetValue } from "../domain/characterData";
import { rebuildDerivedDependencies } from "../domain/dependencyEngine";
import type { EffectiveResourceCatalog } from "../domain/effectiveResourceCatalog";
import type { ResourceExtensionIssue } from "../domain/resourceExtension";
import type { ResourceLibraryQuery } from "../domain/resourceLibrary";
import type { SystemPackage } from "../domain/systemPackage";
import type { ValidationIssue } from "../domain/validationRunner";
import { dependencyRuntimeStateFromResult, warnDependencyIssues } from "./runtimeHelpers";

export function emptyDerivedState() {
  return {
    derivedReadOnlyDisplayContent: {} as Record<string, string>,
    derivedTextPlaceholders: {} as Record<string, string>,
    moduleVisibility: {} as Record<string, boolean>,
    pageVisibility: {} as Record<string, boolean>,
    resourcePickerDefaultQueries: {} as Record<string, ResourceLibraryQuery>,
    cardTableCardWidths: {} as Record<string, number>,
    pendingCardTablePlacements: {} as Record<string, string[]>,
    validationIssues: [] as ValidationIssue[],
    validationStatus: "idle" as const,
  };
}

export function rebuildDependencyRuntimeState(data: CharacterData, systemPackage: SystemPackage) {
  const result = rebuildDerivedDependencies(data, systemPackage);
  warnDependencyIssues(result);
  return dependencyRuntimeStateFromResult(result);
}

export function collectStaleResourceReferenceIssues(
  characterData: CharacterData | null,
  catalog: EffectiveResourceCatalog,
): ResourceExtensionIssue[] {
  if (!characterData) return [];
  const issues: ResourceExtensionIssue[] = [];
  const entryExists = (libraryId: string, entryId: string) => catalog.resourceLibraries
    .some((library) => library.ID === libraryId && library.entries.some((entry) => entry.ID === entryId));

  for (const instance of characterData.cards.instances) {
    if (instance.definitionRef.type === "resourceLibrary"
      && !characterData.embeddedResourceEntries[instance.definitionRef.entryId]
      && !entryExists(instance.definitionRef.libraryId, instance.definitionRef.entryId)) {
      issues.push({
        level: "warning",
        code: "STALE_RESOURCE_DEFINITION_REFERENCE",
        text: `Card Instance 引用已失效：${instance.definitionRef.libraryId}/${instance.definitionRef.entryId}`,
        path: `cards.${instance.instanceId}.definitionRef`,
      });
    }
  }

  for (const [moduleId, snapshot] of Object.entries(characterData.resourceSelections ?? {})) {
    for (const entryId of snapshot.entryIds) {
      if (!entryExists(snapshot.libraryId, entryId)) {
        issues.push({
          level: "warning",
          code: "STALE_RESOURCE_SELECTION_REFERENCE",
          text: `Derived Source Snapshot 引用已失效：${snapshot.libraryId}/${entryId}`,
          path: `resourceSelections.${moduleId}`,
        });
      }
    }
  }
  return issues;
}

export function isCountableStateValue(value: SheetValue): value is CountableState {
  return typeof value === "object" && value !== null && "current" in value && "max" in value;
}

export function isPlayerImageValue(value: unknown): value is PlayerImageValue {
  return typeof value === "object" && value !== null && "kind" in value
    && (value as PlayerImageValue).kind === "player-image";
}
