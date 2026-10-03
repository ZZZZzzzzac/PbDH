import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import type { CharacterTextExport } from "../../apps/player/src/sheet-runtime/domain/characterTextExport.ts";
import { formatCharacterTextExport } from "../../apps/player/src/sheet-runtime/domain/characterTextFormatter.ts";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";

const coreSystemId = JSON.parse(readFileSync("apps/player/public/system-packages/daggerheart-core/system.json", "utf8")).package.id;

function readExport(system: string): CharacterTextExport {
  return JSON.parse(readFileSync(`apps/player/public/system-packages/${system}/exports/character-text.json`, "utf8"))[0];
}

describe("海豹骰属性赋值导出", () => {
  test("负属性之后仍以独立赋值导出全部字段", () => {
    const data = createEmptyCharacterData({ manifest: { ID: coreSystemId, 角色数据版本: "1.0.0" }, modules: [] } as unknown as SystemPackage, "seal");
    data.character.values = {
      agility: "-1", strength: "0", instinct: "2", knowledge: "3", presence: "1", finesse: "0",
      hp: { current: 0, max: 5 }, stress: { current: 0, max: 7 }, hope: { current: 2, max: 6 },
      "armor-slots": { current: 0, max: 4 }, evasion: "11", "major-threshold": "11", "severe-threshold": "22",
    };
    expect(formatCharacterTextExport(readExport("daggerheart-core"), data)).toBe(
      ".st 敏捷=-1 力量=0 本能=2 知识=3 风度=1 灵巧=0 生命=0 生命上限=5 压力=0 压力上限=7 希望=2 希望上限=6 护甲=0 护甲上限=4 闪避=11 重伤阈值=11 严重阈值=22" + ' DH经历="{\\"schemaVersion\\":1,\\"experiences\\":[]}"',
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

test("经历只导出名称及整数修正，空槽跳过，零修正保留，特殊文字安全引用", () => {
  const data = createEmptyCharacterData({ manifest: { ID: coreSystemId, 角色数据版本: "1.0.0" }, modules: [] } as unknown as SystemPackage, "seal");
  data.character.values = {
    "experience-1": "  向导 \"甲\" O'Brien \\ {敏捷} ＋－＝：＆＊ 🐈  ", "experience-modifier-1": "+2",
    "experience-2": "", "experience-modifier-2": "+9",
    "experience-3": "零值经历", "experience-modifier-3": "0",
    "experience-5": "后退", "experience-modifier-5": "-1",
    "class-feature": "禁止导出", "equipment": "禁止导出", "portrait": "data:image/png;base64,secret",
  };
  const output = formatCharacterTextExport(readExport("daggerheart-core"), data);
  expect(output).not.toMatch(/禁止导出|base64/);
  expect(output).not.toMatch(/[\r\n]/u);
  const json = JSON.parse(output.slice(output.indexOf("DH经历=") + "DH经历=".length));
  expect(JSON.parse(json)).toEqual({ schemaVersion: 1, experiences: [
    { name: "向导 \"甲\" O'Brien \\ {敏捷} ＋－＝：＆＊ 🐈", modifier: 2 },
    { name: "零值经历", modifier: 0 }, { name: "后退", modifier: -1 },
  ] });
});

test.each(["", "2 adv", "21", "1.5"])("有名经历的无效修正 %s 不产生可粘贴的半份导出", (modifier) => {
  const data = createEmptyCharacterData({ manifest: { ID: coreSystemId, 角色数据版本: "1.0.0" }, modules: [] } as unknown as SystemPackage, "seal");
  data.character.values = { "experience-1": "向导", "experience-modifier-1": modifier };
  expect(() => formatCharacterTextExport(readExport("daggerheart-core"), data)).toThrow(/经历 1 的修正/u);
});

test.each(["bad\n.st 希望6", "x".repeat(61)])("无效经历名称阻断导出", (name) => {
  const data = createEmptyCharacterData({ manifest: { ID: coreSystemId, 角色数据版本: "1.0.0" }, modules: [] } as unknown as SystemPackage, "seal");
  data.character.values = { "experience-1": name, "experience-modifier-1": "2" };
  expect(() => formatCharacterTextExport(readExport("daggerheart-core"), data)).toThrow(/经历 1 的名称/u);
});

test("海豹骰导出分别保存把、袋、箱，保留零且不自动兑换", () => {
  const data = createEmptyCharacterData({ manifest: { ID: coreSystemId, 角色数据版本: "1.0.0" }, modules: [] } as unknown as SystemPackage, "seal");
  data.character.values = {
    "handful-gold": { current: 0, max: 9 }, "bag-gold": { current: 9, max: 9 }, "chest-gold": { current: 1, max: null },
  };
  const output = formatCharacterTextExport(readExport("daggerheart-core"), data);
  expect(output).toContain("金币把=0 金币袋=9 金币箱=1");
  expect(output).not.toContain("金币=");
});
