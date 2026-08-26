import type { CharacterData } from "../../domain/characterData";
import type { CardInstance } from "../../domain/cardEngine";
import { resolveCardPresentation, type CardPresentation } from "../../domain/cardPresentation";
import type { ResourceLibraryEntry } from "../../domain/resourceLibrary";
import { resolveResourceDefinition } from "../../domain/resourceDefinition";
import {
  findCardTableResourceLibrarySource,
  findResourceLibrary,
  type CardTableModule,
  type SystemPackage,
} from "../../domain/systemPackage";

const cardDefaults = {
  卡图字段: "卡图",
  卡背字段: "卡背",
  背面卡牌ID字段: "背面卡牌ID",
  显示方式字段: "卡牌显示方式",
} as const;

export function cardField(module: CardTableModule, key: keyof typeof cardDefaults): string {
  return module[key] ?? cardDefaults[key];
}

export function resolveVisibleCardDefinition(
  systemPackage: SystemPackage,
  characterData: CharacterData | null,
  module: CardTableModule,
  instance: CardInstance | undefined,
): ResourceLibraryEntry | undefined {
  const front = resolveFrontCardDefinition(systemPackage, characterData, instance);
  if (!front || !instance || instance.face === "front") return front;

  const backArt = front.fields[cardField(module, "卡背字段")]?.trim();
  if (backArt) {
    return { ...front, fields: { ...front.fields, [cardField(module, "卡图字段")]: backArt } };
  }
  const reverseId = front.fields[cardField(module, "背面卡牌ID字段")]?.trim();
  const libraryId = instance.definitionRef.type === "resourceLibrary" ? instance.definitionRef.libraryId : undefined;
  if (!libraryId) return front;
  return reverseId
    ? findResourceLibrary(systemPackage, libraryId)?.entries.find((entry) => entry.ID === reverseId) ?? front
    : front;
}

export function hasReverseCardDefinition(
  systemPackage: SystemPackage,
  characterData: CharacterData | null,
  module: CardTableModule,
  instance: CardInstance | undefined,
): boolean {
  const front = resolveFrontCardDefinition(systemPackage, characterData, instance);
  const backArt = front?.fields[cardField(module, "卡背字段")]?.trim();
  if (backArt) return true;
  const reverseId = front?.fields[cardField(module, "背面卡牌ID字段")]?.trim();
  const libraryId = instance?.definitionRef.type === "resourceLibrary" ? instance.definitionRef.libraryId : undefined;
  if (!libraryId) return false;
  return Boolean(reverseId && reverseId !== front?.ID
    && findResourceLibrary(systemPackage, libraryId)?.entries.some((entry) => entry.ID === reverseId));
}

export function findCardPresentation(
  systemPackage: SystemPackage,
  module: CardTableModule,
  instance: CardInstance | undefined,
): CardPresentation | undefined {
  if (!instance) return undefined;
  if (instance.definitionRef.type === "resourceLibrary") {
    return findCardTableResourceLibrarySource(systemPackage, module, instance.definitionRef.libraryId)?.卡牌展示;
  }
  const sourceId = instance.definitionRef.compositeResourceId.replace(/^composite:/, "");
  return module.资源来源.find((source) => source.类型 === "resourceComposer" && source.ID === sourceId)?.卡牌展示;
}

export function resolveRenderedCardPresentation(
  definition: ResourceLibraryEntry | undefined,
  module: CardTableModule,
  presentation?: CardPresentation,
) {
  return resolveCardPresentation(definition, presentation, [
    cardField(module, "卡图字段"),
    cardField(module, "卡背字段"),
    cardField(module, "显示方式字段"),
    cardField(module, "背面卡牌ID字段"),
  ]);
}

export function resolveCardDisplayMode(
  definition: ResourceLibraryEntry | undefined,
  module: CardTableModule,
): "image" | "text" | "split" {
  const entryMode = definition?.fields[cardField(module, "显示方式字段")];
  if (entryMode === "image" || entryMode === "text" || entryMode === "split") return entryMode;
  return module.显示方式 ?? "image";
}

export function definitionReferenceId(instance: CardInstance): string {
  return instance.definitionRef.type === "resourceLibrary"
    ? instance.definitionRef.entryId
    : instance.definitionRef.compositeResourceId;
}

function resolveFrontCardDefinition(
  systemPackage: SystemPackage,
  characterData: CharacterData | null,
  instance: CardInstance | undefined,
): ResourceLibraryEntry | undefined {
  return instance
    ? resolveResourceDefinition(systemPackage, characterData, instance.definitionRef)
    : undefined;
}
