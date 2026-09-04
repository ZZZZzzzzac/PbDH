import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { AnySchema } from "ajv";
import { describe, expect, test } from "vitest";

import { validateResourcePackageCandidate } from "../../apps/player/src/resources/resource-package-validator.ts";
import {
  ContractRuntime,
  loadPbres,
  validateSystemPackageSemantics,
  type ContractCatalog,
  type SystemPackageDocument,
} from "../../packages/contract-runtime/src/index.ts";

const root = process.cwd();
const packageRoot = path.join(
  root,
  "apps/player/public/system-packages/daggerheart-core",
);

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

type RuntimeResourcePicker = {
  ID: string;
  类型: string;
  资源库?: Array<{
    ID: string;
    字段模板?: Array<{ 键: string; 标签?: string; 列宽?: string }>;
    默认查询?: {
      filters?: Record<string, string[]>;
      sort?: { field: string; direction?: "asc" | "desc" };
    };
  }>;
};

const catalog = readJson<ContractCatalog>(path.join(root, "contracts/catalog.json"));
const schemas = Object.fromEntries(catalog.families.flatMap((family) =>
  family.versions.map((version) => [
    version.schema,
    readJson<AnySchema>(path.join(root, "contracts", version.schema)),
  ])));
const runtime = new ContractRuntime(catalog, schemas);
const preset = readJson<{
  embeddedResourceIndex: Array<{ path: string; packageId: string; version: string; snapshotDigest: string }>;
}>(path.join(root, "apps/player/src/daggerheart-core-preset.generated.json"));
const sourceResourceRoot = path.join(root, "apps/player/system-package-sources/daggerheart-core/resources");
const playerSourceLibraries = [
  ["ancestries", "种族"], ["communities", "社群"], ["classes", "职业"], ["subclasses", "子职业"],
  ["weapons", "武器"], ["armor", "护甲"], ["loot", "物品"], ["domain-cards", "领域卡"],
] as const;
const gmSourceLibraries = [["adversaries", "敌人"], ["environments", "环境"]] as const;

type ExtractedSourceResource = { ID: string; 名称: string; 原文?: string };

async function loadEmbeddedResource(pathName: string) {
  const archive = new Uint8Array(readFileSync(path.join(packageRoot, ...pathName.split("/"))));
  const loaded = await loadPbres(archive, validateResourcePackageCandidate);
  expect(loaded.diagnostics).toEqual([]);
  expect(loaded.candidate).toBeDefined();
  return loaded.candidate!;
}

function hasStructuredEquipmentFeature(data: unknown): boolean {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return false;
  return !Object.hasOwn(data, "描述")
    && Object.hasOwn(data, "特性名称")
    && Object.hasOwn(data, "特性描述");
}

function subclassFeatures(data: unknown): unknown[] | null {
  if (data === null || typeof data !== "object" || Array.isArray(data) || Object.hasOwn(data, "描述")) return null;
  const features = (data as Record<string, unknown>).特性;
  return Array.isArray(features) ? features : null;
}

function professionFeatures(data: unknown): unknown[] | null {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
  const features = (data as Record<string, unknown>).特性;
  return Array.isArray(features) ? features : null;
}

function nestedStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(nestedStrings);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(nestedStrings);
  return [];
}

describe("migrated Daggerheart Core System Package", () => {
  test("领域卡权威资源的回想值不包含闪电符号", () => {
    const entries = readJson<Array<{ 回想: string }>>(path.join(
      root,
      "apps/player/system-package-sources/daggerheart-core/resources/domain-cards.json",
    ));
    expect(entries).toHaveLength(210);
    expect(entries.every((entry) => !entry.回想.includes("⚡"))).toBe(true);
  });

  test("uses separate valid player and GM Resource Packages", async () => {
    const system = readJson<SystemPackageDocument>(path.join(packageRoot, "system.json"));
    expect(runtime.validate({
      family: "system-package",
      version: system.contractVersion,
      mode: "development",
      candidate: system,
    })).toEqual([]);
    expect(validateSystemPackageSemantics(system)).toEqual([]);
    expect(system.embeddedResources).toHaveLength(2);
    expect(system.embeddedResources[0]?.path).toBe("resources/daggerheart-core.pbres");
    expect(system.embeddedResources[1]?.path).toBe("resources/daggerheart-core-gm.pbres");

    const candidates = [];
    for (const embedded of system.embeddedResources) {
      const archive = new Uint8Array(readFileSync(path.join(packageRoot, ...embedded.path.split("/"))));
      expect(archive.byteLength).toBeGreaterThan(1_000);
      const loaded = await loadPbres(archive, validateResourcePackageCandidate);
      expect(loaded.diagnostics).toEqual([]);
      const index = preset.embeddedResourceIndex.find((item) => item.path === embedded.path);
      expect(index).toBeDefined();
      expect(loaded.candidate?.document.package.id).toBe(index?.packageId);
      expect(loaded.candidate?.document.package.version).toBe(index?.version);
      expect(loaded.candidate?.document.snapshotDigest).toBe(index?.snapshotDigest);
      if (loaded.candidate) candidates.push(loaded.candidate);
    }
    expect(candidates[0]?.document.resources).toHaveLength(956);
    expect(candidates[1]?.document.resources).toHaveLength(311);
    expect(candidates[0]?.document.resources.every((resource) => !["敌人", "环境"].includes(resource.template.id))).toBe(true);
    expect(candidates[1]?.document.resources.every((resource) => ["敌人", "环境"].includes(resource.template.id))).toBe(true);
    expect(new Set(candidates.flatMap((candidate) => candidate.document.assets.map((asset) => asset.id)))).toHaveLength(280);
    expect(new Set(candidates.flatMap((candidate) => candidate.document.resources.map((resource) => resource.template.id)))).toEqual(
      new Set(["种族", "社群", "职业", "子职业", "武器", "护甲", "物品", "领域卡", "敌人", "环境"]),
    );
    const resources = candidates.flatMap((candidate) => candidate.document.resources);
    expect(resources.find((resource) => resource.template.id === "种族" && (resource.data as Record<string, unknown>).名称 === "械灵")?.data).toMatchObject({
      类型: "种族",
      特性: [
        { 特性名称: "定制设计", 特性描述: expect.not.stringContaining("定制设计") },
        { 特性名称: "高效休整", 特性描述: expect.not.stringContaining("高效休整") },
      ],
    });
    expect(resources.find((resource) => resource.template.id === "社群" && (resource.data as Record<string, unknown>).名称 === "高城之民")?.data).toMatchObject({
      类型: "社群",
      特性: { 特性名称: "高人一等", 特性描述: expect.not.stringContaining("高人一等") },
    });
    expect(resources.find((resource) => resource.template.id === "职业" && (resource.data as Record<string, unknown>).名称 === "吟游诗人")?.data).toMatchObject({
      类型: "职业",
      希望特性: { 特性名称: expect.any(String), 特性原文: expect.any(String), 特性描述: expect.any(String) },
      特性: [{ 特性名称: "鼓舞人心", 特性原文: "Rally", 特性描述: expect.any(String) }],
    });
    expect(candidates[0]?.document.package.version).toBe("1.0.18");
    expect(candidates[1]?.document.package.version).toBe("1.0.3");
    expect(candidates.every((candidate) => candidate.document.license.label === "Darrington Press Community Gaming License"
      && candidate.document.license.declaration === "https://darringtonpress.com/license/")).toBe(true);
    expect(resources.every((resource) => Object.keys(resource.presentation).length === 2)).toBe(true);
    expect(resources.filter((resource) => resource.template.id === "职业").every((resource) => !resource.presentation.fixedRatio)).toBe(true);
    expect(resources.filter((resource) => resource.template.id === "环境").every((resource) => !resource.presentation.fixedRatio)).toBe(true);
    expect(resources.filter((resource) => !["职业", "环境", "敌人"].includes(resource.template.id)).every((resource) => resource.presentation.fixedRatio)).toBe(true);
    const armorResources = resources.filter((resource) => resource.template.id === "护甲");
    expect(armorResources).toHaveLength(69);
    expect(armorResources.every((resource) => resource.template.version === "1.0.0")).toBe(true);
    const equipmentResources = resources.filter((resource) => resource.template.id === "护甲" || resource.template.id === "武器");
    expect(equipmentResources).toHaveLength(376);
    expect(equipmentResources.every((resource) => hasStructuredEquipmentFeature(resource.data))).toBe(true);
    const stableCounts = new Map([
      ["种族", 24], ["社群", 15], ["职业", 13], ["子职业", 78], ["物品", 240], ["领域卡", 210], ["敌人", 264], ["环境", 47],
    ]);
    for (const [templateId, count] of stableCounts) {
      const matching = resources.filter((resource) => resource.template.id === templateId);
      expect(matching).toHaveLength(count);
      expect(matching.every((resource) => resource.template.version === "1.0.0")).toBe(true);
    }
    const subclassResources = resources.filter((resource) => resource.template.id === "子职业");
    expect(subclassResources.every((resource) => subclassFeatures(resource.data) !== null)).toBe(true);
    expect(subclassResources.flatMap((resource) => subclassFeatures(resource.data) ?? []).length).toBeGreaterThan(78);
    const professionResources = resources.filter((resource) => resource.template.id === "职业");
    expect(professionResources.every((resource) => professionFeatures(resource.data) !== null)).toBe(true);
    expect(professionResources.flatMap((resource) => professionFeatures(resource.data) ?? []).length).toBeGreaterThanOrEqual(13);
    expect(system.resourceCompatibility.every((item) => item.versionRange.minimumInclusive === "1.0.0"
      && item.versionRange.maximumExclusive === "2.0.0")).toBe(true);
    expect(resources.filter((resource) => resource.media.portrait).every((resource) => resource.presentation.mode === "image")).toBe(true);
    expect(resources.filter((resource) => !resource.media.portrait).every((resource) => resource.presentation.mode === "text")).toBe(true);
    expect(resources.find((resource) => resource.template.id === "敌人" && (resource.data as Record<string, unknown>).原文 === "PERFECTED ZOMBIE")).toBeDefined();
    expect(resources.find((resource) => resource.template.id === "敌人" && (resource.data as Record<string, unknown>).原文 === "ZOMBIE LEGION")).toBeDefined();
    expect(resources.filter((resource) => resource.template.id === "领域卡").every((resource) => (resource.data as Record<string, unknown>).领域 !== "Dread")).toBe(true);
    expect(resources.filter((resource) => resource.template.id === "敌人").every((resource) => !/[#]|\bHorde\b/u.test(String((resource.data as Record<string, unknown>).种类)))).toBe(true);
    expect(resources.filter((resource) => resource.template.id !== "子职业").every((resource) => /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/u.test(resource.id))).toBe(true);
    expect(resources.filter((resource) => resource.template.id === "子职业").every((resource) => {
      const data = resource.data as Record<string, unknown>;
      return resource.id === `子职业:${String(data.主职)}:${String(data.名称)}:${String(data.等级)}`;
    })).toBe(true);
    expect(resources.every((resource) => {
      const data = resource.data as Record<string, unknown>;
      const name = String(data.名称).replace(/[<>:"/\\|?*]/gu, "-");
      const filename = resource.template.id === "子职业"
        ? `${name}-${String(data.等级).replace(/[<>:"/\\|?*]/gu, "-")}.json`
        : `${name}.json`;
      return resource.path.split("/").at(-1) === filename;
    })).toBe(true);
    expect(resources.filter((resource) => resource.template.id === "武器").every((resource) => /^武器\/位阶[^/]+\/[^/]+\/[^/]+\.json$/u.test(resource.path))).toBe(true);
    expect(resources.filter((resource) => resource.template.id === "领域卡").every((resource) => /^领域卡\/[^/]+\/等级[^/]+\/[^/]+\.json$/u.test(resource.path))).toBe(true);
    expect(resources.filter((resource) => resource.template.id === "子职业").every((resource) => /^子职业\/[^/]+\/[^/]+-(基础|进阶|精通)\.json$/u.test(resource.path))).toBe(true);

    const allText = resources.flatMap((resource) => nestedStrings(resource.data));
    for (const value of allText) {
      const boldSpans = [...value.matchAll(/\*\*([^*\n]+)\*\*/gu)].map((match) => match[1]!);
      expect(value.replace(/\*\*[^*\n]+\*\*/gu, ""), value).not.toMatch(/[*_#`~]|\[[^\]]+\]\([^)]+\)/u);
      for (const span of boldSpans) {
        expect(span, value).toMatch(/^(?:(?:恢复|标记|清除|获得|花费|失去|承受|转移) .+ (?:生命|希望|压力|恐惧|恩宠|专注|回响|充能)点|(?:恢复|标记|清除|获得|花费|失去|承受|转移) .+ 护甲槽|(?:\d+)?d\d+(?:[+−-]\d+)?|(?:敏捷|力量|灵巧|本能|风度|知识|施法)掷骰(?:\s*[（(]\d+[）)])?)$/u);
      }
    }
    const wyrmlings = resources.find((resource) => resource.template.id === "敌人" && (resource.data as Record<string, unknown>).原文 === "WYRMLINGS");
    expect(((wyrmlings?.data as Record<string, unknown>).特性 as Array<Record<string, string>>).every((feature) => !feature.特性描述.includes("\n"))).toBe(true);
  });

  test("matches every extracted SRD resource against the generated player and GM archives", async () => {
    const provenance = readJson<{
      sourceFile: string;
      sha256: string;
      extractedCounts: Record<string, number>;
      comparison: { playerResourceCount: number; gmResourceCount: number };
    }>(path.join(root, "apps/player/system-package-sources/daggerheart-core/source-provenance.json"));
    expect(provenance.sourceFile).toBe("docs/sources/daggerheart-srd2/DH_SRD_2_2026_08_25.paratranz.json");
    expect(createHash("sha256").update(readFileSync(path.join(root, provenance.sourceFile))).digest("hex")).toBe(provenance.sha256);
    const playerPackage = await loadEmbeddedResource("resources/daggerheart-core.pbres");
    const gmPackage = await loadEmbeddedResource("resources/daggerheart-core-gm.pbres");

    const comparePartition = (
      definitions: ReadonlyArray<readonly [string, string]>,
      packagedResources: typeof playerPackage.document.resources,
      expectedTotal: number,
    ) => {
      const extracted = definitions.flatMap(([fileStem, templateId]) => {
        const entries = readJson<ExtractedSourceResource[]>(path.join(sourceResourceRoot, `${fileStem}.json`));
        expect(entries).toHaveLength(provenance.extractedCounts[fileStem]);
        return entries.map((entry) => ({ entry, templateId }));
      });
      expect(extracted).toHaveLength(expectedTotal);
      expect(new Set(extracted.map(({ entry }) => entry.ID)).size).toBe(extracted.length);
      expect(new Set(packagedResources.map((resource) => resource.id)).size).toBe(packagedResources.length);
      expect(packagedResources.map((resource) => resource.id).sort()).toEqual(extracted.map(({ entry }) => entry.ID).sort());

      const packagedById = new Map(packagedResources.map((resource) => [resource.id, resource] as const));
      for (const { entry, templateId } of extracted) {
        const packaged = packagedById.get(entry.ID);
        expect(packaged, `PBRES 缺少 ${entry.ID}`).toBeDefined();
        expect(packaged?.template).toEqual({ id: templateId, version: "1.0.0" });
        expect((packaged?.data as Record<string, unknown>).名称).toBe(entry.名称);
        if (entry.原文 !== undefined) expect((packaged?.data as Record<string, unknown>).原文).toBe(entry.原文);
      }
    };

    comparePartition(playerSourceLibraries, playerPackage.document.resources, provenance.comparison.playerResourceCount);
    comparePartition(gmSourceLibraries, gmPackage.document.resources, provenance.comparison.gmResourceCount);
  });

  test("keeps the two review JSON documents identical to the PBRES logical documents", async () => {
    const playerPackage = await loadEmbeddedResource("resources/daggerheart-core.pbres");
    const gmPackage = await loadEmbeddedResource("resources/daggerheart-core-gm.pbres");
    expect(readJson(path.join(sourceResourceRoot, "..", "daggerheart-core-player.resource-package.json"))).toEqual(playerPackage.document);
    expect(readJson(path.join(sourceResourceRoot, "..", "daggerheart-core-gm.resource-package.json"))).toEqual(gmPackage.document);
  });

  test("keeps old Sheet resource documents out of the public runtime", () => {
    const system = readJson<SystemPackageDocument>(path.join(packageRoot, "system.json"));
    const inventory = readJson<{ files: string[] }>(path.join(packageRoot, ".pbdh-runtime-files.json"));
    expect(system.runtime).not.toHaveProperty("resourceFormatAdapters");
    expect(system.runtime).not.toHaveProperty("resourceLibraries");
    expect(inventory.files).toContain("system.json");
    expect(inventory.files).not.toContain("manifest.json");
    expect(inventory.files.some((file) => file.startsWith("runtime-libraries/"))).toBe(false);
    expect(() => readFileSync(path.join(packageRoot, "manifest.json"))).toThrow();
    expect(() => readFileSync(path.join(packageRoot, "runtime-libraries/weapons.json"))).toThrow();
    expect(() => readFileSync(path.join(packageRoot, "resources/weapons.json"))).toThrow();
  });

  test("shows and sorts equipment tiers while keeping compact damage headers on one line", () => {
    const modules = readJson<RuntimeResourcePicker[]>(path.join(packageRoot, "modules.json"));
    const pickerLibrary = (moduleId: string) => {
      const module = modules.find((candidate) => candidate.ID === moduleId);
      expect(module?.类型).toBe("resourcePicker");
      expect(module?.资源库).toHaveLength(1);
      return module!.资源库![0]!;
    };

    const primaryWeapon = pickerLibrary("pick-primary-weapon");
    const secondaryWeapon = pickerLibrary("pick-secondary-weapon");
    const backupWeapon1 = pickerLibrary("pick-backup-weapon-1");
    const backupWeapon2 = pickerLibrary("pick-backup-weapon-2");
    const armor = pickerLibrary("pick-armor");

    expect(primaryWeapon.字段模板?.map((field) => field.键)).toEqual([
      "名称", "属性", "距离", "伤害", "负荷", "位阶", "伤害类型", "特性名称", "特性描述", "类型",
    ]);
    expect(secondaryWeapon.字段模板?.map((field) => field.键)).toEqual([
      "名称", "属性", "距离", "伤害", "负荷", "位阶", "伤害类型", "特性名称", "特性描述", "类型",
    ]);
    expect(backupWeapon1.字段模板?.map((field) => field.键)).toEqual([
      "名称", "类型", "属性", "距离", "伤害", "负荷", "伤害类型", "特性名称", "特性描述",
    ]);
    expect(backupWeapon2.字段模板?.map((field) => field.键)).toEqual([
      "名称", "类型", "属性", "距离", "伤害", "负荷", "伤害类型", "特性名称", "特性描述",
    ]);
    expect(armor.字段模板?.map((field) => field.键)).toEqual([
      "名称", "重度阈值", "严重阈值", "护甲值", "位阶", "特性名称", "特性描述",
    ]);
    expect(primaryWeapon.默认查询?.sort).toEqual({ field: "位阶", direction: "asc" });
    expect(secondaryWeapon.默认查询?.sort).toEqual({ field: "位阶", direction: "asc" });
    expect(armor.默认查询?.sort).toEqual({ field: "位阶", direction: "asc" });

    const primaryDamageType = primaryWeapon.字段模板?.find((field) => field.键 === "伤害类型");
    const secondaryDamageType = secondaryWeapon.字段模板?.find((field) => field.键 === "伤害类型");
    expect(primaryDamageType).toMatchObject({ 标签: "类型", 列宽: "compact" });
    expect(secondaryDamageType).toMatchObject({ 标签: "类型", 列宽: "compact" });
  });
});
