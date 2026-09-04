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

const root = path.resolve("apps/player/public/system-packages");
const migrated = [
  { directory: "witchy", name: "巫趣 Witchy", resources: 12, assets: 0 },
  { directory: "hows-my-driving", name: "我的车技如何？", resources: 39, assets: 0 },
  { directory: "tttri", name: "罗德岛旅记", resources: 682, assets: 271 },
] as const;

function hasStructuredEquipmentFeature(data: unknown): boolean {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return false;
  return !Object.hasOwn(data, "描述")
    && Object.hasOwn(data, "特性名称")
    && Object.hasOwn(data, "特性描述");
}

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
      expect(loaded.candidate?.document.snapshotDigest).toBe(entry.preset.embeddedResourceIndex[0]!.snapshotDigest);
      if (item.directory === "tttri") {
        const armor = loaded.candidate?.document.resources.filter((resource) => resource.template.id === "护甲") ?? [];
        expect(armor).toHaveLength(34);
        expect(armor.every((resource) => hasStructuredEquipmentFeature(resource.data))).toBe(true);
        const subclasses = loaded.candidate?.document.resources.filter((resource) => resource.template.id === "子职业") ?? [];
        expect(subclasses).toHaveLength(240);
        expect(subclasses.every((resource) => hasStructuredSubclassFeatures(resource.data))).toBe(true);
        const professions = loaded.candidate?.document.resources.filter((resource) => resource.template.id === "职业") ?? [];
        expect(professions).toHaveLength(7);
        expect(professions.every((resource) => hasStructuredProfessionFeatures(resource.data))).toBe(true);
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
      const ancestries = loaded.package.resourceLibraries?.find((library) => library.ID === "ancestries");
      const communities = loaded.package.resourceLibraries?.find((library) => library.ID === "communities");
      const professions = loaded.package.resourceLibraries?.find((library) => library.ID === "classes");
      expect(ancestries?.entries).toHaveLength(35);
      expect(communities?.entries).toHaveLength(15);
      expect(ancestries?.entries[0]?.fields).toMatchObject({ 名称: "乌萨斯" });
      expect(ancestries?.entries[0]?.fields.简介).not.toBe("");
      expect(communities?.entries[0]?.fields).toMatchObject({ 名称: "高城之民" });
      expect(communities?.entries[0]?.fields.简介).not.toBe("");
      expect(professions?.entries[0]?.fields).toMatchObject({
        名称: "辅助",
        描述: "\\*医疗合并至辅助",
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
