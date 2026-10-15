import type { CharacterData } from "./characterData";
import { flipCardInstance, type CardInstance } from "./cardEngine";
import type { ResourceLibraryEntry } from "./resourceLibrary";
import { resolveResourceDefinition } from "./resourceDefinition";
import type { CardTableModule, SystemPackage } from "./systemPackage";

export function resolveCardBack(system: SystemPackage, data: CharacterData | null, module: CardTableModule, instance: CardInstance): ResourceLibraryEntry | undefined {
  if (instance.backDefinition) return instance.backDefinition;
  const front = resolveResourceDefinition(system, data, instance.definitionRef);
  if (!front) return undefined;
  const imageField = module.卡图字段 ?? "卡图";
  const backImage = front.fields[module.卡背字段 ?? "卡背"]?.trim();
  if (backImage) return {
    ...front, fields: { ...front.fields, [imageField]: backImage },
    ...(front.resourceCopy?.media.back ? { resourceCopy: { ...front.resourceCopy,
      presentation: { ...front.resourceCopy.presentation, mode: "image" },
      media: { ...front.resourceCopy.media, portrait: front.resourceCopy.media.back },
    } } : {}),
  };
  const copy = front.resourceCopy;
  const relation = copy?.replacements?.find((item) => item.replacementId === "alternate-form");
  if (relation && copy?.source) {
    const candidates = (system.resourceLibraries ?? []).flatMap((library) => library.entries.filter((entry) =>
      entry.resourceCopy?.source?.packageId === copy.source!.packageId && entry.resourceCopy.source.resourceId === relation.targetResourceId));
    return candidates.length === 1 ? candidates[0] : undefined;
  }
  const reverseId = front.fields[module.背面卡牌ID字段 ?? "背面卡牌ID"]?.trim();
  const ref = instance.definitionRef;
  return reverseId && ref.type === "resourceLibrary"
    ? system.resourceLibraries?.find((library) => library.ID === ref.libraryId)?.entries.find((entry) => entry.ID === reverseId)
    : undefined;
}

export function flipPlayerCard(data: CharacterData, system: SystemPackage, instanceId: string): CharacterData {
  const instance = data.cards.instances.find((card) => card.instanceId === instanceId);
  if (!instance) return data;
  // 返回正面只依赖实例自身，不再查找来源或背面卡的关联。
  if (instance.face === "back") return flipCardInstance(data, instanceId);
  const module = system.modules.find((item) => item.ID === instance.tableModuleId);
  const back = module?.类型 === "cardTable" ? resolveCardBack(system, data, module, instance) : undefined;
  if (!back) throw new Error("卡背不可用或不唯一，当前卡牌未改变。");
  const front = resolveResourceDefinition(system, data, instance.definitionRef);
  if (!front) throw new Error("正面卡牌不可用，当前卡牌未改变。");
  const ref = instance.definitionRef;
  const entryId = `character-copy:${instanceId}`;
  const nextRef = ref.type === "resourceLibrary" ? { ...ref, entryId } : ref;
  const embeddedResourceEntries = ref.type === "resourceLibrary" ? {
    ...data.embeddedResourceEntries,
    [entryId]: { ...data.embeddedResourceEntries[ref.entryId], libraryId: ref.libraryId, entry: { ...structuredClone(front), ID: entryId },
      ...(front.resourceCopy ? { resourceCopy: structuredClone(front.resourceCopy) } : {}),
    },
  } : data.embeddedResourceEntries;
  return flipCardInstance({ ...data, embeddedResourceEntries, cards: { instances: data.cards.instances.map((card) => card.instanceId === instanceId
    ? { ...card, definitionRef: nextRef, backDefinition: structuredClone(back) } : card) } }, instanceId);
}
