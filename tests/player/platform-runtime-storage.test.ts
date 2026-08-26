import { describe, expect, it } from "vitest";

import type { CharacterSaveDocument, SystemPackageDocument } from "@pbdh/contract-runtime";

import systemJson from "../../apps/player/src/daggerheart-core-system.generated.json";
import type { StoredCharacterSave } from "../../apps/player/src/character-saves/character-save-repository.ts";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import type { SystemPackage as SheetSystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import type { PresetSystemPackage } from "../../apps/player/src/sheet-runtime/loaders/presetSystemPackageLoader.ts";
import { PlatformRuntimeStorage } from "../../apps/player/src/sheet-runtime/storage/platformRuntimeStorage.ts";
import { configureRuntimeEnvironment, createRuntimeEnvironment } from "../../apps/player/src/sheet-runtime/store/runtimeEnvironment.ts";
import { createRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";

describe("Platform Runtime Storage", () => {
  it("首次切换预置系统包时先建立缓存边界，再创建默认人物", async () => {
    const repository = new MemoryCharacterSaveStore();
    const currentSystem = systemJson as SystemPackageDocument;
    const sheetSystemPackage = minimalSheetSystemPackage(currentSystem);
    const storage = new PlatformRuntimeStorage({
      currentSystem,
      characterSaves: repository,
      installedPackages: async () => new Map(),
      localStorage: new MemoryStorage(),
    });
    const environment = createRuntimeEnvironment();
    configureRuntimeEnvironment(environment, {
      storage,
      loadPresetSystemPackage: async () => ({
        ok: true,
        package: sheetSystemPackage,
        packageAssets: [],
        issues: [],
      }),
    });
    const runtime = createRuntimeStore(environment);

    await runtime.getState().switchToPresetSystemPackage(minimalPreset(currentSystem), true);

    expect(runtime.getState().bootStatus).toBe("ready");
    expect(runtime.getState().packageIssues).toEqual([]);
    expect(repository.saves.size).toBe(1);
  });

  it("使用统一 Character Save 仓库完成保存、重命名、恢复和删除", async () => {
    const repository = new MemoryCharacterSaveStore();
    const localStorage = new MemoryStorage();
    const currentSystem = systemJson as SystemPackageDocument;
    const sheetSystemPackage = minimalSheetSystemPackage(currentSystem);
    const storage = new PlatformRuntimeStorage({
      currentSystem,
      characterSaves: repository,
      installedPackages: async () => new Map(),
      localStorage,
      createMediaUrl: (assetId) => `blob:${assetId}`,
      cloudAccountId: () => "account-1",
    });
    await storage.saveCurrentSystemPackage(sheetSystemPackage);

    const data = createEmptyCharacterData(sheetSystemPackage);
    data.character.values.name = "阿斯特里德";
    await storage.saveCharacterSave({
      id: data.character.id,
      packageId: currentSystem.package.id,
      name: "测试角色",
      updatedAt: data.updatedAt,
      data,
    });
    await storage.setActiveCharacterSaveId(currentSystem.package.id, data.character.id);

    expect(await storage.listCharacterSaves(currentSystem.package.id)).toMatchObject([{
      id: data.character.id,
      name: "测试角色",
    }]);
    expect(repository.lastCloudAccountId).toBe("account-1");
    expect((await storage.loadCurrentCharacterData(currentSystem.package.id))?.character.values)
      .toEqual({ name: "阿斯特里德" });

    await storage.renameCharacterSave(currentSystem.package.id, data.character.id, "改名角色");
    expect((await storage.listCharacterSaves(currentSystem.package.id))[0]?.name).toBe("改名角色");

    await storage.deleteCharacterSave(currentSystem.package.id, data.character.id);
    expect(await storage.listCharacterSaves(currentSystem.package.id)).toEqual([]);
    expect(await storage.loadActiveCharacterSaveId(currentSystem.package.id)).toBeNull();
  });
});

class MemoryCharacterSaveStore {
  readonly saves = new Map<string, StoredCharacterSave>();
  lastCloudAccountId: string | null = null;

  async list(): Promise<StoredCharacterSave[]> {
    return [...this.saves.values()];
  }

  async save(
    document: CharacterSaveDocument,
    media: ReadonlyMap<string, Uint8Array>,
    cloudAccountId: string | null = null,
  ): Promise<StoredCharacterSave> {
    this.lastCloudAccountId = cloudAccountId;
    const stored = {
      document: structuredClone(document),
      media: new Map(media),
      sync: { scope: "local-only", state: "clean", baseRevision: null },
    } as StoredCharacterSave;
    this.saves.set(document.documentId, stored);
    return stored;
  }

  async remove(documentId: string): Promise<void> {
    this.saves.delete(documentId);
  }
}

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();

  get length() { return this.#values.size; }
  clear() { this.#values.clear(); }
  getItem(key: string) { return this.#values.get(key) ?? null; }
  key(index: number) { return [...this.#values.keys()][index] ?? null; }
  removeItem(key: string) { this.#values.delete(key); }
  setItem(key: string, value: string) { this.#values.set(key, value); }
}

function minimalSheetSystemPackage(currentSystem: SystemPackageDocument): SheetSystemPackage {
  return {
    manifest: {
      ID: currentSystem.package.id,
      名称: currentSystem.package.name,
      版本: currentSystem.package.version,
      schemaVersion: "0.2.0",
    },
    pages: [],
    modules: [],
  } as SheetSystemPackage;
}

function minimalPreset(currentSystem: SystemPackageDocument): PresetSystemPackage {
  return {
    id: currentSystem.package.id,
    urlPath: "daggerheart",
    name: currentSystem.package.name,
    version: currentSystem.package.version,
    releaseVersion: "test",
    directory: "daggerheart-core",
    inventoryPath: ".pbdh-runtime-files.json",
    fileCount: 0,
    metadataFileCount: 0,
  };
}
