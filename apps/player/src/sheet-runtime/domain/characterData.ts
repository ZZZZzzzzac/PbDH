import { z } from "zod";
import type { TabletopAsset, TabletopResourceCopy } from "@pbdh/contract-runtime";
import { type CardInstance } from "./cardEngine";
import type { CompositeResource } from "./resourceComposer";
import type { FormatDiagnostic } from "./formatAdapter";
import {
  findCardTableResourceLibrarySource,
  findResourceLibrary,
  getOtherResourceLibraries,
  type SystemPackage,
} from "./systemPackage";
import {
  findResourceLibraryEntry,
  resourceLibraryEntrySchema,
  type ResourceLibraryEntry,
} from "./resourceLibrary";
import { clampInt } from "../utils";

export const characterDataSchemaVersion = "0.1.0";

export type CheckboxState = Record<string, boolean>;
export type CountableState = { current: number; max: number | null };
export type PlayerImageValue = { kind: "player-image"; imageId: string };
export type SheetValue = string | CheckboxState | CountableState | PlayerImageValue;

export interface PlayerImageData {
  id: string;
  name?: string;
  mimeType: string;
  dataUrl: string;
  width?: number;
  height?: number;
}

export interface ResourceSelectionSnapshot {
  libraryId: string;
  entryIds: string[];
}

export interface CharacterData {
  kind: "pbdh-character-data";
  schemaVersion: typeof characterDataSchemaVersion;
  systemPackage: {
    id: string;
    version: string;
  };
  character: {
    id: string;
    values: Record<string, SheetValue>;
  };
  cards: {
    instances: CardInstance[];
  };
  compositeResources: Record<string, CompositeResource>;
  embeddedResourceEntries: Record<string, {
    libraryId: string;
    entry: ResourceLibraryEntry;
    resourceCopy?: TabletopResourceCopy;
    assets?: TabletopAsset[];
    media?: Map<string, Uint8Array>;
  }>;
  resourceSelections?: Record<string, ResourceSelectionSnapshot>;
  playerImages: Record<string, PlayerImageData>;
  updatedAt: string;
}

export const sheetValueSchema = z.union([
  z.string(),
  z.record(z.string(), z.boolean()),
  z.object({ current: z.number(), max: z.number().nullable() }),
  z.object({ kind: z.literal("player-image"), imageId: z.string().min(1) }),
]);

const cardInstanceSchema = z.object({
  instanceId: z.string().min(1),
  tableModuleId: z.string().min(1),
  definitionRef: z.discriminatedUnion("type", [
    z.object({ type: z.literal("resourceLibrary"), libraryId: z.string().min(1), entryId: z.string().min(1) }),
    z.object({ type: z.literal("compositeResource"), compositeResourceId: z.string().min(1) }),
  ]).optional(),
  libraryId: z.string().min(1).optional(),
  definitionId: z.string().min(1).optional(),
  state: z.string(),
  xPct: z.number(),
  yPct: z.number(),
  zIndex: z.number().int(),
  face: z.enum(["front", "back"]),
  rotation: z.number(),
  scale: z.number().positive(),
  indicators: z.union([
    z.array(z.object({
      indicatorId: z.string().min(1),
      colorIndex: z.number().int().min(0).max(9),
      value: z.number().int().min(0),
    })).max(10),
    z.record(z.string().min(1), z.number().int().min(0)),
  ]).default([]),
  tokenCount: z.number().int().min(0).optional(),
}).refine((instance) => Boolean(instance.definitionRef || (instance.libraryId && instance.definitionId)), {
  message: "Card Instance 必须提供 Definition Reference。",
});

const compositeResourceSchema = z.object({
  ID: z.string().min(1),
  composerModuleId: z.string().min(1),
  fields: z.record(z.string(), z.string()),
  resourceCopy: z.custom<TabletopResourceCopy>().optional(),
});

const resourceSelectionSnapshotSchema = z.object({
  libraryId: z.string().min(1),
  entryIds: z.array(z.string().min(1)).min(1),
});

const playerImageDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  mimeType: z.string().min(1),
  dataUrl: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const characterDataSchema = z.object({
  kind: z.literal("pbdh-character-data"),
  schemaVersion: z.literal(characterDataSchemaVersion),
  systemPackage: z.object({
    id: z.string().min(1),
    version: z.string().min(1),
  }),
  character: z.object({
    id: z.string().min(1),
    values: z.record(z.string().min(1), sheetValueSchema),
  }),
  cards: z
    .object({
      instances: z.array(cardInstanceSchema),
    })
    .default({ instances: [] }),
  compositeResources: z.record(z.string().min(1), compositeResourceSchema).default({}),
  embeddedResourceEntries: z.record(z.string().min(1), z.object({
    libraryId: z.string().min(1),
    entry: resourceLibraryEntrySchema,
    resourceCopy: z.custom<TabletopResourceCopy>().optional(),
    assets: z.array(z.custom<TabletopAsset>()).optional(),
    media: z.map(z.string(), z.custom<Uint8Array>((value) => value instanceof Uint8Array)).optional(),
  })).default({}),
  resourceSelections: z.record(z.string().min(1), resourceSelectionSnapshotSchema).default({}),
  playerImages: z.record(z.string().min(1), playerImageDataSchema).default({}),
  updatedAt: z.string().min(1),
});

const characterDataImportSchema = z.object({
  kind: z.literal("pbdh-character-data"),
  schemaVersion: z.literal(characterDataSchemaVersion),
  systemPackage: z.object({ id: z.string().min(1), version: z.string().min(1) }),
  character: z.object({ id: z.string().min(1), values: z.record(z.string().min(1), z.unknown()) }),
  cards: z.object({ instances: z.array(z.unknown()) }).default({ instances: [] }),
  compositeResources: z.record(z.string().min(1), z.unknown()).default({}),
  embeddedResourceEntries: z.record(z.string().min(1), z.unknown()).default({}),
  resourceSelections: z.record(z.string().min(1), z.unknown()).default({}),
  playerImages: z.record(z.string().min(1), z.unknown()).default({}),
  updatedAt: z.string().min(1),
});

export interface CharacterConversionReport {
  convertedFields: number;
  skippedFields: number;
  matchedCards: number;
  skippedCards: number;
  convertedImages: number;
  skippedImages: number;
  diagnostics: FormatDiagnostic[];
}

export type CharacterImportResult =
  | { ok: true; data: CharacterData; report: CharacterConversionReport }
  | { ok: false; error: string };

export function createEmptyCharacterData(systemPackage: SystemPackage, characterId = createCharacterId()): CharacterData {
  return {
    kind: "pbdh-character-data",
    schemaVersion: characterDataSchemaVersion,
    systemPackage: {
      id: systemPackage.manifest.ID,
      version: systemPackage.manifest.版本,
    },
    character: {
      id: characterId,
      values: seedDefaultModuleValues(systemPackage),
    },
    cards: {
      instances: [],
    },
    compositeResources: {},
    embeddedResourceEntries: {},
    resourceSelections: {},
    playerImages: {},
    updatedAt: new Date().toISOString(),
  };
}

export function createCharacterId(): string {
  return crypto.randomUUID();
}

function seedDefaultModuleValues(systemPackage: SystemPackage): Record<string, SheetValue> {
  const values: Record<string, SheetValue> = {};

  for (const module of systemPackage.modules) {
    switch (module.类型) {
      case "freeText":
      case "longText":
        values[module.ID] = module.默认值 ?? "";
        break;
      case "checkboxResource":
        values[module.ID] = Object.fromEntries(
          module.选项.map((option) => [option.ID, option.默认选中 ?? false] as const),
        );
        break;
      case "countableResource": {
        const min = module.最小值 ?? 0;
        const max = module.最大值 ?? null;
        const defaultValue = module.默认值 ?? min;
        values[module.ID] = { current: clampInt(defaultValue, min, max), max };
        break;
      }
      case "readOnlyDisplay":
      case "imageField":
      case "cardTable":
      case "resourcePicker":
        break;
    }
  }

  return values;
}

export function updateCharacterValue(data: CharacterData, moduleId: string, value: SheetValue): CharacterData {
  return {
    ...data,
    character: {
      ...data.character,
      values: {
        ...data.character.values,
        [moduleId]: value,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

export function updatePlayerImage(data: CharacterData, moduleId: string, image: PlayerImageData): CharacterData {
  const previousValue = data.character.values[moduleId];
  const previousImageId = isPlayerImageValue(previousValue) ? previousValue.imageId : undefined;
  const playerImages = { ...data.playerImages };
  if (previousImageId) delete playerImages[previousImageId];

  return {
    ...updateCharacterValue(data, moduleId, { kind: "player-image", imageId: image.id }),
    playerImages: {
      ...playerImages,
      [image.id]: image,
    },
  };
}

export function removePlayerImage(data: CharacterData, moduleId: string): CharacterData {
  const value = data.character.values[moduleId];
  if (!isPlayerImageValue(value)) return data;

  const values = { ...data.character.values };
  const playerImages = { ...data.playerImages };
  delete values[moduleId];
  delete playerImages[value.imageId];

  return {
    ...data,
    character: { ...data.character, values },
    playerImages,
    updatedAt: new Date().toISOString(),
  };
}

function isPlayerImageValue(value: unknown): value is PlayerImageValue {
  return typeof value === "object" && value !== null && "kind" in value && (value as PlayerImageValue).kind === "player-image";
}

export function exportCharacterData(data: CharacterData): string {
  const { playerImages, ...readableData } = data;
  return JSON.stringify({ ...readableData, playerImages }, null, 2);
}

export function parseCharacterDataJson(text: string, currentPackage: SystemPackage): CharacterImportResult {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(text);
  } catch {
    return { ok: false, error: "导入失败：Character JSON 格式错误。" };
  }

  const parsed = characterDataImportSchema.safeParse(parsedJson);

  if (!parsed.success) {
    return {
      ok: false,
      error: "导入失败：文件不是有效的 Character Data。",
    };
  }

  if (parsed.data.systemPackage.id !== currentPackage.manifest.ID) {
    return {
      ok: false,
      error: "导入失败：Character Data 不属于当前 System Package。",
    };
  }

  return projectCharacterData(parsed.data, currentPackage);
}

function projectCharacterData(
  source: z.infer<typeof characterDataImportSchema>,
  currentPackage: SystemPackage,
): Extract<CharacterImportResult, { ok: true }> {
  const data = createEmptyCharacterData(currentPackage);
  const diagnostics: FormatDiagnostic[] = [];
  const modules = new Map(currentPackage.modules.map((module) => [module.ID, module]));
  const values = { ...data.character.values };
  const playerImages: Record<string, PlayerImageData> = {};
  const referencedImageIds = new Set<string>();
  let convertedFields = 0;
  let skippedFields = 0;
  let convertedImages = 0;
  let skippedImages = 0;

  for (const [moduleId, value] of Object.entries(source.character.values)) {
    const module = modules.get(moduleId);
    if (!module) {
      skippedFields += 1;
      diagnostics.push(importWarning(
        "CHARACTER_DATA_MODULE_MISSING",
        `Module「${moduleId}」在当前 System Package 中不存在，已跳过。`,
        `character.values.${moduleId}`,
      ));
      continue;
    }
    if (module.类型 === "imageField") {
      const imageValue = playerImageValueSchema.safeParse(value);
      if (imageValue.success) referencedImageIds.add(imageValue.data.imageId);
      const image = imageValue.success
        ? playerImageDataSchema.safeParse(source.playerImages[imageValue.data.imageId])
        : undefined;
      if (!imageValue.success || !image?.success || image.data.id !== imageValue.data.imageId
        || !isImageDataUrl(image.data.dataUrl) || !image.data.mimeType.startsWith("image/")) {
        skippedImages += 1;
        diagnostics.push(importWarning(
          "CHARACTER_DATA_IMAGE_INVALID",
          `Player Image「${moduleId}」在当前 System Package 中无法合法使用，已跳过。`,
          `character.values.${moduleId}`,
        ));
        continue;
      }
      values[moduleId] = imageValue.data;
      playerImages[image.data.id] = image.data;
      convertedImages += 1;
      continue;
    }
    if (!valueMatchesCurrentModule(value, module)) {
      skippedFields += 1;
      diagnostics.push(importWarning(
        "CHARACTER_DATA_VALUE_INCOMPATIBLE",
        `Module「${moduleId}」无法合法使用来源值，已改用当前默认值。`,
        `character.values.${moduleId}`,
      ));
      continue;
    }
    values[moduleId] = value;
    convertedFields += 1;
  }

  for (const imageId of Object.keys(source.playerImages)) {
    if (playerImages[imageId] || referencedImageIds.has(imageId)) continue;
    skippedImages += 1;
    diagnostics.push(importWarning(
      "CHARACTER_DATA_IMAGE_ORPHANED",
      `Player Image「${imageId}」没有可用的 Image Field 引用，已跳过。`,
      `playerImages.${imageId}`,
    ));
  }

  const compositeResources = projectCompositeResources(source.compositeResources, currentPackage, diagnostics);
  const resourceSelections = projectResourceSelections(source.resourceSelections, currentPackage, diagnostics);
  const cards = projectCards(source.cards.instances, currentPackage, compositeResources, diagnostics);

  return {
    ok: true,
    data: {
      ...data,
      character: { ...data.character, values },
      cards: { instances: cards.instances },
      compositeResources,
      embeddedResourceEntries: {},
      resourceSelections,
      playerImages,
      updatedAt: new Date().toISOString(),
    },
    report: {
      convertedFields,
      skippedFields,
      matchedCards: cards.instances.length,
      skippedCards: cards.skipped,
      convertedImages,
      skippedImages,
      diagnostics,
    },
  };
}

const playerImageValueSchema = z.object({
  kind: z.literal("player-image"),
  imageId: z.string().min(1),
});

function valueMatchesCurrentModule(
  value: unknown,
  module: SystemPackage["modules"][number],
): value is SheetValue {
  if (module.类型 === "freeText" || module.类型 === "longText") return typeof value === "string";
  if (!isRecord(value)) return false;
  if (module.类型 === "checkboxResource") {
    const optionIds = new Set(module.选项.map((option) => option.ID));
    return Object.entries(value).every(([id, selected]) => optionIds.has(id) && typeof selected === "boolean");
  }
  if (module.类型 === "countableResource") {
    if (Object.keys(value).some((key) => key !== "current" && key !== "max")) return false;
    const current = value.current;
    const max = value.max;
    const min = module.最小值 ?? 0;
    if (typeof current !== "number" || !Number.isInteger(current) || current < min) return false;
    if (max !== null && (typeof max !== "number" || !Number.isInteger(max) || max < current)) return false;
    return module.最大值可改 === true ? true : max === (module.最大值 ?? null);
  }
  return false;
}

function projectCompositeResources(
  source: Record<string, unknown>,
  currentPackage: SystemPackage,
  diagnostics: FormatDiagnostic[],
): Record<string, CompositeResource> {
  const result: Record<string, CompositeResource> = {};
  for (const [key, raw] of Object.entries(source)) {
    const parsed = compositeResourceSchema.safeParse(raw);
    const composer = parsed.success
      ? currentPackage.modules.find((module) => module.ID === parsed.data.composerModuleId && module.类型 === "resourceComposer")
      : undefined;
    const expectedFields = composer?.类型 === "resourceComposer"
      ? new Set(["ID", ...composer.输出字段.map((mapping) => mapping.字段), ...(composer.选择关系输出 ? [composer.选择关系输出.字段] : [])])
      : undefined;
    const actualFields = parsed.success ? Object.keys(parsed.data.fields) : [];
    const compatible = parsed.success && composer?.类型 === "resourceComposer"
      && key === parsed.data.ID && parsed.data.ID === `composite:${composer.ID}`
      && parsed.data.fields.ID === parsed.data.ID
      && expectedFields?.size === actualFields.length
      && actualFields.every((field) => expectedFields.has(field));
    if (!compatible) {
      diagnostics.push(importWarning(
        "CHARACTER_DATA_COMPOSITE_INCOMPATIBLE",
        `Composite Resource「${key}」不符合当前 Resource Composer，已跳过。`,
        `compositeResources.${key}`,
      ));
      continue;
    }
    result[key] = parsed.data;
  }
  return result;
}

function projectResourceSelections(
  source: Record<string, unknown>,
  currentPackage: SystemPackage,
  diagnostics: FormatDiagnostic[],
): Record<string, ResourceSelectionSnapshot> {
  const result: Record<string, ResourceSelectionSnapshot> = {};
  for (const [moduleId, raw] of Object.entries(source)) {
    const parsed = resourceSelectionSnapshotSchema.safeParse(raw);
    const module = currentPackage.modules.find((candidate) => candidate.ID === moduleId);
    const library = parsed.success ? findResourceLibrary(currentPackage, parsed.data.libraryId) : undefined;
    const libraryAllowed = parsed.success && module?.类型 === "resourcePicker" && library
      ? module.资源库 === "其他"
        ? getOtherResourceLibraries(currentPackage).some((candidate) => candidate.ID === library.ID)
        : module.资源库.some((link) => link.ID === library.ID)
      : false;
    const entries = parsed.success && library
      ? parsed.data.entryIds.map((entryId) => findResourceLibraryEntry(library, entryId))
      : [];
    if (!parsed.success || !libraryAllowed || entries.some((entry) => !entry)
      || new Set(entries.map((entry) => entry?.ID)).size !== entries.length) {
      diagnostics.push(importWarning(
        "CHARACTER_DATA_SELECTION_INCOMPATIBLE",
        `Derived Source Snapshot「${moduleId}」不符合当前 Resource Picker，已跳过。`,
        `resourceSelections.${moduleId}`,
      ));
      continue;
    }
    result[moduleId] = { libraryId: library!.ID, entryIds: entries.map((entry) => entry!.ID) };
  }
  return result;
}

function projectCards(
  source: unknown[],
  currentPackage: SystemPackage,
  compositeResources: Record<string, CompositeResource>,
  diagnostics: FormatDiagnostic[],
): { instances: CardInstance[]; skipped: number } {
  const instances: CardInstance[] = [];
  const instanceIds = new Set<string>();
  let skipped = 0;
  for (const [index, raw] of source.entries()) {
    const parsed = cardInstanceSchema.safeParse(raw);
    if (!parsed.success) {
      skipped += 1;
      diagnostics.push(importWarning("CHARACTER_DATA_CARD_INVALID", `第 ${index + 1} 张 Card 数据无效，已跳过。`, `cards.instances.${index}`));
      continue;
    }
    const normalized = normalizeCardInstance(parsed.data);
    if (instanceIds.has(normalized.instanceId)) {
      skipped += 1;
      diagnostics.push(importWarning("CHARACTER_DATA_CARD_DUPLICATE", `Card Instance ID「${normalized.instanceId}」重复，已跳过。`, `cards.instances.${index}`));
      continue;
    }
    const table = currentPackage.modules.find((module) => module.ID === normalized.tableModuleId);
    if (table?.类型 !== "cardTable") {
      skipped += 1;
      diagnostics.push(importWarning("CHARACTER_DATA_CARD_TABLE_INVALID", `Card「${normalized.instanceId}」的 Card Table 不存在，已跳过。`, `cards.instances.${index}.tableModuleId`));
      continue;
    }

    let definitionRef = normalized.definitionRef;
    if (definitionRef.type === "resourceLibrary") {
      const library = findResourceLibrary(currentPackage, definitionRef.libraryId);
      const entry = findResourceLibraryEntry(library, definitionRef.entryId);
      if (!library || !entry || !findCardTableResourceLibrarySource(currentPackage, table, library.ID)) {
        skipped += 1;
        diagnostics.push(importWarning("CHARACTER_DATA_CARD_RESOURCE_MISSING", `Card「${normalized.instanceId}」的 Resource Entry 或资源来源不可用，已跳过。`, `cards.instances.${index}.definitionRef`));
        continue;
      }
      definitionRef = { ...definitionRef, entryId: entry.ID };
    } else {
      const composite = compositeResources[definitionRef.compositeResourceId];
      const sourceAllowed = composite && table.资源来源.some((sourceItem) => sourceItem.类型 === "resourceComposer" && sourceItem.ID === composite.composerModuleId);
      if (!composite || !sourceAllowed) {
        skipped += 1;
        diagnostics.push(importWarning("CHARACTER_DATA_CARD_RESOURCE_MISSING", `Card「${normalized.instanceId}」的 Composite Resource 不可用，已跳过。`, `cards.instances.${index}.definitionRef`));
        continue;
      }
    }

    const stateOptions = table.状态选项 ?? [];
    const stateValid = stateOptions.length === 0 ? normalized.state === "" : stateOptions.includes(normalized.state);
    const state = stateValid ? normalized.state : stateOptions[0] ?? "";
    if (!stateValid) {
      diagnostics.push(importWarning("CHARACTER_DATA_CARD_STATE_RESET", `Card「${normalized.instanceId}」的状态在当前 Card Table 中不可用，已重置为「${state}」。`, `cards.instances.${index}.state`));
    }
    instanceIds.add(normalized.instanceId);
    instances.push({ ...normalized, definitionRef, state });
  }
  return { instances, skipped };
}

function normalizeCardInstance(instance: z.infer<typeof cardInstanceSchema>): CardInstance {
  const definitionRef = instance.definitionRef ?? {
    type: "resourceLibrary" as const,
    libraryId: instance.libraryId!,
    entryId: instance.definitionId!,
  };
  const { libraryId: _libraryId, definitionId: _definitionId, ...current } = instance;
  return { ...current, definitionRef };
}

function importWarning(code: string, text: string, path: string): FormatDiagnostic {
  return { level: "warning", code, text, path };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isImageDataUrl(value: string): boolean {
  return /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=\s]+$/iu.test(value);
}

export function updateResourceSelectionSnapshot(
  data: CharacterData,
  moduleId: string,
  libraryId: string,
  entryIds: string[],
): CharacterData {
  if (entryIds.length === 0) return data;
  return {
    ...data,
    resourceSelections: {
      ...(data.resourceSelections ?? {}),
      [moduleId]: { libraryId, entryIds },
    },
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeCharacterData(data: z.infer<typeof characterDataSchema>): CharacterData {
  return {
    ...data,
    cards: {
      instances: data.cards.instances.map((instance) => {
        const definitionRef = instance.definitionRef ?? (instance.libraryId && instance.definitionId
          ? { type: "resourceLibrary" as const, libraryId: instance.libraryId, entryId: instance.definitionId }
          : undefined);
        if (!definitionRef) throw new Error(`Card Instance ${instance.instanceId} 缺少 Definition Reference。`);
        const { libraryId: _libraryId, definitionId: _definitionId, ...current } = instance;
        return { ...current, definitionRef };
      }),
    },
  };
}

export function migrateCharacterResourceReferences(data: CharacterData, systemPackage: SystemPackage): CharacterData {
  return {
    ...data,
    cards: {
      instances: data.cards.instances.map((instance) => {
        if (instance.definitionRef.type !== "resourceLibrary") return instance;
        const entry = findResourceLibraryEntry(findResourceLibrary(systemPackage, instance.definitionRef.libraryId), instance.definitionRef.entryId);
        if (!entry || entry.ID === instance.definitionRef.entryId) return instance;
        return { ...instance, definitionRef: { ...instance.definitionRef, entryId: entry.ID } };
      }),
    },
    resourceSelections: Object.fromEntries(Object.entries(data.resourceSelections ?? {}).map(([moduleId, snapshot]) => {
      const library = findResourceLibrary(systemPackage, snapshot.libraryId);
      return [moduleId, {
        ...snapshot,
        entryIds: snapshot.entryIds.map((entryId) => findResourceLibraryEntry(library, entryId)?.ID ?? entryId),
      }];
    })),
  };
}
