import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  computeResourcePackageSnapshotDigest,
  loadPbres,
  writePbres,
} from "../../packages/contract-runtime/src/index.ts";
import {
  mapBatchToRegisteredCandidates,
  resourceConversionRegistry,
  validatePbresConversionCandidate,
} from "../../packages/resource-conversion/src/index.ts";
import type {
  JsonValue,
  ResourceFormatId,
  TemporaryResourceBatch,
} from "../../packages/resource-conversion/src/types.ts";
import {
  dhsheetEngineImport,
  dhsheetEngineRead,
  kidEngineRead,
  rinkcxEngineRead,
  zzzEngineRead,
} from "./upstream-engines.ts";

const encoder = new TextEncoder();

function input(value: JsonValue, fileName = "fixture.json") {
  return { bytes: encoder.encode(JSON.stringify(value)), fileName };
}

const rinkEnemy = {
  name: "测试敌人", rank: "2", type: "斗士", description: "简介", motivation: "追击", difficulty: "15",
  threshold: "8/14", health: "6", stress: "3", attackBonus: "+2", weaponName: "斧",
  weaponRange: "近战", damageDice: "2d8+3", damageType: "物理", decoratorColor: "#123456",
  imageTransform: "translate(1px, 2px)", experiences: ["导航+2"],
  traits: [{ name: "坚韧", desc: "不会退缩", flavor: "" }],
  specialTraits: [{ name: "冲锋", trigger: "行动", choice: "", effect: "移动并攻击" }],
} satisfies JsonValue;

const kidWeapon = {
  id: "kid-weapon", type: "weapon", name: "短剑", description: "", creator: "基德", owner: "测试",
  trait: "敏捷", range: "近战", damage: "d8", damageType: "物理", burden: "单手", feature: "可靠",
} satisfies JsonValue;

const dhsheetPack = {
  name: "测试卡包", version: "V1", author: "不冻港",
  profession: [], ancestry: [], community: [], subclass: [], domain: [],
  variant: [{ id: "dh-weapon", 名称: "长剑", 类型: "主武器", 属性: "力量", 距离: "近战", 伤害: "d10", 负荷: "双手", 伤害类型: "物理", 描述: "沉重", 位阶: "1" }],
} satisfies JsonValue;

const zzzPack = [
  { 名称: "弓", 类型: "主武器", 属性: "敏捷", 距离: "远距离", 伤害: "d8", 双手: true, 伤害类型: "物理", 描述: "远射", 位阶: 1 },
  "https://example.invalid/card.webp",
] satisfies JsonValue;

const adversaryBatch: TemporaryResourceBatch = {
  name: "敌人转换",
  resources: [{
    sourceId: "enemy:complete",
    kind: "adversary",
    name: "完整敌人",
    fields: {
      名称: "完整敌人", 原文: "Complete Adversary", 位阶: "3", 种类: "头目", 类型: "敌人",
      简介: "用于敌人模板转换。", 动机与战术: "守住大门", 难度: "17",
      重度伤害阈值: "12", 严重伤害阈值: "24", 生命点: "9", 压力点: "5",
      攻击命中: "+4", 攻击武器: "重锤", 攻击范围: "近战", 攻击伤害: "3d10+2",
      攻击属性: "物理", 经历: "守卫 +3；威吓 +2",
      特性: [{ 特性名称: "坚守", 特性原文: "Hold Fast", 特性类型: "被动", 特性描述: "不会后退。" }],
    },
    source: { formatId: "pbres", upstreamRevision: "test", path: "/resources/0", raw: {} },
  }],
  sourceDocument: { formatId: "pbres", upstreamRevision: "test", container: "pbres" },
  media: new Map(),
};

const weaponBatch: TemporaryResourceBatch = {
  name: "武器转换",
  resources: [{
    sourceId: "weapon:moonblade",
    kind: "weapon",
    name: "月刃",
    fields: {
      名称: "月刃", 原文: "", 类型: "主武器", 属性: "敏捷", 距离: "近战", 伤害: "d8+2",
      负荷: "单手", 伤害类型: "魔法", 特性名称: "可靠", 特性原文: "Reliable", 特性描述: "攻击掷骰+1。",
      简介: "刀身映着冷白月光。", 位阶: "2",
    },
    source: { formatId: "pbres", upstreamRevision: "test", path: "/resources/0", raw: {} },
  }],
  sourceDocument: { formatId: "pbres", upstreamRevision: "test", container: "pbres" },
  media: new Map(),
};

const armorBatch: TemporaryResourceBatch = {
  name: "护甲转换",
  resources: [{
    sourceId: "armor:padded",
    kind: "armor",
    name: "填充布甲",
    fields: {
      名称: "填充布甲", 原文: "", 类型: "护甲", 护甲值: "3", 重度伤害阈值: "5",
      严重伤害阈值: "11", 特性名称: "灵活", 特性原文: "Flexible", 特性描述: "闪避值+1。",
      简介: "层叠缝制的轻便布甲。", 位阶: "1",
    },
    source: { formatId: "pbres", upstreamRevision: "test", path: "/resources/0", raw: {} },
  }],
  sourceDocument: { formatId: "pbres", upstreamRevision: "test", container: "pbres" },
  media: new Map(),
};

const itemBatch: TemporaryResourceBatch = {
  name: "物品转换",
  resources: [
    {
      sourceId: "item:whistle",
      kind: "item",
      name: "风笛哨",
      fields: {
        名称: "风笛哨", 类型: "物品", 掷骰: "02", 特性描述: "一英里外都能听到。",
        简介: "手工制作的独特哨子。",
      },
      source: { formatId: "pbres", upstreamRevision: "test", path: "/resources/0", raw: {} },
    },
    {
      sourceId: "item:potion",
      kind: "item",
      name: "治疗药水",
      fields: {
        名称: "治疗药水", 类型: "消耗品", 掷骰: "51", 特性描述: "恢复 1 生命点。",
        简介: "盛在红色小瓶中。",
      },
      source: { formatId: "pbres", upstreamRevision: "test", path: "/resources/1", raw: {} },
    },
  ],
  sourceDocument: { formatId: "pbres", upstreamRevision: "test", container: "pbres" },
  media: new Map(),
};

const professionBatch: TemporaryResourceBatch = {
  name: "职业转换",
  resources: [{
    sourceId: "class:bard",
    kind: "class",
    name: "吟游诗人",
    fields: {
      名称: "吟游诗人",
      类型: "职业",
      简介: "富有魅力的表演者。",
      领域: ["优雅", "典籍"],
      生命点: "5",
      闪避值: "10",
      职业物品: "一本浪漫小说",
      希望特性: { 特性名称: "大闹一场", 特性原文: "", 特性描述: "干扰一个目标。" },
      特性: [{ 特性名称: "鼓舞人心", 特性原文: "", 特性描述: "每场游戏开始时获得一枚鼓舞骰。" }],
      推荐初始属性: { 敏捷: "+0", 力量: "-1", 灵巧: "+1", 本能: "+0", 风度: "+2", 知识: "+1" },
      推荐初始武器: "刺剑 + 匕首",
      推荐初始护甲: "填充布甲",
      背景问题: ["谁教会了你自信？", "你曾爱过谁？"],
      关系问题: ["我们为何成为朋友？", "我做了什么让你烦恼？"],
    },
    source: { formatId: "pbres", upstreamRevision: "test", path: "/resources/0", raw: {} },
  }],
  sourceDocument: { formatId: "pbres", upstreamRevision: "test", container: "pbres" },
  media: new Map(),
};

const subclassBatch: TemporaryResourceBatch = {
  name: "子职业转换",
  resources: ([
    ["基础", "振奋之言", "帮助盟友恢复压力。"],
    ["进阶", "英勇之言", "强化盟友的行动。"],
    ["精通", "传奇之言", "扭转绝境。"],
  ] as const).map(([level, featureName, featureDescription], index) => ({
    sourceId: `subclass:wordsmith:${index}`,
    kind: "subclass" as const,
    name: "言语大师",
    fields: {
      名称: "言语大师", 类型: "子职业", 主职: "吟游诗人", 等级: level, 施法属性: "风度",
      特性: [{ 特性名称: featureName, 特性原文: "", 特性描述: featureDescription }], 简介: "他们用故事改写现实。",
    },
    source: { formatId: "pbres" as const, upstreamRevision: "test", path: `/resources/${index}`, raw: {} },
  })),
  sourceDocument: { formatId: "pbres", upstreamRevision: "test", container: "pbres" },
  media: new Map(),
};

const ancestryBatch: TemporaryResourceBatch = {
  name: "种族转换",
  resources: [{
    sourceId: "ancestry:dragonborn",
    kind: "ancestry",
    name: "龙人",
    fields: {
      名称: "龙人",
      原文: "",
      类型: "种族",
      简介: "龙人的外观类似无翼的龙类。",
      特性: [
        { 特性名称: "鳞片保护", 特性原文: "", 特性描述: "受到严重伤害时可以减少生命损失。" },
        { 特性名称: "元素吐息", 特性原文: "", 特性描述: "喷吐元素能量并造成魔法伤害。" },
      ],
    },
    source: { formatId: "pbres", upstreamRevision: "test", path: "/resources/0", raw: {} },
  }],
  sourceDocument: { formatId: "pbres", upstreamRevision: "test", container: "pbres" },
  media: new Map(),
};

const communityBatch: TemporaryResourceBatch = {
  name: "社群转换",
  resources: [{
    sourceId: "community:highborne",
    kind: "community",
    name: "高城之民",
    fields: {
      名称: "高城之民", 类型: "社群", 简介: "来自充满声望的上流社会。", 性格: "亲切、坦率、狡猾、沉着。",
      特性: { 特性名称: "高人一等", 特性原文: "", 特性描述: "与贵族交际或利用声誉时具有优势。" },
    },
    source: { formatId: "pbres", upstreamRevision: "test", path: "/resources/0", raw: {} },
  }],
  sourceDocument: { formatId: "pbres", upstreamRevision: "test", container: "pbres" },
  media: new Map(),
};

const domainBatch: TemporaryResourceBatch = {
  name: "领域卡转换",
  resources: [{
    sourceId: "domain:arcana:rune-charm",
    kind: "domain",
    name: "符文护符",
    fields: {
      名称: "符文护符", 类型: "领域卡", 领域: "奥术", 等级: "1", 属性: "法术", 回想: "0",
      特性描述: "花费希望点以减少即将到来的伤害。", 简介: "一件意义深远的个人小饰品。",
    },
    source: { formatId: "pbres", upstreamRevision: "test", path: "/resources/0", raw: {} },
  }],
  sourceDocument: { formatId: "pbres", upstreamRevision: "test", container: "pbres" },
  media: new Map(),
};

const environmentBatch: TemporaryResourceBatch = {
  name: "环境转换",
  resources: [{
    sourceId: "environment:burning-library",
    kind: "environment",
    name: "燃烧的图书馆",
    fields: {
      名称: "燃烧的图书馆", 位阶: "2", 种类: "险境", 简介: "烈焰吞噬了古老藏书。",
      趋向: "蔓延火势；隔断退路", 难度: "14", 潜在敌人: "纵火者、灰烬幽灵",
      特性: [{ 特性名称: "坍塌", 特性原文: "", 特性类型: "动作", 特性描述: "燃烧的书架轰然倒下。", 引导问题: "谁被困在火海中？" }],
    },
    source: { formatId: "pbres", upstreamRevision: "test", path: "/resources/0", raw: {} },
  }],
  sourceDocument: { formatId: "pbres", upstreamRevision: "test", container: "pbres" },
  media: new Map(),
};

async function roundTrip(formatId: ResourceFormatId, value: JsonValue, fileName = "fixture.json") {
  const imported = await resourceConversionRegistry.import(formatId, input(value, fileName));
  expect(imported.ok).toBe(true);
  if (!imported.ok) throw new Error("import failed");
  const exported = await resourceConversionRegistry.export(formatId, imported.batch);
  expect(exported.ok).toBe(true);
  if (!exported.ok) throw new Error("export failed");
  return { imported, exported };
}

describe("third-party resource source engines", () => {
  test("RinkCX output is read by the extracted enemy engine without losing native fields", async () => {
    const { exported } = await roundTrip("rinkcx", rinkEnemy);
    const [read] = rinkcxEngineRead(exported.artifact.bytes);
    expect(read?.type).toBe("enemy");
    expect(read?.data.decoratorColor).toBe("#123456");
    expect(read?.data.imageTransform).toBe("translate(1px, 2px)");
  });

  test("Kid output is accepted by its 28-type discriminator", async () => {
    const { exported } = await roundTrip("kid", kidWeapon);
    expect(kidEngineRead(exported.artifact.bytes)).toMatchObject(kidWeapon);
  });

  test("Kid recovers JSON appended after arbitrary PNG bytes", async () => {
    const prefix = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0x00, 0x80]);
    const payload = encoder.encode(`||TRPG_DATA||${JSON.stringify(kidWeapon)}`);
    const bytes = new Uint8Array(prefix.length + payload.length);
    bytes.set(prefix);
    bytes.set(payload, prefix.length);
    const imported = await resourceConversionRegistry.import("kid", {
      bytes,
      fileName: "card.png",
      container: "png",
    });
    expect(imported.ok).toBe(true);
    expect(imported.report.diagnostics).toContainEqual(expect.objectContaining({
      code: "kid.png.trailing-payload-fragile",
    }));
  });

  test("dhsheet JSON and dhcb outputs preserve grouped native records and dhcb can be re-imported", async () => {
    const imported = await resourceConversionRegistry.import("dhsheet", input(dhsheetPack));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("import failed");
    const json = await resourceConversionRegistry.export("dhsheet", imported.batch, { container: "json" });
    const dhcb = await resourceConversionRegistry.export("dhsheet", imported.batch, { container: "dhcb" });
    expect(json.ok && dhcb.ok).toBe(true);
    if (!json.ok || !dhcb.ok) throw new Error("export failed");
    expect(dhsheetEngineRead(json.artifact.bytes, false).variant).toEqual(dhsheetPack.variant);
    expect(dhsheetEngineRead(dhcb.artifact.bytes, true).variant).toEqual(dhsheetPack.variant);
    const reimported = await resourceConversionRegistry.import("dhsheet", {
      bytes: dhcb.artifact.bytes,
      fileName: dhcb.artifact.fileName,
      container: "dhcb",
    });
    expect(reimported.ok).toBe(true);
    if (!reimported.ok) throw new Error("dhcb re-import failed");
    expect(reimported.batch.resources).toEqual(imported.batch.resources);
  });

  test("dhsheet imports its explicit equipment-pack variant", async () => {
    const imported = await resourceConversionRegistry.import("dhsheet", input({
      format: "daggerheart.equipment-pack.v1",
      name: "旱土巨像武器包",
      version: "1.0.0",
      equipment: {
        weapons: [{
          id: "dryland-revolver-t1",
          name: "左轮手枪（位阶1）",
          tier: "T1",
          weaponType: "primary",
          trait: "finesse",
          damageType: "physical",
          range: "far",
          burden: "oneHanded",
          damage: "d8+1",
          featureName: "六发",
          description: "花费 1 弹药指示物进行攻击。",
        }],
        armor: [],
      },
    }, "旱土巨像武器包.json"));

    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error(imported.report.diagnostics[0]?.message ?? "import failed");
    expect(imported.batch.resources).toHaveLength(1);
    expect(imported.batch.resources[0]).toMatchObject({
      sourceId: "dryland-revolver-t1",
      kind: "weapon",
      name: "左轮手枪（位阶1）",
      fields: {
        名称: "左轮手枪（位阶1）",
        类型: "主武器",
        属性: "灵巧",
        距离: "远距离",
        伤害: "d8+1",
        负荷: "单手",
        伤害类型: "物理",
        特性名称: "六发",
        特性原文: "",
        特性描述: "花费 1 弹药指示物进行攻击。",
        位阶: "1",
      },
    });
    const candidate = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0];
    expect(candidate?.template).toMatchObject({ id: "武器" });
    expect(candidate?.diagnostics).toEqual([]);
  });

  test("ZZZ preserves opaque string entries even though the upstream reader skips them", async () => {
    const { imported, exported } = await roundTrip("zzz", zzzPack);
    expect(imported.batch.resources).toHaveLength(2);
    expect(imported.report.diagnostics).toContainEqual(expect.objectContaining({ code: "zzz.record.non-object" }));
    expect(JSON.parse(new TextDecoder().decode(exported.artifact.bytes))).toEqual(zzzPack);
    expect(zzzEngineRead(exported.artifact.bytes)).toHaveLength(1);
  });

  test("explicit source selection never falls back to another adapter", async () => {
    const result = await resourceConversionRegistry.import("zzz", input(rinkEnemy));
    expect(result.ok).toBe(false);
    expect(result.report.diagnostics[0]?.code).toBe("zzz.card-array.required");
  });
});

describe("registered Template mapping and native pbres", () => {
  test("RinkCX adversary and third-party weapons enter registered Template candidates", async () => {
    const rink = await resourceConversionRegistry.import("rinkcx", input(rinkEnemy));
    const kid = await resourceConversionRegistry.import("kid", input(kidWeapon));
    expect(rink.ok && kid.ok).toBe(true);
    if (!rink.ok || !kid.ok) throw new Error("import failed");
    const mapped = mapBatchToRegisteredCandidates([...rink.batch.resources, ...kid.batch.resources]);
    expect(mapped.unmapped).toEqual([]);
    expect(mapped.candidates.map((item) => item.template.id)).toEqual(["敌人", "武器"]);
    expect(mapped.candidates[1]?.template.version).toBe("1.0.0");
    expect(mapped.candidates[0]?.data.难度).toBe("15");
    expect(mapped.candidates[1]?.data.伤害).toBe("d8");
  });

  test("Kid NPC description enters 简介 and source-missing combat fields remain empty without warnings", async () => {
    const kid = await resourceConversionRegistry.import("kid", input({
      ...kidWeapon,
      type: "npc",
      description: "守门人简介",
      difficulty: "14",
      motive: "守门",
      features: [],
    }));
    expect(kid.ok).toBe(true);
    if (!kid.ok) throw new Error("import failed");
    const [candidate] = mapBatchToRegisteredCandidates(kid.batch.resources).candidates;
    expect(candidate?.data).toMatchObject({ 类型: "敌人", 简介: "守门人简介", 难度: "14", 生命点: "" });
    expect(candidate?.diagnostics).toEqual([]);
  });

  test("enemy Contract exports to RinkCX and Kid with the approved nonessential fields omitted", async () => {
    const rink = await resourceConversionRegistry.export("rinkcx", adversaryBatch);
    const kid = await resourceConversionRegistry.export("kid", adversaryBatch, { creator: "测试", owner: "测试" });
    expect(rink.ok && kid.ok).toBe(true);
    if (!rink.ok || !kid.ok) throw new Error("export failed");
    expect(rink.report.diagnostics).toEqual([]);
    expect(rinkcxEngineRead(rink.artifact.bytes)[0]?.data).toMatchObject({ health: "9", damageDice: "3d10+2" });
    expect(kidEngineRead(kid.artifact.bytes)).toMatchObject({
      type: "npc", description: "用于敌人模板转换。", difficulty: "17", motive: "守住大门",
    });
    const rinkImported = await resourceConversionRegistry.import("rinkcx", {
      bytes: rink.artifact.bytes, fileName: rink.artifact.fileName,
    });
    const kidImported = await resourceConversionRegistry.import("kid", {
      bytes: kid.artifact.bytes, fileName: kid.artifact.fileName,
    });
    expect(rinkImported.ok && kidImported.ok).toBe(true);
    if (!rinkImported.ok || !kidImported.ok) throw new Error("re-import failed");
    expect(mapBatchToRegisteredCandidates(rinkImported.batch.resources).candidates[0]?.diagnostics).toEqual([]);
    expect(mapBatchToRegisteredCandidates(kidImported.batch.resources).candidates[0]?.diagnostics).toEqual([]);
  });

  test("enemy Contract remains complete in dhsheet variant and ZZZ open records", async () => {
    const dhsheet = await resourceConversionRegistry.export("dhsheet", adversaryBatch);
    const zzz = await resourceConversionRegistry.export("zzz", adversaryBatch);
    expect(dhsheet.ok && zzz.ok).toBe(true);
    if (!dhsheet.ok || !zzz.ok) throw new Error("export failed");
    const dhsheetDocument = dhsheetEngineImport(dhsheet.artifact.bytes, false);
    expect(dhsheetDocument.customFieldDefinitions).toEqual({ variants: ["敌人"] });
    expect((dhsheetDocument.variant as JsonValue[])[0]).toMatchObject({
      名称: "完整敌人", 类型: "敌人", 生命点: "9", 攻击伤害: "3d10+2",
    });
    expect(zzzEngineRead(zzz.artifact.bytes)[0]).toMatchObject({
      名称: "完整敌人", 类型: "敌人", 生命点: "9", 攻击伤害: "3d10+2",
    });
    const dhsheetImported = await resourceConversionRegistry.import("dhsheet", {
      bytes: dhsheet.artifact.bytes, fileName: dhsheet.artifact.fileName,
    });
    const zzzImported = await resourceConversionRegistry.import("zzz", {
      bytes: zzz.artifact.bytes, fileName: zzz.artifact.fileName,
    });
    expect(dhsheetImported.ok && zzzImported.ok).toBe(true);
    if (!dhsheetImported.ok || !zzzImported.ok) throw new Error("re-import failed");
    const expected = adversaryBatch.resources[0]?.fields;
    const dhsheetCandidate = mapBatchToRegisteredCandidates(dhsheetImported.batch.resources).candidates[0];
    const zzzCandidate = mapBatchToRegisteredCandidates(zzzImported.batch.resources).candidates[0];
    expect(dhsheetCandidate?.diagnostics).toEqual([]);
    expect(zzzCandidate?.diagnostics).toEqual([]);
    expect(dhsheetCandidate?.data).toEqual(expected);
    expect(zzzCandidate?.data).toEqual(expected);
  });

  test("Kid weapon keeps gameplay feature and flavor description separate", async () => {
    const source = { ...kidWeapon, description: "一把朴素的短剑。", feature: "可靠：攻击掷骰+1。" };
    const imported = await resourceConversionRegistry.import("kid", input(source));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("import failed");
    const candidate = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0];
    expect(candidate?.template).toEqual({ id: "武器", version: "1.0.0" });
    expect(candidate?.data).toMatchObject({
      特性名称: "", 特性描述: "可靠：攻击掷骰+1。", 简介: "一把朴素的短剑。", 位阶: "",
    });
    expect(candidate?.diagnostics).toEqual([]);
  });

  test("weapon Contract exports to Kid while approved tier loss stays silent", async () => {
    const exported = await resourceConversionRegistry.export("kid", weaponBatch, { creator: "测试", owner: "测试" });
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error("export failed");
    expect(exported.report.diagnostics).toEqual([]);
    expect(kidEngineRead(exported.artifact.bytes)).toMatchObject({
      type: "weapon",
      description: "刀身映着冷白月光。",
      feature: "可靠：攻击掷骰+1。",
    });
    expect(kidEngineRead(exported.artifact.bytes)).not.toHaveProperty("tier");
  });

  test("weapon Contract remains complete in dhsheet and ZZZ records", async () => {
    for (const formatId of ["dhsheet", "zzz"] as const) {
      const exported = await resourceConversionRegistry.export(formatId, weaponBatch);
      expect(exported.ok).toBe(true);
      if (!exported.ok) throw new Error("export failed");
      const imported = await resourceConversionRegistry.import(formatId, {
        bytes: exported.artifact.bytes,
        fileName: exported.artifact.fileName,
      });
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error("re-import failed");
      const candidate = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0];
      expect(candidate?.diagnostics).toEqual([]);
      const { 原文: _original, ...expected } = weaponBatch.resources[0]!.fields;
      expect(candidate?.data).toMatchObject(expected);
    }
  });

  test("Kid armor maps thresholds plus gameplay and flavor descriptions", async () => {
    const imported = await resourceConversionRegistry.import("kid", input({
      id: "kid-armor", type: "armor", name: "填充布甲", creator: "测试", owner: "测试",
      description: "层叠缝制的轻便布甲。", score: "3", majorThreshold: "5",
      severeThreshold: "11", feature: "灵活：闪避值+1。",
    }));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("import failed");
    const candidate = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0];
    expect(candidate?.template).toEqual({ id: "护甲", version: "1.0.0" });
    expect(candidate?.data).toEqual({
      名称: "填充布甲", 类型: "护甲", 护甲值: "3", 重度伤害阈值: "5",
      严重伤害阈值: "11", 特性名称: "", 特性原文: "", 特性描述: "灵活：闪避值+1。",
      简介: "层叠缝制的轻便布甲。", 位阶: "",
    });
    expect(candidate?.diagnostics).toEqual([]);
  });

  test("armor exports to Kid with approved tier loss", async () => {
    const exported = await resourceConversionRegistry.export("kid", armorBatch, { creator: "测试", owner: "测试" });
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error("export failed");
    expect(exported.report.diagnostics).toEqual([]);
    expect(kidEngineRead(exported.artifact.bytes)).toMatchObject({
      type: "armor", description: "层叠缝制的轻便布甲。", score: "3",
      majorThreshold: "5", severeThreshold: "11", feature: "灵活：闪避值+1。",
    });
    expect(kidEngineRead(exported.artifact.bytes)).not.toHaveProperty("tier");
  });

  test("armor normalizes dhsheet and ZZZ threshold spellings without semantic loss", async () => {
    for (const formatId of ["dhsheet", "zzz"] as const) {
      const exported = await resourceConversionRegistry.export(formatId, armorBatch);
      expect(exported.ok).toBe(true);
      if (!exported.ok) throw new Error("export failed");
      if (formatId === "dhsheet") dhsheetEngineImport(exported.artifact.bytes, false);
      else zzzEngineRead(exported.artifact.bytes);
      const imported = await resourceConversionRegistry.import(formatId, {
        bytes: exported.artifact.bytes, fileName: exported.artifact.fileName,
      });
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error("re-import failed");
      const candidate = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0];
      expect(candidate?.diagnostics).toEqual([]);
      const { 原文: _original, ...expected } = armorBatch.resources[0]!.fields;
      expect(candidate?.data).toMatchObject(expected);
    }
  });

  test("RinkCX remains explicit about not supporting standalone armor", async () => {
    const exported = await resourceConversionRegistry.export("rinkcx", armorBatch);
    expect(exported.ok).toBe(false);
    expect(exported.report.diagnostics).toContainEqual(expect.objectContaining({ code: "rinkcx.kind.unsupported" }));
  });

  test("Kid loot and consumable map to one item Template without mixing effect and flavor", async () => {
    const sources = [
      { id: "loot", type: "loot", name: "风笛哨", description: "手工哨子。", creator: "测试", owner: "测试", feature: "远处可闻。" },
      { id: "consumable", type: "consumable", name: "治疗药水", description: "红色药水。", creator: "测试", owner: "测试", effect: "恢复生命。" },
    ] as const;
    for (const source of sources) {
      const imported = await resourceConversionRegistry.import("kid", input(source));
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error("import failed");
      const candidate = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0];
      expect(candidate?.template).toEqual({ id: "物品", version: "1.0.0" });
      expect(candidate?.data).toMatchObject({
        类型: source.type === "consumable" ? "消耗品" : "物品",
        掷骰: "",
        特性描述: source.type === "consumable" ? "恢复生命。" : "远处可闻。",
        简介: source.description,
      });
      expect(candidate?.diagnostics).toEqual([]);
    }
  });

  test("item Contract exports both Kid discriminators with approved roll loss", async () => {
    for (const resource of itemBatch.resources) {
      const exported = await resourceConversionRegistry.export("kid", {
        ...itemBatch, resources: [resource],
      }, { creator: "测试", owner: "测试" });
      expect(exported.ok).toBe(true);
      if (!exported.ok) throw new Error("export failed");
      expect(exported.report.diagnostics).toEqual([]);
      const read = kidEngineRead(exported.artifact.bytes);
      expect(read).toMatchObject({
        type: resource.fields.类型 === "消耗品" ? "consumable" : "loot",
        description: resource.fields.简介,
      });
      expect(read).not.toHaveProperty("roll");
      expect(read[resource.fields.类型 === "消耗品" ? "effect" : "feature"]).toBe(resource.fields.特性描述);
    }
  });

  test("Kid-only card types map their visible fields to the Free Template", async () => {
    const sources: Array<Record<string, JsonValue>> = [
      { type: "story", trigger: "造成伤害时", effect: "伤害+2" },
      { type: "calamity", effect: "天空坠落" },
      { type: "ingredient", flavors: [{ name: "咸", die: "d4" }], feature: "提升菜肴效果" },
      { type: "meal", components: [{ name: "月盐", die: "d4" }], effect: "恢复生命", die: "1d6" },
      { type: "transformation", features: [{ name: "利爪", description: "伤害+1" }] },
      { type: "material", source: "巨龙", part: "鳞片", features: [{ name: "耐火", description: "抵抗火焰" }] },
      { type: "vehicle", armaments: [{ name: "弩炮", damage: "2d10" }], features: [{ name: "坚固", description: "护甲+1" }] },
      { type: "madness", effect: "看到幻象", cureCondition: "完成休息" },
      { type: "clue", content: "门锁被撬开", note: "来自现场" },
      { type: "prophecy", content: "双月重合", successEffect: "王国得救", failureEffect: "灾厄降临" },
      { type: "question", questionType: "背景", options: ["你失去了谁？", "你在逃避什么？"] },
      { type: "quest", questGiver: "镇长", dangerLevel: "高", deadline: "三天", objectives: "救回村民", reward: "100金币" },
      { type: "wheelchair", frameType: "轻型", tier: "2", trait: "敏捷", range: "近战", damage: "d8", burden: "单手", evasionMod: "+1", feature: "机动", actions: "冲刺", consequences: "标记压力" },
      { type: "anomaly", containmentClass: "欧几里得", source: "裂隙", procedures: "避光保存", effects: "制造幻影", drawback: "消耗压力" },
      { type: "stronghold", functions: "提供休息", restrictions: "位置固定" },
      { type: "landmark", appearance: "黑色高塔", functions: "指引方向", notes: "夜间发光" },
    ];
    for (const [index, source] of sources.entries()) {
      const imported = await resourceConversionRegistry.import("kid", input({
        id: `free-${index}`, name: `自由资源${index}`, description: "可见简介", creator: "测试", owner: "测试", ...source,
      }));
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error("import failed");
      const mapped = mapBatchToRegisteredCandidates(imported.batch.resources);
      expect(mapped.unmapped).toEqual([]);
      expect(mapped.candidates[0]?.template).toEqual({ id: "自由", version: "1.0.0" });
      expect(mapped.candidates[0]?.data).toMatchObject({ 名称: `自由资源${index}` });
      expect(mapped.candidates[0]?.data.简介).toBe("可见简介");
      expect(mapped.candidates[0]?.data.内容).toEqual(expect.any(Array));
      expect((mapped.candidates[0]?.data.内容 as JsonValue[]).length).toBeGreaterThan(0);
      expect(mapped.candidates[0]?.diagnostics).toEqual([]);
    }
  });

  test("Free Template survives dhsheet and ZZZ while RinkCX rejects it", async () => {
    const imported = await resourceConversionRegistry.import("kid", input({
      id: "story", type: "story", name: "复仇誓言", description: "你不会忘记那一天。",
      creator: "测试", owner: "测试", trigger: "造成伤害时", effect: "伤害+2",
    }));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("import failed");
    const kidExport = await resourceConversionRegistry.export("kid", imported.batch);
    expect(kidExport.ok).toBe(true);
    if (!kidExport.ok) throw new Error("Kid export failed");
    expect(kidEngineRead(kidExport.artifact.bytes)).toMatchObject({
      type: "story", trigger: "造成伤害时", effect: "伤害+2",
    });
    const expected = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0]?.data;
    for (const formatId of ["dhsheet", "zzz"] as const) {
      const exported = await resourceConversionRegistry.export(formatId, imported.batch);
      expect(exported.ok).toBe(true);
      if (!exported.ok) throw new Error("export failed");
      if (formatId === "dhsheet") dhsheetEngineImport(exported.artifact.bytes, false);
      else zzzEngineRead(exported.artifact.bytes);
      const reimported = await resourceConversionRegistry.import(formatId, {
        bytes: exported.artifact.bytes, fileName: exported.artifact.fileName,
      });
      expect(reimported.ok).toBe(true);
      if (!reimported.ok) throw new Error("re-import failed");
      expect(mapBatchToRegisteredCandidates(reimported.batch.resources).candidates[0]?.data).toEqual(expected);
    }
    const rinkcx = await resourceConversionRegistry.export("rinkcx", imported.batch);
    expect(rinkcx.ok).toBe(false);
    expect(rinkcx.report.diagnostics).toContainEqual(expect.objectContaining({ code: "rinkcx.kind.unsupported" }));
  });

  test("dhsheet keeps structured free fields as content blocks instead of object strings", async () => {
    const fileName = "【滋孽】基础领域&职业&魂素（种族重构）_2.0版本.json";
    const imported = await resourceConversionRegistry.import("dhsheet", {
      bytes: new Uint8Array(readFileSync(path.join(process.cwd(), "docs/third", fileName))),
      fileName,
      container: "json",
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("real dhsheet import failed");

    const freeCandidates = mapBatchToRegisteredCandidates(imported.batch.resources).candidates
      .filter((candidate) => candidate.template.id === "自由");
    expect(freeCandidates.length).toBeGreaterThan(0);
    for (const candidate of freeCandidates) {
      expect(Object.keys(candidate.data).sort()).toEqual(["内容", "名称", "简介", "类型"]);
      expect(JSON.stringify(candidate.data)).not.toContain("[object Object]");
      expect(candidate.data.内容).toEqual(expect.any(Array));
      expect(candidate.diagnostics).toEqual([]);
    }
  });

  test("unknown open records do not enter the Free Template without an explicit visible mapping", async () => {
    const imported = await resourceConversionRegistry.import("zzz", input([{
      名称: "未知记录", 类型: "未来类型", 私有结构: { value: "不能自动持久化" },
    }]));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("import failed");
    const mapped = mapBatchToRegisteredCandidates(imported.batch.resources);
    expect(mapped.candidates).toEqual([]);
    expect(mapped.unmapped).toHaveLength(1);
  });

  test("item Contract remains complete in dhsheet and ZZZ records", async () => {
    for (const formatId of ["dhsheet", "zzz"] as const) {
      const exported = await resourceConversionRegistry.export(formatId, itemBatch);
      expect(exported.ok).toBe(true);
      if (!exported.ok) throw new Error("export failed");
      if (formatId === "dhsheet") dhsheetEngineImport(exported.artifact.bytes, false);
      else zzzEngineRead(exported.artifact.bytes);
      const imported = await resourceConversionRegistry.import(formatId, {
        bytes: exported.artifact.bytes, fileName: exported.artifact.fileName,
      });
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error("re-import failed");
      const candidates = mapBatchToRegisteredCandidates(imported.batch.resources).candidates;
      expect(candidates.map((candidate) => candidate.data)).toEqual(itemBatch.resources.map((resource) => resource.fields));
      expect(candidates.flatMap((candidate) => candidate.diagnostics)).toEqual([]);
    }
  });

  test("RinkCX remains explicit about not supporting standalone items", async () => {
    const exported = await resourceConversionRegistry.export("rinkcx", itemBatch);
    expect(exported.ok).toBe(false);
    expect(exported.report.diagnostics).toContainEqual(expect.objectContaining({ code: "rinkcx.kind.unsupported" }));
  });

  test("Kid class enters the structured profession Template with unavailable fields empty", async () => {
    const imported = await resourceConversionRegistry.import("kid", input({
      id: "kid-class", type: "class", name: "吟游诗人", description: "富有魅力的表演者。",
      creator: "测试", owner: "测试", evasion: "10", hp: "5", spellcastingAttribute: "风度",
      classFeature: "鼓舞人心", hopeFeature: "大闹一场", domain1: "优雅", domain2: "典籍",
      startingItems: "一本浪漫小说",
    }));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("import failed");
    const candidate = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0];
    expect(candidate?.template).toEqual({ id: "职业", version: "1.0.0" });
    expect(candidate?.data).toMatchObject({
      领域: ["优雅", "典籍"], 生命点: "5", 闪避值: "10",
      希望特性: { 特性名称: "", 特性原文: "", 特性描述: "大闹一场" },
      特性: [{ 特性名称: "", 特性原文: "", 特性描述: "鼓舞人心" }],
      推荐初始属性: { 敏捷: "", 力量: "", 灵巧: "", 本能: "", 风度: "", 知识: "" }, 推荐初始武器: "", 背景问题: [], 关系问题: [],
    });
    expect(candidate?.data).not.toHaveProperty("施法属性");
    expect(candidate?.diagnostics).toEqual([]);
  });

  test("dhsheet profession normalizes joined domains, formatted attributes, and numbered questions", async () => {
    const imported = await resourceConversionRegistry.import("dhsheet", input({
      name: "职业包",
      profession: [{
        id: "bard", 名称: "吟游诗人", 描述: "职业描述", 领域: "优雅+典籍", 生命点: 5, 闪避值: 10,
        职业物品: "一本小说", 希望特性: "大闹一场", 职业特性: "鼓舞人心",
        推荐初始属性: "敏捷 **+0** 力量 **-1** 风度 **+2**",
        推荐初始武器: "刺剑+匕首", 推荐初始护甲: "填充布甲",
        背景问题1: "谁教会了你自信？", 背景问题2: "你曾爱过谁？",
        关系问题1: "我们为何成为朋友？", 施法属性: "风度",
      }],
      ancestry: [], community: [], subclass: [], domain: [], variant: [],
    }));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("import failed");
    const candidate = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0];
    expect(candidate?.data).toMatchObject({
      领域: ["优雅", "典籍"],
      推荐初始属性: { 敏捷: "+0", 力量: "-1", 灵巧: "", 本能: "", 风度: "+2", 知识: "" },
      推荐初始武器: "刺剑 + 匕首",
      背景问题: ["谁教会了你自信？", "你曾爱过谁？"],
      关系问题: ["我们为何成为朋友？"],
      特性: [{ 特性名称: "", 特性原文: "", 特性描述: "鼓舞人心" }],
    });
    expect(candidate?.diagnostics).toEqual([]);
  });

  test("profession exports to Kid with unsupported recommendation fields silently omitted", async () => {
    const exported = await resourceConversionRegistry.export("kid", professionBatch, { creator: "测试", owner: "测试" });
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error("export failed");
    expect(exported.report.diagnostics).toEqual([]);
    expect(kidEngineRead(exported.artifact.bytes)).toMatchObject({
      type: "class", description: "富有魅力的表演者。", evasion: "10", hp: "5",
      domain1: "优雅", domain2: "典籍",
      classFeature: "鼓舞人心：每场游戏开始时获得一枚鼓舞骰。", hopeFeature: "大闹一场：干扰一个目标。", startingItems: "一本浪漫小说",
    });
    expect(kidEngineRead(exported.artifact.bytes)).not.toHaveProperty("spellcastingAttribute");
  });

  test("profession remains complete through dhsheet and ZZZ native shapes", async () => {
    for (const formatId of ["dhsheet", "zzz"] as const) {
      const exported = await resourceConversionRegistry.export(formatId, professionBatch);
      expect(exported.ok).toBe(true);
      if (!exported.ok) throw new Error("export failed");
      const target = formatId === "dhsheet"
        ? dhsheetEngineRead(exported.artifact.bytes, false)
        : { profession: zzzEngineRead(exported.artifact.bytes) };
      expect(target).toBeDefined();
      const imported = await resourceConversionRegistry.import(formatId, {
        bytes: exported.artifact.bytes, fileName: exported.artifact.fileName,
      });
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error("re-import failed");
      const candidate = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0];
      expect(candidate?.diagnostics).toEqual([]);
      expect(candidate?.data).toEqual(professionBatch.resources[0]?.fields);
    }
  });

  test("RinkCX remains explicit about not supporting professions", async () => {
    const exported = await resourceConversionRegistry.export("rinkcx", professionBatch);
    expect(exported.ok).toBe(false);
    expect(exported.report.diagnostics).toContainEqual(expect.objectContaining({ code: "rinkcx.kind.unsupported" }));
  });

  test("Kid subclass card splits into one canonical resource per present level", async () => {
    const imported = await resourceConversionRegistry.import("kid", input({
      id: "kid-wordsmith", type: "subclass", name: "言语大师-基础", baseClass: "吟游诗人",
      creator: "测试", owner: "测试", description: "他们用故事改写现实。", spellcastingAttribute: "风度",
      foundationFeature: "振奋之言：帮助盟友恢复压力。",
      advancedFeature: "英勇之言：强化盟友的行动。",
      masteryFeature: "传奇之言：扭转绝境。",
    }));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("import failed");
    const candidates = mapBatchToRegisteredCandidates(imported.batch.resources).candidates;
    expect(candidates).toHaveLength(3);
    expect(candidates.map((candidate) => candidate.template)).toEqual(Array(3).fill({ id: "子职业", version: "1.0.0" }));
    expect(candidates.map((candidate) => candidate.data)).toEqual(subclassBatch.resources.map((resource) => resource.fields));
    expect(candidates.flatMap((candidate) => candidate.diagnostics)).toEqual([]);
  });

  test("Kid merges three canonical subclass levels and accepts a partial single-level card", async () => {
    const exported = await resourceConversionRegistry.export("kid", subclassBatch, { creator: "测试", owner: "测试" });
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error("export failed");
    expect(kidEngineRead(exported.artifact.bytes)).toMatchObject({
      type: "subclass", name: "言语大师", baseClass: "吟游诗人", description: "他们用故事改写现实。",
      spellcastingAttribute: "风度",
      foundationFeature: "振奋之言：帮助盟友恢复压力。",
      advancedFeature: "英勇之言：强化盟友的行动。",
      masteryFeature: "传奇之言：扭转绝境。",
    });
    const reimported = await resourceConversionRegistry.import("kid", {
      bytes: exported.artifact.bytes, fileName: exported.artifact.fileName,
    });
    expect(reimported.ok).toBe(true);
    if (!reimported.ok) throw new Error("re-import failed");
    expect(mapBatchToRegisteredCandidates(reimported.batch.resources).candidates.map((candidate) => candidate.data))
      .toEqual(subclassBatch.resources.map((resource) => resource.fields));

    const partial = await resourceConversionRegistry.export("kid", {
      ...subclassBatch, resources: [subclassBatch.resources[1]!],
    }, { creator: "测试", owner: "测试" });
    expect(partial.ok).toBe(true);
    if (!partial.ok) throw new Error("partial export failed");
    expect(kidEngineRead(partial.artifact.bytes)).toMatchObject({
      foundationFeature: "", advancedFeature: "英勇之言：强化盟友的行动。", masteryFeature: "",
    });
  });

  test("Kid refuses to merge unrelated subclass resources", async () => {
    const exported = await resourceConversionRegistry.export("kid", {
      ...subclassBatch,
      resources: [subclassBatch.resources[0]!, {
        ...subclassBatch.resources[1]!, fields: { ...subclassBatch.resources[1]!.fields, 主职: "法师" },
      }],
    }, { creator: "测试", owner: "测试" });
    expect(exported.ok).toBe(false);
    expect(exported.report.diagnostics).toContainEqual(expect.objectContaining({ code: "kid.subclass.batch-mismatch" }));
  });

  test("subclass levels remain complete through dhsheet and ZZZ native shapes", async () => {
    for (const formatId of ["dhsheet", "zzz"] as const) {
      const exported = await resourceConversionRegistry.export(formatId, subclassBatch);
      expect(exported.ok).toBe(true);
      if (!exported.ok) throw new Error("export failed");
      if (formatId === "dhsheet") {
        const target = dhsheetEngineImport(exported.artifact.bytes, false);
        expect((target.subclass as Record<string, unknown>[]).map((card) => card.等级)).toEqual(["基石", "专精", "大师"]);
      } else {
        expect(zzzEngineRead(exported.artifact.bytes).map((card) => card.名称)).toEqual([
          "言语大师-基础", "言语大师-进阶", "言语大师-精通",
        ]);
      }
      const imported = await resourceConversionRegistry.import(formatId, {
        bytes: exported.artifact.bytes, fileName: exported.artifact.fileName,
      });
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error("re-import failed");
      const candidates = mapBatchToRegisteredCandidates(imported.batch.resources).candidates;
      expect(candidates.map((candidate) => candidate.data)).toEqual(subclassBatch.resources.map((resource) => resource.fields));
      expect(candidates.flatMap((candidate) => candidate.diagnostics)).toEqual([]);
    }
  });

  test("RinkCX remains explicit about not supporting subclasses", async () => {
    const exported = await resourceConversionRegistry.export("rinkcx", subclassBatch);
    expect(exported.ok).toBe(false);
    expect(exported.report.diagnostics).toContainEqual(expect.objectContaining({ code: "rinkcx.kind.unsupported" }));
  });

  test("Kid ancestry maps its two named features without flattening", async () => {
    const imported = await resourceConversionRegistry.import("kid", input({
      id: "kid-dragonborn", type: "ancestry", name: "龙人", creator: "测试", owner: "测试",
      description: "龙人的外观类似无翼的龙类。",
      feature1Name: "鳞片保护", feature1Desc: "受到严重伤害时可以减少生命损失。",
      feature2Name: "元素吐息", feature2Desc: "喷吐元素能量并造成魔法伤害。",
    }));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("import failed");
    const candidate = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0];
    expect(candidate?.template).toEqual({ id: "种族", version: "1.0.0" });
    expect(candidate?.data).toEqual(ancestryBatch.resources[0]?.fields);
    expect(candidate?.diagnostics).toEqual([]);
  });

  test("ancestry exports to Kid and permits an absent second feature", async () => {
    const exported = await resourceConversionRegistry.export("kid", ancestryBatch, { creator: "测试", owner: "测试" });
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error("export failed");
    expect(kidEngineRead(exported.artifact.bytes)).toMatchObject({
      type: "ancestry", description: "龙人的外观类似无翼的龙类。",
      feature1Name: "鳞片保护", feature1Desc: "受到严重伤害时可以减少生命损失。",
      feature2Name: "元素吐息", feature2Desc: "喷吐元素能量并造成魔法伤害。",
    });
    const partial = await resourceConversionRegistry.export("kid", {
      ...ancestryBatch,
      resources: [{
        ...ancestryBatch.resources[0]!,
        fields: {
          ...ancestryBatch.resources[0]!.fields,
          特性: [{ 特性名称: "鳞片保护", 特性原文: "", 特性描述: "受到严重伤害时可以减少生命损失。" }],
        },
      }],
    }, { creator: "测试", owner: "测试" });
    expect(partial.ok).toBe(true);
    if (!partial.ok) throw new Error("partial export failed");
    expect(kidEngineRead(partial.artifact.bytes)).toMatchObject({ feature2Name: "", feature2Desc: "" });
  });

  test("dhsheet merges and restores its paired ancestry cards", async () => {
    const exported = await resourceConversionRegistry.export("dhsheet", ancestryBatch);
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error("export failed");
    const target = dhsheetEngineImport(exported.artifact.bytes, false);
    expect(target.ancestry).toEqual([
      expect.objectContaining({ 名称: "鳞片保护", 种族: "龙人", 类别: 1, 效果: "受到严重伤害时可以减少生命损失。" }),
      expect.objectContaining({ 名称: "元素吐息", 种族: "龙人", 类别: 2, 效果: "喷吐元素能量并造成魔法伤害。" }),
    ]);
    const imported = await resourceConversionRegistry.import("dhsheet", {
      bytes: exported.artifact.bytes, fileName: exported.artifact.fileName,
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("re-import failed");
    const candidates = mapBatchToRegisteredCandidates(imported.batch.resources).candidates;
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.data).toEqual(ancestryBatch.resources[0]?.fields);
    expect(candidates[0]?.diagnostics).toEqual([]);
  });

  test("ZZZ uses a deterministic merged description and preserves ambiguous source text", async () => {
    const exported = await resourceConversionRegistry.export("zzz", ancestryBatch);
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error("export failed");
    expect(zzzEngineRead(exported.artifact.bytes)[0]).toMatchObject({
      名称: "龙人", 类型: "种族", 简介: "龙人的外观类似无翼的龙类。",
      描述: "鳞片保护：受到严重伤害时可以减少生命损失。\n元素吐息：喷吐元素能量并造成魔法伤害。",
    });
    const reimported = await resourceConversionRegistry.import("zzz", {
      bytes: exported.artifact.bytes, fileName: exported.artifact.fileName,
    });
    expect(reimported.ok).toBe(true);
    if (!reimported.ok) throw new Error("re-import failed");
    expect(mapBatchToRegisteredCandidates(reimported.batch.resources).candidates[0]?.data).toEqual(ancestryBatch.resources[0]?.fields);

    const ambiguousText = "这是一整段无法可靠识别特性边界的说明。";
    const ambiguous = await resourceConversionRegistry.import("zzz", input([
      { 名称: "未知种族", 类型: "种族", 简介: "简介", 描述: ambiguousText },
    ]));
    expect(ambiguous.ok).toBe(true);
    if (!ambiguous.ok) throw new Error("ambiguous import failed");
    expect(mapBatchToRegisteredCandidates(ambiguous.batch.resources).candidates[0]?.data).toMatchObject({
      特性: [{ 特性名称: "", 特性原文: "", 特性描述: ambiguousText }],
    });
  });

  test("RinkCX remains explicit about not supporting ancestries", async () => {
    const exported = await resourceConversionRegistry.export("rinkcx", ancestryBatch);
    expect(exported.ok).toBe(false);
    expect(exported.report.diagnostics).toContainEqual(expect.objectContaining({ code: "rinkcx.kind.unsupported" }));
  });

  test("Kid community preserves introduction, demeanor, and named feature", async () => {
    const imported = await resourceConversionRegistry.import("kid", input({
      id: "kid-highborne", type: "community", name: "高城之民", creator: "测试", owner: "测试",
      description: "来自充满声望的上流社会。", demeanor: "亲切、坦率、狡猾、沉着。",
      featureName: "高人一等", featureDesc: "与贵族交际或利用声誉时具有优势。",
    }));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("import failed");
    const candidate = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0];
    expect(candidate?.template).toEqual({ id: "社群", version: "1.0.0" });
    expect(candidate?.data).toEqual(communityBatch.resources[0]?.fields);
    expect(candidate?.diagnostics).toEqual([]);

    const exported = await resourceConversionRegistry.export("kid", communityBatch, { creator: "测试", owner: "测试" });
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error("export failed");
    expect(kidEngineRead(exported.artifact.bytes)).toMatchObject({
      type: "community", description: "来自充满声望的上流社会。", demeanor: "亲切、坦率、狡猾、沉着。",
      featureName: "高人一等", featureDesc: "与贵族交际或利用声誉时具有优势。",
    });
  });

  test("community remains complete through dhsheet and ZZZ merged descriptions", async () => {
    for (const formatId of ["dhsheet", "zzz"] as const) {
      const exported = await resourceConversionRegistry.export(formatId, communityBatch);
      expect(exported.ok).toBe(true);
      if (!exported.ok) throw new Error("export failed");
      const target = formatId === "dhsheet"
        ? (dhsheetEngineImport(exported.artifact.bytes, false).community as Record<string, unknown>[])[0]
        : zzzEngineRead(exported.artifact.bytes)[0];
      expect(target).toMatchObject({
        名称: "高城之民", 简介: "来自充满声望的上流社会。", 描述: "高人一等：与贵族交际或利用声誉时具有优势。",
      });
      expect(target?.[formatId === "dhsheet" ? "特性" : "性格"]).toBe("亲切、坦率、狡猾、沉着。");
      const imported = await resourceConversionRegistry.import(formatId, {
        bytes: exported.artifact.bytes, fileName: exported.artifact.fileName,
      });
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error("re-import failed");
      const candidate = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0];
      expect(candidate?.data).toEqual(communityBatch.resources[0]?.fields);
      expect(candidate?.diagnostics).toEqual([]);
    }
  });

  test("community import retains an unparseable merged feature as unnamed text", async () => {
    const description = "这是一整段没有可靠特性名称边界的游戏效果。";
    for (const [formatId, value] of [
      ["dhsheet", { name: "包", profession: [], ancestry: [], community: [{ id: "c", 名称: "未知社群", 特性: "谨慎", 简介: "简介", 描述: description }], subclass: [], domain: [], variant: [] }],
      ["zzz", [{ 名称: "未知社群", 类型: "社群", 性格: "谨慎", 简介: "简介", 描述: description }]],
    ] as const) {
      const imported = await resourceConversionRegistry.import(formatId, input(value as unknown as JsonValue));
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error("import failed");
      expect(mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0]?.data).toMatchObject({
        特性: { 特性名称: "", 特性原文: "", 特性描述: description },
      });
    }
  });

  test("RinkCX remains explicit about not supporting communities", async () => {
    const exported = await resourceConversionRegistry.export("rinkcx", communityBatch);
    expect(exported.ok).toBe(false);
    expect(exported.report.diagnostics).toContainEqual(expect.objectContaining({ code: "rinkcx.kind.unsupported" }));
  });

  test("Kid domain separates gameplay ability from flavor description", async () => {
    const imported = await resourceConversionRegistry.import("kid", input({
      id: "kid-rune-charm", type: "domain", name: "符文护符", creator: "测试", owner: "测试",
      description: "一件意义深远的个人小饰品。", domainName: "奥术", level: "1级", category: "法术",
      recallCost: "0⚡", ability: "花费希望点以减少即将到来的伤害。",
    }));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("import failed");
    const candidate = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0];
    expect(candidate?.template).toEqual({ id: "领域卡", version: "1.0.0" });
    expect(candidate?.data).toEqual(domainBatch.resources[0]?.fields);
    expect(candidate?.diagnostics).toEqual([]);

    const exported = await resourceConversionRegistry.export("kid", domainBatch, { creator: "测试", owner: "测试" });
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error("export failed");
    expect(kidEngineRead(exported.artifact.bytes)).toMatchObject({
      type: "domain", description: "一件意义深远的个人小饰品。", domainName: "奥术",
      level: "1", category: "法术", recallCost: "0", ability: "花费希望点以减少即将到来的伤害。",
    });
  });

  test("domain normalizes dhsheet and ZZZ numeric fields without losing its summary", async () => {
    for (const formatId of ["dhsheet", "zzz"] as const) {
      const exported = await resourceConversionRegistry.export(formatId, domainBatch);
      expect(exported.ok).toBe(true);
      if (!exported.ok) throw new Error("export failed");
      expect(exported.report.diagnostics).toEqual([]);
      const target = formatId === "dhsheet"
        ? (dhsheetEngineImport(exported.artifact.bytes, false).domain as Record<string, unknown>[])[0]
        : zzzEngineRead(exported.artifact.bytes)[0];
      expect(target).toMatchObject({ 名称: "符文护符", 领域: "奥术", 等级: 1, 属性: "法术", 回想: 0, 描述: "花费希望点以减少即将到来的伤害。" });
      expect(target).toHaveProperty("风味描述", "一件意义深远的个人小饰品。");
      const imported = await resourceConversionRegistry.import(formatId, {
        bytes: exported.artifact.bytes, fileName: exported.artifact.fileName,
      });
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error("re-import failed");
      const candidate = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0];
      expect(candidate?.data).toEqual(domainBatch.resources[0]?.fields);
      expect(candidate?.diagnostics).toEqual([]);
    }
  });

  test("RinkCX remains explicit about not supporting domain cards", async () => {
    const exported = await resourceConversionRegistry.export("rinkcx", domainBatch);
    expect(exported.ok).toBe(false);
    expect(exported.report.diagnostics).toContainEqual(expect.objectContaining({ code: "rinkcx.kind.unsupported" }));
  });

  test("RinkCX scene silently discards fear metadata but preserves environment rules", async () => {
    const imported = await resourceConversionRegistry.import("rinkcx", input({
      name: "燃烧的图书馆", nameEn: "Burning Library", rank: "2", type: "险境",
      description: "烈焰吞噬了古老藏书。", tendencies: "蔓延火势；隔断退路", difficulty: "14",
      enemies: "纵火者、灰烬幽灵",
      traits: [{ name: "坍塌", type: "动作", fear: true, cost: "2", desc: "燃烧的书架轰然倒下。", qs: "谁被困在火海中？" }],
    }));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("import failed");
    const candidate = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0];
    expect(candidate?.template).toEqual({ id: "环境", version: "1.0.0" });
    expect(candidate?.data).toMatchObject(environmentBatch.resources[0]?.fields ?? {});
    expect(candidate?.data.原文).toBe("Burning Library");
    expect((candidate?.data.特性 as Array<Record<string, unknown>>)[0]?.特性原文).toBe("");
    expect(candidate?.diagnostics).toEqual([]);

    const exported = await resourceConversionRegistry.export("rinkcx", environmentBatch);
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error("export failed");
    const target = rinkcxEngineRead(exported.artifact.bytes)[0];
    expect(target?.type).toBe("scene");
    expect(target?.data).toMatchObject({ name: "燃烧的图书馆", rank: "2", type: "险境", difficulty: "14" });
    expect((target?.data.traits as Record<string, unknown>[])[0]).toEqual({
      name: "坍塌", type: "动作", desc: "燃烧的书架轰然倒下。", qs: "谁被困在火海中？",
    });
  });

  test("Kid environment silently discards isFear and fearCost", async () => {
    const imported = await resourceConversionRegistry.import("kid", input({
      id: "kid-environment", type: "environment", name: "燃烧的图书馆", creator: "测试", owner: "测试",
      description: "烈焰吞噬了古老藏书。", tier: "2", envType: "险境", tendency: "蔓延火势；隔断退路",
      difficulty: "14", potentialEnemies: "纵火者、灰烬幽灵",
      features: [{ name: "坍塌", type: "动作", isFear: true, fearCost: "2", description: "燃烧的书架轰然倒下。", guidingQuestion: "谁被困在火海中？" }],
    }));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("import failed");
    expect(mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0]?.data)
      .toMatchObject(environmentBatch.resources[0]?.fields ?? {});

    const exported = await resourceConversionRegistry.export("kid", environmentBatch, { creator: "测试", owner: "测试" });
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error("export failed");
    const feature = (kidEngineRead(exported.artifact.bytes).features as Record<string, unknown>[])[0];
    expect(feature).toEqual({ name: "坍塌", type: "动作", description: "燃烧的书架轰然倒下。", guidingQuestion: "谁被困在火海中？" });
  });

  test("environment remains complete through dhsheet and ZZZ open records", async () => {
    for (const formatId of ["dhsheet", "zzz"] as const) {
      const exported = await resourceConversionRegistry.export(formatId, environmentBatch);
      expect(exported.ok).toBe(true);
      if (!exported.ok) throw new Error("export failed");
      if (formatId === "dhsheet") dhsheetEngineImport(exported.artifact.bytes, false);
      else expect(zzzEngineRead(exported.artifact.bytes)[0]).toMatchObject({ 类型: "环境", 名称: "燃烧的图书馆" });
      const imported = await resourceConversionRegistry.import(formatId, {
        bytes: exported.artifact.bytes, fileName: exported.artifact.fileName,
      });
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error("re-import failed");
      const candidate = mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0];
      expect(candidate?.data).toMatchObject(environmentBatch.resources[0]?.fields ?? {});
      expect(candidate?.diagnostics).toEqual([]);
    }
  });

  test("authoritative pbres reader and writer remain the native adapter engine", async () => {
    const bytes = new Uint8Array(readFileSync(path.join(
      process.cwd(), "contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.pbres",
    )));
    const imported = await resourceConversionRegistry.import("pbres", { bytes, fileName: "minotaur-wrecker.pbres", container: "pbres" });
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("pbres import failed");
    const exported = await resourceConversionRegistry.export("pbres", imported.batch);
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error("pbres export failed");
    const read = await loadPbres(exported.artifact.bytes, validatePbresConversionCandidate);
    expect(read.candidate?.document.package.id).toBe(imported.batch.nativePackage?.package.id);
  });

  test("pbres restores the exact Free Template identity", async () => {
    const bytes = new Uint8Array(readFileSync(path.join(
      process.cwd(), "contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.pbres",
    )));
    const loaded = await loadPbres(bytes, validatePbresConversionCandidate);
    expect(loaded.candidate).toBeDefined();
    if (!loaded.candidate) throw new Error("fixture did not load");
    const document = structuredClone(loaded.candidate.document);
    const resource = document.resources[0]!;
    resource.template = { id: "自由", version: "1.0.0" };
    resource.data = {
      名称: "复仇誓言",
      类型: "专属",
      简介: "你不会忘记那一天。",
      内容: [
        { 名称: "触发条件", 描述: "造成伤害时" },
        { 名称: "效果", 描述: "伤害+2" },
      ],
    };
    document.snapshotDigest = await computeResourcePackageSnapshotDigest(document, loaded.candidate.media);
    const imported = await resourceConversionRegistry.import("pbres", {
      bytes: writePbres(document, loaded.candidate.media), fileName: "free.pbres", container: "pbres",
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("pbres import failed");
    expect(imported.batch.resources[0]?.kind).toBe("free");
    expect(mapBatchToRegisteredCandidates(imported.batch.resources).candidates[0]).toMatchObject({
      template: { id: "自由", version: "1.0.0" },
      data: resource.data,
    });
  });

  test("pbres rejects resource data that violates its exact registered Template", async () => {
    const bytes = new Uint8Array(readFileSync(path.join(
      process.cwd(), "contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.pbres",
    )));
    const loaded = await loadPbres(bytes, validatePbresConversionCandidate);
    expect(loaded.candidate).toBeDefined();
    if (!loaded.candidate) throw new Error("fixture did not load");
    const malformed = structuredClone(loaded.candidate.document);
    const data = malformed.resources[0]?.data as Record<string, JsonValue>;
    data.unexpected = "not allowed by the Template";
    malformed.snapshotDigest = await computeResourcePackageSnapshotDigest(malformed, loaded.candidate.media);
    const result = await resourceConversionRegistry.import("pbres", {
      bytes: writePbres(malformed, loaded.candidate.media),
      fileName: "invalid-template-data.pbres",
      container: "pbres",
    });
    expect(result.ok).toBe(false);
    expect(result.report.diagnostics).toContainEqual(expect.objectContaining({
      code: "conversion.template-data.invalid",
      path: "/resources/0/data",
    }));
  });
});
