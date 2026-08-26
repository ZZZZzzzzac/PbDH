import type { CharacterData } from "./characterData";
import { transitionCountableState, type CountableDirection } from "./countableState";

export type CardFace = "front" | "back";
export type ResourceDefinitionRef =
  | { type: "resourceLibrary"; libraryId: string; entryId: string }
  | { type: "compositeResource"; compositeResourceId: string };
export const maxCardIndicators = 10;

export interface CardIndicator {
  indicatorId: string;
  colorIndex: number;
  value: number;
}

export type CardIndicatorState = CardIndicator[] | Record<string, number>;

export interface CardInstance {
  instanceId: string;
  tableModuleId: string;
  definitionRef: ResourceDefinitionRef;
  state: string;
  xPct: number;
  yPct: number;
  zIndex: number;
  face: CardFace;
  rotation: number;
  scale: number;
  /** Record form is accepted only for saves created by the earlier Author-typed indicator prototype. */
  indicators?: CardIndicatorState;
}

export interface CreateCardInstanceInput {
  instanceId: string;
  tableModuleId: string;
  definitionRef?: ResourceDefinitionRef;
  libraryId?: string;
  definitionId?: string;
  state?: string;
}

export interface CardTableLayout {
  surfaceWidthPx: number;
  cardWidthPx: number;
  cardHeightPx: number;
  surfaceHeightPx: number;
  columns: number;
  insetXPct: number;
  insetYPct: number;
  stepXPct: number;
  stepYPct: number;
}

export interface CardTableLayoutInput {
  surfaceWidthPx: number;
  cardCount: number;
  preferredCardWidthPx?: number;
  minSurfaceHeightPx?: number;
}

const cardAspectHeightPerWidth = 88 / 63;
export const defaultCardWidthPx = 250;
export const minCardWidthPx = 140;
export const maxCardWidthPx = 320;
const defaultCardGapPx = 16;
const defaultCardInsetPx = 16;
const defaultCardSurfaceHeightPx = 520;

const defaultCardGridColumns = 5;
const defaultCardInsetXPct = 4;
const defaultCardInsetYPct = 6;
const defaultCardStepXPct = 18;
const defaultCardStepYPct = 24;

export function defaultCardPosition(index: number): { xPct: number; yPct: number } {
  return {
    xPct: defaultCardInsetXPct + (index % defaultCardGridColumns) * defaultCardStepXPct,
    yPct: defaultCardInsetYPct + Math.floor(index / defaultCardGridColumns) * defaultCardStepYPct,
  };
}

export function createCardInstance(data: CharacterData, input: CreateCardInstanceInput): CharacterData {
  if (!input.definitionRef && (!input.libraryId || !input.definitionId)) {
    throw new Error("Card Instance requires a Resource Definition Reference.");
  }
  const definitionRef = input.definitionRef ?? {
    type: "resourceLibrary" as const,
    libraryId: input.libraryId ?? "",
    entryId: input.definitionId ?? "",
  };
  const siblingCount = data.cards.instances.filter((instance) => instance.tableModuleId === input.tableModuleId).length;
  const instance: CardInstance = {
    instanceId: input.instanceId,
    tableModuleId: input.tableModuleId,
    definitionRef,
    state: input.state ?? "",
    ...defaultCardPosition(siblingCount),
    zIndex: nextZIndex(data.cards.instances),
    face: "front",
    rotation: 0,
    scale: 1,
    indicators: [],
  };

  return updateCardInstances(data, [...data.cards.instances, instance]);
}

export function updateCardInstancePosition(data: CharacterData, instanceId: string, xPct: number, yPct: number): CharacterData {
  return updateCardInstances(
    data,
    data.cards.instances.map((instance) =>
      instance.instanceId === instanceId ? { ...instance, xPct: clampPct(xPct), yPct: clampPct(yPct), zIndex: nextZIndex(data.cards.instances) } : instance,
    ),
  );
}

export function bringCardInstanceToFront(data: CharacterData, instanceId: string): CharacterData {
  return updateCardInstances(
    data,
    data.cards.instances.map((instance) =>
      instance.instanceId === instanceId ? { ...instance, zIndex: nextZIndex(data.cards.instances) } : instance,
    ),
  );
}

export function updateCardInstanceState(data: CharacterData, instanceId: string, state: string): CharacterData {
  return updateCardInstances(
    data,
    data.cards.instances.map((instance) => (instance.instanceId === instanceId ? { ...instance, state } : instance)),
  );
}

export function flipCardInstance(data: CharacterData, instanceId: string): CharacterData {
  return updateCardInstances(
    data,
    data.cards.instances.map((instance) =>
      instance.instanceId === instanceId ? { ...instance, face: instance.face === "front" ? "back" : "front" } : instance,
    ),
  );
}

export function rotateCardInstance(data: CharacterData, instanceId: string, quarterTurns: number): CharacterData {
  return updateCardInstances(
    data,
    data.cards.instances.map((instance) =>
      instance.instanceId === instanceId ? { ...instance, rotation: normalizeRotation(instance.rotation + quarterTurns * 90) } : instance,
    ),
  );
}

export function setCardInstanceUpright(data: CharacterData, instanceId: string): CharacterData {
  return updateCardInstances(
    data,
    data.cards.instances.map((instance) => instance.instanceId === instanceId ? { ...instance, rotation: 0 } : instance),
  );
}

export function addCardIndicator(data: CharacterData, instanceId: string, indicatorId: string): CharacterData {
  return updateCardInstances(
    data,
    data.cards.instances.map((instance) => {
      if (instance.instanceId !== instanceId) return instance;
      const indicators = readCardIndicators(instance);
      if (indicators.length >= maxCardIndicators) return instance;
      const usedColors = new Set(indicators.map((indicator) => indicator.colorIndex));
      const colorIndex = Array.from({ length: maxCardIndicators }, (_unused, index) => index).find((index) => !usedColors.has(index)) ?? indicators.length;
      return { ...instance, indicators: [...indicators, { indicatorId, colorIndex, value: 0 }] };
    }),
  );
}

export function transitionCardIndicator(
  data: CharacterData,
  instanceId: string,
  indicatorId: string,
  direction: CountableDirection,
): CharacterData {
  return updateCardInstances(
    data,
    data.cards.instances.map((instance) => {
      if (instance.instanceId !== instanceId) {
        return instance;
      }
      const indicators = readCardIndicators(instance);
      const target = indicators.find((indicator) => indicator.indicatorId === indicatorId);
      if (!target) return instance;
      if (direction === "decrement" && target.value === 0) {
        return { ...instance, indicators: indicators.filter((indicator) => indicator.indicatorId !== indicatorId) };
      }
      const next = transitionCountableState(
        { current: target.value, max: null },
        { min: 0, step: 1, editableMax: false },
        "current",
        direction,
      );
      return {
        ...instance,
        indicators: indicators.map((indicator) => indicator.indicatorId === indicatorId ? { ...indicator, value: next.current } : indicator),
      };
    }),
  );
}

export function readCardIndicators(instance: Pick<CardInstance, "indicators">): CardIndicator[] {
  if (Array.isArray(instance.indicators)) return instance.indicators;
  return Object.entries(instance.indicators ?? {}).slice(0, maxCardIndicators).map(([indicatorId, value], colorIndex) => ({
    indicatorId,
    colorIndex,
    value,
  }));
}

function normalizeRotation(rotation: number): number {
  return ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
}

export function createCardTableLayout(input: CardTableLayoutInput): CardTableLayout {
  const surfaceWidthPx = Number.isFinite(input.surfaceWidthPx) && input.surfaceWidthPx > 0 ? input.surfaceWidthPx : 800;
  const surfaceMaxCardWidthPx = Math.max(minCardWidthPx, surfaceWidthPx - defaultCardInsetPx * 2);
  const preferredCardWidthPx = clampCardWidth(input.preferredCardWidthPx ?? defaultCardWidthPx);
  const cardWidthPx = Math.min(preferredCardWidthPx, surfaceMaxCardWidthPx);
  const cardHeightPx = cardWidthPx * cardAspectHeightPerWidth;
  const usableWidthPx = Math.max(cardWidthPx, surfaceWidthPx - defaultCardInsetPx * 2);
  const columns = Math.max(1, Math.floor((usableWidthPx + defaultCardGapPx) / (cardWidthPx + defaultCardGapPx)));
  const rows = Math.max(1, Math.ceil(Math.max(0, input.cardCount) / columns));
  const surfaceHeightPx = Math.max(
    defaultCardSurfaceHeightPx,
    input.minSurfaceHeightPx ?? 0,
    defaultCardInsetPx * 2 + rows * cardHeightPx + Math.max(0, rows - 1) * defaultCardGapPx,
  );

  return {
    surfaceWidthPx,
    cardWidthPx,
    cardHeightPx,
    surfaceHeightPx,
    columns,
    insetXPct: (defaultCardInsetPx / surfaceWidthPx) * 100,
    insetYPct: (defaultCardInsetPx / surfaceHeightPx) * 100,
    stepXPct: ((cardWidthPx + defaultCardGapPx) / surfaceWidthPx) * 100,
    stepYPct: ((cardHeightPx + defaultCardGapPx) / surfaceHeightPx) * 100,
  };
}

export function clampCardTablePosition(layout: CardTableLayout, xPct: number, yPct: number): { xPct: number; yPct: number } {
  const maxXPct = 100 - (layout.cardWidthPx / layout.surfaceWidthPx) * 100;
  const maxYPct = 100 - (layout.cardHeightPx / layout.surfaceHeightPx) * 100;

  return {
    xPct: clampPctRange(xPct, 0, maxXPct),
    yPct: clampPctRange(yPct, 0, maxYPct),
  };
}

export function clampCardWidth(value: number): number {
  if (!Number.isFinite(value)) {
    return defaultCardWidthPx;
  }
  return Math.min(maxCardWidthPx, Math.max(minCardWidthPx, Math.round(value)));
}

export function tidyCardTable(data: CharacterData, tableModuleId: string, layout: CardTableLayout): CharacterData {
  let tableIndex = 0;

  return updateCardInstances(
    data,
    data.cards.instances.map((instance) => {
      if (instance.tableModuleId !== tableModuleId) {
        return instance;
      }

      const next = {
        ...instance,
        xPct: layout.insetXPct + (tableIndex % layout.columns) * layout.stepXPct,
        yPct: layout.insetYPct + Math.floor(tableIndex / layout.columns) * layout.stepYPct,
        zIndex: tableIndex + 1,
        rotation: 0,
      };
      tableIndex += 1;
      return next;
    }),
  );
}

export function placeCardInstancesInNextTidySlots(
  data: CharacterData,
  tableModuleId: string,
  instanceIds: string[],
  layout: CardTableLayout,
): CharacterData {
  const targetIds = new Set(instanceIds);
  let tableIndex = 0;

  return updateCardInstances(
    data,
    data.cards.instances.map((instance) => {
      if (instance.tableModuleId !== tableModuleId) return instance;
      const instanceIndex = tableIndex;
      tableIndex += 1;
      if (!targetIds.has(instance.instanceId)) return instance;
      return {
        ...instance,
        xPct: layout.insetXPct + (instanceIndex % layout.columns) * layout.stepXPct,
        yPct: layout.insetYPct + Math.floor(instanceIndex / layout.columns) * layout.stepYPct,
      };
    }),
  );
}

export interface CardLayoutSnapshotEntry {
  instanceId: string;
  xPct: number;
  yPct: number;
  zIndex: number;
  rotation: number;
}

export function restoreCardTableLayout(
  data: CharacterData,
  tableModuleId: string,
  snapshot: CardLayoutSnapshotEntry[],
): CharacterData {
  const savedById = new Map(snapshot.map((card) => [card.instanceId, card]));
  return updateCardInstances(
    data,
    data.cards.instances.map((instance) => {
      if (instance.tableModuleId !== tableModuleId) return instance;
      const saved = savedById.get(instance.instanceId);
      if (!saved) return instance;
      return {
        ...instance,
        xPct: saved.xPct,
        yPct: saved.yPct,
        zIndex: saved.zIndex,
        rotation: saved.rotation,
      };
    }),
  );
}

export function deleteCardInstance(data: CharacterData, instanceId: string): CharacterData {
  return updateCardInstances(
    data,
    data.cards.instances.filter((instance) => instance.instanceId !== instanceId),
  );
}

function nextZIndex(instances: CardInstance[]): number {
  return Math.max(0, ...instances.map((instance) => instance.zIndex)) + 1;
}

function clampPct(value: number): number {
  return Math.min(96, Math.max(0, Number.isFinite(value) ? value : 0));
}

function clampPctRange(value: number, min: number, max: number): number {
  const safeValue = Number.isFinite(value) ? value : min;
  const safeMax = Math.max(min, Number.isFinite(max) ? max : min);
  return Math.min(safeMax, Math.max(min, safeValue));
}

function updateCardInstances(data: CharacterData, instances: CardInstance[]): CharacterData {
  return {
    ...data,
    cards: {
      ...data.cards,
      instances,
    },
    updatedAt: new Date().toISOString(),
  };
}
