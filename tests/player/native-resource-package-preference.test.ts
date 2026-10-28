// @vitest-environment happy-dom
import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import type {
  ResourcePackageLogicalDocument,
  SystemPackageDocument,
} from "../../packages/contract-runtime/src/index.ts";
import {
  nativeResourcePackagesSuppressed,
  restorePlayerResourceLibrary,
} from "../../apps/player/src/PlayerSheetSurface.tsx";
import { defaultPlayerSystemPackage } from "../../apps/player/src/playerSystemPackageCatalog.ts";
import {
  areNativeResourcePackagesDisabled,
  nativeResourcePackagePreferenceKey,
  setNativeResourcePackagesDisabled,
} from "../../apps/player/src/resources/native-resource-package-preference.ts";
import type {
  ResourcePackageRepository,
  StoredResourcePackage,
} from "../../apps/player/src/resources/resource-package-repository.ts";

const root = process.cwd();
const mediaPath = path.join(
  root,
  "contracts/conformance/resource-package/1.0.0/media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp",
);

function fixture(packageId: string, source: StoredResourcePackage["source"]): StoredResourcePackage {
  const document = JSON.parse(readFileSync(path.join(
    root,
    "contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json",
  ), "utf8")) as ResourcePackageLogicalDocument;
  document.package.id = packageId;
  const asset = document.assets[0]!;
  return {
    document,
    media: new Map([[asset.id, new Uint8Array(readFileSync(mediaPath))]]),
    installedAt: "2026-08-27T00:00:00.000Z",
    source,
  };
}

class MemoryRepository implements ResourcePackageRepository {
  constructor(private readonly stored: StoredResourcePackage[]) {}

  async list(): Promise<StoredResourcePackage[]> {
    return this.stored;
  }

  async replace(): Promise<void> {
    throw new Error("测试仓库不写入");
  }

  async remove(): Promise<void> {
    throw new Error("测试仓库不写入");
  }
}

afterEach(() => {
  localStorage.removeItem(nativeResourcePackagePreferenceKey);
});

describe("禁用原生数据包", () => {
  test("设置按浏览器持久化，关闭时移除", () => {
    expect(areNativeResourcePackagesDisabled()).toBe(false);

    expect(setNativeResourcePackagesDisabled(true)).toBe(true);
    expect(localStorage.getItem(nativeResourcePackagePreferenceKey)).toBe("true");
    expect(areNativeResourcePackagesDisabled()).toBe(true);

    expect(setNativeResourcePackagesDisabled(false)).toBe(true);
    expect(localStorage.getItem(nativeResourcePackagePreferenceKey)).toBeNull();
    expect(areNativeResourcePackagesDisabled()).toBe(false);
  });

  test("没有本地存储时读取按未禁用处理，写入报告失败", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { value: undefined, configurable: true });
    try {
      expect(areNativeResourcePackagesDisabled()).toBe(false);
      expect(setNativeResourcePackagesDisabled(true)).toBe(false);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
      consoleError.mockRestore();
    }
  });

  test("默认状态把原生与第三方资源包都还原进资源库", async () => {
    const native = fixture("01a0132c-4eef-7703-94ac-ec8d1a660ab1", "bundled");
    const thirdParty = fixture("01a0132c-4eef-7703-94ac-ec8d1a660ab2", "market");

    expect(nativeResourcePackagesSuppressed(defaultPlayerSystemPackage.system)).toBe(false);
    const library = await restorePlayerResourceLibrary(new MemoryRepository([native, thirdParty]));

    expect([...library.keys()]).toEqual([native.document.package.id, thirdParty.document.package.id]);
  });

  test("禁用后预置系统只还原第三方资源包", async () => {
    setNativeResourcePackagesDisabled(true);
    const native = fixture("01a0132c-4eef-7703-94ac-ec8d1a660ac1", "bundled");
    const market = fixture("01a0132c-4eef-7703-94ac-ec8d1a660ac2", "market");
    const localFile = fixture("01a0132c-4eef-7703-94ac-ec8d1a660ac3", "file");

    expect(nativeResourcePackagesSuppressed(defaultPlayerSystemPackage.system)).toBe(true);
    const library = await restorePlayerResourceLibrary(
      new MemoryRepository([native, market, localFile]),
    );

    expect([...library.keys()]).toEqual([market.document.package.id, localFile.document.package.id]);
  });

  test("同 id 的第三方资源包不会被当成原生数据包过滤", async () => {
    const packageId = "01a0132c-4eef-7703-94ac-ec8d1a660af1";
    setNativeResourcePackagesDisabled(true);

    const bundled = await restorePlayerResourceLibrary(
      new MemoryRepository([fixture(packageId, "bundled")]),
    );
    const fromMarket = await restorePlayerResourceLibrary(
      new MemoryRepository([fixture(packageId, "market")]),
    );

    expect(bundled.size).toBe(0);
    expect([...fromMarket.keys()]).toEqual([packageId]);
  });

  test("本地上传的系统包保留自带的 bundled 资源", async () => {
    setNativeResourcePackagesDisabled(true);
    const imported = structuredClone(defaultPlayerSystemPackage.system) as SystemPackageDocument;
    imported.package.id = "01a0132c-4eef-7703-94ac-ec8d1a660ad0";
    const embedded = fixture("01a0132c-4eef-7703-94ac-ec8d1a660ad1", "bundled");

    expect(nativeResourcePackagesSuppressed(imported)).toBe(false);
    const library = await restorePlayerResourceLibrary(new MemoryRepository([embedded]), imported);

    expect([...library.keys()]).toEqual([embedded.document.package.id]);
  });

  test("重新启用后原生数据包立即回到资源库", async () => {
    const native = fixture("01a0132c-4eef-7703-94ac-ec8d1a660ae1", "bundled");
    const repository = new MemoryRepository([native]);

    setNativeResourcePackagesDisabled(true);
    expect((await restorePlayerResourceLibrary(repository)).size).toBe(0);

    setNativeResourcePackagesDisabled(false);
    expect([...(await restorePlayerResourceLibrary(repository)).keys()])
      .toEqual([native.document.package.id]);
  });
});
