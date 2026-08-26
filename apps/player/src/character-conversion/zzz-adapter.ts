import { reverseMap, zzzToCanonical } from "./field-maps.ts";
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

const canonicalToZzz = reverseMap(zzzToCanonical);

export const zzzCharacterAdapter: CharacterFormatAdapter = {
  id: "zzz",
  import(input) {
    let raw: CharacterJsonObject | undefined;
    try {
      raw = characterObject(JSON.parse(characterDecoder.decode(input.bytes)));
    } catch {
      return characterImportFailure("zzz", "zzz.character.json-invalid", "ZZZ 人物卡 JSON 无法解析。");
    }
    if (!raw || typeof raw.NameTextbox !== "string" || !Array.isArray(raw.cards)) {
      return characterImportFailure("zzz", "zzz.character.mismatch", "所选文件不是 ZZZ 人物卡。 ");
    }
    const values: CharacterJsonObject = {};
    for (const [source, target] of Object.entries(zzzToCanonical)) {
      if (raw[source] !== undefined) values[target] = characterText(raw[source]);
    }
    const character = {
      name: characterText(raw.NameTextbox) || "未命名角色",
      values,
      cards: characterJsonValue(raw.cards) ? raw.cards : [],
      sourceExtensions: { zzz: raw },
    };
    return { ok: true, character, report: characterReport("zzz", "import") };
  },
  export(character) {
    const native = characterObject(character.sourceExtensions.zzz);
    if (!native && character.cards.length > 0) {
      return characterExportFailure(
        "zzz",
        "conversion.decision-required",
        "非 ZZZ 来源卡牌尚未裁定如何映射为 {data, position}。",
        "/cards",
      );
    }
    const output: CharacterJsonObject = native ? structuredClone(native) : { cards: [] };
    for (const [canonical, source] of Object.entries(canonicalToZzz)) {
      if (character.values[canonical] !== undefined) output[String(source)] = characterText(character.values[canonical]);
    }
    output.NameTextbox = characterText(character.values["character-name"]) || character.name;
    if (native) output.cards = character.cards;
    return {
      ok: true,
      artifact: characterJsonArtifact(output, `${characterStem(character.name)}_匕首之心人物卡_zzz.json`),
      report: characterReport("zzz", "export"),
    };
  },
};
