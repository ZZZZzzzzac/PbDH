import "fake-indexeddb/auto";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { SystemPackageDocument } from "@pbdh/contract-runtime";

import { installMissingEmbeddedResourcePackages } from "../../apps/player/src/resources/install-embedded-resource-packages.ts";
import {
  DexieResourcePackageRepository,
  PbDHLocalDatabase,
} from "../../apps/player/src/resources/resource-package-repository.ts";
import type { PresetSystemPackage } from "../../apps/player/src/sheet-runtime/loaders/presetSystemPackageLoader.ts";
import type {
  ResourcePackageRepository,
  StoredResourcePackage,
} from "../../apps/player/src/resources/resource-package-repository.ts";

const packageRoot = path.resolve("apps/player/public/system-packages/daggerheart-core");

describe("系统包内置 .pbres 安装", () => {
  it("首次加载时安装所有 Daggerheart Core 原生资源包，重复加载保持幂等", async () => {
    const systemPackage = JSON.parse(await readFile(path.join(packageRoot, "system.json"), "utf8")) as SystemPackageDocument;
    const preset = JSON.parse(await readFile("apps/player/src/daggerheart-core-preset.generated.json", "utf8")) as PresetSystemPackage;
    const repository = new MemoryRepository();
    let fetchCount = 0;
    const fetchFile: typeof fetch = async (url) => {
      fetchCount += 1;
      const relativePath = decodeURIComponent(String(url).replace("https://preset.invalid/", ""));
      try {
        return new Response(await readFile(path.join(packageRoot, relativePath)), { status: 200 });
      } catch {
        return new Response(null, { status: 404 });
      }
    };

    const first = await installMissingEmbeddedResourcePackages({
      systemPackage,
      embeddedResourceIndex: preset.embeddedResourceIndex,
      systemPackageBaseUrl: "https://preset.invalid",
      repository,
      fetchFile,
    });
    const second = await installMissingEmbeddedResourcePackages({
      systemPackage,
      embeddedResourceIndex: preset.embeddedResourceIndex,
      systemPackageBaseUrl: "https://preset.invalid",
      repository,
      fetchFile,
    });

    expect(first.installedPackageIds).toHaveLength(1);
    expect(repository.packages).toHaveLength(1);
    expect(repository.packages.reduce((total, candidate) =>
      total + candidate.document.resources.length, 0)).toBe(980);
    expect(second).toMatchObject({
      installedPackageIds: [],
      unchangedPackageIds: preset.embeddedResourceIndex.map((item) => item.packageId),
      rejected: [],
    });
    expect(fetchCount).toBe(1);
  });

  it("内置资源低于最低版本时自动替换为系统包版本", async () => {
    const systemPackage = JSON.parse(await readFile(path.join(packageRoot, "system.json"), "utf8")) as SystemPackageDocument;
    const preset = JSON.parse(await readFile("apps/player/src/daggerheart-core-preset.generated.json", "utf8")) as PresetSystemPackage;
    const embedded = preset.embeddedResourceIndex[0]!;
    const repository = new MemoryRepository();
    const fetchFile: typeof fetch = async (url) => {
      const relativePath = decodeURIComponent(String(url).replace("https://preset.invalid/", ""));
      return new Response(await readFile(path.join(packageRoot, relativePath)), { status: 200 });
    };
    await installMissingEmbeddedResourcePackages({
      systemPackage,
      embeddedResourceIndex: preset.embeddedResourceIndex,
      systemPackageBaseUrl: "https://preset.invalid",
      repository,
      fetchFile,
    });
    repository.packages[0]!.document.package.version = "1.0.0";
    repository.packages[0]!.document.snapshotDigest = `sha256:${"0".repeat(64)}`;

    const result = await installMissingEmbeddedResourcePackages({
      systemPackage,
      embeddedResourceIndex: preset.embeddedResourceIndex,
      systemPackageBaseUrl: "https://preset.invalid",
      repository,
      fetchFile,
    });

    expect(result.installedPackageIds).toEqual([embedded.packageId]);
    const replaced = repository.packages.find((item) => item.document.package.id === embedded.packageId);
    expect(replaced?.document.package.version).toBe(embedded.version);
    expect(replaced?.document.snapshotDigest).toBe(embedded.snapshotDigest);
  });

  it("自动重装媒体记录缺失的内置资源包", async () => {
    const systemPackage = JSON.parse(await readFile(path.join(packageRoot, "system.json"), "utf8")) as SystemPackageDocument;
    const preset = JSON.parse(await readFile("apps/player/src/daggerheart-core-preset.generated.json", "utf8")) as PresetSystemPackage;
    const database = new PbDHLocalDatabase(`pbdh-platform-test-${crypto.randomUUID()}`);
    const repository = new DexieResourcePackageRepository(database);
    let fetchCount = 0;
    const fetchFile: typeof fetch = async (url) => {
      fetchCount += 1;
      const relativePath = decodeURIComponent(String(url).replace("https://preset.invalid/", ""));
      return new Response(await readFile(path.join(packageRoot, relativePath)), { status: 200 });
    };

    try {
      await installMissingEmbeddedResourcePackages({
        systemPackage,
        embeddedResourceIndex: preset.embeddedResourceIndex,
        systemPackageBaseUrl: "https://preset.invalid",
        repository,
        fetchFile,
      });
      const [installed] = await database.installedSystemResourcePackages.toArray();
      const missingAssetId = (installed!.document as { assets: Array<{ id: string }> }).assets[0]!.id;
      await database.mediaAssets.delete(missingAssetId);

      const repaired = await installMissingEmbeddedResourcePackages({
        systemPackage,
        embeddedResourceIndex: preset.embeddedResourceIndex,
        systemPackageBaseUrl: "https://preset.invalid",
        repository,
        fetchFile,
      });

      expect(repaired.installedPackageIds).toEqual([preset.embeddedResourceIndex[0]!.packageId]);
      await expect(repository.list(systemPackage.package.id)).resolves.toHaveLength(1);
      expect(fetchCount).toBe(2);
    } finally {
      database.close();
      await database.delete();
    }
  });
});

class MemoryRepository implements ResourcePackageRepository {
  packages: Array<StoredResourcePackage & { systemPackageId: string }> = [];

  async list(systemPackageId: string): Promise<StoredResourcePackage[]> {
    return this.packages.filter((item) => item.systemPackageId === systemPackageId);
  }

  async replace(systemPackageId: string, candidate: StoredResourcePackage, source: StoredResourcePackage["source"]): Promise<void> {
    this.packages = this.packages.filter((item) =>
      item.systemPackageId !== systemPackageId || item.document.package.id !== candidate.document.package.id);
    this.packages.push({
      ...candidate,
      systemPackageId,
      installedAt: "2026-08-26T00:00:00.000Z",
      source,
    });
  }

  async remove(systemPackageId: string, packageId: string): Promise<void> {
    this.packages = this.packages.filter((item) =>
      item.systemPackageId !== systemPackageId || item.document.package.id !== packageId);
  }
}
