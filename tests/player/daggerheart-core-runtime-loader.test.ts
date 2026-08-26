import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadPbres, type SystemPackageDocument } from "@pbdh/contract-runtime";
import { describe, expect, it } from "vitest";

import systemJson from "../../apps/player/src/daggerheart-core-system.generated.json";
import {
  daggerheartCorePreset,
  loadDaggerheartCoreRuntimePackage,
} from "../../apps/player/src/sheet-runtime/loaders/daggerheartCoreRuntimeLoader.ts";
import { validateResourcePackageCandidate } from "../../apps/player/src/resources/resource-package-validator.ts";
import { routeResourcePackage } from "../../apps/player/src/resources/route-resource-package.ts";
import type { ResourceLibrary } from "../../apps/player/src/resources/resource-library.ts";

const packageRoot = path.resolve("apps/player/public/system-packages/daggerheart-core");
const currentSystem = systemJson as SystemPackageDocument;

describe("Daggerheart Core Sheet Runtime 加载", () => {
  it("从原生 .pbres 组装完整的 Sheet Runtime 资源库", async () => {
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
    expect(loaded.package.resourceFormatAdapters).toBeUndefined();
    expect(daggerheartCorePreset.fileCount).toBeGreaterThan(10);
  });
});
