import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadPbres, type SystemPackageDocument } from "@pbdh/contract-runtime";
import { beforeAll, describe, expect, it } from "vitest";

import systemJson from "../../apps/player/src/daggerheart-core-system.generated.json";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import { applyResourceSelectionToDraft } from "../../apps/player/src/sheet-runtime/domain/resourceSelection.ts";
import type { ResourceLibrary as SheetResourceLibrary } from "../../apps/player/src/sheet-runtime/domain/resourceLibrary.ts";
import type { SystemPackage as SheetSystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import {
  loadDaggerheartCoreRuntimePackage,
} from "../../apps/player/src/sheet-runtime/loaders/daggerheartCoreRuntimeLoader.ts";import { rebuildDependencyRuntimeState } from "../../apps/player/src/sheet-runtime/store/runtimeStateHelpers.ts";
import { validateResourcePackageCandidate } from "../../apps/player/src/resources/resource-package-validator.ts";
import { routeResourcePackage } from "../../apps/player/src/resources/route-resource-package.ts";
import type { ResourceLibrary } from "../../apps/player/src/resources/resource-library.ts";

const packageRoot = path.resolve("apps/player/public/system-packages/daggerheart-core");
const currentSystem = systemJson as SystemPackageDocument;

let systemPackage: SheetSystemPackage;

beforeAll(async () => {
  const installedPackages = new Map();
  for (const embedded of currentSystem.embeddedResources) {
    const archive = await loadPbres(
      new Uint8Array(await readFile(path.join(packageRoot, embedded.path))),
      validateResourcePackageCandidate,
    );
    if (!archive.candidate) throw new Error("内置 .pbres 无法读取");
    const candidate = archive.candidate;
    installedPackages.set(candidate.document.package.id, {
      ...candidate,
      routes: routeResourcePackage({ currentSystem, resourcePackage: candidate.document }),
    });
  }
  const fetchFile: typeof fetch = async (url) => {
    const pathname = new URL(String(url), "https://preset.invalid").pathname;
    const marker = "/system-packages/daggerheart-core/";
    const relativePath = decodeURIComponent(pathname.slice(pathname.indexOf(marker) + marker.length));
    try {
      return new Response(await readFile(path.join(packageRoot, relativePath)), { status: 200 });
    } catch {
      return new Response(null, { status: 404 });
    }
  };
  const loaded = await loadDaggerheartCoreRuntimePackage({
    currentSystem,
    installedPackages: installedPackages as ResourceLibrary,
    baseUrl: "/",
    fetchFile,
  });
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
  systemPackage = loaded.package;
}, 60_000);

function library(id: string): SheetResourceLibrary {
  const found = systemPackage.resourceLibraries?.find((candidate) => candidate.ID === id);
  if (!found) throw new Error(`缺少资源库：${id}`);
  return found;
}

// Character Save 只保留最终字段，不保存资源选择快照（ADR-0052）。
// 重新打开存档时页面可见性只能从已保存字段重建，这里模拟 Save → 重新打开后的数据。
function reopenSavedData(data: ReturnType<typeof createEmptyCharacterData>) {
  return { ...data, resourceSelections: {} };
}

describe("Daggerheart 额外说明页", () => {
  it("德鲁伊在主职写入后显示野兽形态页，重新打开存档后仍可见", () => {
    const druid = library("classes").entries.find((entry) => entry.fields.名称 === "德鲁伊");
    expect(druid).toBeDefined();

    const applied = applyResourceSelectionToDraft(
      createEmptyCharacterData(systemPackage, "druid"),
      systemPackage,
      "pick-class",
      "classes",
      [druid!],
    );
    expect(applied.derivedResult.pageVisibility["beast-forms-t1-t2"]).toBe(true);
    expect(applied.derivedResult.pageVisibility["beast-forms-t3-t4"]).toBe(true);

    const reopened = rebuildDependencyRuntimeState(reopenSavedData(applied.characterData), systemPackage);
    expect(reopened.pageVisibility["beast-forms-t1-t2"]).toBe(true);
    expect(reopened.pageVisibility["beast-forms-t3-t4"]).toBe(true);
  });

  it("游侠的驯兽大师子职显示动物伙伴页，重新打开存档后仍可见", () => {
    const ranger = library("classes").entries.find((entry) => entry.fields.名称 === "游侠");
    const beastbound = library("subclasses").entries.find((entry) =>
      entry.fields.名称 === "驯兽大师" && entry.fields.等级 === "基础");
    expect(ranger).toBeDefined();
    expect(beastbound).toBeDefined();

    const withClass = applyResourceSelectionToDraft(
      createEmptyCharacterData(systemPackage, "ranger"),
      systemPackage,
      "pick-class",
      "classes",
      [ranger!],
    ).characterData;
    const withSubclass = applyResourceSelectionToDraft(
      withClass,
      systemPackage,
      "pick-subclass",
      "subclasses",
      [beastbound!],
    ).characterData;
    expect(withSubclass.character.values["subclass-name"]).toBe("驯兽大师");

    const reopened = rebuildDependencyRuntimeState(reopenSavedData(withSubclass), systemPackage);
    expect(reopened.pageVisibility["ranger-companion"]).toBe(true);
  });

  it("非德鲁伊、非驯兽大师角色不显示这些页面", () => {
    const warrior = library("classes").entries.find((entry) => entry.fields.名称 === "战士");
    expect(warrior).toBeDefined();
    const applied = applyResourceSelectionToDraft(
      createEmptyCharacterData(systemPackage, "warrior"),
      systemPackage,
      "pick-class",
      "classes",
      [warrior!],
    );
    const reopened = rebuildDependencyRuntimeState(reopenSavedData(applied.characterData), systemPackage);
    expect(reopened.pageVisibility["beast-forms-t1-t2"] ?? false).toBe(false);
    expect(reopened.pageVisibility["ranger-companion"] ?? false).toBe(false);
  });
});

describe("freeTextEquals 依赖条件", () => {
  const minimalPackage = (trigger: Record<string, string>) => ({
    manifest: { ID: "00000000-0000-7000-8000-000000000099", 名称: "条件测试", 版本: "1.0.0", 角色数据版本: "1.0.0" },
    pages: [
      { ID: "main", 名称: "人物卡", layout: { 类型: "htmlTemplate" as const, htmlContent: "<main><pb-module id=\"class-name\"></pb-module></main>" } },
      { ID: "beast", 名称: "野兽形态", 默认隐藏: true, layout: { 类型: "htmlTemplate" as const, htmlContent: "<main></main>" } },
    ],
    modules: [{ ID: "class-name", 类型: "freeText" as const, 标签: "职业" }],
    dependencies: [{
      ID: "show-beast-forms",
      sources: [{ 类型: "freeText" as const, 模块ID: "class-name" }],
      targets: [{ 类型: "page" as const, 页面ID: "beast" }],
      触发: trigger,
      条件: { 类型: "freeTextEquals" as const, 值: "德鲁伊" },
      动作: [{ 类型: "setVisibility" as const, 目标类型: "page" as const, 目标ID: "beast", 显示: true }],
    }],
  });

  it("允许 freeTextChanged 触发读取已保存文本控制页面可见性", async () => {
    const { validateSystemPackage } = await import("../../apps/player/src/sheet-runtime/domain/systemPackage/validator.ts");
    const result = validateSystemPackage(minimalPackage({ 类型: "freeTextChanged", 来源模块ID: "class-name" }));
    expect(result.ok).toBe(true);
  });

  it("拒绝把 freeTextEquals 用在 resourceSelected 触发上", async () => {
    const { validateSystemPackage } = await import("../../apps/player/src/sheet-runtime/domain/systemPackage/validator.ts");
    const result = validateSystemPackage(minimalPackage({ 类型: "resourceSelected", 来源模块ID: "class-name" }));
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "UNSUPPORTED_DEPENDENCY_CONDITION" }),
    ]));
  });
});
