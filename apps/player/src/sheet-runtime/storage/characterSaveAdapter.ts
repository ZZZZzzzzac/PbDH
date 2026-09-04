import {
  CHARACTER_SAVE_VERSION,
  type CharacterSaveCandidate,
  type CharacterSaveDocument,
  type CharacterTabletopInstance,
  type TabletopAsset,
  type TabletopResourceCopy,
} from "@pbdh/contract-runtime";
import { templateRegistry } from "@pbdh/templates/core";

import type { ResourceLibrary as PlatformResourceLibrary } from "../../resources/resource-library.ts";
import { buildSheetEmbeddedResourceEntry } from "../adapters/platformResourceLibraries.ts";
import type {
  CharacterData as SheetCharacterData,
  PlayerImageData,
  SheetValue,
} from "../domain/characterData.ts";
import type { CardInstance } from "../domain/cardEngine.ts";
import type { SystemPackage as SheetSystemPackage } from "../domain/systemPackage.ts";

export type NormalizedPlayerImage = {
  asset: TabletopAsset;
  bytes: Uint8Array;
};

export async function sheetCharacterToSave(input: {
  name: string;
  data: SheetCharacterData;
  currentSystem: CharacterSaveDocument["systemPackage"] & {
    resourceCompatibility: Array<{
      templateId: string;
      versionRange: { minimumInclusive: string };
      nativeEntry: { id: string };
    }>;
  };
  sheetSystemPackage: SheetSystemPackage;
  installedPackages: PlatformResourceLibrary;
  existing?: CharacterSaveCandidate;
  admitPlayerImage?: (image: PlayerImageData) => Promise<NormalizedPlayerImage>;
  nameCreatedAt?: string;
}): Promise<CharacterSaveCandidate> {
  const media = new Map<string, Uint8Array>();
  const characterData: Record<string, unknown> = {};
  for (const module of input.sheetSystemPackage.modules) {
    if (module.类型 === "freeText" || module.类型 === "longText"
      || module.类型 === "checkboxResource" || module.类型 === "countableResource") {
      characterData[module.ID] = structuredClone(input.data.character.values[module.ID]);
    } else if (module.类型 === "imageField") {
      characterData[module.ID] = null;
    } else if (module.类型 === "cardTable") {
      characterData[module.ID] = { instances: [] };
    }
  }

  for (const [moduleId, value] of Object.entries(input.data.character.values)) {
    if (!isPlayerImageValue(value)) continue;
    const image = input.data.playerImages[value.imageId];
    if (!image) {
      continue;
    }
    const existingAssetId = imageAssetId(input.existing?.document.characterData[moduleId]);
    const existingBytes = existingAssetId ? input.existing?.media.get(existingAssetId) : undefined;
    const normalized = existingAssetId && existingBytes
      ? { asset: { id: existingAssetId }, bytes: existingBytes }
      : await requirePlayerImageAdmission(input.admitPlayerImage, image);
    media.set(normalized.asset.id, new Uint8Array(normalized.bytes));
    characterData[moduleId] = { assetId: normalized.asset.id };
  }

  for (const card of input.data.cards.instances) {
    const existingInstance = findSavedCardInstance(input.existing?.document, card.instanceId);
    const snapshot = existingInstance
      ? { resourceCopy: structuredClone(existingInstance.resourceCopy) }
      : snapshotCard(card, input);
    const instance: CharacterTabletopInstance = {
      instanceId: card.instanceId,
      resourceCopy: snapshot.resourceCopy,
      state: {
        value: card.state,
        indicators: JSON.stringify(card.indicators),
        ...(card.tokenCount === undefined ? {} : { tokenCount: String(card.tokenCount) }),
      },
      geometry: {
        x: card.xPct,
        y: card.yPct,
        layer: Math.max(0, card.zIndex),
        rotation: card.rotation,
        flipped: card.face === "back",
        scale: card.scale,
      },
    };
    const tableState = characterData[card.tableModuleId];
    if (!isCardTableState(tableState)) throw new Error(`Card Table Module 不存在：${card.tableModuleId}`);
    tableState.instances.push(instance);
  }

  const now = input.data.updatedAt;
  const document: CharacterSaveDocument = {
    contractVersion: CHARACTER_SAVE_VERSION,
    documentId: input.data.character.id,
    name: input.name,
    createdAt: input.existing?.document.createdAt ?? input.nameCreatedAt ?? now,
    updatedAt: now,
    systemPackage: {
      id: input.currentSystem.id,
      version: input.currentSystem.version,
    },
    characterDataVersion: input.sheetSystemPackage.manifest.角色数据版本,
    characterData,
  };
  const diagnostics = validateCharacterDataForSystemPackage(document, input.sheetSystemPackage);
  if (diagnostics.length > 0) throw new Error(`Character Save Module 状态无效：${diagnostics.join("；")}`);
  return { document, media };
}

export function characterSaveToSheet(input: {
  candidate: CharacterSaveCandidate;
  currentSystem: {
    resourceCompatibility: Array<{
      templateId: string;
      versionRange: { minimumInclusive: string; maximumExclusive: string };
      nativeEntry: { id: string };
    }>;
  };
  sheetSystemPackage: SheetSystemPackage;
  installedPackages?: PlatformResourceLibrary;
  mediaUrl: (assetId: string, bytes: Uint8Array) => string;
}): SheetCharacterData {
  const document = completeCharacterDataForSystemPackage(
    input.candidate.document,
    input.sheetSystemPackage,
  );
  const diagnostics = validateCharacterDataForSystemPackage(
    document,
    input.sheetSystemPackage,
  );
  if (diagnostics.length > 0) throw new Error(`Character Save Module 状态无效：${diagnostics.join("；")}`);
  const embeddedResourceEntries: SheetCharacterData["embeddedResourceEntries"] = {};
  const cards: CardInstance[] = input.sheetSystemPackage.modules.flatMap((module) => {
    if (module.类型 !== "cardTable") return [];
    const tableState = document.characterData[module.ID];
    if (!isCardTableState(tableState)) return [];
    return tableState.instances.map((instance) => {
    const compatibility = input.currentSystem.resourceCompatibility.find((candidate) =>
      candidate.templateId === instance.resourceCopy.template.id);
    const libraryId = compatibility?.nativeEntry.id ?? "其他";
    const entryId = `character-copy:${instance.instanceId}`;
    embeddedResourceEntries[entryId] = {
      libraryId,
      entry: buildSheetEmbeddedResourceEntry({
        entryId,
        libraryId,
        resourceCopy: instance.resourceCopy,
        resolveMediaReference: ({ assetId }) => {
          const bytes = resolveCardMedia(input.installedPackages, instance.resourceCopy, assetId);
          return bytes ? input.mediaUrl(assetId, bytes) : undefined;
        },
      }),
      resourceCopy: structuredClone(instance.resourceCopy),
      assets: resolveCardAssets(input.installedPackages, instance.resourceCopy),
      media: new Map(Object.values(instance.resourceCopy.media).flatMap((assetId) => {
        const bytes = resolveCardMedia(input.installedPackages, instance.resourceCopy, assetId);
        return bytes ? [[assetId, new Uint8Array(bytes)] as const] : [];
      })),
    };
    return {
      instanceId: instance.instanceId,
      tableModuleId: module.ID,
      definitionRef: { type: "resourceLibrary", libraryId, entryId },
      state: instance.state.value ?? "",
      xPct: instance.geometry.x,
      yPct: instance.geometry.y,
      zIndex: instance.geometry.layer,
      face: instance.geometry.flipped ? "back" : "front",
      rotation: instance.geometry.rotation,
      scale: instance.geometry.scale,
      indicators: parseIndicators(instance.state.indicators),
      ...(parseTokenCount(instance.state.tokenCount) === undefined
        ? {}
        : { tokenCount: parseTokenCount(instance.state.tokenCount) }),
    };
    });
  });

  const playerImages: Record<string, PlayerImageData> = {};
  const values: Record<string, SheetValue> = {};
  for (const module of input.sheetSystemPackage.modules) {
    const value = document.characterData[module.ID];
    if (module.类型 === "freeText" || module.类型 === "longText"
      || module.类型 === "checkboxResource" || module.类型 === "countableResource") {
      values[module.ID] = structuredClone(value) as SheetValue;
      continue;
    }
    if (module.类型 !== "imageField") continue;
    const assetId = imageAssetId(value);
    const bytes = assetId ? input.candidate.media.get(assetId) : undefined;
    if (!assetId || !bytes) continue;
    values[module.ID] = { kind: "player-image", imageId: assetId };
    playerImages[assetId] = {
      id: assetId,
      mimeType: "image/webp",
      dataUrl: input.mediaUrl(assetId, bytes),
    };
  }

  return {
    kind: "pbdh-character-data",
    schemaVersion: "0.1.0",
    systemPackage: structuredClone(document.systemPackage),
    character: {
      id: document.documentId,
      values,
    },
    cards: { instances: cards },
    compositeResources: {},
    embeddedResourceEntries,
    resourceSelections: {},
    playerImages,
    updatedAt: document.updatedAt,
  };
}

function snapshotCard(
  card: CardInstance,
  input: Parameters<typeof sheetCharacterToSave>[0],
): { resourceCopy: TabletopResourceCopy } {
  if (card.definitionRef.type === "resourceLibrary") {
    const embedded = input.data.embeddedResourceEntries[card.definitionRef.entryId];
    if (embedded?.resourceCopy) {
      return {
        resourceCopy: structuredClone(embedded.resourceCopy),
      };
    }
    const parsed = parseInstalledEntryId(card.definitionRef.entryId);
    if (!parsed) throw new Error(`桌面卡不是可保存的平台资源：${card.definitionRef.entryId}`);
    const installed = input.installedPackages.get(parsed.packageId);
    const resource = installed?.document.resources.find((candidate) => candidate.id === parsed.resourceId);
    if (!installed || !resource || !isRecord(resource.data)) {
      throw new Error(`桌面卡来源资源不可用：${card.definitionRef.entryId}`);
    }
    return {
      resourceCopy: {
        source: { packageId: parsed.packageId, resourceId: parsed.resourceId },
        template: structuredClone(resource.template),
        presentation: structuredClone(resource.presentation),
        data: structuredClone(resource.data),
        labels: [],
        media: structuredClone(resource.media),
      },
    };
  }

  const compositeResourceId = card.definitionRef.compositeResourceId;
  const composite = Object.values(input.data.compositeResources).find((candidate) =>
    candidate.ID === compositeResourceId);
  const composer = composite && input.sheetSystemPackage.modules.find((module) =>
    module.类型 === "resourceComposer" && module.ID === composite.composerModuleId);
  if (!composite || composer?.类型 !== "resourceComposer") {
    throw new Error(`组合桌面卡不可用：${card.definitionRef.compositeResourceId}`);
  }
  const nativeEntryId = composer.来源槽位[0]?.资源库ID;
  const compatibility = input.currentSystem.resourceCompatibility.find((candidate) =>
    candidate.nativeEntry.id === nativeEntryId);
  if (!compatibility) throw new Error(`组合桌面卡没有模板映射：${composite.composerModuleId}`);
  const template = templateRegistry.resolve(
    compatibility.templateId,
    compatibility.versionRange.minimumInclusive,
  );
  if (!template) throw new Error(`组合桌面卡模板不可用：${compatibility.templateId}`);
  const resourceCopy: TabletopResourceCopy = {
    source: null,
    template: { id: compatibility.templateId, version: compatibility.versionRange.minimumInclusive },
    presentation: { ...template.defaultPresentation },
    data: compositeData(compatibility.templateId, composite.fields),
    labels: [],
    media: compositeMedia(composite.fields),
  };
  return { resourceCopy };
}

function compositeData(templateId: string, fields: Record<string, string>): Record<string, unknown> {
  if (templateId === "种族") {
    return {
      名称: [fields.种族A名称, fields.种族B名称].filter(Boolean).join(" / "),
      类型: "种族",
      简介: "",
      特性: [
        { 特性名称: featureName(fields.特性A), 特性描述: featureDescription(fields.特性A) },
        { 特性名称: featureName(fields.特性B), 特性描述: featureDescription(fields.特性B) },
      ],
    };
  }
  return {
    名称: fields.名称 ?? "组合资源",
    类型: "自由资源",
    简介: "",
    内容: Object.entries(fields).map(([key, value]) => ({ 名称: key, 描述: value })),
  };
}

function compositeMedia(fields: Record<string, string>): Record<string, string> {
  return Object.fromEntries([
    ["portrait", assetIdFromRuntimePath(fields.卡图)],
    ["back", assetIdFromRuntimePath(fields.卡背)],
  ].filter((entry): entry is [string, string] => Boolean(entry[1])));
}

function parseInstalledEntryId(entryId: string): { packageId: string; resourceId: string } | undefined {
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):(.*)$/u.exec(entryId);
  return match?.[2] ? { packageId: match[1]!, resourceId: match[2] } : undefined;
}

function assetIdFromRuntimePath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = /^platform-resources\/[^/]+\/(sha256%3A[0-9a-f]{64})\.webp$/u.exec(value);
  return match ? decodeURIComponent(match[1]!) : undefined;
}

function featureName(value: string | undefined): string {
  return /\*\*([^*]+)\*\*/u.exec(value ?? "")?.[1] ?? "特性";
}

function featureDescription(value: string | undefined): string {
  return (value ?? "").replace(/^\*\*[^*]+\*\*[：:]\s*/u, "");
}

function parseIndicators(value: string | undefined): CardInstance["indicators"] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as CardInstance["indicators"] : [];
  } catch {
    return [];
  }
}

function parseTokenCount(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function imageAssetId(value: unknown): string | undefined {
  return isRecord(value) && typeof value.assetId === "string" ? value.assetId : undefined;
}

function isCardTableState(value: unknown): value is { instances: CharacterTabletopInstance[] } {
  return isRecord(value) && Array.isArray(value.instances);
}

function findSavedCardInstance(
  document: CharacterSaveDocument | undefined,
  instanceId: string,
): CharacterTabletopInstance | undefined {
  if (!document) return undefined;
  for (const value of Object.values(document.characterData)) {
    if (!isCardTableState(value)) continue;
    const found = value.instances.find((candidate) => candidate.instanceId === instanceId);
    if (found) return found;
  }
  return undefined;
}

function resolveCardPackage(
  installedPackages: PlatformResourceLibrary | undefined,
  resourceCopy: TabletopResourceCopy,
) {
  if (!installedPackages) return undefined;
  const sourcePackage = resourceCopy.source
    ? installedPackages.get(resourceCopy.source.packageId)
    : undefined;
  if (sourcePackage) return sourcePackage;
  const assetIds = Object.values(resourceCopy.media);
  return [...installedPackages.values()].find((candidate) =>
    assetIds.some((assetId) => candidate.media.has(assetId)));
}

function resolveCardMedia(
  installedPackages: PlatformResourceLibrary | undefined,
  resourceCopy: TabletopResourceCopy,
  assetId: string,
): Uint8Array | undefined {
  return resolveCardPackage(installedPackages, resourceCopy)?.media.get(assetId);
}

function resolveCardAssets(
  installedPackages: PlatformResourceLibrary | undefined,
  resourceCopy: TabletopResourceCopy,
): TabletopAsset[] {
  const packageEntry = resolveCardPackage(installedPackages, resourceCopy);
  const assetIds = new Set(Object.values(resourceCopy.media));
  return packageEntry?.document.assets.filter((asset) => assetIds.has(asset.id)) ?? [];
}

export function validateCharacterDataForSystemPackage(
  document: CharacterSaveDocument,
  systemPackage: SheetSystemPackage,
): string[] {
  const diagnostics: string[] = [];
  if (document.systemPackage.id !== systemPackage.manifest.ID) diagnostics.push("System Package ID 不匹配");
  if (document.systemPackage.version !== systemPackage.manifest.版本) diagnostics.push("System Package 版本不匹配");
  if (document.characterDataVersion !== systemPackage.manifest.角色数据版本) diagnostics.push("Character Data 版本不匹配");

  const modules = new Map(systemPackage.modules.map((module) => [module.ID, module]));
  const stateful = new Set(systemPackage.modules.flatMap((module) =>
    module.类型 === "freeText" || module.类型 === "longText" || module.类型 === "checkboxResource"
      || module.类型 === "countableResource" || module.类型 === "imageField" || module.类型 === "cardTable"
      ? [module.ID]
      : []));
  for (const moduleId of Object.keys(document.characterData)) {
    if (!stateful.has(moduleId)) diagnostics.push(`未知或无状态 Module：${moduleId}`);
  }

  const instanceIds = new Set<string>();
  for (const moduleId of stateful) {
    const module = modules.get(moduleId)!;
    if (!Object.prototype.hasOwnProperty.call(document.characterData, moduleId)) {
      diagnostics.push(`缺少 Module 状态：${moduleId}`);
      continue;
    }
    const value = document.characterData[moduleId];
    if (module.类型 === "freeText" || module.类型 === "longText") {
      if (typeof value !== "string") diagnostics.push(`${moduleId} 必须是字符串`);
      continue;
    }
    if (module.类型 === "checkboxResource") {
      const optionIds = new Set(module.选项.map((option) => option.ID));
      if (!isRecord(value) || Object.keys(value).length !== optionIds.size
        || Object.entries(value).some(([id, checked]) => !optionIds.has(id) || typeof checked !== "boolean")) {
        diagnostics.push(`${moduleId} 的勾选状态无效`);
      }
      continue;
    }
    if (module.类型 === "countableResource") {
      const max = isRecord(value) ? value.max : undefined;
      const current = isRecord(value) ? value.current : undefined;
      const min = module.最小值 ?? 0;
      const expectedMax = module.最大值 ?? null;
      if (!isRecord(value) || Object.keys(value).some((key) => key !== "current" && key !== "max")
        || !Number.isInteger(current) || (max !== null && !Number.isInteger(max))
        || (typeof current === "number" && current < min)
        || (typeof current === "number" && typeof max === "number" && current > max)
        || (module.最大值可改 !== true && max !== expectedMax)) {
        diagnostics.push(`${moduleId} 的计数状态无效`);
      }
      continue;
    }
    if (module.类型 === "imageField") {
      if (value !== null && (!isRecord(value) || Object.keys(value).length !== 1
        || typeof value.assetId !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value.assetId))) {
        diagnostics.push(`${moduleId} 的图片引用无效`);
      }
      continue;
    }
    if (module.类型 === "cardTable") {
      if (!isCardTableState(value) || Object.keys(value).length !== 1) {
        diagnostics.push(`${moduleId} 的卡牌桌面状态无效`);
        continue;
      }
      value.instances.forEach((instance, index) => {
        if (!isTabletopInstance(instance)) {
          diagnostics.push(`${moduleId}.instances[${index}] 无效`);
          return;
        }
        const states = module.状态选项 ?? [];
        if (typeof instance.state.value !== "string"
          || (states.length > 0 && !states.includes(instance.state.value))
          || !isSerializedIndicators(instance.state.indicators)
          || (instance.state.tokenCount !== undefined && parseTokenCount(instance.state.tokenCount) === undefined)) {
          diagnostics.push(`${moduleId}.instances[${index}] 的运行状态无效`);
        }
        if (instanceIds.has(instance.instanceId)) diagnostics.push(`Card Instance ID 重复：${instance.instanceId}`);
        instanceIds.add(instance.instanceId);
      });
    }
  }
  return diagnostics;
}

export function completeCharacterDataForSystemPackage(
  document: CharacterSaveDocument,
  systemPackage: SheetSystemPackage,
): CharacterSaveDocument {
  const characterData = structuredClone(document.characterData) as Record<string, unknown>;
  let changed = false;
  for (const module of systemPackage.modules) {
    if (Object.prototype.hasOwnProperty.call(characterData, module.ID)) continue;
    switch (module.类型) {
      case "freeText":
      case "longText":
        characterData[module.ID] = module.默认值 ?? "";
        changed = true;
        break;
      case "checkboxResource":
        characterData[module.ID] = Object.fromEntries(module.选项.map((option) =>
          [option.ID, option.默认选中 ?? false]));
        changed = true;
        break;
      case "countableResource": {
        const min = module.最小值 ?? 0;
        const max = module.最大值 ?? null;
        const initial = module.默认值 ?? min;
        characterData[module.ID] = {
          current: Math.max(min, max === null ? initial : Math.min(max, initial)),
          max,
        };
        changed = true;
        break;
      }
      case "imageField":
        characterData[module.ID] = null;
        changed = true;
        break;
      case "cardTable":
        characterData[module.ID] = { instances: [] };
        changed = true;
        break;
    }
  }
  const systemPackageChanged = document.systemPackage.id === systemPackage.manifest.ID
    && document.systemPackage.version === "1.1.0"
    && systemPackage.manifest.版本 === "1.0.0";
  return changed || systemPackageChanged
    ? {
        ...document,
        systemPackage: systemPackageChanged
          ? { ...document.systemPackage, version: systemPackage.manifest.版本 }
          : document.systemPackage,
        characterData,
      }
    : document;
}

function isTabletopInstance(value: unknown): value is CharacterTabletopInstance {
  if (!isRecord(value) || typeof value.instanceId !== "string" || !isRecord(value.resourceCopy)
    || !isRecord(value.state) || Object.values(value.state).some((item) => typeof item !== "string")
    || !isRecord(value.geometry)) return false;
  const geometry = value.geometry;
  return ["x", "y", "layer", "rotation", "scale"].every((key) =>
    typeof geometry[key] === "number" && Number.isFinite(geometry[key]))
    && Number.isInteger(geometry.layer)
    && typeof geometry.scale === "number" && geometry.scale > 0
    && typeof geometry.flipped === "boolean"
    && isRecord(value.resourceCopy.template)
    && typeof value.resourceCopy.template.id === "string"
    && typeof value.resourceCopy.template.version === "string"
    && isRecord(value.resourceCopy.presentation)
    && isRecord(value.resourceCopy.data)
    && Array.isArray(value.resourceCopy.labels)
    && value.resourceCopy.labels.every((label) => typeof label === "string")
    && isRecord(value.resourceCopy.media)
    && Object.values(value.resourceCopy.media).every((assetId) => typeof assetId === "string");
}

function isSerializedIndicators(value: string | undefined): boolean {
  if (value === undefined) return true;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.length <= 10 && parsed.every((indicator) => isRecord(indicator)
        && typeof indicator.indicatorId === "string"
        && Number.isInteger(indicator.colorIndex)
        && typeof indicator.colorIndex === "number" && indicator.colorIndex >= 0 && indicator.colorIndex <= 9
        && Number.isInteger(indicator.value)
        && typeof indicator.value === "number" && indicator.value >= 0);
    }
    return isRecord(parsed) && Object.entries(parsed).every(([id, count]) =>
      id.length > 0 && Number.isInteger(count) && typeof count === "number" && count >= 0);
  } catch {
    return false;
  }
}

async function requirePlayerImageAdmission(
  admit: ((image: PlayerImageData) => Promise<NormalizedPlayerImage>) | undefined,
  image: PlayerImageData,
) {
  if (!admit) throw new Error(`玩家图片尚未进入统一媒体流程：${image.id}`);
  return admit(image);
}

function isPlayerImageValue(value: unknown): value is { kind: "player-image"; imageId: string } {
  return isRecord(value) && value.kind === "player-image" && typeof value.imageId === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
