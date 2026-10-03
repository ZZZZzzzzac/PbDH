import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import type { CharacterTextExport } from "../../apps/player/src/sheet-runtime/domain/characterTextExport.ts";
import { formatCharacterTextExport } from "../../apps/player/src/sheet-runtime/domain/characterTextFormatter.ts";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";

function readExport(system: string): CharacterTextExport {
  return JSON.parse(readFileSync(`apps/player/public/system-packages/${system}/exports/character-text.json`, "utf8"))[0];
}

describe("海豹骰属性赋值导出", () => {
  test("负属性之后仍以独立赋值导出全部字段", () => {
    const data = createEmptyCharacterData({ manifest: { ID: "daggerheart-core", 角色数据版本: "1.0.0" }, modules: [] } as unknown as SystemPackage, "seal");
    data.character.values = {
      agility: "-1", strength: "0", instinct: "2", knowledge: "3", presence: "1", finesse: "0",
      hp: { current: 0, max: 5 }, stress: { current: 0, max: 7 }, hope: { current: 2, max: 6 },
      "armor-slots": { current: 0, max: 4 }, evasion: "11", "major-threshold": "11", "severe-threshold": "22",
    };
    expect(formatCharacterTextExport(readExport("daggerheart-core"), data)).toBe(
      ".st 敏捷=-1 力量=0 本能=2 知识=3 风度=1 灵巧=0 生命=0 生命上限=5 压力=0 压力上限=7 希望=2 希望上限=6 护甲=0 护甲上限=4 闪避=11 重伤阈值=11 严重阈值=22",
    );
  });

  test.each(["tttri", "heart-of-hopefind"])("%s 也使用空格隔开的赋值", (system) => {
    const definition = readExport(system);
    const data = createEmptyCharacterData({ manifest: { ID: system, 角色数据版本: "1.0.0" }, modules: [] } as unknown as SystemPackage, "seal");
    for (const field of definition.字段) data.character.values[field.模块ID] = field.取值 === "文本" ? "-1" : { current: 0, max: 6 };
    const fields = formatCharacterTextExport(definition, data).slice(4).split(" ");
    expect(fields).toHaveLength(definition.字段.length);
    expect(fields.every((field) => /^[^=\s]+=-?\d+$/u.test(field))).toBe(true);
  });
});
