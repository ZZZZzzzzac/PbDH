import type { CharacterData } from "./characterData";
import type { ResourceDefinitionRef } from "./cardEngine";
import type { ResourceLibraryEntry } from "./resourceLibrary";
import { findResourceLibraryEntry } from "./resourceLibrary";
import { findResourceLibrary, type SystemPackage } from "./systemPackage";
import { materializeImportedComposite } from "./resourceComposer";

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
  const composite = Object.values(characterData?.compositeResources ?? {}).find((resource) => resource.ID === reference.compositeResourceId);
  if (!composite || composite.resourceCopy) return composite;
  const composer = systemPackage.modules.find((module) => module.ID === composite.composerModuleId);
  return composer?.类型 === "resourceComposer"
    ? materializeImportedComposite(composer, composite.fields, systemPackage.resourceLibraries ?? [])
    : composite;
}
