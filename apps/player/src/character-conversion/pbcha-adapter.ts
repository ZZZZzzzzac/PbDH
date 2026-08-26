import { strToU8, unzipSync, zipSync } from "fflate";

import {
  characterDecoder,
  characterExportFailure,
  characterImportFailure,
  characterJsonValue,
  characterObject,
  characterReport,
  characterStem,
} from "./shared.ts";
import type { CharacterFormatAdapter, TemporaryCharacter } from "./types.ts";

export const temporaryPbchaProfileVersion = "0.0.0-dev.1" as const;

export const pbchaCharacterAdapter: CharacterFormatAdapter = {
  id: "pbcha",
  import(input) {
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(input.bytes);
    } catch {
      return characterImportFailure("pbcha", "pbcha.archive.invalid", "临时 .pbcha 不是有效 ZIP。");
    }
    const manifestBytes = files["manifest.json"];
    const characterBytes = files["character.json"];
    if (!manifestBytes || !characterBytes) {
      return characterImportFailure("pbcha", "pbcha.entry.missing", "临时 .pbcha 缺少 manifest.json 或 character.json。");
    }
    try {
      const manifest = characterObject(JSON.parse(characterDecoder.decode(manifestBytes)));
      const document = characterObject(JSON.parse(characterDecoder.decode(characterBytes)));
      if (manifest?.family !== "character-save" || manifest.profileVersion !== temporaryPbchaProfileVersion) {
        return characterImportFailure("pbcha", "pbcha.profile.unsupported", "不支持该 Character Save Profile。 ");
      }
      const values = characterObject(document?.values);
      const extensions = characterObject(document?.sourceExtensions);
      if (!document || !values || !extensions || !Array.isArray(document.cards) || !characterJsonValue(document.cards)) {
        return characterImportFailure("pbcha", "pbcha.character.invalid", "临时 character.json 结构无效。");
      }
      const character: TemporaryCharacter = {
        name: typeof document.name === "string" ? document.name : "未命名角色",
        values,
        cards: document.cards,
        sourceExtensions: extensions,
      };
      return { ok: true, character, report: characterReport("pbcha", "import") };
    } catch {
      return characterImportFailure("pbcha", "pbcha.json.invalid", "临时 .pbcha JSON 无法解析。");
    }
  },
  export(character) {
    if (!characterJsonValue(character.values) || !characterJsonValue(character.cards) || !characterJsonValue(character.sourceExtensions)) {
      return characterExportFailure("pbcha", "pbcha.character.invalid", "人物卡包含不可序列化数据。");
    }
    const files: Record<string, Uint8Array> = {
      "manifest.json": strToU8(`${JSON.stringify({
        family: "character-save",
        profileVersion: temporaryPbchaProfileVersion,
        status: "development-only",
      }, null, 2)}\n`),
      "character.json": strToU8(`${JSON.stringify({
        name: character.name,
        values: character.values,
        cards: character.cards,
        sourceExtensions: character.sourceExtensions,
      }, null, 2)}\n`),
    };
    return {
      ok: true,
      artifact: {
        bytes: zipSync(files, { level: 6 }),
        fileName: `${characterStem(character.name)}.pbcha`,
        mediaType: "application/zip",
      },
      report: characterReport("pbcha", "export", [{
        code: "pbcha.profile.development-only",
        severity: "warning",
        message: "0.0.0-dev.1 仅用于转换测试，不能进入正式持久化或生产导出。",
      }]),
    };
  },
};
