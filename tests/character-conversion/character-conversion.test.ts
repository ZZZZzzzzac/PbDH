import { describe, expect, test } from "vitest";

import { characterConversionRegistry } from "../../apps/player/src/character-conversion/index.ts";
import type { CharacterJsonValue } from "../../apps/player/src/character-conversion/types.ts";
import { dhsheetCharacterEngineRead, zzzCharacterEngineRead } from "./upstream-engines.ts";

const encoder = new TextEncoder();

function jsonInput(value: CharacterJsonValue, fileName: string) {
  return { bytes: encoder.encode(JSON.stringify(value)), fileName };
}

const zzzCharacter = {
  NameTextbox: "啄页",
  RaceTextbox: "仙灵",
  CommunityTextbox: "荒野之民",
  ClassTextbox: "战士",
  LevelTextbox: "1",
  EvasionTextbox: "11",
  AgilityTextbox: "2",
  MajorTextbox: "8",
  SevereTextbox: "16",
  FutureTextbox: "上游新增字段",
  avatarImageSrc: "data:image/png;base64,iVBORw0KGgo=",
  cards: [{ data: { 名称: "勇气", 类型: "领域卡" }, position: { left: "10px", top: "20px" } }],
} satisfies CharacterJsonValue;

const emptyCards = Array.from({ length: 20 }, () => null);
const dhsheetCharacter = {
  ruleSetId: "daggerheart",
  name: "布罗克",
  level: "1",
  evasion: "10",
  agility: "1",
  minorThreshold: "7",
  majorThreshold: "14",
  futureField: { nested: "上游新增字段" },
  cards: emptyCards,
  inventory_cards: emptyCards,
  inventory: Array.from({ length: 5 }, () => ""),
  gold: Array.from({ length: 21 }, () => false),
  hp: Array.from({ length: 18 }, () => false),
  stress: Array.from({ length: 18 }, () => false),
  armorBoxes: Array.from({ length: 12 }, () => false),
  experience: Array.from({ length: 5 }, () => ""),
  experienceValues: Array.from({ length: 5 }, () => ""),
  checkedUpgrades: { tier1: {}, tier2: {}, tier3: {} },
} satisfies CharacterJsonValue;

describe("character format engines", () => {
  test("ZZZ import and export preserve fields, cards, layout, and images", () => {
    const imported = characterConversionRegistry.import("zzz", jsonInput(zzzCharacter, "啄页_匕首之心人物卡_zzz.json"));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("ZZZ import failed");
    const exported = characterConversionRegistry.export("zzz", imported.character);
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error("ZZZ export failed");
    expect(zzzCharacterEngineRead(exported.artifact.bytes)).toEqual(zzzCharacter);
  });

  test("dhsheet import and export preserve unknown future data", () => {
    const imported = characterConversionRegistry.import("dhsheet", jsonInput(dhsheetCharacter, "布罗克.json"));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("dhsheet import failed");
    const exported = characterConversionRegistry.export("dhsheet", imported.character);
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error("dhsheet export failed");
    expect(dhsheetCharacterEngineRead(exported.artifact.bytes)).toEqual(dhsheetCharacter);
  });

  test("a card-free ZZZ character can enter the dhsheet target engine", () => {
    const source = { ...zzzCharacter, cards: [] } satisfies CharacterJsonValue;
    const imported = characterConversionRegistry.import("zzz", jsonInput(source, "source.json"));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("ZZZ import failed");
    const exported = characterConversionRegistry.export("dhsheet", imported.character);
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error("dhsheet export failed");
    const read = dhsheetCharacterEngineRead(exported.artifact.bytes);
    expect(read).toMatchObject({ name: "啄页", level: "1", evasion: "11", agility: "2" });
  });

  test("cross-format card layout conversion is blocked until its loss policy is decided", () => {
    const imported = characterConversionRegistry.import("zzz", jsonInput(zzzCharacter, "source.json"));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("ZZZ import failed");
    const exported = characterConversionRegistry.export("dhsheet", imported.character);
    expect(exported.ok).toBe(false);
    expect(exported.report.diagnostics[0]?.code).toBe("conversion.decision-required");
  });

  test("explicit character source selection rejects a mismatched file", () => {
    const result = characterConversionRegistry.import("zzz", jsonInput(dhsheetCharacter, "wrong.json"));
    expect(result.ok).toBe(false);
    expect(result.report.diagnostics[0]?.code).toBe("zzz.character.mismatch");
  });
});
