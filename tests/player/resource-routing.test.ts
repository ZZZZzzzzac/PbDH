import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { routeResourcePackage } from "../../apps/player/src/resources/route-resource-package.ts";
import type {
  ResourcePackageLogicalDocument,
  SystemPackageDocument,
} from "../../packages/contract-runtime/src/index.ts";

const root = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}

const system = readJson<SystemPackageDocument>(
  "apps/player/public/system-packages/daggerheart-core/system.json",
);
const resourcePackage = readJson<ResourcePackageLogicalDocument>(
  "contracts/conformance/resource-package/1.0.0/valid/daggerheart-core-primary-weapon.json",
);

function routeWithTargets(targets: ResourcePackageLogicalDocument["targets"]) {
  return routeResourcePackage({
    currentSystem: system,
    resourcePackage: { ...resourcePackage, targets },
  });
}

describe("Player Resource Compatibility routing", () => {
  test("包版本与文字变更不改变原生路由，删除资源和换模板按实际内容处理", () => {
    const changed = structuredClone(resourcePackage);
    changed.package.version = "9.0.0";
    changed.resources[0]!.data = { ...(changed.resources[0]!.data as Record<string, string>), 名称: "修改后的名称" };
    expect(routeResourcePackage({ currentSystem: system, resourcePackage: changed })[0]?.destination).toBe("native");
    const templateChanged = structuredClone(changed);
    templateChanged.resources[0]!.template.id = "尚未声明兼容的模板";
    expect(routeResourcePackage({ currentSystem: system, resourcePackage: templateChanged })[0])
      .toMatchObject({ destination: "other-resources", reason: "template-incompatible" });
    expect(routeResourcePackage({ currentSystem: system, resourcePackage: { ...changed, resources: [] } })).toEqual([]);
    expect(resourcePackage.resources).toHaveLength(1);
  });

  test("routes a compatible Template to its native entry", () => {
    expect(routeWithTargets(resourcePackage.targets)).toMatchObject([
      {
        destination: "native",
        nativeEntry: { id: "weapons", label: "武器" },
      },
    ]);
  });

  test("target metadata does not gate Template compatibility", () => {
    for (const targets of [
      [],
      [{ systemPackageId: "01a0132c-4eef-7703-94ac-ec8d1a660099", version: "1.0.0" }],
      [{ systemPackageId: system.package.id, version: "2.0.0" }],
      [
        { systemPackageId: "01a0132c-4eef-7703-94ac-ec8d1a660099", version: "1.0.0" },
        ...resourcePackage.targets,
      ],
    ]) {
      expect(routeWithTargets(targets)[0]?.destination).toBe("native");
    }
  });

  test("routes the exact Creator weapon pattern with no targets", () => {
    const creatorPackage = structuredClone(resourcePackage);
    creatorPackage.targets = [];
    creatorPackage.resources[0]!.template.version = "1.0.0";

    expect(routeResourcePackage({ currentSystem: system, resourcePackage: creatorPackage })[0]).toMatchObject({
      destination: "native",
      nativeEntry: { id: "weapons", label: "武器" },
    });
  });

  test("falls back when target matches but Template compatibility does not", () => {
    const incompatible = structuredClone(system);
    const weaponCompatibility = incompatible.resourceCompatibility.find((item) => item.templateId === "武器")!;
    weaponCompatibility.versionRange = {
      minimumInclusive: "2.0.0",
      maximumExclusive: "3.0.0",
    };
    expect(routeResourcePackage({ currentSystem: incompatible, resourcePackage })[0]).toMatchObject({
      destination: "other-resources",
      reason: "template-incompatible",
    });
  });

  test("contains no Daggerheart or weapon-type special case", () => {
    const genericSystem = structuredClone(system);
    genericSystem.package.id = "01a0132c-4eef-7703-94ac-ec8d1a660077";
    genericSystem.package.name = "Generic Test System";
    genericSystem.resourceCompatibility[0]!.templateId = "生物";
    genericSystem.resourceCompatibility[0]!.nativeEntry = { id: "creatures", label: "生物" };
    const genericResources = structuredClone(resourcePackage);
    genericResources.targets = [{
      systemPackageId: genericSystem.package.id,
      version: genericSystem.package.version,
    }];
    genericResources.resources[0]!.template.id = "生物";
    expect(routeResourcePackage({
      currentSystem: genericSystem,
      resourcePackage: genericResources,
    })[0]).toMatchObject({
      destination: "native",
      nativeEntry: { id: "creatures", label: "生物" },
    });
  });
});
