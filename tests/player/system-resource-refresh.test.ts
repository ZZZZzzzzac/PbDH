import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadPbres } from "@pbdh/contract-runtime";
import { describe, expect, test } from "vitest";

import { playerSystemPackageCatalog } from "../../apps/player/src/playerSystemPackageCatalog.ts";
import { validateResourcePackageCandidate } from "../../apps/player/src/resources/resource-package-validator.ts";
import type { ResourceLibrary } from "../../apps/player/src/resources/resource-library.ts";
import { routeResourcePackage } from "../../apps/player/src/resources/route-resource-package.ts";
import { replacePlatformResourceLibraries } from "../../apps/player/src/sheet-runtime/adapters/platformResourceLibraries.ts";

const root = path.resolve("apps/player/public/system-packages");

describe("System Package resource refresh", () => {
  test.each(playerSystemPackageCatalog)("keeps $preset.name official resources exactly once after refresh", async (entry) => {
    const installedPackages = new Map();
    for (const embedded of entry.system.embeddedResources) {
      const archive = await loadPbres(
        new Uint8Array(await readFile(path.join(root, entry.preset.directory, embedded.path))),
        validateResourcePackageCandidate,
      );
      if (!archive.candidate) throw new Error(archive.diagnostics.map((item) => item.code).join("\n"));
      installedPackages.set(archive.candidate.document.package.id, {
        ...archive.candidate,
        routes: routeResourcePackage({
          currentSystem: entry.system,
          resourcePackage: archive.candidate.document,
        }),
      });
    }

    const marker = `/system-packages/${entry.preset.directory}/`;
    const fetchFile: typeof fetch = async (url) => {
      const pathname = new URL(String(url), "https://preset.invalid").pathname;
      const relativePath = decodeURIComponent(pathname.slice(pathname.indexOf(marker) + marker.length));
      try {
        return new Response(await readFile(path.join(root, entry.preset.directory, relativePath)), { status: 200 });
      } catch {
        return new Response(null, { status: 404 });
      }
    };
    const library = installedPackages as ResourceLibrary;
    const loaded = await entry.load({
      currentSystem: entry.system,
      installedPackages: library,
      baseUrl: "/",
      fetchFile,
    });
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues, null, 2));
    const before = loaded.package.resourceLibraries?.reduce(
      (total, resourceLibrary) => total + resourceLibrary.entries.length,
      0,
    ) ?? 0;

    const refreshed = replacePlatformResourceLibraries({
      currentSystem: entry.system,
      basePackage: loaded.package,
      installedPackages: library,
    });
    const after = refreshed.resourceLibraries?.reduce(
      (total, resourceLibrary) => total + resourceLibrary.entries.length,
      0,
    ) ?? 0;

    expect(after).toBe(before);
  });
});
