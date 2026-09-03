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

function hasStructuredEquipmentFeature(data: unknown): boolean {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return false;
  return !Object.hasOwn(data, "描述")
    && Object.hasOwn(data, "特性名")
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

describe("migrated Daggerheart Core System Package", () => {
  test("领域卡权威资源的回想值不包含闪电符号", () => {
    const entries = readJson<Array<{ 回想: string }>>(path.join(
      root,
      "apps/player/system-package-sources/daggerheart-core/resources/domain-cards.json",
    ));
    expect(entries).toHaveLength(189);
    expect(entries.every((entry) => !entry.回想.includes("⚡"))).toBe(true);
  });

  test("uses one valid native Resource Package for all System Package libraries", async () => {
    const system = readJson<SystemPackageDocument>(path.join(packageRoot, "system.json"));
    expect(runtime.validate({
      family: "system-package",
      version: system.contractVersion,
      mode: "development",
      candidate: system,
    })).toEqual([]);
    expect(validateSystemPackageSemantics(system)).toEqual([]);
    expect(system.embeddedResources).toHaveLength(1);
    expect(system.embeddedResources[0]?.path).toBe("resources/daggerheart-core.pbres");

    const candidates = [];
    for (const embedded of system.embeddedResources) {
      const archive = new Uint8Array(readFileSync(path.join(packageRoot, ...embedded.path.split("/"))));
      expect(archive.byteLength).toBeGreaterThan(20_000_000);
      const loaded = await loadPbres(archive, validateResourcePackageCandidate);
      expect(loaded.diagnostics).toEqual([]);
      const index = preset.embeddedResourceIndex.find((item) => item.path === embedded.path);
      expect(index).toBeDefined();
      expect(loaded.candidate?.document.package.id).toBe(index?.packageId);
      expect(loaded.candidate?.document.package.version).toBe(index?.version);
      expect(loaded.candidate?.document.snapshotDigest).toBe(index?.snapshotDigest);
      if (loaded.candidate) candidates.push(loaded.candidate);
    }
    expect(candidates.flatMap((candidate) => candidate.document.resources)).toHaveLength(625);
    expect(new Set(candidates.flatMap((candidate) => candidate.document.assets.map((asset) => asset.id)))).toHaveLength(280);
    expect(new Set(candidates.flatMap((candidate) => candidate.document.resources.map((resource) => resource.template.id)))).toEqual(
      new Set(["种族", "社群", "职业", "子职业", "武器", "护甲", "物品", "领域卡"]),
    );
    const resources = candidates.flatMap((candidate) => candidate.document.resources);
    expect(resources.find((resource) => resource.id === "种族:械灵")?.data).toMatchObject({
      类型: "种族",
      特性: [
        { 名称: "定制设计", 描述: expect.not.stringContaining("定制设计") },
        { 名称: "高效休整", 描述: expect.not.stringContaining("高效休整") },
      ],
    });
    expect(resources.find((resource) => resource.id === "社群:高城之民")?.data).toMatchObject({
      类型: "社群",
      特性: { 名称: "高人一等", 描述: expect.not.stringContaining("高人一等") },
    });
    expect(resources.find((resource) => resource.id === "职业:吟游诗人")?.data).toMatchObject({
      类型: "职业",
      希望特性: { 名称: expect.any(String), 原名: expect.any(String), 特性描述: expect.any(String) },
      特性: [{ 名称: "鼓舞人心", 原名: "Rally", 特性描述: expect.any(String) }],
      推荐初始属性: { 敏捷: "+0", 力量: "-1", 灵巧: "+1", 本能: "+0", 风度: "+2", 知识: "+1" },
      推荐初始武器: "刺剑 + 匕首",
    });
    expect(candidates[0]?.document.package.version).toBe("1.0.13");
    expect(resources.every((resource) => Object.keys(resource.presentation).length === 2)).toBe(true);
    expect(resources.filter((resource) => resource.template.id === "职业").every((resource) => !resource.presentation.fixedRatio)).toBe(true);
    expect(resources.filter((resource) => resource.template.id === "环境").every((resource) => !resource.presentation.fixedRatio)).toBe(true);
    expect(resources.filter((resource) => !["职业", "环境"].includes(resource.template.id)).every((resource) => resource.presentation.fixedRatio)).toBe(true);
    const armorResources = resources.filter((resource) => resource.template.id === "护甲");
    expect(armorResources).toHaveLength(34);
    expect(armorResources.every((resource) => resource.template.version === "1.0.0")).toBe(true);
    const equipmentResources = resources.filter((resource) => resource.template.id === "护甲" || resource.template.id === "武器");
    expect(equipmentResources).toHaveLength(226);
    expect(equipmentResources.every((resource) => hasStructuredEquipmentFeature(resource.data))).toBe(true);
    const stableCounts = new Map([
      ["种族", 18], ["社群", 9], ["职业", 9], ["子职业", 54], ["物品", 120], ["领域卡", 189],
    ]);
    for (const [templateId, count] of stableCounts) {
      const matching = resources.filter((resource) => resource.template.id === templateId);
      expect(matching).toHaveLength(count);
      expect(matching.every((resource) => resource.template.version === "1.0.0")).toBe(true);
    }
    const subclassResources = resources.filter((resource) => resource.template.id === "子职业");
    expect(subclassResources.every((resource) => subclassFeatures(resource.data) !== null)).toBe(true);
    expect(subclassResources.flatMap((resource) => subclassFeatures(resource.data) ?? [])).toHaveLength(75);
    const professionResources = resources.filter((resource) => resource.template.id === "职业");
    expect(professionResources.every((resource) => professionFeatures(resource.data) !== null)).toBe(true);
    expect(professionResources.flatMap((resource) => professionFeatures(resource.data) ?? [])).toHaveLength(15);
    expect(system.resourceCompatibility.every((item) => item.versionRange.minimumInclusive === "1.0.0"
      && item.versionRange.maximumExclusive === "2.0.0")).toBe(true);
    expect(resources.filter((resource) => resource.media.portrait).every((resource) => resource.presentation.mode === "image")).toBe(true);
    expect(resources.filter((resource) => !resource.media.portrait).every((resource) => resource.presentation.mode === "text")).toBe(true);
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
      "名称", "属性", "距离", "伤害", "负荷", "位阶", "伤害类型", "特性名", "特性描述", "类型",
    ]);
    expect(secondaryWeapon.字段模板?.map((field) => field.键)).toEqual([
      "名称", "属性", "距离", "伤害", "负荷", "位阶", "伤害类型", "特性名", "特性描述", "类型",
    ]);
    expect(backupWeapon1.字段模板?.map((field) => field.键)).toEqual([
      "名称", "类型", "属性", "距离", "伤害", "负荷", "伤害类型", "特性名", "特性描述",
    ]);
    expect(backupWeapon2.字段模板?.map((field) => field.键)).toEqual([
      "名称", "类型", "属性", "距离", "伤害", "负荷", "伤害类型", "特性名", "特性描述",
    ]);
    expect(armor.字段模板?.map((field) => field.键)).toEqual([
      "名称", "重度阈值", "严重阈值", "护甲值", "位阶", "特性名", "特性描述",
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
