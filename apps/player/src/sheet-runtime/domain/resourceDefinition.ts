import type { CharacterData } from "./characterData";
import type { ResourceDefinitionRef } from "./cardEngine";
import type { ResourceLibraryEntry } from "./resourceLibrary";
import { findResourceLibraryEntry } from "./resourceLibrary";
import { findResourceLibrary, type SystemPackage } from "./systemPackage";

export function resolveResourceDefinition(
  systemPackage: SystemPackage,
  characterData: CharacterData | null,
  reference: ResourceDefinitionRef | undefined,
): ResourceLibraryEntry | undefined {
  if (!reference) return undefined;
  if (reference.type === "resourceLibrary") {
    const embedded = characterData?.embeddedResourceEntries[reference.entryId];
    if (embedded?.libraryId === reference.libraryId) return embedded.entry;
    return findResourceLibraryEntry(findResourceLibrary(systemPackage, reference.libraryId), reference.entryId);
  }
  return Object.values(characterData?.compositeResources ?? {}).find((resource) => resource.ID === reference.compositeResourceId);
}
