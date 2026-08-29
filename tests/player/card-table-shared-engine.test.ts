import { describe, expect, test } from "vitest";

import {
  bringCardInstanceToFront,
  flipCardInstance,
  rotateCardInstance,
  type CardInstance,
} from "../../apps/player/src/sheet-runtime/domain/cardEngine.ts";
import type { CharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";

function characterWithCards(cards: CardInstance[]): CharacterData {
  return {
    cards: { instances: cards },
    updatedAt: "2026-08-29T00:00:00.000Z",
  } as CharacterData;
}

function card(instanceId: string, zIndex: number): CardInstance {
  return {
    instanceId,
    tableModuleId: "cards",
    definitionRef: { type: "resourceLibrary", libraryId: "cards", entryId: instanceId },
    state: "",
    xPct: 0,
    yPct: 0,
    zIndex,
    face: "front",
    rotation: 0,
    scale: 1,
  };
}

describe("Player card table shared geometry", () => {
  test("uses the shared tabletop rules for layer, quarter rotation and flip", () => {
    const source = characterWithCards([card("first", 0), card("second", 1)]);
    const layered = bringCardInstanceToFront(source, "first");
    const rotated = rotateCardInstance(layered, "first", 5);
    const flipped = flipCardInstance(rotated, "first");

    expect(flipped.cards.instances.find((item) => item.instanceId === "first")).toMatchObject({
      zIndex: 1,
      rotation: 90,
      face: "back",
    });
  });
});
