import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import type {
  ResourcePackageLogicalDocument,
  SystemPackageDocument,
} from "../../packages/contract-runtime/src/index.ts";
import { applyResourceSelection } from "../../apps/player/src/resources/apply-resource-selection.ts";
import {
  listResourcePickerCandidates,
  queryResourcePickerCandidates,
} from "../../apps/player/src/resources/resource-picker.ts";
import { routeResourcePackage } from "../../apps/player/src/resources/route-resource-package.ts";

const root = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}

const currentSystem = readJson<SystemPackageDocument>(
  "contracts/conformance/system-package/1.0.0-alpha.1/valid/daggerheart/system.json",
);
const resourcePackage = readJson<ResourcePackageLogicalDocument>(
  "contracts/conformance/resource-package/1.0.0-alpha.1/valid/daggerheart-core-primary-weapon.json",
);
const broadsword = resourcePackage.resources[0]!;

describe("Player resource selection materialization", () => {
  test("writes all declared final values in one result", () => {
    const before = { characterName: "阿斯特里德" };
    const result = applyResourceSelection({
      characterData: before,
      currentSystem,
      sourceModuleId: "pick-primary-weapon",
      selectedResource: broadsword,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.patches).toEqual({
      "primary-weapon-name": "**阔剑**｜敏捷｜近战｜d8 物理｜单手",
      "primary-weapon-description": "可靠：你的攻击掷骰+1。",
    });
    expect(result.characterData).toEqual({ ...before, ...result.patches });
    expect(result.characterData).not.toHaveProperty("resourceSelections");
    expect(JSON.stringify(result.characterData)).not.toContain(resourcePackage.package.id);
    expect(JSON.stringify(result.characterData)).not.toContain(broadsword.id);
  });

  test("missing field rejects the entire event with zero writes", () => {
    const selectedResource = structuredClone(broadsword);
    delete (selectedResource.data as Record<string, unknown>)["描述"];
    const before = { "primary-weapon-name": "旧武器", untouched: "保留" };
    const result = applyResourceSelection({
      characterData: before,
      currentSystem,
      sourceModuleId: "pick-primary-weapon",
      selectedResource,
    });

    expect(result.characterData).toBe(before);
    expect(result.patches).toEqual({});
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      "player.resource-selection.field-missing",
    ]);
  });

  test("no matching Dependency produces a diagnostic and zero writes", () => {
    const before = { untouched: "保留" };
    const result = applyResourceSelection({
      characterData: before,
      currentSystem,
      sourceModuleId: "unknown-picker",
      selectedResource: broadsword,
    });

    expect(result.characterData).toBe(before);
    expect(result.patches).toEqual({});
    expect(result.diagnostics[0]?.code).toBe("player.resource-selection.dependency-missing");
  });

  test("later package changes cannot mutate the materialized result", () => {
    const applied = applyResourceSelection({
      characterData: {},
      currentSystem,
      sourceModuleId: "pick-primary-weapon",
      selectedResource: broadsword,
    }).characterData;
    const updated = structuredClone(broadsword);
    (updated.data as Record<string, unknown>)["名称"] = "已更新的阔剑";
    (updated.data as Record<string, unknown>)["描述"] = "新描述";

    expect(applied["primary-weapon-name"]).toBe("**阔剑**｜敏捷｜近战｜d8 物理｜单手");
    expect(applied["primary-weapon-description"]).toBe("可靠：你的攻击掷骰+1。");
  });

  test("native picker candidates keep Sheet search, filter, sort, and single-resource identity", () => {
    const installed = {
      document: resourcePackage,
      media: new Map(),
      routes: routeResourcePackage({ currentSystem, resourcePackage }),
    };
    const candidates = listResourcePickerCandidates(
      new Map([[resourcePackage.package.id, installed]]),
      "weapons",
    );

    expect(candidates).toHaveLength(1);
    expect(queryResourcePickerCandidates(candidates, { keywords: "阔剑" })[0]?.resource.id)
      .toBe(broadsword.id);
    expect(queryResourcePickerCandidates(candidates, { filters: { 属性: ["知识"] } }))
      .toEqual([]);
    expect(queryResourcePickerCandidates(candidates, {
      filters: { 属性: ["敏捷"] },
      sort: { field: "位阶", direction: "desc" },
    })[0]?.resource.id).toBe(broadsword.id);
  });
});
