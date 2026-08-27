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

describe("migrated Daggerheart Core System Package", () => {
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
      expect(loaded.candidate?.document.snapshotDigest).toBe(embedded.snapshotDigest);
      if (loaded.candidate) candidates.push(loaded.candidate);
    }
    expect(candidates.flatMap((candidate) => candidate.document.resources)).toHaveLength(625);
    expect(new Set(candidates.flatMap((candidate) => candidate.document.assets.map((asset) => asset.id)))).toHaveLength(280);
    expect(new Set(candidates.flatMap((candidate) => candidate.document.resources.map((resource) => resource.template.id)))).toEqual(
      new Set(["种族", "社群", "职业", "子职业", "武器", "护甲", "物品", "领域卡"]),
    );
    const resources = candidates.flatMap((candidate) => candidate.document.resources);
    expect(resources.filter((resource) => resource.media.portrait).every((resource) => resource.presentation.mode === "image")).toBe(true);
    expect(resources.filter((resource) => !resource.media.portrait).every((resource) => resource.presentation.mode === "text")).toBe(true);
  });

  test("keeps old Sheet resource documents out of the public runtime", () => {
    const manifest = readJson<Record<string, unknown>>(path.join(packageRoot, "manifest.json"));
    expect(manifest).not.toHaveProperty("resourceFormatAdapters");
    expect(manifest.resourceLibraries).toEqual(expect.arrayContaining([
      expect.objectContaining({ ID: "weapons", 路径: "runtime-libraries/weapons.json" }),
      expect.objectContaining({ ID: "domain-cards", 路径: "runtime-libraries/domain-cards.json" }),
    ]));
    expect(readJson(path.join(packageRoot, "runtime-libraries/weapons.json"))).toEqual([]);
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
    const armor = pickerLibrary("pick-armor");

    expect(primaryWeapon.字段模板?.map((field) => field.键)).toEqual([
      "名称", "属性", "距离", "伤害", "负荷", "位阶", "伤害类型", "描述", "类型",
    ]);
    expect(secondaryWeapon.字段模板?.map((field) => field.键)).toEqual([
      "名称", "属性", "距离", "伤害", "负荷", "位阶", "伤害类型", "描述", "类型",
    ]);
    expect(armor.字段模板?.map((field) => field.键)).toContain("位阶");
    expect(primaryWeapon.默认查询?.sort).toEqual({ field: "位阶", direction: "asc" });
    expect(secondaryWeapon.默认查询?.sort).toEqual({ field: "位阶", direction: "asc" });
    expect(armor.默认查询?.sort).toEqual({ field: "位阶", direction: "asc" });

    const primaryDamageType = primaryWeapon.字段模板?.find((field) => field.键 === "伤害类型");
    const secondaryDamageType = secondaryWeapon.字段模板?.find((field) => field.键 === "伤害类型");
    expect(primaryDamageType).toMatchObject({ 标签: "类型", 列宽: "compact" });
    expect(secondaryDamageType).toMatchObject({ 标签: "类型", 列宽: "compact" });
  });
});
