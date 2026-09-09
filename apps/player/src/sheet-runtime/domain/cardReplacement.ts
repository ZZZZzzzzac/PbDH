import { executeTabletopCommand, type TabletopDocumentModel } from "@pbdh/tabletop/core";
import type { TemplateCoreCapability } from "@pbdh/templates/core";
import type { CharacterData } from "./characterData";
import type { SystemPackage } from "./systemPackage";

type TemplateResolver = (id: string, version: string) => TemplateCoreCapability<any> | undefined;

function replacementSource(data: CharacterData, system: SystemPackage, instanceId: string) {
  const instance = data.cards.instances.find((item) => item.instanceId === instanceId);
  const ref = instance?.definitionRef;
  if (ref?.type !== "resourceLibrary") return undefined;
  const embedded = data.embeddedResourceEntries[ref.entryId];
  const source = embedded?.libraryId === ref.libraryId ? embedded.entry : system.resourceLibraries?.find((library) => library.ID === ref.libraryId)?.entries.find((entry) => entry.ID === ref.entryId);
  const copy = source?.resourceCopy;
  if (!copy?.source) return undefined;
  return { instance: instance!, copy };
}

export function cardReplacementTemplate(data: CharacterData, system: SystemPackage, instanceId: string) {
  const source = replacementSource(data, system, instanceId);
  return source?.copy.replacements?.length ? source.copy.template : undefined;
}

export function cardReplacementOptions(resolveTemplate: TemplateResolver, data: CharacterData, system: SystemPackage, instanceId: string) {
  const source = replacementSource(data, system, instanceId);
  if (!source) return [];
  const { instance, copy } = source;
  const supported = resolveTemplate(copy.template.id, copy.template.version)?.tabletop.replacements ?? [];
  return (copy.replacements ?? []).filter((replacement) => supported.some((item) => item.id === replacement.replacementId)).map((replacement) => {
    const candidates = (system.resourceLibraries ?? []).flatMap((library) => library.entries.filter((entry) => entry.resourceCopy?.source?.packageId === copy.source!.packageId && entry.resourceCopy.source.resourceId === replacement.targetResourceId).map((entry) => ({ libraryId: library.ID, entry })));
    const target = candidates.length === 1 ? candidates[0] : undefined;
    return { id: replacement.replacementId, name: target?.entry.fields.名称 || replacement.targetResourceId, target, source: copy, instance: instance! };
  });
}

export function replacePlayerCard(resolveTemplate: TemplateResolver, data: CharacterData, system: SystemPackage, instanceId: string, replacementId: string, newInstanceId: string): CharacterData {
  const reference = cardReplacementTemplate(data, system, instanceId);
  if (reference && !resolveTemplate(reference.id, reference.version)) throw new Error("卡牌模板尚未加载完成，请稍后重试。");
  const option = cardReplacementOptions(resolveTemplate, data, system, instanceId).find((item) => item.id === replacementId);
  const target = option?.target;
  if (!option || !target?.entry.resourceCopy) throw new Error("替换目标未安装或不唯一，当前卡牌未改变。");
  const table = system.modules.find((module) => module.ID === option.instance.tableModuleId);
  if (table?.类型 !== "cardTable" || !table.资源来源.some((source) => (source.类型 === "resourceLibrary" && source.ID === target.libraryId) || source.类型 === "otherResourceLibraries")) throw new Error("当前桌面不接纳替换目标，当前卡牌未改变。");
  const instance = option.instance;
  const document: TabletopDocumentModel = { id: "player-replacement", name: "Player replacement", canvas: { width: 100, height: 100 }, assets: [], instances: [{ id: instanceId, resource: { ...option.source, replacements: option.source.replacements ?? [] }, state: {}, position: { x: instance.xPct, y: instance.yPct }, layer: instance.zIndex, rotation: instance.rotation, flipped: instance.face === "back", scale: instance.scale }] };
  const result = executeTabletopCommand(document, { type: "replace", instanceId, newInstanceId, replacementId, resource: { ...target.entry.resourceCopy, replacements: target.entry.resourceCopy.replacements ?? [] }, state: {} }, { capabilities: new Set(["replace"]) });
  if (result.diagnostics.length) throw new Error(result.diagnostics.map((item) => item.code).join(", "));
  const replaced = result.document.instances[0]!;
  const entryId = `character-copy:${newInstanceId}`;
  return {
    ...data,
    embeddedResourceEntries: { ...data.embeddedResourceEntries, [entryId]: { libraryId: target.libraryId, entry: { ...structuredClone(target.entry), ID: entryId }, resourceCopy: structuredClone(target.entry.resourceCopy) } },
    cards: { instances: data.cards.instances.map((card) => card.instanceId !== instanceId ? card : { instanceId: newInstanceId, tableModuleId: card.tableModuleId, definitionRef: { type: "resourceLibrary", libraryId: target.libraryId, entryId }, state: table.状态选项?.[0] ?? "", xPct: replaced.position.x, yPct: replaced.position.y, zIndex: replaced.layer, rotation: replaced.rotation, face: "front", scale: replaced.scale, indicators: [] }) },
    updatedAt: new Date().toISOString(),
  };
}
