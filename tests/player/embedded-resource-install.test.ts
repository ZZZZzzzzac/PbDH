import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { SystemPackageDocument } from "@pbdh/contract-runtime";

import { installMissingEmbeddedResourcePackages } from "../../apps/player/src/resources/install-embedded-resource-packages.ts";
import type {
  ResourcePackageRepository,
  StoredResourcePackage,
} from "../../apps/player/src/resources/resource-package-repository.ts";

const packageRoot = path.resolve("apps/player/public/system-packages/daggerheart-core");

describe("系统包内置 .pbres 安装", () => {
  it("首次加载时安装所有 Daggerheart Core 原生资源包，重复加载保持幂等", async () => {
    const systemPackage = JSON.parse(await readFile(path.join(packageRoot, "system.json"), "utf8")) as SystemPackageDocument;
    const repository = new MemoryRepository();
    const fetchFile: typeof fetch = async (url) => {
      const relativePath = decodeURIComponent(String(url).replace("https://preset.invalid/", ""));
      try {
        return new Response(await readFile(path.join(packageRoot, relativePath)), { status: 200 });
      } catch {
        return new Response(null, { status: 404 });
      }
    };

    const first = await installMissingEmbeddedResourcePackages({
      systemPackage,
      systemPackageBaseUrl: "https://preset.invalid",
      repository,
      fetchFile,
    });
    const second = await installMissingEmbeddedResourcePackages({
      systemPackage,
      systemPackageBaseUrl: "https://preset.invalid",
      repository,
      fetchFile,
    });

    expect(first.installedPackageIds).toHaveLength(8);
    expect(repository.packages).toHaveLength(8);
    expect(repository.packages.reduce((total, candidate) =>
      total + candidate.document.resources.length, 0)).toBe(625);
    expect(second).toMatchObject({
      installedPackageIds: [],
      unchangedPackageIds: systemPackage.embeddedResources.map((item) => item.packageId),
      pendingUpdates: [],
      rejected: [],
    });
  });
});

class MemoryRepository implements ResourcePackageRepository {
  packages: StoredResourcePackage[] = [];

  async list(): Promise<StoredResourcePackage[]> {
    return this.packages;
  }

  async replace(candidate: StoredResourcePackage, source: StoredResourcePackage["source"]): Promise<void> {
    this.packages = this.packages.filter((item) =>
      item.document.package.id !== candidate.document.package.id);
    this.packages.push({
      ...candidate,
      installedAt: "2026-08-26T00:00:00.000Z",
      source,
    });
  }

  async remove(packageId: string): Promise<void> {
    this.packages = this.packages.filter((item) => item.document.package.id !== packageId);
  }
}
