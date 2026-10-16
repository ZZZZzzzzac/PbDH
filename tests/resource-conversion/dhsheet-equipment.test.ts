import { describe, expect, test } from "vitest";
import { strFromU8 } from "fflate";

import { dhsheetAdapter, type JsonObject, type TemporaryResource, type TemporaryResourceBatch } from "@pbdh/resource-conversion";
import { dhsheetEngineImport } from "./upstream-engines.ts";

const weapon: TemporaryResource = {
  sourceId: "test-blade", kind: "weapon", name: "试验剑",
  fields: {
    名称: "试验剑", 类型: "主武器", 属性: "灵巧", 距离: "近战", 伤害: "d8+2", 负荷: "单手",
    伤害类型: "物理", 位阶: "2", 特性名称: "**锐利**", 特性描述: "攻击获得 +1。",
  },
  source: { formatId: "pbres", upstreamRevision: "1.0.0", path: "/resources/0", raw: {} },
};
const armor: TemporaryResource = {
  sourceId: "test-armor", kind: "armor", name: "试验甲",
  fields: {
    名称: "试验甲", 类型: "护甲", 位阶: "T3", 护甲值: "5", 重度伤害阈值: "12", 严重伤害阈值: "26",
    特性名称: "稳固", 特性描述: "护甲特性原文。",
  },
  source: { formatId: "pbres", upstreamRevision: "1.0.0", path: "/resources/1", raw: {} },
};
function batch(resources: TemporaryResource[]): TemporaryResourceBatch {
  return {
    name: "兼容测试", version: "1.2.3", resources, media: new Map(),
    sourceDocument: { formatId: "pbres", upstreamRevision: "1.0.0", container: "pbres" },
  };
}

describe("Sheet equipment export", () => {
  test("exports selectable equipment even when a wheelchair uses an unsupported spellcasting trait", async () => {
    const wheelchair: TemporaryResource = {
      ...weapon, sourceId: "arcane-wheelchair", name: "奥术框架轮椅",
      fields: { ...weapon.fields, 名称: "奥术框架轮椅", 属性: "施法属性" },
    };
    const resources = batch([weapon, wheelchair, armor]);
    const legacy = await dhsheetAdapter.export(resources);
    if (!legacy.ok) throw new Error("legacy export must remain available");
    expect(dhsheetEngineImport(legacy.artifact.bytes, false).variant).toHaveLength(3);
    expect(legacy.report.diagnostics).toEqual([]);
    const exported = await dhsheetAdapter.export(resources, { dhsheetContent: "equipment" });
    if (!exported.ok) throw new Error("valid equipment must remain exportable");
    expect(exported.report.converted).toBe(2);
    const document = JSON.parse(strFromU8(exported.artifact.bytes));
    expect(document.equipment.weapons.map((item: JsonObject) => item.name)).toEqual(["试验剑"]);
    expect(document.equipment.armor.map((item: JsonObject) => item.name)).toEqual(["试验甲"]);
    expect(exported.report.diagnostics).toContainEqual(expect.objectContaining({
      code: "dhsheet.equipment.invalid", resourceId: "arcane-wheelchair", severity: "warning",
    }));
  });

  test.each(["json", "dhcb"] as const)("exports legacy %s cards and native equipment through independent calls", async (container) => {
    const secondary = structuredClone(weapon);
    secondary.sourceId = "test-secondary";
    secondary.fields = { ...secondary.fields, 类型: "副武器", 负荷: "副手", 距离: "邻近", 伤害类型: "魔法" };
    const exported = await dhsheetAdapter.export(batch([weapon, secondary, armor]), { container, creator: "测试作者" });
    if (!exported.ok) throw new Error(JSON.stringify(exported.report));
    const legacy = dhsheetEngineImport(exported.artifact.bytes, container === "dhcb");
    expect(legacy).not.toHaveProperty("format");
    expect(legacy).not.toHaveProperty("equipment");
    expect(legacy.variant).toHaveLength(3);
    expect(exported.report).toMatchObject({ converted: 3, failed: 0, diagnostics: [] });
    const equipment = await dhsheetAdapter.export(batch([weapon, secondary, armor]), { dhsheetContent: "equipment", creator: "测试作者" });
    if (!equipment.ok) throw new Error(JSON.stringify(equipment.report));
    const companion = equipment.artifact;
    expect(companion.container).toBe("json");
    expect(companion.fileName).toBe("兼容测试-装备包.json");
    const document = JSON.parse(strFromU8(companion.bytes));
    expect(document).toEqual({
      format: "daggerheart.equipment-pack.v1", name: "兼容测试", version: "1.2.3", author: "测试作者", description: "",
      equipment: {
        weapons: [{
          id: "test-blade", name: "试验剑", tier: "T2", weaponType: "primary", trait: "finesse",
          damageType: "physical", range: "melee", burden: "oneHanded", damage: "d8+2",
          featureName: "**锐利**", description: "攻击获得 +1。",
        }, {
          id: "test-secondary", name: "试验剑", tier: "T2", weaponType: "secondary", trait: "finesse",
          damageType: "magic", range: "veryClose", burden: "offHand", damage: "d8+2",
          featureName: "**锐利**", description: "攻击获得 +1。",
        }],
        armor: [{
          id: "test-armor", name: "试验甲", tier: "T3", baseArmorMax: 5, baseThresholds: { minor: 12, major: 26 },
          featureName: "稳固", description: "护甲特性原文。",
        }],
      },
    });
    const reopened = await dhsheetAdapter.import({ bytes: companion.bytes, fileName: companion.fileName });
    if (!reopened.ok) throw new Error(JSON.stringify(reopened.report));
    expect(reopened.batch.resources.map((resource) => resource.kind)).toEqual(["weapon", "weapon", "armor"]);
    expect(reopened.batch.resources[1]?.fields.负荷).toBe("副手");
    expect(reopened.batch.resources[2]?.fields).toMatchObject({ 护甲值: "5", 重度伤害阈值: "12", 严重伤害阈值: "26" });
  });

  test.each([
    ["敏捷", "极近距离", "agility", "veryClose"],
    ["力量", "近距离", "strength", "close"],
    ["本能", "远距离", "instinct", "far"],
    ["风度", "极远", "presence", "veryFar"],
    ["知识", "极远距离", "knowledge", "veryFar"],
  ])("maps %s / %s without changing damage", async (trait, range, expectedTrait, expectedRange) => {
    const resource = { ...weapon, fields: { ...weapon.fields, 属性: trait!, 距离: range!, 负荷: "双手" } };
    const result = await dhsheetAdapter.export(batch([resource]), { dhsheetContent: "equipment" });
    if (!result.ok) throw new Error("export failed");
    expect(JSON.parse(strFromU8(result.artifact.bytes))).toMatchObject({
      author: "未署名", equipment: { weapons: [{ trait: expectedTrait, range: expectedRange, burden: "twoHanded", damage: "d8+2" }] },
    });
  });

  test.each<JsonObject>([
    { 位阶: "" }, { 位阶: "5" }, { 属性: "智力" }, { 类型: "武器" }, { 伤害: "" },
  ])("keeps old export usable when weapon fields are unsupported: %j", async (fields) => {
    const resources = batch([{ ...weapon, fields: { ...weapon.fields, ...fields } }, armor]);
    const legacy = await dhsheetAdapter.export(resources);
    if (!legacy.ok) throw new Error("legacy export must remain available");
    expect(dhsheetEngineImport(legacy.artifact.bytes, false).variant).toHaveLength(2);
    const result = await dhsheetAdapter.export(resources, { dhsheetContent: "equipment" });
    if (!result.ok) throw new Error("armor must remain exportable");
    expect(JSON.parse(strFromU8(result.artifact.bytes)).equipment.weapons).toEqual([]);
    expect(result.report.converted).toBe(1);
    expect(result.report.diagnostics).toContainEqual(expect.objectContaining({
      code: "dhsheet.equipment.invalid", severity: "warning", resourceId: "test-blade",
    }));
  });

  test.each<JsonObject>([
    { 护甲值: "" }, { 护甲值: "4+等级" }, { 重度伤害阈值: "-1" }, { 严重伤害阈值: "1" },
  ])("does not invent armor numbers: %j", async (fields) => {
    const result = await dhsheetAdapter.export(batch([{ ...armor, fields: { ...armor.fields, ...fields } }]), { dhsheetContent: "equipment" });
    expect(result.ok).toBe(false);
    expect(result.report.diagnostics[0]?.resourceId).toBe("test-armor");
  });

  test("accepts zero armor and equal thresholds, rejects duplicate and unsafe IDs", async () => {
    const zero = { ...armor, fields: { ...armor.fields, 护甲值: "0", 重度伤害阈值: "0", 严重伤害阈值: "0" } };
    const result = await dhsheetAdapter.export(batch([zero]), { dhsheetContent: "equipment" });
    if (!result.ok) throw new Error("export failed");
    expect(JSON.parse(strFromU8(result.artifact.bytes)).equipment.armor).toHaveLength(1);
    for (const resources of [[weapon, weapon], [{ ...weapon, sourceId: "bad/id" }]]) {
      const invalid = await dhsheetAdapter.export(batch(resources), { dhsheetContent: "equipment" });
      expect(invalid.ok).toBe(false);
      expect(invalid.report.diagnostics).not.toEqual([]);
    }
  });

  test("keeps card export unchanged and refuses empty equipment exports", async () => {
    const item: TemporaryResource = { ...weapon, kind: "item", fields: { 类型: "物品", 特性描述: "工具" } };
    const result = await dhsheetAdapter.export(batch([item]));
    if (!result.ok) throw new Error("export failed");
    expect(result.artifact.container).toBe("json");
    expect(result.report.diagnostics).toEqual([]);
    const equipment = await dhsheetAdapter.export(batch([item]), { dhsheetContent: "equipment" });
    expect(equipment.ok).toBe(false);
    expect(equipment.report.diagnostics[0]?.code).toBe("dhsheet.equipment.empty");
  });
});
