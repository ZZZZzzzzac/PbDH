import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  loadPbres,
  type ResourcePackageLogicalDocument,
  type SystemPackageDocument,
} from "@pbdh/contract-runtime";
import { describe, expect, it } from "vitest";

import systemJson from "../../apps/player/src/daggerheart-core-system.generated.json";
import { sheetRuntimeMediaPath } from "../../apps/player/src/sheet-runtime/adapters/platformResourceLibraries.ts";
import {
  createEmptyCharacterData,
  exportCharacterData,
  parseCharacterDataJson,
} from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import { applyResourceSelectionToDraft } from "../../apps/player/src/sheet-runtime/domain/resourceSelection.ts";
import {
  daggerheartCorePreset,
  loadDaggerheartCoreRuntimePackage,
} from "../../apps/player/src/sheet-runtime/loaders/daggerheartCoreRuntimeLoader.ts";
import { validateResourcePackageCandidate } from "../../apps/player/src/resources/resource-package-validator.ts";
import { routeResourcePackage } from "../../apps/player/src/resources/route-resource-package.ts";
import type { ResourceLibrary } from "../../apps/player/src/resources/resource-library.ts";

const packageRoot = path.resolve("apps/player/public/system-packages/daggerheart-core");
const currentSystem = systemJson as SystemPackageDocument;
const marketWeaponFixture = JSON.parse(await readFile(path.resolve(
  "contracts/conformance/resource-package/1.0.0-alpha.1/valid/daggerheart-core-primary-weapon.json",
), "utf8")) as ResourcePackageLogicalDocument;
const marketWeaponMedia = new Uint8Array(await readFile(path.resolve(
  "contracts/conformance/resource-package/1.0.0-alpha.1/media/a991add6e770461480dd9bf35fde9debe267f7f5b970d01cb65bb689166b28cd.webp",
)));

describe("Daggerheart Core Sheet Runtime 加载", () => {
  it("从带包级封面的原生 .pbres 组装完整资源库且不报告未使用图片", async () => {
    const installedPackages = new Map();
    for (const embedded of currentSystem.embeddedResources) {
      const archive = await loadPbres(
        new Uint8Array(await readFile(path.join(packageRoot, embedded.path))),
        validateResourcePackageCandidate,
      );
      expect(archive.candidate).not.toBeNull();
      const candidate = archive.candidate!;
      const coverAssetId = `sha256:${"f".repeat(64)}`;
      candidate.document.assets.push({
        ...candidate.document.assets[0]!,
        id: coverAssetId,
        byteLength: "1",
      });
      candidate.media.set(coverAssetId, new Uint8Array([1]));
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

    if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues, null, 2));
    expect(loaded.package.manifest.ID).toBe(currentSystem.package.id);
    expect(loaded.package.modules.length).toBeGreaterThan(20);
    expect(loaded.package.pages.length).toBeGreaterThan(1);
    expect(loaded.package.resourceLibraries?.reduce((total, library) =>
      total + library.entries.length, 0)).toBe(625);
    for (const libraryId of ["subclasses", "domain-cards"]) {
      const imageEntry = loaded.package.resourceLibraries?.find((library) => library.ID === libraryId)
        ?.entries.find((entry) => entry.fields.卡牌显示方式 === "image");
      expect(imageEntry?.fields.卡图).toBeTruthy();
      expect(loaded.packageAssets).toContainEqual(expect.objectContaining({
        路径: imageEntry?.fields.卡图,
        sourceType: "resourceExtension",
        bytes: expect.any(Uint8Array),
      }));
    }
    expect(loaded.issues.some((issue) => issue.code === "UNUSED_PACKAGE_IMAGE")).toBe(false);
    expect(loaded.package.resourceFormatAdapters).toBeUndefined();
    expect(daggerheartCorePreset.fileCount).toBeGreaterThan(10);

    const armor = loaded.package.resourceLibraries
      ?.find((library) => library.ID === "armor")
      ?.entries.find((entry) => entry.fields.名称 === "填充布甲");
    expect(armor).toBeDefined();
    const applied = applyResourceSelectionToDraft(
      createEmptyCharacterData(loaded.package, "armor-character"),
      loaded.package,
      "pick-armor",
      "armor",
      [armor!],
    );
    expect(applied.interactionResult.warnings).toEqual([]);
    expect(applied.characterData.character.values).toMatchObject({
      "armor-name": "**填充布甲**｜阈值 5/11｜护甲值 3",
      "armor-value": "3",
      "armor-description": ":red[**灵活**]：闪避值+1。",
      "armor-slots": { current: 0, max: 3 },
    });
    expect(applied.characterData.resourceSelections).not.toHaveProperty("pick-armor");
    expect(JSON.stringify(applied.characterData)).not.toContain(armor!.ID);
    expect(JSON.stringify(applied.characterData)).not.toContain(currentSystem.embeddedResources[0]!.packageId);

    const restored = parseCharacterDataJson(exportCharacterData(applied.characterData), loaded.package);
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.error);
    expect(restored.data.character.values).toMatchObject(applied.characterData.character.values);
    expect(restored.data.resourceSelections).not.toHaveProperty("pick-armor");
  });

  it("加载带卡图的 Market 原生武器时不把运行时卡图报告为未使用图片", async () => {
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
    const document = structuredClone(marketWeaponFixture);
    document.resources[0]!.template.version = "1.0.0";
    document.resources[0]!.presentation.mode = "image";
    document.resources[0]!.media.portrait = document.assets[0]!.id;
    const media = new Map([[document.assets[0]!.id, marketWeaponMedia]]);
    installedPackages.set(document.package.id, {
      document,
      media,
      routes: routeResourcePackage({ currentSystem, resourcePackage: document }),
    });
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

    if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues, null, 2));
    expect(loaded.package.resourceLibraries?.find((library) => library.ID === "weapons")?.entries)
      .toContainEqual(expect.objectContaining({
        fields: expect.objectContaining({
          卡图: sheetRuntimeMediaPath(document.package.id, document.assets[0]!.id),
        }),
      }));
    expect(loaded.issues).not.toContainEqual(expect.objectContaining({
      code: "UNUSED_PACKAGE_IMAGE",
      path: sheetRuntimeMediaPath(document.package.id, document.assets[0]!.id),
    }));
  });
});
