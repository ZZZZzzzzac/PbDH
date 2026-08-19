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
  "contracts/conformance/system-package/1.0.0-alpha.1/valid/daggerheart/system.json",
);
const resourcePackage = readJson<ResourcePackageLogicalDocument>(
  "contracts/conformance/resource-package/1.0.0-alpha.1/valid/minotaur-wrecker.json",
);

function routeWithTargets(targets: ResourcePackageLogicalDocument["targets"]) {
  return routeResourcePackage({
    currentSystem: system,
    resourcePackage: { ...resourcePackage, targets },
  });
}

describe("Player Resource Compatibility routing", () => {
  test("routes a matching target and compatible Template to native entry", () => {
    expect(routeWithTargets(resourcePackage.targets)).toMatchObject([
      {
        destination: "native",
        nativeEntry: { id: "adversaries", label: "敌人" },
      },
    ]);
  });

  test("supports zero, single, and multiple targets with any-target matching", () => {
    expect(routeWithTargets([])[0]).toMatchObject({
      destination: "other-resources",
      reason: "no-targets",
    });
    expect(routeWithTargets([
      { systemPackageId: "01a0132c-4eef-7703-94ac-ec8d1a660099", version: "1.0.0" },
    ])[0]).toMatchObject({
      destination: "other-resources",
      reason: "target-mismatch",
    });
    expect(routeWithTargets([
      { systemPackageId: "01a0132c-4eef-7703-94ac-ec8d1a660099", version: "1.0.0" },
      ...resourcePackage.targets,
    ])[0]?.destination).toBe("native");
  });

  test("requires matching System ID and SemVer MAJOR", () => {
    expect(routeWithTargets([
      { systemPackageId: system.package.id, version: "2.0.0" },
    ])[0]).toMatchObject({ destination: "other-resources", reason: "target-mismatch" });
    expect(routeWithTargets([
      { systemPackageId: system.package.id, version: "1.99.0" },
    ])[0]?.destination).toBe("native");
  });

  test("falls back when target matches but Template compatibility does not", () => {
    const incompatible = structuredClone(system);
    incompatible.resourceCompatibility[0]!.versionRange = {
      minimumInclusive: "2.0.0",
      maximumExclusive: "3.0.0",
    };
    expect(routeResourcePackage({ currentSystem: incompatible, resourcePackage })[0]).toMatchObject({
      destination: "other-resources",
      reason: "template-incompatible",
    });
  });

  test("contains no Daggerheart or enemy-type special case", () => {
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
