// @vitest-environment happy-dom
import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import type { ResourcePackageLogicalDocument } from "../../packages/contract-runtime/src/index.ts";
import {
  enabledResourceLibrary,
  restorePlayerResourceLibrary,
} from "../../apps/player/src/PlayerSheetSurface.tsx";
import {
  loadDisabledNativeResourcePackageIds,
  nativeResourcePackagePreferenceKey,
  setNativeResourcePackageDisabled,
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
const nativePackageId = "01a0132c-4eef-7703-94ac-ec8d1a660ab1";
const thirdPartyPackageId = "01a0132c-4eef-7703-94ac-ec8d1a660ab2";

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
  test("按包记录禁用状态，全部启用后清空设置", () => {
    expect(loadDisabledNativeResourcePackageIds().size).toBe(0);

    expect(setNativeResourcePackageDisabled(nativePackageId, true)).toBe(true);
    expect(setNativeResourcePackageDisabled(thirdPartyPackageId, true)).toBe(true);
    expect([...loadDisabledNativeResourcePackageIds()]).toEqual([nativePackageId, thirdPartyPackageId]);
    expect(JSON.parse(localStorage.getItem(nativeResourcePackagePreferenceKey)!))
      .toEqual([nativePackageId, thirdPartyPackageId]);

    expect(setNativeResourcePackageDisabled(nativePackageId, false)).toBe(true);
    expect([...loadDisabledNativeResourcePackageIds()]).toEqual([thirdPartyPackageId]);

    expect(setNativeResourcePackageDisabled(thirdPartyPackageId, false)).toBe(true);
    expect(localStorage.getItem(nativeResourcePackagePreferenceKey)).toBeNull();
  });

  test("损坏的设置按未禁用处理", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem(nativeResourcePackagePreferenceKey, "{损坏");

    expect(loadDisabledNativeResourcePackageIds().size).toBe(0);
    consoleError.mockRestore();
  });

  test("没有本地存储时读取为空集，写入报告失败", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { value: undefined, configurable: true });
    try {
      expect(loadDisabledNativeResourcePackageIds().size).toBe(0);
      expect(setNativeResourcePackageDisabled(nativePackageId, true)).toBe(false);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
      consoleError.mockRestore();
    }
  });

  test("禁用的原生数据包仍留在已安装资源库，可随时重新启用", async () => {
    setNativeResourcePackageDisabled(nativePackageId, true);
    const native = fixture(nativePackageId, "bundled");
    const thirdParty = fixture(thirdPartyPackageId, "market");

    const library = await restorePlayerResourceLibrary(new MemoryRepository([native, thirdParty]));

    expect([...library.keys()]).toEqual([nativePackageId, thirdPartyPackageId]);
  });

  test("只有启用的资源包进入人物卡的资源选择", async () => {
    const native = fixture(nativePackageId, "bundled");
    const thirdParty = fixture(thirdPartyPackageId, "market");
    const library = await restorePlayerResourceLibrary(new MemoryRepository([native, thirdParty]));

    expect(enabledResourceLibrary(library, new Set())).toBe(library);
    expect([...enabledResourceLibrary(library, new Set([nativePackageId])).keys()])
      .toEqual([thirdPartyPackageId]);
  });
});
