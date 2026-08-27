import { readFile } from "node:fs/promises";
import path from "node:path";

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
    expect(currentSystem.package).toMatchObject({
      id: "01a04186-51be-74e1-b94f-ec17d354dc00",
      name: "寻望之心",
      version: "1.1.0",
    });
    expect(loaded.package.manifest.ID).toBe(currentSystem.package.id);
    expect(loaded.package.pages).toHaveLength(1);
    expect(loaded.package.modules.length).toBeGreaterThan(20);
    expect(loaded.package.validationChecks).toHaveLength(3);
    expect(loaded.package.skins).toContainEqual(expect.objectContaining({ ID: "survivor-notebook" }));
    expect(loaded.package.resourceLibraries?.map((library) => [library.ID, library.entries.length]))
      .toEqual([["survivor-styles", 8]]);
    expect(loaded.package.resourceLibraries?.[0]?.entries[0]?.fields)
      .toHaveProperty("第一特性名称");
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
      ["名称", "简介", "第一特性名称", "第一特性规则", "第二特性名称", "第二特性规则"],
      ["名称", "简介", "第一特性名称", "第一特性规则", "第二特性名称", "第二特性规则"],
    ]);
    expect(loaded.package.resourceFormatAdapters).toBeUndefined();
    expect(heartOfHopefindPreset.fileCount).toBeGreaterThan(10);
  });

  it("在窄屏下取消 A4 固定宽度并折叠多栏布局", async () => {
    const layout = await readFile(path.join(packageRoot, "layouts/base.css"), "utf8");

    expect(layout).toContain("@media screen and (max-width: 800px)");
    expect(layout).toContain("width: 100%");
    expect(layout).toContain(".overview-grid");
    expect(layout).toContain("grid-template-columns: minmax(0, 1fr)");
  });
});
