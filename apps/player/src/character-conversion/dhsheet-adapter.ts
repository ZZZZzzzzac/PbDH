import { dhsheetToCanonical, reverseMap } from "./field-maps.ts";
import {
  characterDecoder,
  characterExportFailure,
  characterImportFailure,
  characterJsonArtifact,
  characterJsonValue,
  characterObject,
  characterReport,
  characterStem,
  characterText,
} from "./shared.ts";
import type { CharacterFormatAdapter, CharacterJsonObject } from "./types.ts";

const canonicalToDhsheet = reverseMap(dhsheetToCanonical);

function emptyArray(length: number, value: null | boolean | string): Array<null | boolean | string> {
  return Array.from({ length }, () => value);
}

export const dhsheetCharacterAdapter: CharacterFormatAdapter = {
  id: "dhsheet",
  import(input) {
    let raw: CharacterJsonObject | undefined;
    try {
      const text = characterDecoder.decode(input.bytes);
      const json = input.fileName.toLocaleLowerCase().endsWith(".html")
        ? text.slice(text.indexOf("window.characterData = ") + "window.characterData = ".length, text.indexOf("\n};") + 2)
        : text;
      raw = characterObject(JSON.parse(json));
    } catch {
      return characterImportFailure("dhsheet", "dhsheet.character.json-invalid", "dhsheet 人物卡无法解析。");
    }
    if (!raw || typeof raw.ruleSetId !== "string" || typeof raw.name !== "string") {
      return characterImportFailure("dhsheet", "dhsheet.character.mismatch", "所选文件不是 dhsheet 人物卡。 ");
    }
    const values: CharacterJsonObject = {};
    for (const [source, target] of Object.entries(dhsheetToCanonical)) {
      if (raw[source] !== undefined) values[target] = characterText(raw[source]);
    }
    const cards = Array.isArray(raw.cards) && characterJsonValue(raw.cards) ? raw.cards : [];
    return {
      ok: true,
      character: {
        name: raw.name,
        values,
        cards,
        sourceExtensions: { dhsheet: raw },
      },
      report: characterReport("dhsheet", "import"),
    };
  },
  export(character) {
    const native = characterObject(character.sourceExtensions.dhsheet);
    if (!native && character.cards.length > 0) {
      return characterExportFailure(
        "dhsheet",
        "conversion.decision-required",
        "非 dhsheet 来源卡牌尚未裁定如何映射为 StandardCard[20]。",
        "/cards",
      );
    }
    const output: CharacterJsonObject = native ? structuredClone(native) : {
      ruleSetId: "daggerheart",
      cards: emptyArray(20, null),
      inventory_cards: emptyArray(20, null),
      inventory: emptyArray(5, ""),
      gold: emptyArray(21, false),
      hp: emptyArray(18, false),
      stress: emptyArray(18, false),
      armorBoxes: emptyArray(12, false),
      experience: emptyArray(5, ""),
      experienceValues: emptyArray(5, ""),
      checkedUpgrades: { tier1: {}, tier2: {}, tier3: {} },
    };
    for (const [canonical, source] of Object.entries(canonicalToDhsheet)) {
      if (character.values[canonical] !== undefined) output[String(source)] = characterText(character.values[canonical]);
    }
    output.name = characterText(character.values["character-name"]) || character.name;
    if (native) output.cards = character.cards;
    return {
      ok: true,
      artifact: characterJsonArtifact(output, `${characterStem(character.name)}.json`),
      report: characterReport("dhsheet", "export"),
    };
  },
};
