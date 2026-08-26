import {
  CHARACTER_SAVE_VERSION,
  type CharacterSaveCandidate,
  type CharacterSaveDocument,
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
  const assets = new Map<string, TabletopAsset>();
  const media = new Map<string, Uint8Array>();
  const values = structuredClone(input.data.character.values) as Record<string, SheetValue>;

  for (const [moduleId, value] of Object.entries(values)) {
    if (!isPlayerImageValue(value)) continue;
    const image = input.data.playerImages[value.imageId];
    if (!image) {
      delete values[moduleId];
      continue;
    }
    const existingAsset = input.existing?.document.characterData.assets.find((asset) =>
      asset.id === image.id);
    const existingBytes = existingAsset ? input.existing?.media.get(existingAsset.id) : undefined;
    const normalized = existingAsset && existingBytes
      ? { asset: existingAsset, bytes: existingBytes }
      : await requirePlayerImageAdmission(input.admitPlayerImage, image);
    addAsset(assets, media, normalized.asset, normalized.bytes);
    values[moduleId] = { kind: "player-image", imageId: normalized.asset.id };
  }

  const instances = input.data.cards.instances.map((card) => {
    const existingInstance = input.existing?.document.characterData.tabletop.instances.find((candidate) =>
      candidate.instanceId === card.instanceId);
    const snapshot = existingInstance
      ? snapshotFromExisting(input.existing!, existingInstance.resourceCopy, assets, media)
      : snapshotCard(card, input);
    for (const asset of snapshot.assets) {
      const bytes = snapshot.media.get(asset.id);
      if (!bytes) throw new Error(`桌面卡缺少媒体：${asset.id}`);
      addAsset(assets, media, asset, bytes);
    }
    return {
      instanceId: card.instanceId,
      resourceCopy: snapshot.resourceCopy,
      state: {
        sheetState: card.state,
        tableModuleId: card.tableModuleId,
        indicators: JSON.stringify(card.indicators),
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
  });

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
    characterData: {
      values,
      tabletop: { instances },
      assets: [...assets.values()].sort((left, right) => left.id.localeCompare(right.id)),
    },
  };
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
  mediaUrl: (assetId: string, bytes: Uint8Array) => string;
}): SheetCharacterData {
  const embeddedResourceEntries: SheetCharacterData["embeddedResourceEntries"] = {};
  const cards: CardInstance[] = input.candidate.document.characterData.tabletop.instances.map((instance) => {
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
          const bytes = input.candidate.media.get(assetId);
          return bytes ? input.mediaUrl(assetId, bytes) : undefined;
        },
      }),
      resourceCopy: structuredClone(instance.resourceCopy),
      assets: input.candidate.document.characterData.assets.filter((asset) =>
        Object.values(instance.resourceCopy.media).includes(asset.id)),
      media: new Map(Object.values(instance.resourceCopy.media).flatMap((assetId) => {
        const bytes = input.candidate.media.get(assetId);
        return bytes ? [[assetId, new Uint8Array(bytes)] as const] : [];
      })),
    };
    return {
      instanceId: instance.instanceId,
      tableModuleId: instance.state.tableModuleId ?? "character-card-table",
      definitionRef: { type: "resourceLibrary", libraryId, entryId },
      state: instance.state.sheetState ?? "",
      xPct: instance.geometry.x,
      yPct: instance.geometry.y,
      zIndex: instance.geometry.layer,
      face: instance.geometry.flipped ? "back" : "front",
      rotation: instance.geometry.rotation,
      scale: instance.geometry.scale,
      indicators: parseIndicators(instance.state.indicators),
    };
  });

  const playerImages: Record<string, PlayerImageData> = {};
  const values = structuredClone(input.candidate.document.characterData.values) as Record<string, SheetValue>;
  for (const value of Object.values(values)) {
    if (!isPlayerImageValue(value)) continue;
    const asset = input.candidate.document.characterData.assets.find((candidate) =>
      candidate.id === value.imageId);
    const bytes = asset ? input.candidate.media.get(asset.id) : undefined;
    if (!asset || !bytes) continue;
    playerImages[asset.id] = {
      id: asset.id,
      mimeType: asset.mediaType,
      dataUrl: input.mediaUrl(asset.id, bytes),
    };
  }

  return {
    kind: "pbdh-character-data",
    schemaVersion: "0.1.0",
    systemPackage: structuredClone(input.candidate.document.systemPackage),
    character: {
      id: input.candidate.document.documentId,
      values,
    },
    cards: { instances: cards },
    compositeResources: {},
    embeddedResourceEntries,
    resourceSelections: {},
    playerImages,
    updatedAt: input.candidate.document.updatedAt,
  };
}

function snapshotCard(
  card: CardInstance,
  input: Parameters<typeof sheetCharacterToSave>[0],
): { resourceCopy: TabletopResourceCopy; assets: TabletopAsset[]; media: Map<string, Uint8Array> } {
  if (card.definitionRef.type === "resourceLibrary") {
    const embedded = input.data.embeddedResourceEntries[card.definitionRef.entryId];
    if (embedded?.resourceCopy) {
      return {
        resourceCopy: structuredClone(embedded.resourceCopy),
        assets: structuredClone(embedded.assets ?? []),
        media: new Map([...(embedded.media ?? new Map())].map(([assetId, bytes]) =>
          [assetId, new Uint8Array(bytes)])),
      };
    }
    const parsed = parseInstalledEntryId(card.definitionRef.entryId);
    if (!parsed) throw new Error(`桌面卡不是可保存的平台资源：${card.definitionRef.entryId}`);
    const installed = input.installedPackages.get(parsed.packageId);
    const resource = installed?.document.resources.find((candidate) => candidate.id === parsed.resourceId);
    if (!installed || !resource || !isRecord(resource.data)) {
      throw new Error(`桌面卡来源资源不可用：${card.definitionRef.entryId}`);
    }
    const assetIds = new Set(Object.values(resource.media));
    return {
      resourceCopy: {
        source: { packageId: parsed.packageId, resourceId: parsed.resourceId },
        template: structuredClone(resource.template),
        presentation: structuredClone(resource.presentation),
        data: structuredClone(resource.data),
        labels: [],
        media: structuredClone(resource.media),
      },
      assets: installed.document.assets.filter((asset) => assetIds.has(asset.id)),
      media: new Map([...installed.media].filter(([assetId]) => assetIds.has(assetId))),
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
    presentation: template.defaultPresentation,
    data: compositeData(compatibility.templateId, composite.fields),
    labels: [],
    media: compositeMedia(composite.fields),
  };
  const assetIds = new Set(Object.values(resourceCopy.media));
  const assets: TabletopAsset[] = [];
  const media = new Map<string, Uint8Array>();
  for (const installed of input.installedPackages.values()) {
    for (const asset of installed.document.assets) {
      if (!assetIds.has(asset.id) || assets.some((candidate) => candidate.id === asset.id)) continue;
      const bytes = installed.media.get(asset.id);
      if (!bytes) continue;
      assets.push(asset);
      media.set(asset.id, bytes);
    }
  }
  return { resourceCopy, assets, media };
}

function snapshotFromExisting(
  existing: CharacterSaveCandidate,
  resourceCopy: TabletopResourceCopy,
  assets: Map<string, TabletopAsset>,
  media: Map<string, Uint8Array>,
) {
  const ids = new Set(Object.values(resourceCopy.media));
  const selectedAssets = existing.document.characterData.assets.filter((asset) => ids.has(asset.id));
  const selectedMedia = new Map<string, Uint8Array>();
  for (const asset of selectedAssets) {
    const bytes = existing.media.get(asset.id);
    if (bytes) selectedMedia.set(asset.id, bytes);
  }
  for (const asset of selectedAssets) {
    const bytes = selectedMedia.get(asset.id);
    if (bytes) addAsset(assets, media, asset, bytes);
  }
  return { resourceCopy: structuredClone(resourceCopy), assets: selectedAssets, media: selectedMedia };
}

function compositeData(templateId: string, fields: Record<string, string>): Record<string, unknown> {
  if (templateId === "种族") {
    return {
      名称: [fields.种族A名称, fields.种族B名称].filter(Boolean).join(" / "),
      简介: "",
      特性: [
        { 名称: featureName(fields.特性A), 描述: fields.特性A ?? "" },
        { 名称: featureName(fields.特性B), 描述: fields.特性B ?? "" },
      ],
    };
  }
  return {
    名称: fields.名称 ?? "组合资源",
    类型: "自由资源",
    描述: Object.entries(fields).map(([key, value]) => `${key}：${value}`).join("\n"),
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

function parseIndicators(value: string | undefined): CardInstance["indicators"] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as CardInstance["indicators"] : [];
  } catch {
    return [];
  }
}

function addAsset(
  assets: Map<string, TabletopAsset>,
  media: Map<string, Uint8Array>,
  asset: TabletopAsset,
  bytes: Uint8Array,
) {
  assets.set(asset.id, structuredClone(asset));
  media.set(asset.id, new Uint8Array(bytes));
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
