import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadPbres, validateSystemPackageSemantics, type SystemPackageDocument } from "@pbdh/contract-runtime";
import { describe, expect, test } from "vitest";

import { playerSystemPackageCatalog } from "../../apps/player/src/playerSystemPackageCatalog.ts";
import { embeddedResourcePackageAction } from "../../apps/player/src/resource-manager/ResourceManager.tsx";
import { validateResourcePackageCandidate } from "../../apps/player/src/resources/resource-package-validator.ts";
import { commitResourcePackageRemoval, type ResourceLibrary } from "../../apps/player/src/resources/resource-library.ts";
import { routeResourcePackage } from "../../apps/player/src/resources/route-resource-package.ts";
import { replacePlatformResourceLibraries } from "../../apps/player/src/sheet-runtime/adapters/platformResourceLibraries.ts";
import { getResourceLibraryFields } from "../../apps/player/src/sheet-runtime/domain/resourceLibrary.ts";
import { resolveCardDisplayMode } from "../../apps/player/src/sheet-runtime/rendering/cardTable/cardDefinition.ts";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import { applyResourceSelectionToDraft } from "../../apps/player/src/sheet-runtime/domain/resourceSelection.ts";
import { validateSelectedResourceField } from "../../apps/player/src/sheet-runtime/domain/systemPackage/validationHelpers.ts";
import type { PackageIssue } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";

const root = path.resolve("apps/player/public/system-packages");
const migrated = [
  { directory: "witchy", name: "巫趣 Witchy", resources: 12, assets: 0 },
  { directory: "hows-my-driving", name: "我的车技如何？", resources: 39, assets: 0 },
  { directory: "tttri", name: "罗德岛旅记", resources: 607, assets: 286 },
] as const;

function hasStructuredSubclassFeatures(data: unknown): boolean {
  if (data === null || typeof data !== "object" || Array.isArray(data) || Object.hasOwn(data, "描述")) return false;
  return Array.isArray((data as Record<string, unknown>).特性);
}

function hasStructuredProfessionFeatures(data: unknown): boolean {
  if (data === null || typeof data !== "object" || Array.isArray(data) || Object.hasOwn(data, "职业特性")) return false;
  return Array.isArray((data as Record<string, unknown>).特性);
}

describe("additional migrated System Packages", () => {
  test("registers every supported system and uses the official-resource naming rule", async () => {
    expect(playerSystemPackageCatalog.map((entry) => entry.system.package.name)).toEqual([
      "匕首之心",
      "寻望之心",
      "巫趣 Witchy",
      "我的车技如何？",
      "罗德岛旅记",
    ]);

    for (const item of migrated) {
      const entry = playerSystemPackageCatalog.find((candidate) => candidate.preset.directory === item.directory)!;
      expect(validateSystemPackageSemantics(entry.system)).toEqual([]);
      expect(entry.system.embeddedResources).toHaveLength(1);
      const embeddedPath = entry.system.embeddedResources[0]!.path;
      const loaded = await loadPbres(
        new Uint8Array(await readFile(path.join(root, item.directory, embeddedPath))),
        validateResourcePackageCandidate,
      );
      expect(loaded.diagnostics).toEqual([]);
      expect(loaded.candidate?.document.package.name).toBe(`${item.name}官方资源`);
      expect(loaded.candidate?.document.resources).toHaveLength(item.resources);
      expect(loaded.candidate?.document.assets).toHaveLength(item.assets);
      if (item.directory === "hows-my-driving") {
        const archetype = loaded.candidate?.document.resources.find((resource) => resource.id === "原型:肌肉");
        expect(archetype?.template).toEqual({ id: "自由", version: "1.0.1" });
        expect(archetype?.data).toMatchObject({
          原文: "THE MUSCLE",
          内容: [
            { 名称: "力大无穷", 描述: expect.stringContaining("身体类行事风格") },
            { 名称: "傲慢混蛋", 描述: expect.stringContaining("过度自信") },
          ],
        });
      }
      if (item.directory === "witchy") {
        const archetype = loaded.candidate?.document.resources.find((resource) => resource.id === "原型:主宰");
        const familiar = loaded.candidate?.document.resources.find((resource) => resource.path.startsWith("使魔类型/"));
        expect(archetype?.template).toEqual({ id: "自由", version: "1.0.1" });
        expect(archetype?.data).toMatchObject({
          简介: "",
          内容: [
            { 名称: "不可违逆", 描述: expect.stringContaining("直接视为成功") },
            { 名称: "还不够好", 描述: expect.stringContaining("混乱失败") },
            { 名称: "魔力获取（每场景 1 次）", 描述: expect.stringContaining("获得 1 魔力点") },
          ],
        });
        expect(familiar?.data).toMatchObject({
          简介: "",
          内容: [{ 名称: "使魔能力", 描述: expect.any(String) }],
        });
      }
      if (item.directory === "tttri") {
        const domainCards = loaded.candidate?.document.resources.filter((resource) => resource.template.id === "领域卡") ?? [];
        expect(domainCards).toHaveLength(236);
        expect(domainCards.every((resource) => /^领域卡\/[^/]+\/[^/]+\.json$/u.test(resource.path))).toBe(true);
        const armor = loaded.candidate?.document.resources.filter((resource) => resource.template.id === "护甲") ?? [];
        expect(armor).toHaveLength(34);
        expect(armor.filter((resource) => (resource.data as Record<string, unknown>).位阶 === "1")).toHaveLength(4);
        expect(armor.find((resource) => resource.id === "护甲:基础轻型制式装备")?.data).toMatchObject({
          名称: "基础轻型制式装备", 重度伤害阈值: "5", 严重伤害阈值: "11", 护甲值: "3", 特性名称: "灵活", 特性描述: "闪避值+1",
        });
        expect(armor.find((resource) => resource.id === "护甲:身负重任套装")?.data).toMatchObject({
          重度伤害阈值: "18", 严重伤害阈值: "48", 护甲值: "8", 特性名称: "困难", 特性描述: "所有角色属性以及闪避值-1",
        });
        const subclasses = loaded.candidate?.document.resources.filter((resource) => resource.template.id === "子职业") ?? [];
        expect(subclasses).toHaveLength(280);
        for (const name of ["排陷手", "破术者", "收割者", "卫盟者", "回环射手", "塑灵术师", "游击手", "行商"]) {
          expect(subclasses.filter((resource) => (resource.data as Record<string, unknown>).名称 === name)).toHaveLength(5);
        }
        const hook = subclasses.find((resource) => resource.id === "子职:特种:钩索师:T4Y");
        expect(hook?.data).toMatchObject({ 特性: [{ 特性名称: "外置捕网", 特性描述: expect.stringContaining("敏捷反应掷骰（17）") }] });
        const guard = subclasses.find((resource) => resource.id === "子职:近卫:无畏者:T4Y");
        expect(guard?.data).toMatchObject({ 特性: [{ 特性名称: "无畏之心" }], 职业特性: expect.stringContaining("并中断该目标正在持续的动作") });
        expect(subclasses.every((resource) => hasStructuredSubclassFeatures(resource.data))).toBe(true);
        const professions = loaded.candidate?.document.resources.filter((resource) => resource.template.id === "职业") ?? [];
        expect(professions).toHaveLength(7);
        expect(professions.every((resource) => hasStructuredProfessionFeatures(resource.data))).toBe(true);
        expect(loaded.candidate?.document.resources.some((resource) => resource.template.id === "物品")).toBe(false);
      }
    }

    const daggerheart = await loadPbres(
      new Uint8Array(await readFile(path.join(root, "daggerheart-core/resources/daggerheart-core.pbres"))),
      validateResourcePackageCandidate,
    );
    expect(daggerheart.candidate?.document.package.name).toBe("匕首之心玩家资源");
  });

  test.each(migrated)("loads $name through the Player runtime", async (item) => {
    const catalogEntry = playerSystemPackageCatalog.find((candidate) => candidate.preset.directory === item.directory)!;
    const currentSystem = catalogEntry.system as SystemPackageDocument;
    const installedPackages = new Map();
    for (const embedded of currentSystem.embeddedResources) {
      const archive = await loadPbres(
        new Uint8Array(await readFile(path.join(root, item.directory, embedded.path))),
        validateResourcePackageCandidate,
      );
      expect(archive.candidate).not.toBeNull();
      const candidate = archive.candidate!;
      installedPackages.set(candidate.document.package.id, {
        ...candidate,
        routes: routeResourcePackage({ currentSystem, resourcePackage: candidate.document }),
      });
    }
    const marker = `/system-packages/${item.directory}/`;
    const fetchFile: typeof fetch = async (url) => {
      const pathname = new URL(String(url), "https://preset.invalid").pathname;
      const relativePath = decodeURIComponent(pathname.slice(pathname.indexOf(marker) + marker.length));
      try {
        return new Response(await readFile(path.join(root, item.directory, relativePath)), { status: 200 });
      } catch {
        return new Response(null, { status: 404 });
      }
    };

    const loaded = await catalogEntry.load({
      currentSystem,
      installedPackages: installedPackages as ResourceLibrary,
      baseUrl: "/",
      fetchFile,
    });
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues, null, 2));
    expect(loaded.package.manifest.名称).toBe(item.name);
    expect(loaded.package.pages.length).toBeGreaterThan(0);
    expect(loaded.package.modules.length).toBeGreaterThan(0);
    expect(loaded.package.resourceLibraries?.reduce((total, library) => total + library.entries.length, 0))
      .toBe(item.resources);
    expect(loaded.package.validationChecks?.length ?? 0).toBeGreaterThan(0);
    if (item.directory === "tttri") {
      const picker = loaded.package.modules.find((module) => module.ID === "pick-armor");
      expect(picker?.类型).toBe("resourcePicker");
      for (const layout of ["layouts/character-main.html", "skins/rhodes-island/character-main.html", "skins/terra-portal/character-main.html"]) {
        expect(await readFile(path.join(root, "tttri", layout), "utf8")).toContain('<pb-module id="pick-armor"></pb-module>');
      }
      const empty = createEmptyCharacterData(loaded.package);
      expect(String(empty.character.values.inventory).split("\n")).toHaveLength(3);
      expect(String(empty.character.values.inventory).split("\n")[0]).toBe("一根照明棒、一捆工业弹力绳、作战食品包。");
      const issues: PackageIssue[] = [];
      validateSelectedResourceField(loaded.package, picker, "不存在的护甲字段", "test", "fill-armor", issues);
      expect(issues.map((issue) => issue.code)).toEqual(["MISSING_RESOURCE_FIELD_REFERENCE"]);
      const armorLibrary = loaded.package.resourceLibraries!.find((library) => library.ID === "armor")!;
      expect(armorLibrary.entries).toHaveLength(34);
      const armor = armorLibrary.entries.find((entry) => entry.fields.名称 === "基础轻型制式装备")!;
      expect(armor).toBeDefined();
      const selected = applyResourceSelectionToDraft(empty, loaded.package, "pick-armor", "armor", [armor]).characterData;
      expect(selected.character.values).toMatchObject({
        "armor-summary": `基础轻型制式装备 | 阈值 ${armor.fields.重度阈值}/${armor.fields.严重阈值} | 护甲值 ${armor.fields.护甲值}`,
        "armor-feature": armor.fields.特性,
        "armor-value": armor.fields.护甲值,
        "major-threshold": armor.fields.重度阈值,
        "severe-threshold": armor.fields.严重阈值,
        "armor-slots": { max: Number(armor.fields.护甲值) },
        inventory: empty.character.values.inventory,
      });
      const ancestries = loaded.package.resourceLibraries?.find((library) => library.ID === "ancestries");
      const communities = loaded.package.resourceLibraries?.find((library) => library.ID === "communities");
      const professions = loaded.package.resourceLibraries?.find((library) => library.ID === "classes");
      expect(ancestries?.entries).toHaveLength(35);
      expect(communities?.entries).toHaveLength(15);
      expect(ancestries?.entries.find((entry) => entry.fields.名称 === "乌萨斯")?.fields.简介).not.toBe("");
      expect(communities?.entries.find((entry) => entry.fields.名称 === "高城之民")?.fields.简介).not.toBe("");
      const ancestry = ancestries?.entries.find((entry) => entry.fields.名称 === "乌萨斯");
      const cardTable = loaded.package.modules.find((candidate) => candidate.ID === "character-card-table");
      expect(ancestry?.resourceCopy?.presentation.mode).toBe("split");
      expect(ancestry?.fields).not.toHaveProperty("卡牌显示方式");
      expect(cardTable?.类型).toBe("cardTable");
      if (!cardTable || cardTable.类型 !== "cardTable") throw new Error("tttri character-card-table missing");
      expect(resolveCardDisplayMode(ancestry, cardTable)).toBe("split");
      expect(professions?.entries.find((entry) => entry.fields.名称 === "辅助")?.fields).toMatchObject({
        名称: "辅助",
        描述: "",
        希望特性: expect.stringContaining("共勉前路："),
        职业特性: expect.stringContaining("状态分析："),
      });

      for (const [moduleId, libraryId] of [["pick-community", "communities"], ["pick-domain-card", "domain-cards"]] as const) {
        const module = loaded.package.modules.find((candidate) => candidate.ID === moduleId);
        expect(module?.类型).toBe("resourcePicker");
        if (!module || module.类型 !== "resourcePicker") continue;
        expect(Array.isArray(module.资源库)).toBe(true);
        if (!Array.isArray(module.资源库)) continue;
        const link = module.资源库.find((candidate) => candidate.ID === libraryId);
        const library = loaded.package.resourceLibraries?.find((candidate) => candidate.ID === libraryId);
        expect(library?.entries.length).toBeGreaterThan(0);
        expect(link).toBeDefined();
        expect(library).toBeDefined();
        if (!link || !library) continue;
        expect(getResourceLibraryFields(library, link.字段模板).some((field) => field.visible)).toBe(true);
      }
    }
  });

  test("keeps Witchy official resources while installing and removing other systems' official packages", async () => {
    const witchy = playerSystemPackageCatalog.find((candidate) => candidate.preset.directory === "witchy")!;
    const archives = await Promise.all([
      ["witchy", "resources/witchy.pbres"],
      ["daggerheart-core", "resources/daggerheart-core.pbres"],
      ["heart-of-hopefind", "resources/heart-of-hopefind.pbres"],
    ].map(async ([directory, archivePath]) => {
      const loaded = await loadPbres(
        new Uint8Array(await readFile(path.join(root, directory!, archivePath!))),
        validateResourcePackageCandidate,
      );
      if (!loaded.candidate) throw new Error(loaded.diagnostics.map((item) => item.code).join("\n"));
      return loaded.candidate;
    }));
    const library = new Map(archives.map((candidate) => [candidate.document.package.id, {
      ...candidate,
      routes: routeResourcePackage({ currentSystem: witchy.system, resourcePackage: candidate.document }),
    }]));
    const embeddedIndex = new Map(witchy.preset.embeddedResourceIndex.map((item) => [item.packageId, item]));
    const [witchyResources, daggerheartResources, hopefindResources] = archives;

    expect(library).toHaveLength(3);
    expect(embeddedResourcePackageAction(library.get(witchyResources!.document.package.id)!, embeddedIndex)).toBe("locked");
    expect(embeddedResourcePackageAction(library.get(daggerheartResources!.document.package.id)!, embeddedIndex)).toBe("remove");
    expect(embeddedResourcePackageAction(library.get(hopefindResources!.document.package.id)!, embeddedIndex)).toBe("remove");

    const marker = "/system-packages/witchy/";
    const fetchFile: typeof fetch = async (url) => {
      const pathname = new URL(String(url), "https://preset.invalid").pathname;
      const relativePath = decodeURIComponent(pathname.slice(pathname.indexOf(marker) + marker.length));
      try {
        return new Response(await readFile(path.join(root, "witchy", relativePath)), { status: 200 });
      } catch {
        return new Response(null, { status: 404 });
      }
    };
    const officialOnly = new Map([[witchyResources!.document.package.id, library.get(witchyResources!.document.package.id)!]]);
    const loaded = await witchy.load({
      currentSystem: witchy.system,
      installedPackages: officialOnly,
      baseUrl: "/",
      fetchFile,
    });
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues, null, 2));
    const refreshed = replacePlatformResourceLibraries({
      currentSystem: witchy.system,
      basePackage: loaded.package,
      installedPackages: library,
      preloadedPackageIds: new Set(embeddedIndex.keys()),
    });
    expect(refreshed.resourceLibraries?.reduce((total, resourceLibrary) => total + resourceLibrary.entries.length, 0))
      .toBe(witchyResources!.document.resources.length
        + daggerheartResources!.document.resources.length
        + hopefindResources!.document.resources.length);
    const projectedBard = refreshed.resourceLibraries
      ?.flatMap((resourceLibrary) => resourceLibrary.entries)
      .find((entry) => entry.fields.名称 === "吟游诗人" && entry.fields.类型 === "职业");
    expect(projectedBard?.fields).toMatchObject({
      名称: "吟游诗人",
      原文: "BARD",
      描述: expect.stringContaining("吟游诗人是诸界域中最富魅力的存在"),
      希望特性: expect.stringContaining("大闹一场："),
      职业特性: expect.stringContaining("鼓舞人心："),
      背景问题1: expect.stringContaining("自信"),
      关系问题1: expect.stringContaining("朋友"),
    });

    const withoutDaggerheart = commitResourcePackageRemoval(library, daggerheartResources!.document.package.id);
    const restored = commitResourcePackageRemoval(withoutDaggerheart, hopefindResources!.document.package.id);
    expect([...restored.keys()]).toEqual([witchyResources!.document.package.id]);
    expect(restored.get(witchyResources!.document.package.id)?.document.package.name).toBe("巫趣 Witchy官方资源");
  });
});
