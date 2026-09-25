import { readFile } from "node:fs/promises";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import { applyResourceSelectionToDraft } from "../../apps/player/src/sheet-runtime/domain/resourceSelection.ts";
import { gridItem, moveGridItem } from "../../apps/player/src/sheet-runtime/domain/gridLayout.ts";
import { characterSaveToSheet } from "../../apps/player/src/sheet-runtime/storage/characterSaveAdapter.ts";
import { evaluateDependencies, rebuildDerivedDependencies } from "../../apps/player/src/sheet-runtime/domain/dependencyEngine.ts";
import { sheetCharacterToSave, completeCharacterDataForSystemPackage, validateCharacterDataForSystemPackage } from "../../apps/player/src/sheet-runtime/storage/characterSaveAdapter.ts";

import { loadPbres, type SystemPackageDocument } from "@pbdh/contract-runtime";
import { describe, expect, it } from "vitest";

import systemJson from "../../apps/player/src/heart-of-hopefind-system.generated.json";
import { validateResourcePackageCandidate } from "../../apps/player/src/resources/resource-package-validator.ts";
import type { ResourceLibrary } from "../../apps/player/src/resources/resource-library.ts";
import { routeResourcePackage } from "../../apps/player/src/resources/route-resource-package.ts";
import {
  heartOfHopefindPreset,
  loadHeartOfHopefindRuntimePackage,
} from "../../apps/player/src/sheet-runtime/loaders/heartOfHopefindRuntimeLoader.ts";

const packageRoot = path.resolve("apps/player/public/system-packages/heart-of-hopefind");
const currentSystem = systemJson as SystemPackageDocument;

describe("寻望之心 Sheet Runtime 加载", () => {
  it("通过当前 System Package Contract 加载不同布局与标准内嵌资源", async () => {
    const installedPackages = new Map();
    for (const embedded of currentSystem.embeddedResources) {
      const archive = await loadPbres(
        new Uint8Array(await readFile(path.join(packageRoot, embedded.path))),
        validateResourcePackageCandidate,
      );
      expect(archive.candidate).not.toBeNull();
      const candidate = archive.candidate!;
      installedPackages.set(candidate.document.package.id, {
        ...candidate,
        routes: routeResourcePackage({
          currentSystem,
          resourcePackage: candidate.document,
        }),
      });
    }
    const fetchFile: typeof fetch = async (url) => {
      const pathname = new URL(String(url), "https://preset.invalid").pathname;
      const marker = "/system-packages/heart-of-hopefind/";
      const relativePath = decodeURIComponent(pathname.slice(pathname.indexOf(marker) + marker.length));
      try {
        return new Response(await readFile(path.join(packageRoot, relativePath)), { status: 200 });
      } catch {
        return new Response(null, { status: 404 });
      }
    };

    const loaded = await loadHeartOfHopefindRuntimePackage({
      currentSystem,
      installedPackages: installedPackages as ResourceLibrary,
      baseUrl: "/",
      fetchFile,
    });

    if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues, null, 2));
    expect(currentSystem.contractVersion).toBe("1.0.0");
    expect(currentSystem.package).toMatchObject({
      id: "01a04186-51be-74e1-b94f-ec17d354dc00",
      name: "寻望之心",
      version: "1.0.3",
    });
    expect(loaded.package.manifest.ID).toBe(currentSystem.package.id);
    expect(loaded.package.pages).toHaveLength(2);
    expect(loaded.package.modules.length).toBeGreaterThan(20);
    expect(loaded.package.validationChecks).toHaveLength(4);
    expect(loaded.package.skins).toContainEqual(expect.objectContaining({ ID: "survivor-notebook" }));
    expect(loaded.package.resourceLibraries?.map((library) => [library.ID, library.entries.length]))
      .toEqual([["survivor-styles", 8], ["supplies", 50]]);
    expect(loaded.package.resourceLibraries?.[0]?.entries[0]?.fields)
      .toHaveProperty("内容1名称");
    const styles = loaded.package.resourceLibraries![0]!.entries.map((entry) => entry.fields.名称);
    expect(styles).toContain("孤狼");
    expect(styles).not.toContain("孤独");
    let data = createEmptyCharacterData(loaded.package);
    data.character.values["fear-die"] = "d8";
    data.character.values["dark-erosion"] = { active: true };
    data.character.values["core-hurt-status-turn"] = "暗蚀";
    data.character.values["bag-1-cell-1-1"] = "水壶";
    data.character.values["bag-1-cell-2-1"] = "水壶";
    for (const checked of [true, false]) {
      data.character.values.noise = { active: checked };
      const result = evaluateDependencies(data, loaded.package, {
        type: "checkboxChanged", sourceModuleId: "noise", optionId: "active", checked,
        checkboxState: { active: checked },
      });
      expect(result.dataPatches).toEqual({});
      expect(result.moduleVisibility["noisy-fear-die"]).toBe(checked);
      expect(rebuildDerivedDependencies(data, loaded.package).moduleVisibility["noisy-fear-die"]).toBe(checked);
    }
    const supply = loaded.package.resourceLibraries!.find((library) => library.ID === "supplies")!.entries.find((entry) => entry.fields.尺寸 === "1×2")!;
    const table = loaded.package.modules.find((module) => module.ID === "supply-inventory")!;
    if (table.类型 !== "cardTable") throw new Error("Missing grid table.");
    expect(table.网格布局?.容器).toHaveLength(1);
    expect(table.网格布局?.容器[0]?.尺寸选项?.map((entry) => [entry.行数, entry.列数])).toEqual([[3, 5], [5, 5], [7, 5]]);
    const picker = loaded.package.modules.find((entry) => entry.ID === "pick-supplies");
    expect(picker?.类型 === "resourcePicker" && picker.多选).toBe(false);
    for (let count = 0; count < 2; count += 1) data = applyResourceSelectionToDraft(data, loaded.package, "pick-supplies", "supplies", [supply]).characterData;
    expect(data.cards.instances).toHaveLength(2);
    const oversized = loaded.package.resourceLibraries!.find((library) => library.ID === "supplies")!.entries.find((entry) => entry.fields.尺寸 === "大件")!;
    data = applyResourceSelectionToDraft(data, loaded.package, "pick-supplies", "supplies", [oversized]).characterData;
    expect(data.cards.instances).toHaveLength(2);
    expect(data.character.values["oversized-supplies"]).toContain(oversized.fields.名称);
    const [first, second] = data.cards.instances;
    expect(first!.state).toBe("手上");
    expect(first!.definitionRef).not.toEqual(second!.definitionRef);
    data = moveGridItem(data, loaded.package, { instanceId: first!.instanceId, state: "主背包", column: 4, row: 0, rotation: 0 });
    expect(() => moveGridItem(data, loaded.package, { instanceId: first!.instanceId, state: "主背包", column: 4, row: 0, rotation: 90 })).toThrow("越界");
    expect(() => moveGridItem(data, loaded.package, { instanceId: second!.instanceId, state: "主背包", column: 4, row: 0, rotation: 0 })).toThrow("占用");
    data = moveGridItem(data, loaded.package, { instanceId: first!.instanceId, state: "主背包", column: 0, row: 0, rotation: 90 });
    expect(gridItem(data, loaded.package, table, data.cards.instances[0]!).size).toEqual({ width: 2, height: 1 });
    const saved = await sheetCharacterToSave({ name: "求生者", data, sheetSystemPackage: loaded.package,
      installedPackages, currentSystem: { ...currentSystem.package, resourceCompatibility: currentSystem.resourceCompatibility } });
    const withoutLibraries = { ...loaded.package, resourceLibraries: [] };
    const restored = characterSaveToSheet({ candidate: saved, sheetSystemPackage: withoutLibraries, currentSystem, installedPackages: new Map(), mediaUrl: () => "" });
    expect(restored.cards.instances.map((item) => [item.state, item.rotation])).toEqual([["主背包", 90], ["手上", 0]]);
    expect(gridItem(restored, withoutLibraries, table, restored.cards.instances[0]!).size).toEqual({ width: 2, height: 1 });
    expect(moveGridItem(restored, withoutLibraries, { instanceId: first!.instanceId, state: "手上", column: 0, row: 0, rotation: 90 }).cards.instances[0]!.state).toBe("手上");
    expect(saved.document.characterData["fear-die"]).toBe("d8");
    expect(saved.document.characterData["core-hurt-status-turn"]).toBe("暗蚀");
    expect(saved.document.characterData["bag-1-cell-2-1"]).toBe("水壶");
    const previous = { ...saved.document, characterData: { ...saved.document.characterData } };
    delete previous.characterData["dark-erosion"];
    delete previous.characterData["arc-limit"];
    const completed = completeCharacterDataForSystemPackage(previous, loaded.package);
    expect(completed.characterData["arc-limit"]).toBe("5");
    expect(completed.characterData["fear-die"]).toBe("d8");
    expect(validateCharacterDataForSystemPackage(completed, loaded.package)).toEqual([]);
    const packageAssetUrls = new Map(
      loaded.packageAssets?.map((asset) => [asset.路径, asset.staticUrl]) ?? [],
    );
    for (const resource of ["life", "stress", "hope", "wounds"]) {
      expect(packageAssetUrls.get(`assets/icons/resource-${resource}-marked.webp`))
        .toContain(`/system-packages/heart-of-hopefind/assets/icons/resource-${resource}-marked.webp`);
      expect(packageAssetUrls.get(`assets/icons/resource-${resource}-unmarked.webp`))
        .toContain(`/system-packages/heart-of-hopefind/assets/icons/resource-${resource}-unmarked.webp`);
    }
    const composer = loaded.package.modules.find((module) => module.ID === "pick-survivor-style");
    expect(composer?.类型).toBe("resourceComposer");
    if (composer?.类型 !== "resourceComposer") throw new Error("Missing survivor style composer.");
    expect(composer.来源槽位.map((slot) => slot.字段模板?.map((field) => field.键))).toEqual([
      ["名称", "简介", "内容1名称", "内容1描述", "内容2名称", "内容2描述"],
      ["名称", "简介", "内容1名称", "内容1描述", "内容2名称", "内容2描述"],
    ]);
    expect(loaded.package.resourceFormatAdapters).toBeUndefined();
    const inventory = JSON.parse(await readFile(
      path.join(packageRoot, ".pbdh-runtime-files.json"),
      "utf8",
    )) as { files: string[] };
    expect(inventory.files).toContain("system.json");
    expect(inventory.files).not.toContain("manifest.json");
    expect(inventory.files.some((file) => file.startsWith("runtime-libraries/"))).toBe(false);
    await expect(readFile(path.join(packageRoot, "manifest.json"))).rejects.toThrow();
    expect(heartOfHopefindPreset.fileCount).toBeGreaterThan(10);
  });

  it("在窄屏下取消 A4 固定宽度并折叠多栏布局", async () => {
    const layout = await readFile(path.join(packageRoot, "layouts/base.css"), "utf8");

    expect(layout).toContain("@media screen and (max-width: 800px)");
    expect(layout).toContain("width: 100%");
    expect(layout).toContain(".overview-grid");
    expect(layout).toContain("grid-template-columns: minmax(0, 1fr)");
  });

  it("审核希望骰和单条职业加值，不限制职业总点数与旧弧光上限", async () => {
    const check = async (file: string, values: Record<string, unknown>) => {
      const context = { module: { exports: async (_input: unknown): Promise<Array<{ code: string }>> => [] } };
      runInNewContext(await readFile(path.join(packageRoot, "checks", file), "utf8"), context);
      return context.module.exports({ characterData: { character: { values } } });
    };
    expect(await check("character-state.js", { "hope-die": "d20", "fear-die": "d12" }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: "HOPEFIND_HOPE_DIE_INVALID" })]));
    const trained = { "profession-name": "警察", "profession-modifier-1": "3", "profession-modifier-2": "3",
      "profession-modifier-3": "2", "profession-modifier-4": "1" };
    expect(await check("character-details.js", trained)).toEqual([]);
    expect(await check("character-details.js", { "profession-name": "警察", "profession-modifier-1": "3" })).toEqual([]);
    expect(await check("character-details.js", { ...trained, "profession-modifier-1": "4" }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: "HOPEFIND_PROFESSION_MODIFIER_MAX" })]));
    const arcs = { "arc-limit": "1", "arc-1-description": "守护伙伴", "arc-1-intensity": "2",
      "arc-2-description": "回忆投入 3", "arc-2-intensity": "1" };
    expect(await check("character-details.js", arcs)).toEqual([]);
    expect(await check("character-details.js", { ...arcs, "arc-limit": "2" })).toEqual([]);
    const inventory = { "bag-1-rows": "3", "bag-1-columns": "5", "bag-1-cell-1-1": "水壶", "bag-1-cell-2-1": "水壶" };
    expect(await check("inventory.js", inventory)).toEqual([]);
    expect(await check("inventory.js", { ...inventory, "bag-2-rows": "5", "bag-2-columns": "5" })).toEqual([]);
    expect(await check("inventory.js", { ...inventory, "bag-1-rows": "4" }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: "HOPEFIND_BAG_PRESET" })]));
  });
});
