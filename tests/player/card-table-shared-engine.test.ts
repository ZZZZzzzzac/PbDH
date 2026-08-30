import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";

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
  test("mounts the same shared React tabletop surface as GM", async () => {
    const player = await readFile("apps/player/src/sheet-runtime/rendering/CardTableModule.tsx", "utf8");
    const gm = await readFile("apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx", "utf8");

    expect(player).toContain('from "@pbdh/tabletop/react"');
    expect(player).toContain("<TabletopSurface");
    expect(gm).toContain("<TabletopSurface");
    expect(player).not.toContain("onPointerMove={continueDrag}");
  });

  test("uses the shared context-menu shell in Player and GM", async () => {
    const shared = await readFile("packages/tabletop/src/react/index.tsx", "utf8");
    const player = await readFile("apps/player/src/sheet-runtime/rendering/cardTable/CardActionSurfaces.tsx", "utf8");
    const gm = await readFile("apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx", "utf8");

    expect(shared).toContain("export function TabletopContextMenu");
    expect(player).toContain("<TabletopContextMenu");
    expect(gm).toContain("<TabletopContextMenu");
  });

  test("previews drag and scale directly without rerendering every card on each pointer event", async () => {
    const shared = await readFile("packages/tabletop/src/react/index.tsx", "utf8");

    expect(shared).toContain('style.setProperty("--tabletop-x"');
    expect(shared).toContain('style.setProperty("--tabletop-scale"');
    expect(shared).not.toContain("setDraftPositions");
    expect(shared).not.toContain("setDraftScales");
  });

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
