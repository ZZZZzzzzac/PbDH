import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import type {
  ResourcePackageLogicalDocument,
  SystemPackageDocument,
} from "../../packages/contract-runtime/src/index.ts";
import { buildSheetResourceLibraries } from "../../apps/player/src/sheet-runtime/adapters/platformResourceLibraries.ts";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import {
  queryResourceLibraryEntries,
} from "../../apps/player/src/sheet-runtime/domain/resourceLibrary.ts";
import { applyResourceSelectionToDraft } from "../../apps/player/src/sheet-runtime/domain/resourceSelection.ts";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import { routeResourcePackage } from "../../apps/player/src/resources/route-resource-package.ts";

const root = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}

const currentSystem = readJson<SystemPackageDocument>(
  "apps/player/public/system-packages/daggerheart-core/system.json",
);
const runtimeSystem = {
  manifest: { ID: "daggerheart-core", 名称: "匕首之心", 版本: "1.0.0", 角色数据版本: "1.0.0" },
  pages: [],
  modules: [
    { ID: "pick-primary-weapon", 类型: "resourcePicker", 按钮文本: "选择主武器", 资源库: "weapons" },
    { ID: "primary-weapon-name", 类型: "freeText", 标签: "主武器" },
    { ID: "primary-weapon-description", 类型: "freeText", 标签: "主武器特性" },
  ],
  dependencies: [{
    ID: "fill-primary-weapon",
    sources: [{ 类型: "resourcePicker", 模块ID: "pick-primary-weapon" }],
    targets: [
      { 类型: "module", 模块ID: "primary-weapon-name" },
      { 类型: "module", 模块ID: "primary-weapon-description" },
    ],
    触发: { 类型: "resourceSelected", 来源模块ID: "pick-primary-weapon" },
    条件: { 类型: "always" },
    动作: [
      {
        类型: "fillText",
        目标模块ID: "primary-weapon-name",
        内容: {
          类型: "selectedResourceTemplate",
          格式: "**{{名称}}**｜{{属性}}｜{{距离}}｜{{伤害}} {{伤害类型}}｜{{负荷}}",
        },
      },
      {
        类型: "fillText",
        目标模块ID: "primary-weapon-description",
        内容: { 类型: "selectedResourceTemplate", 格式: "{{特性名称}}：{{特性描述}}" },
      },
    ],
  }],
} as unknown as SystemPackage;
const resourcePackage = readJson<ResourcePackageLogicalDocument>(
  "contracts/conformance/resource-package/1.0.0/valid/daggerheart-core-primary-weapon.json",
);
const installed = {
  document: resourcePackage,
  media: new Map(),
  routes: routeResourcePackage({ currentSystem, resourcePackage }),
};
const weaponLibrary = buildSheetResourceLibraries({
  currentSystem,
  installedPackages: new Map([[resourcePackage.package.id, installed]]),
}).find((library) => library.ID === "weapons")!;
const broadswordEntry = weaponLibrary.entries[0]!;

describe("Player resource selection materialization", () => {
  test("writes all declared final values through the Sheet Runtime", () => {
    const before = createEmptyCharacterData(runtimeSystem, "resource-application");
    const result = applyResourceSelectionToDraft(
      before,
      runtimeSystem,
      "pick-primary-weapon",
      "weapons",
      [broadswordEntry],
    );

    expect(result.interactionResult.warnings).toEqual([]);
    expect(result.interactionResult.dataPatches).toEqual({
      "primary-weapon-name": "**阔剑**｜敏捷｜近战｜d8 物理｜单手",
      "primary-weapon-description": "可靠：你的攻击掷骰+1。",
    });
    expect(result.characterData.character.values).toMatchObject(result.interactionResult.dataPatches);
    expect(result.characterData.resourceSelections).not.toHaveProperty("pick-primary-weapon");
    expect(JSON.stringify(result.characterData)).not.toContain(resourcePackage.package.id);
    expect(JSON.stringify(result.characterData)).not.toContain(broadswordEntry.ID);
  });

  test("no matching Dependency produces zero writes and no persistence", () => {
    const before = createEmptyCharacterData(runtimeSystem, "no-dependency");
    const result = applyResourceSelectionToDraft(
      before,
      runtimeSystem,
      "unknown-picker",
      "weapons",
      [broadswordEntry],
    );

    expect(result.characterData).toBe(before);
    expect(result.interactionResult.dataPatches).toEqual({});
    expect(result.shouldPersist).toBe(false);
  });

  test("later package changes cannot mutate the materialized result", () => {
    const mutableEntry = structuredClone(broadswordEntry);
    const applied = applyResourceSelectionToDraft(
      createEmptyCharacterData(runtimeSystem, "immutable-result"),
      runtimeSystem,
      "pick-primary-weapon",
      "weapons",
      [mutableEntry],
    ).characterData;
    mutableEntry.fields.名称 = "已更新的阔剑";
    mutableEntry.fields.特性描述 = "新描述";

    expect(applied.character.values["primary-weapon-name"]).toBe("**阔剑**｜敏捷｜近战｜d8 物理｜单手");
    expect(applied.character.values["primary-weapon-description"]).toBe("可靠：你的攻击掷骰+1。");
  });

  test("native picker candidates keep Sheet search, filter, sort, and single-resource identity", () => {
    expect(weaponLibrary.entries).toHaveLength(1);
    expect(queryResourceLibraryEntries(weaponLibrary, { keywords: "阔剑" })[0]?.ID)
      .toBe(broadswordEntry.ID);
    expect(queryResourceLibraryEntries(weaponLibrary, { filters: { 属性: ["知识"] } }))
      .toEqual([]);
    expect(queryResourceLibraryEntries(weaponLibrary, {
      filters: { 属性: ["敏捷"] },
      sort: { field: "位阶", direction: "desc" },
    })[0]?.ID).toBe(broadswordEntry.ID);
  });
});
