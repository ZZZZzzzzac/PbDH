import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadPbres, loadPbcha, writePbcha } from "@pbdh/contract-runtime";
import { beforeAll, describe, expect, it } from "vitest";
import { playerSystemPackageCatalog } from "../../apps/player/src/playerSystemPackageCatalog.ts";
import { validateResourcePackageCandidate } from "../../apps/player/src/resources/resource-package-validator.ts";
import { routeResourcePackage } from "../../apps/player/src/resources/route-resource-package.ts";
import type { ResourceLibrary } from "../../apps/player/src/resources/resource-library.ts";
import { validateCharacterSaveCandidate } from "../../apps/player/src/character-saves/character-save-validator.ts";
import { characterSaveToSheet, sheetCharacterToSave } from "../../apps/player/src/sheet-runtime/storage/characterSaveAdapter.ts";
import { convertExternalCharacterSource, exportExternalCharacterData, parseAndDetectCharacterSource } from "../../apps/player/src/sheet-runtime/domain/characterFormatAdapter.ts";
import { createEmptyCharacterData, exportCharacterData, type CharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import { parseCharacterDataText } from "../../apps/player/src/sheet-runtime/export/output.ts";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import { applyResourceSelectionToDraft } from "../../apps/player/src/sheet-runtime/domain/resourceSelection.ts";
import { executePackageScriptInWorker } from "../../apps/player/src/sheet-runtime/domain/packageScriptRunner.ts";
import { canonicalCardResource } from "../../apps/player/src/sheet-runtime/rendering/cardTable/CardFace.tsx";
import { cardReplacementOptions, replacePlayerCard } from "../../apps/player/src/sheet-runtime/domain/cardReplacement.ts";
import { resolveResourceDefinition } from "../../apps/player/src/sheet-runtime/domain/resourceDefinition.ts";

async function loadSystem(directory: string) {
  const catalog = playerSystemPackageCatalog.find((entry) => entry.preset.directory === directory)!;
  const root = path.resolve("apps/player/public/system-packages", directory);
  const installed = new Map<string, ResourceLibrary extends ReadonlyMap<string, infer Value> ? Value : never>();
  for (const embedded of catalog.system.embeddedResources) {
    const loaded = await loadPbres(new Uint8Array(await readFile(path.join(root, embedded.path))), validateResourcePackageCandidate);
    if (!loaded.candidate) throw new Error(JSON.stringify(loaded.diagnostics));
    installed.set(loaded.candidate.document.package.id, {
      ...loaded.candidate,
      routes: routeResourcePackage({ currentSystem: catalog.system, resourcePackage: loaded.candidate.document }),
    });
  }
  const loaded = await catalog.load({ currentSystem: catalog.system, installedPackages: installed, baseUrl: "/", fetchFile: async (url) => {
    const pathname = new URL(String(url), "https://preset.invalid").pathname;
    const relative = decodeURIComponent(pathname.split(`/system-packages/${directory}/`)[1]!);
    try { return new Response(await readFile(path.join(root, relative))); }
    catch { return new Response(null, { status: 404 }); }
  } });
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
  return { system: loaded.package, installed, catalog };
}

function adapter(system: SystemPackage) {
  return system.characterFormatAdapters!.find((item) => item.ID.includes("dhsheet"))!;
}

async function importSheet(system: SystemPackage, document: Record<string, unknown>) {
  const result = await convertExternalCharacterSource({ document, fileName: "sample.json", carrier: { 类型: "json", 检测: [] } }, adapter(system), system);
  if ("error" in result) throw new Error(JSON.stringify(result.error));
  return result;
}

async function exportSheet(system: SystemPackage, data: CharacterData) {
  const result = await exportExternalCharacterData(data, adapter(system), system);
  if ("error" in result) throw new Error(JSON.stringify(result.error));
  return result;
}

// 依据 dhsheet 的 SheetData / StandardCard 建样本，不调用待测导出脚本生成输入。
function sourceDocument(cards: unknown[] = []) {
  return {
    ruleSetId: "daggerheart", name: "互通测试", level: "7", proficiency: 4,
    gold: Array.from({ length: 21 }, (_, index) => index >= 18),
    experience: ["侦察", "制图", "交涉", "航行", "医术"], experienceValues: ["2", "3", "1", "4", "2"],
    hope: 3, hopeMax: 6, hp: [true, false, true], hpMax: 8, stress: [false, true], stressMax: 7,
    armorBoxes: [true], armorMax: 4, inventory: ["绳索", "", "口粮", "", "药品"], cards, inventory_cards: [],
    primaryWeaponName: "测试武器", primaryWeaponTrait: "", primaryWeaponDamage: "2d8+3",
    inventoryWeapon1Name: "短弓", inventoryWeapon1Trait: "敏捷", inventoryWeapon1Damage: "d6+2", inventoryWeapon1Feature: "备用",
    companionName: "测试伙伴", companionWeapon: "d8", companionRange: "近距离", companionStress: [true], companionStressMax: 4,
    companionExperience: ["追踪", "守望"], companionExperienceValue: ["3", "2"],
    agility: { checked: false, value: "3", spellcasting: false },
    trainingOptions: { intelligent: [true, false, true], radiantInDarkness: [true], creatureComfort: [false], armored: [true], vicious: [false, true, false], resilient: [true, false, false], bonded: [true], aware: [false, true, false] },
  };
}

function domainCard(system: SystemPackage) {
  const entry = system.resourceLibraries!.find((library) => library.ID === "domain-cards")!.entries[0]!;
  return {
    standarized: true, id: String(entry.fields.原名 || entry.ID), name: String(entry.fields.名称), type: "domain",
    class: String(entry.fields.领域), level: Number(String(entry.fields.等级).replace(/级$/u, "")), description: String(entry.fields.描述),
    cardSelectDisplay: { item1: String(entry.fields.领域), item2: String(entry.fields.属性 || ""), item3: `RC.${entry.fields.回想 || 0}` },
  };
}

describe.each(["daggerheart-core", "tttri"])("%s dhsheet interop", (directory) => {
  let context: Awaited<ReturnType<typeof loadSystem>>;
  beforeAll(async () => { context = await loadSystem(directory); }, 60000);

  if (directory === "tttri") it.each(["x", "y"])("所有核心子职的 T4%s 按最终特性往返，不依赖外部样本", async (selectedModule) => {
    const { system, catalog, installed } = context;
    const entries = system.resourceLibraries!.find((library) => library.ID === "subclasses")!.entries.filter((entry) => entry.fields.阶段 === `T4${selectedModule.toUpperCase()}`);
    expect(entries.length).toBeGreaterThan(0);
    for (const [index, entry] of entries.entries()) {
      const name = String(entry.fields.名称);
      const profession = String(entry.fields.主职);
      const classText = `职业最终文本 ${profession}/${name}/${selectedModule}`;
      const subclassText = `子职最终文本 ${name}/${selectedModule}`;
      const hopeText = `希望最终文本 ${name}/${selectedModule}`;
      const source = { ...sourceDocument(), level: "8", ruleSetId: "rhodes-island", selectedModule,
        profession: "external-class", professionRef: { id: "external-class", name: profession },
        subclass: "external-branch", subclassRef: { id: "external-branch", name },
        cards: [{ standarized: true, id: "external-class", type: "profession", class: profession, name: profession, description: classText, professionSpecial: { 希望特性: hopeText }, cardSelectDisplay: {} }, { standarized: true, id: "external-branch", type: "subclass", class: profession, name, level: 1, description: subclassText, cardSelectDisplay: {} }],
      };
      const imported = await importSheet(system, source);
      expect(imported.report.skippedCards).toBe(0);
      expect(imported.data.character.values).toMatchObject({ "subclass-stage": `精英${selectedModule.toUpperCase()}`, "class-feature": classText, "subclass-current": subclassText, "class-hope-feature": hopeText });
      const candidate = await sheetCharacterToSave({ name: "T4测试", data: imported.data, currentSystem: { ...catalog.system.package, resourceCompatibility: catalog.system.resourceCompatibility }, sheetSystemPackage: system, installedPackages: installed });
      const reopened = await loadPbcha(writePbcha(candidate.document, candidate.media), validateCharacterSaveCandidate);
      expect(reopened.diagnostics).toEqual([]);
      const restored = characterSaveToSheet({ candidate: reopened.candidate!, currentSystem: catalog.system, sheetSystemPackage: system, mediaUrl: (id) => id });
      const exported = await exportSheet(system, restored);
      expect(exported.document.selectedModule).toBe(selectedModule);
      expect(exported.document.branchUpgradeCount).toBe(2);
      expect(exported.document.subclass).toMatch(/^ri-branch-[a-f0-9]{12}$/u);
      const cards = exported.document.cards as Array<{ description: string }>;
      expect(cards[0]!.description).toBe(classText);
      expect(cards[1]!.description).toBe(subclassText);
      const again = await importSheet(system, exported.document);
      expect(again.data.character.values).toMatchObject({ "subclass-stage": `精英${selectedModule.toUpperCase()}`, "class-feature": classText, "subclass-current": subclassText, "class-hope-feature": hopeText });
      if (process.env.PBDH_WRITE_INTEROP_SAMPLES === "1" && index === 0) {
        await writeFile(path.resolve(".scratch/dhsheet-interop", `tttri-t4-${selectedModule}.json`), `${JSON.stringify(exported.document, null, 2)}\n`);
        await writeFile(path.resolve(".scratch/dhsheet-interop", `tttri-t4-${selectedModule}.pbcha`), writePbcha(candidate.document, candidate.media));
      }
    }
  }, 30000);

  if (directory === "tttri") it("核心领域卡名称正确，五组 replacement 可切换并经 PBCHA 保存恢复", async () => {
    const resources = [...context.installed.values()].flatMap((item) => item.document.resources);
    const nameOf = (item: typeof resources[number]) => item.data && typeof item.data === "object" && !Array.isArray(item.data) ? item.data.名称 : undefined;
    for (const name of ["恶魇吞日", "遁入阇那"]) expect(resources.some((item) => nameOf(item) === name)).toBe(true);
    for (const [frontName, backName] of [["归乡邀约", "归乡邀约·洗礼"], ["霜白摇篮曲", "摇篮曲·终"], ["大地的慈悲", "大地的慈悲·昭示"], ["反击炮火", "召唤：炮台"], ["号令巨兵", "召唤：巨兵"]]) {
      const front = resources.find((item) => nameOf(item) === frontName)!;
      const back = resources.find((item) => nameOf(item) === backName)!;
      expect(back).toBeDefined();
      expect(front.replacements).toEqual([{ replacementId: "alternate-form", targetResourceId: back.id }]);
      expect(back.replacements).toEqual([{ replacementId: "alternate-form", targetResourceId: front.id }]);
      expect(back.template).toEqual({ id: "领域卡", version: "1.1.0" });
      expect([...context.installed.values()].some((item) => item.media.has(back.media.portrait!))).toBe(true);
      const { system, catalog, installed } = context;
      const library = system.resourceLibraries!.find((item) => item.ID === "domain-cards")!;
      const frontEntry = library.entries.find((item) => item.resourceCopy?.source?.resourceId === front.id)!;
      let data = createEmptyCharacterData(system);
      data.cards.instances = [{ instanceId: crypto.randomUUID(), tableModuleId: "character-card-table", definitionRef: { type: "resourceLibrary", libraryId: library.ID, entryId: frontEntry.ID }, state: "配置", xPct: 25, yPct: 30, zIndex: 3, rotation: 90, face: "front", scale: 1.2, indicators: [] }];
      const options = cardReplacementOptions(data, system, data.cards.instances[0]!.instanceId);
      expect(options.map((option) => option.name)).toEqual([backName]);
      data = replacePlayerCard(data, system, data.cards.instances[0]!.instanceId, "alternate-form", crypto.randomUUID());
      expect(data.cards.instances[0]).toMatchObject({ xPct: 25, yPct: 30, zIndex: 3, rotation: 90, scale: 1.2 });
      const candidate = await sheetCharacterToSave({ name: backName!, data, currentSystem: { ...catalog.system.package, resourceCompatibility: catalog.system.resourceCompatibility }, sheetSystemPackage: system, installedPackages: installed });
      const opened = await loadPbcha(writePbcha(candidate.document, candidate.media), validateCharacterSaveCandidate);
      expect(opened.diagnostics).toEqual([]);
      data = characterSaveToSheet({ candidate: opened.candidate!, currentSystem: catalog.system, sheetSystemPackage: system, installedPackages: installed, mediaUrl: (id) => id });
      const exported = await exportSheet(system, data);
      expect((exported.document.cards as Array<{ name: string }>).some((item) => item.name === backName)).toBe(true);
      expect((await importSheet(system, exported.document)).report.skippedCards).toBe(0);
      expect(cardReplacementOptions(data, system, data.cards.instances[0]!.instanceId).map((option) => option.name)).toEqual([frontName]);
      const missing = { ...system, resourceLibraries: [] };
      expect(() => replacePlayerCard(data, missing, data.cards.instances[0]!.instanceId, "alternate-form", crypto.randomUUID())).toThrow("替换目标未安装");
      data = replacePlayerCard(data, system, data.cards.instances[0]!.instanceId, "alternate-form", crypto.randomUUID());
      expect(cardReplacementOptions(data, system, data.cards.instances[0]!.instanceId).map((option) => option.name)).toEqual([backName]);
    }
  });

  if (directory === "daggerheart-core") it("野兽羁绊与驯兽大师三个阶段双向对应", async () => {
    const cards = ["Foundation", "Specialization", "Mastery"].map((stage, index) => ({
      standarized: true, id: `Beastbound-${stage}`, name: `野兽羁绊${["基石", "专精", "大师"][index]}`, headerDisplay: "野兽羁绊", type: "subclass", class: "游侠", level: index + 1, description: "", cardSelectDisplay: {},
    }));
    const imported = await importSheet(context.system, { ...sourceDocument(cards), subclassRef: { id: cards[0]!.id, name: cards[0]!.name } });
    expect(imported.report.skippedCards).toBe(0);
    expect(imported.data.cards.instances).toHaveLength(3);
    expect(imported.data.character.values["subclass-name"]).toBe("驯兽大师");
    const exported = await exportSheet(context.system, imported.data);
    const subclasses = (exported.document.cards as typeof cards).filter((card) => card.type === "subclass");
    expect(subclasses.map((card) => [card.id, card.name, card.level])).toEqual(cards.map((card) => [card.id, card.name, card.level]));
    expect((await importSheet(context.system, exported.document)).report.skippedCards).toBe(0);
  });

  if (directory === "daggerheart-core") it("两项种族特性按槽位合成，未知血统留空，PBCHA 往返不丢特性", async () => {
    const { system, catalog, installed } = context;
    const entries = system.resourceLibraries!.find((library) => library.ID === "ancestries")!.entries;
    const pair = [entries[0]!, entries[1]!].map((entry, index) => {
      const feature = (entry.resourceCopy!.data.特性 as Array<{ 特性名称: string; 特性描述: string }>)[index]!;
      return { standarized: true, id: `ancestry-${index}`, name: feature.特性名称, description: feature.特性描述, type: "ancestry", class: entry.fields.名称, level: index + 1, cardSelectDisplay: {} };
    });
    for (const unknown of [false, true]) {
      const cards = structuredClone(pair);
      if (unknown) cards[1]!.name = "未知特性";
      const imported = await importSheet(system, { ...sourceDocument(cards), ancestry1: cards[0]!.id, ancestry2: cards[1]!.id });
      const normalized = parseCharacterDataText(exportCharacterData(imported.data), system);
      expect(normalized.ok).toBe(true);
      if (!normalized.ok) throw new Error(normalized.error);
      expect(normalized.report.skippedCards).toBe(0);
      expect(normalized.data.cards.instances).toHaveLength(1);
      const composite = Object.values(normalized.data.compositeResources)[0]!;
      const legacyData = structuredClone(normalized.data);
      delete legacyData.compositeResources[composite.ID]!.resourceCopy;
      expect(resolveResourceDefinition(system, legacyData, legacyData.cards.instances[0]!.definitionRef)?.resourceCopy?.template.id).toBe("种族");
      expect(legacyData.compositeResources[composite.ID]!.resourceCopy).toBeUndefined();
      expect(composite.resourceCopy?.template.id).toBe("种族");
      expect(composite.resourceCopy?.presentation.mode).toBe("text");
      expect(composite.resourceCopy?.data.特性).toEqual(cards.map((card, index) => expect.objectContaining({ 特性名称: card.name, 特性描述: card.description, 特性原文: unknown && index === 1 ? "" : expect.any(String) })));
      expect(imported.report.skippedCards).toBe(0);
      expect(imported.data.cards.instances).toHaveLength(1);
      const fields = Object.values(imported.data.compositeResources)[0]!.fields;
      expect(fields.种族B名称).toBe(unknown ? "" : entries[1]!.fields.名称);
      const candidate = await sheetCharacterToSave({ name: "混血", data: imported.data, currentSystem: { ...catalog.system.package, resourceCompatibility: catalog.system.resourceCompatibility }, sheetSystemPackage: system, installedPackages: installed });
      const reopened = await loadPbcha(writePbcha(candidate.document, candidate.media), validateCharacterSaveCandidate);
      expect(reopened.diagnostics).toEqual([]);
      const restored = characterSaveToSheet({ candidate: reopened.candidate!, currentSystem: catalog.system, sheetSystemPackage: system, mediaUrl: (id) => id });
      const exported = await exportSheet(system, restored);
      const result = (exported.document.cards as typeof cards).filter((card) => card.type === "ancestry");
      expect(result.map((card) => [card.name, card.description, card.level])).toEqual(cards.map((card) => [card.name, card.description, card.level]));
    }
  });

  if (directory === "daggerheart-core") it("主职兼职不生成桌面职业卡，导出通过子职生成两张外部职业卡", async () => {
    const { system, catalog, installed } = context;
    const classes = system.resourceLibraries!.find((library) => library.ID === "classes")!.entries;
    expect(system.modules.find((module) => module.ID === "pick-multiclass")).toMatchObject({ 按钮文本: "兼" });
    for (const entry of classes) expect(entry.resourceCopy?.presentation.fixedRatio).toBe(false);
    const table = system.modules.find((module) => module.ID === "character-card-table");
    if (table?.类型 !== "cardTable") throw new Error("Missing card table");
    for (const entry of classes) {
      const surface = canonicalCardResource(entry.resourceCopy!, entry, table, { type: "resourceLibrary", libraryId: "classes", entryId: entry.ID });
      expect(surface.presentation.fixedRatio).toBe(false);
      expect(entry.resourceCopy!.presentation.fixedRatio).toBe(false);
    }
    const [primary, secondary] = classes;
    let data = applyResourceSelectionToDraft(createEmptyCharacterData(system), system, "pick-class", "classes", [primary!]).characterData;
    expect(data.cards.instances).toHaveLength(0);
    const before = structuredClone(data.character.values);
    data = applyResourceSelectionToDraft(data, system, "pick-multiclass", "classes", [secondary!]).characterData;
    expect(data.cards.instances).toHaveLength(0);
    const subclass = system.resourceLibraries!.find((library) => library.ID === "subclasses")!.entries.find((entry) => entry.fields.主职 === secondary!.fields.名称)!;
    data = applyResourceSelectionToDraft(data, system, "pick-subclass", "subclasses", [subclass]).characterData;
    for (const key of ["class-name", "hp", "evasion", "class-hope-feature", "background-question-1"]) expect(data.character.values[key]).toEqual(before[key]);
    expect(data.character.values["class-feature"]).toBe(`${before["class-feature"]}\n\n【${secondary!.fields.名称}】\n${secondary!.fields.职业特性}`);
    const candidate = await sheetCharacterToSave({ name: "兼职角色", data, currentSystem: { ...catalog.system.package, resourceCompatibility: catalog.system.resourceCompatibility }, sheetSystemPackage: system, installedPackages: installed });
    const reopened = await loadPbcha(writePbcha(candidate.document, candidate.media), validateCharacterSaveCandidate);
    expect(reopened.diagnostics).toEqual([]);
    const restored = characterSaveToSheet({ candidate: reopened.candidate!, currentSystem: catalog.system, sheetSystemPackage: system, mediaUrl: (id) => id });
    const exported = await exportSheet(system, restored);
    const cards = (exported.document.cards as Array<{ type: string; name: string; description: string }>).filter((card) => card.type === "profession");
    expect(cards.map((card) => card.name)).toEqual([primary!.fields.名称, secondary!.fields.名称]);
    expect(cards.map((card) => card.description)).toEqual([primary!.fields.职业特性, secondary!.fields.职业特性]);
    expect(exported.report.exportedCards).toBe(3);
    const imported = await importSheet(system, exported.document);
    expect(imported.report.skippedCards).toBe(0);
    expect(imported.data.cards.instances).toHaveLength(1);
    expect(imported.data.character.values["class-feature"]).toEqual(data.character.values["class-feature"]);
    const script = await readFile(path.resolve("apps/player/public/system-packages/daggerheart-core/checks/character-consistency.js"), "utf8");
    const check = async () => await executePackageScriptInWorker(script, { characterData: restored, resourceLibraries: system.resourceLibraries }, "multiclass check") as Array<{ code: string }>;
    expect((await check()).some((issue) => issue.code === "MULTICLASS_SUBCLASS_MISMATCH")).toBe(true);
    restored.character.values["advancement-tier-3"] = { "multiclass-1": true, "multiclass-2": true };
    expect((await check()).some((issue) => issue.code === "MULTICLASS_PROFESSION_MISMATCH")).toBe(false);
    expect((await check()).some((issue) => issue.code === "MULTICLASS_SUBCLASS_MISMATCH")).toBe(false);
    restored.character.values["class-feature"] = "玩家自行改写的汇总";
    const canonicalExport = await exportSheet(system, restored);
    expect((canonicalExport.document.cards as Array<{ type: string; description: string }>).filter((card) => card.type === "profession").map((card) => card.description)).toEqual([primary!.fields.职业特性, secondary!.fields.职业特性]);
    expect(canonicalExport.report.diagnostics.some((issue) => issue.code === "DHSHEET_PROFESSION_SUMMARY_NOT_REVERSIBLE")).toBe(false);
  });

  it("识别无规则标识的旧 JSON 和 HTML，拒绝其他规则包", () => {
    const source: Record<string, unknown> = sourceDocument();
    delete source.ruleSetId;
    expect(parseAndDetectCharacterSource(JSON.stringify(source), "old.json", [adapter(context.system)]).status).toBe("match");
    expect(parseAndDetectCharacterSource(`window.characterData = ${JSON.stringify(source, null, 2)};`, "old.html", [adapter(context.system)]).status).toBe("match");
    expect(parseAndDetectCharacterSource(JSON.stringify({ ...source, ruleSetId: "other-game" }), "other.json", [adapter(context.system)]).status).toBe("none");
  });

  it("读取数值型熟练并保留三箱金币", async () => {
    const imported = await importSheet(context.system, sourceDocument());
    expect(imported.data.character.values.proficiency).toEqual({ current: 4, max: 6 });
    expect(imported.data.character.values["chest-gold"]).toEqual({ current: 3, max: null });
  });

  it("装备组合保留中间空字段的位置", async () => {
    const imported = await importSheet(context.system, sourceDocument());
    const exported = await exportSheet(context.system, imported.data);
    expect(exported.document).toMatchObject({ primaryWeaponName: "测试武器", primaryWeaponTrait: "", primaryWeaponDamage: "2d8+3" });
  });

  if (directory === "daggerheart-core") it("原生五段武器和带标签护甲导出到正确字段", async () => {
    const data = createEmptyCharacterData(context.system);
    Object.assign(data.character.values, {
      "primary-weapon-name": "**短弓**｜敏捷｜远距离｜d6+3 物理｜双手",
      "armor-name": "**皮甲**｜阈值 5/11｜护甲值 3",
      "armor-value": "3", "major-threshold": "7", "severe-threshold": "13",
    });
    const exported = await exportSheet(context.system, data);
    expect(exported.document).toMatchObject({ primaryWeaponName: "短弓", primaryWeaponTrait: "物理/双手/远距离", primaryWeaponDamage: "敏捷: d6+3", armorName: "皮甲", armorBaseScore: "3", armorThreshold: "5/11", armorValue: "3", minorThreshold: "7", majorThreshold: "13" });
  });

  it("保留配置与宝库中的重复卡实例", async () => {
    const card = domainCard(context.system);
    const imported = await importSheet(context.system, { ...sourceDocument([card, card]), inventory_cards: [card] });
    expect(imported.data.cards.instances.map((item) => item.state)).toEqual(["配置", "配置", "宝库"]);
    const exported = await exportSheet(context.system, imported.data);
    expect((exported.document.cards as typeof card[]).filter((item) => item.type === "domain")).toHaveLength(2);
    expect((exported.document.inventory_cards as typeof card[]).filter((item) => item.type === "domain")).toHaveLength(1);
  });

  it("PBCHA 保存恢复后仍能导出卡牌内容与等级", async () => {
    const { system, installed, catalog } = context;
    const card = domainCard(system);
    const imported = await importSheet(system, sourceDocument([card]));
    const candidate = await sheetCharacterToSave({ name: "往返样本", data: imported.data, currentSystem: { ...catalog.system.package, resourceCompatibility: catalog.system.resourceCompatibility }, sheetSystemPackage: system, installedPackages: installed });
    const archive = writePbcha(candidate.document, candidate.media);
    const reopened = await loadPbcha(archive, validateCharacterSaveCandidate);
    expect(reopened.diagnostics).toEqual([]);
    const restored = characterSaveToSheet({ candidate: reopened.candidate!, currentSystem: catalog.system, sheetSystemPackage: system, mediaUrl: (id) => id });
    const exported = await exportSheet(system, restored);
    const cards = (exported.document.cards as typeof card[]).filter((item) => item.type === "domain");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ name: card.name, class: card.class, level: card.level, description: card.description });
  });

  it("空卡槽不计为丢失卡", async () => {
    const imported = await importSheet(context.system, sourceDocument([null, { standarized: true, id: "empty-1", name: "", type: "unknown", class: "", description: "", cardSelectDisplay: {} }]));
    expect(imported.report.skippedCards).toBe(0);
  });

  it("未安装自定义卡明确报告而不伪造匹配", async () => {
    const imported = await importSheet(context.system, sourceDocument([{ ...domainCard(context.system), id: "custom-only", name: "不存在的自定义领域卡", description: "独有规则" }]));
    expect(imported.report.skippedCards).toBe(1);
    expect(imported.report.diagnostics.some((item) => item.code === "CHARACTER_ADAPTER_CARD_NOT_FOUND")).toBe(true);
  });

  it("全部领域卡分批经 dhsheet 往返，保持名称领域等级回想", async () => {
    const system = context.system;
    const entries = system.resourceLibraries!.find((library) => library.ID === "domain-cards")!.entries;
    for (let start = 0; start < entries.length; start += 15) {
      const batch = entries.slice(start, start + 15);
      const sourceCards = batch.map((entry) => ({ standarized: true, id: entry.ID, name: entry.fields.名称, class: entry.fields.领域, type: "domain", level: Number.parseInt(String(entry.fields.等级), 10), description: entry.fields.描述, cardSelectDisplay: {} }));
      const imported = await importSheet(system, sourceDocument(sourceCards));
      expect(imported.report.skippedCards).toBe(0);
      const exported = await exportSheet(system, imported.data);
      const cards = (exported.document.cards as ReturnType<typeof domainCard>[]).filter((card) => card.type === "domain");
      expect(cards.map((card) => [card.name, card.class, card.level])).toEqual(sourceCards.map((card) => [card.name, card.class, card.level]));
      const again = await importSheet(system, exported.document);
      expect(again.report.skippedCards).toBe(0);
      expect(again.data.cards.instances.map((card) => card.definitionRef)).toEqual(imported.data.cards.instances.map((card) => card.definitionRef));
    }
  }, 30000);

  if (directory === "daggerheart-core") it("同名子职按阶段匹配，而非在三张卡之间误选", async () => {
    const entries = context.system.resourceLibraries!.find((library) => library.ID === "subclasses")!.entries;
    const first = entries[0]!;
    const family = entries.filter((entry) => entry.fields.名称 === first.fields.名称 && entry.fields.主职 === first.fields.主职);
    const cards = family.map((entry) => ({ standarized: true, id: `external-${entry.ID}`, name: `${entry.fields.名称}${entry.fields.等级}`, headerDisplay: entry.fields.名称, type: "subclass", class: entry.fields.主职, level: ({ 基础: 1, 进阶: 2, 精通: 3 } as Record<string, number>)[String(entry.fields.等级)], description: entry.fields.描述, cardSelectDisplay: {} }));
    const imported = await importSheet(context.system, sourceDocument(cards));
    expect(imported.report.skippedCards).toBe(0);
    expect(imported.data.cards.instances).toHaveLength(family.length);
    const exported = await exportSheet(context.system, imported.data);
    expect((exported.document.cards as typeof cards).filter((card) => card.type === "subclass").map((card) => card.level).sort()).toEqual(cards.map((card) => card.level).sort());
  });

  it("超过普通槽位容量时拒绝导出，不静默截断", async () => {
    const imported = await importSheet(context.system, sourceDocument(Array.from({ length: 16 }, () => domainCard(context.system))));
    const exported = await exportExternalCharacterData(imported.data, adapter(context.system), context.system);
    expect(exported).toHaveProperty("error.code", "CHARACTER_ADAPTER_EXPORT_SCRIPT_ERROR");
  });

  it.each([1, 5, 10])("等级 %i 的原生角色经 PBCHA、dhsheet 往返并保留编辑", async (level) => {
    const { system, installed, catalog } = context;
    const data = createEmptyCharacterData(system);
    data.character.values["character-name"] = `${directory}-level-${level}`;
    data.character.values.level = String(level);
    data.character.values.agility = String(level - 3);
    data.character.values.hope = { current: level % 6, max: 6 };
    const entries = system.resourceLibraries!.find((library) => library.ID === "domain-cards")!.entries;
    data.cards.instances = entries.slice(0, level + 1).map((entry, index) => ({ instanceId: crypto.randomUUID(), tableModuleId: "character-card-table", definitionRef: { type: "resourceLibrary", libraryId: "domain-cards", entryId: entry.ID }, state: index % 2 ? "宝库" : "配置", xPct: index, yPct: index, zIndex: index, face: "front", rotation: 0, scale: 1, indicators: [] }));
    const candidate = await sheetCharacterToSave({ name: String(data.character.values["character-name"]), data, currentSystem: { ...catalog.system.package, resourceCompatibility: catalog.system.resourceCompatibility }, sheetSystemPackage: system, installedPackages: installed });
    const archive = writePbcha(candidate.document, candidate.media);
    const reopened = await loadPbcha(archive, validateCharacterSaveCandidate);
    expect(reopened.diagnostics).toEqual([]);
    const restored = characterSaveToSheet({ candidate: reopened.candidate!, currentSystem: catalog.system, sheetSystemPackage: system, mediaUrl: (id) => id });
    restored.character.values.agility = "9";
    restored.cards.instances[0]!.state = "宝库";
    const exported = await exportSheet(system, restored);
    const imported = await importSheet(system, exported.document);
    expect(imported.data.character.values.agility).toBe("9");
    expect(imported.data.cards.instances.map((item) => item.state).sort()).toEqual(restored.cards.instances.map((item) => item.state).sort());
    expect(imported.report.skippedCards).toBe(0);
    if (process.env.PBDH_WRITE_INTEROP_SAMPLES === "1") {
      const prefix = path.resolve(".scratch/dhsheet-interop", `${directory}-level-${level}`);
      await writeFile(`${prefix}.pbcha`, archive);
      await writeFile(`${prefix}.dhsheet.json`, `${JSON.stringify(exported.document, null, 2)}\n`);
    }
  });

  if (directory === "daggerheart-core") it("备用武器及伙伴字段双向一致", async () => {
    const source = sourceDocument();
    const imported = await importSheet(context.system, source);
    const exported = await exportSheet(context.system, imported.data);
    for (const key of ["inventoryWeapon1Trait", "inventoryWeapon1Damage", "companionWeapon"]) expect(exported.document[key]).toEqual(source[key as keyof typeof source]);
    expect((exported.document.companionExperience as string[]).slice(0, 2)).toEqual(source.companionExperience);
    expect((exported.document.companionExperienceValue as string[]).slice(0, 2)).toEqual(source.companionExperienceValue);
    expect(exported.document.trainingOptions).toEqual(source.trainingOptions);
  });
});
