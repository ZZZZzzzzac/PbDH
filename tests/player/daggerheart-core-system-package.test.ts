import { existsSync, readFileSync } from "node:fs";
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

function unexpectedLocalizedLatin(value: unknown, pathParts: string[] = []): string[] {
  if (typeof value === "string") {
    const field = pathParts.at(-1);
    if (field === "原文" || field === "特性原文") return [];
    const residual = value
      .replace(/(?<![A-Za-z])(?:\d+)?d\d+(?:[+−-]\d+)?(?![A-Za-z])/giu, "")
      .replace(/\bX\b/gu, "");
    return /[A-Za-z]/u.test(residual) ? [`${pathParts.join(".")}: ${value}`] : [];
  }
  if (Array.isArray(value)) return value.flatMap((item, index) => unexpectedLocalizedLatin(item, [...pathParts, String(index)]));
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([field, item]) => unexpectedLocalizedLatin(item, [...pathParts, field]));
  }
  return [];
}

describe("migrated Daggerheart Core System Package", () => {
  test("Echo Blade 的译名修正不会创建新的武器资源", async () => {
    const playerPackage = await loadEmbeddedResource("resources/daggerheart-core.pbres");
    const echoBlade = playerPackage.document.resources.find((resource) => (
      resource.template.id === "武器" && (resource.data as Record<string, unknown>).原文 === "Echo Blade"
    ));
    expect(echoBlade).toMatchObject({
      id: "0585bc96-de93-5371-8d04-c4ab5d2da68f",
      data: { 名称: "回响利刃", 特性名称: "加倍", 特性原文: "Up" },
    });
  });

  test("本地化资源字段只保留骰子、变量与专用原文字段中的拉丁字母", async () => {
    const packages = await Promise.all([
      loadEmbeddedResource("resources/daggerheart-core.pbres"),
      loadEmbeddedResource("resources/daggerheart-core-gm.pbres"),
    ]);
    const violations = packages.flatMap((candidate, packageIndex) => candidate.document.resources
      .flatMap((resource, resourceIndex) => unexpectedLocalizedLatin(resource.data, [String(packageIndex), String(resourceIndex), "data"])));
    expect(violations).toEqual([]);
  });

  test("种族和社群简介只保留第一句", async () => {
    const playerPackage = await loadEmbeddedResource("resources/daggerheart-core.pbres");
    const resources = playerPackage.document.resources.filter((resource) => ["种族", "社群"].includes(resource.template.id));
    expect(resources).toHaveLength(39);
    for (const resource of resources) {
      const introduction = String((resource.data as Record<string, unknown>).简介);
      expect(introduction, String((resource.data as Record<string, unknown>).名称)).toMatch(/^[^。]*。$/u);
    }
  });

  test("跨源记录继承武器位阶", async () => {
    const playerPackage = await loadEmbeddedResource("resources/daggerheart-core.pbres");
    const entries = playerPackage.document.resources.filter((resource) => resource.template.id === "武器")
      .map((resource) => resource.data as { 名称: string; 位阶: string; 类型: string });
    const counts: Record<string, number> = {};
    for (const entry of entries) {
      const key = `${entry.位阶}/${entry.类型}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    expect(counts).toEqual({
      "1/主武器": 38,
      "1/副武器": 13,
      "2/主武器": 68,
      "2/副武器": 20,
      "3/主武器": 60,
      "3/副武器": 20,
      "4/主武器": 68,
      "4/副武器": 20,
    });
    const tierThreePrimaryWeapons = entries.filter((entry) => entry.位阶 === "3" && entry.类型 === "主武器");
    expect(tierThreePrimaryWeapons.some((entry) => entry.名称 === "高级奥术步枪")).toBe(true);
    expect(tierThreePrimaryWeapons.filter((entry) => /^高级\s/u.test(entry.名称))).toEqual([]);
    expect(playerPackage.document.resources.find((resource) => (
      resource.template.id === "武器" && (resource.data as Record<string, unknown>).原文 === "Advanced Arcane Rifle"
    ))?.id).toBe("f26e0225-2ca4-52da-8fd8-fb0370eb65e4");
  });

  test("用不同译名区分两种 Heavy 护甲特性", async () => {
    const playerPackage = await loadEmbeddedResource("resources/daggerheart-core.pbres");
    const entries = playerPackage.document.resources.filter((resource) => resource.template.id === "护甲")
      .map((resource) => resource.data as { 原文: string; 特性名称: string });
    expect(entries.find((entry) => entry.原文 === "Chainmail Armor")?.特性名称).toBe("沉重");
    expect(entries.find((entry) => entry.原文 === "Full Plate Armor")?.特性名称).toBe("极重");
  });

  test("领域卡权威资源的回想值不包含闪电符号", async () => {
    const playerPackage = await loadEmbeddedResource("resources/daggerheart-core.pbres");
    const entries = playerPackage.document.resources.filter((resource) => resource.template.id === "领域卡")
      .map((resource) => resource.data as { 回想: string });
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
    expect(candidates[0]?.document.package.version).toBe("1.0.19");
    expect(candidates[1]?.document.package.version).toBe("1.0.4");
    expect(candidates.every((candidate) => candidate.document.license.label === "Darrington Press Community Gaming License"
      && candidate.document.license.declaration === "https://darringtonpress.com/license/")).toBe(true);
    expect(resources.every((resource) => Object.keys(resource.presentation).length === 2)).toBe(true);
    expect(resources.filter((resource) => resource.template.id === "职业").every((resource) => !resource.presentation.fixedRatio)).toBe(true);
    expect(resources.filter((resource) => resource.template.id === "环境").every((resource) => !resource.presentation.fixedRatio)).toBe(true);
    expect(resources.filter((resource) => !["职业", "环境", "敌人"].includes(resource.template.id)).every((resource) => resource.presentation.fixedRatio)).toBe(true);
    const armorResources = resources.filter((resource) => resource.template.id === "护甲");
    expect(armorResources).toHaveLength(69);
    expect(armorResources.every((resource) => resource.template.version === "1.0.1")).toBe(true);
    const equipmentResources = resources.filter((resource) => resource.template.id === "护甲" || resource.template.id === "武器");
    expect(equipmentResources).toHaveLength(376);
    expect(equipmentResources.every((resource) => hasStructuredEquipmentFeature(resource.data))).toBe(true);
    const stableCounts = new Map([
      ["种族", 24], ["社群", 15], ["职业", 13], ["子职业", 78], ["物品", 240], ["领域卡", 210], ["敌人", 264], ["环境", 47],
    ]);
    for (const [templateId, count] of stableCounts) {
      const matching = resources.filter((resource) => resource.template.id === templateId);
      expect(matching).toHaveLength(count);
      expect(matching.every((resource) => resource.template.version === "1.0.1")).toBe(true);
    }
    const subclassResources = resources.filter((resource) => resource.template.id === "子职业");
    expect(subclassResources.every((resource) => subclassFeatures(resource.data) !== null)).toBe(true);
    expect(subclassResources.flatMap((resource) => subclassFeatures(resource.data) ?? []).length).toBeGreaterThan(78);
    const professionResources = resources.filter((resource) => resource.template.id === "职业");
    expect(professionResources.every((resource) => professionFeatures(resource.data) !== null)).toBe(true);
    expect(professionResources.flatMap((resource) => professionFeatures(resource.data) ?? []).length).toBeGreaterThanOrEqual(13);
    expect(system.resourceCompatibility.every((item) => item.versionRange.minimumInclusive === "1.0.0"
      && item.versionRange.maximumExclusive === "2.0.0")).toBe(true);
    expect(candidates.every((candidate) => candidate.document.contractVersion === "1.1.0")).toBe(true);
    expect(resources.every((resource) => resource.attribution?.artworkCredit === ""
      && resource.attribution.sourceLabel === (resource.template.id === "敌人" || resource.template.id === "环境"
        ? "匕首之心主持人资源"
        : "匕首之心玩家资源"))).toBe(true);
    expect(resources.filter((resource) => resource.media.portrait).every((resource) => resource.presentation.mode === "image")).toBe(true);
    expect(resources.filter((resource) => !resource.media.portrait).every((resource) => resource.presentation.mode === "text")).toBe(true);
    expect(resources.find((resource) => resource.template.id === "敌人" && (resource.data as Record<string, unknown>).原文 === "PERFECTED ZOMBIE")).toBeDefined();
    expect(resources.find((resource) => resource.template.id === "敌人" && (resource.data as Record<string, unknown>).原文 === "ZOMBIE LEGION")).toBeDefined();
    expect(resources.find((resource) => resource.template.id === "环境" && (resource.data as Record<string, unknown>).原文 === "TIME COURT")?.data).toMatchObject({
      名称: "时光法庭",
      简介: "一名或多名玩家角色被强行从时间线上拽走，因破坏连续性而受审。",
      特性: [
        { 特性名称: "超脱时间", 特性原文: "Out of Time", 特性类型: "被动" },
        { 特性名称: "陪审团审判", 特性原文: "Trial by Jury", 特性类型: "被动" },
        { 特性名称: "辩护律师", 特性原文: "Counsel for the Defense", 特性类型: "被动" },
        { 特性名称: "公诉律师", 特性原文: "Counsel for the Prosecution", 特性类型: "动作" },
        { 特性名称: "“法庭肃静！”", 特性原文: "“Order in the Court!”", 特性类型: "反应" },
      ],
    });
    expect(resources.filter((resource) => resource.template.id === "领域卡").every((resource) => (resource.data as Record<string, unknown>).领域 !== "Dread")).toBe(true);
    expect(resources.filter((resource) => resource.template.id === "敌人").every((resource) => !/[#]|\bHorde\b/u.test(String((resource.data as Record<string, unknown>).种类)))).toBe(true);
    expect(resources.filter((resource) => ["敌人", "环境"].includes(resource.template.id)).flatMap((resource) => {
      const features = (resource.data as Record<string, unknown>).特性;
      return Array.isArray(features) ? features as Array<Record<string, string>> : [];
    }).every((feature) => feature.特性类型 !== "演化" && !/[-—]\s*(?:进化|演化)(?:\s+Evolution)?\s*[:：]/u.test(feature.特性描述))).toBe(true);
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

  test("只保留 ParaTranz 快照作为可编辑资源源", () => {
    const sourceRoot = path.join(root, "apps/player/system-package-sources/daggerheart-core");
    expect(existsSync(path.join(root, "docs/sources/daggerheart-srd2/DH_SRD_2_2026_08_25.paratranz.json"))).toBe(true);
    expect(existsSync(path.join(sourceRoot, "resources"))).toBe(false);
    expect(existsSync(path.join(sourceRoot, "extraction-overrides.json"))).toBe(false);
    expect(existsSync(path.join(sourceRoot, "daggerheart-core-player.resource-package.json"))).toBe(false);
    expect(existsSync(path.join(sourceRoot, "daggerheart-core-gm.resource-package.json"))).toBe(false);
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
