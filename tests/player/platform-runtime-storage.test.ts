import { describe, expect, it, vi } from "vitest";

import type { CharacterSaveDocument, SystemPackageDocument } from "@pbdh/contract-runtime";

import systemJson from "../../apps/player/src/daggerheart-core-system.generated.json";
import heartSystemJson from "../../apps/player/src/heart-of-hopefind-system.generated.json";
import type { StoredCharacterSave } from "../../apps/player/src/character-saves/character-save-repository.ts";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import type { SystemPackage as SheetSystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import type { PresetSystemPackage } from "../../apps/player/src/sheet-runtime/loaders/presetSystemPackageLoader.ts";
import { PlatformRuntimeStorage } from "../../apps/player/src/sheet-runtime/storage/platformRuntimeStorage.ts";
import type { SystemPackageCacheSnapshot } from "../../apps/player/src/sheet-runtime/storage/runtimeStorage.ts";
import { sheetCharacterToSave } from "../../apps/player/src/sheet-runtime/storage/characterSaveAdapter.ts";
import { configureRuntimeEnvironment, createRuntimeEnvironment } from "../../apps/player/src/sheet-runtime/store/runtimeEnvironment.ts";
import { createRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";

describe("Platform Runtime Storage", () => {
  it("保存当前角色不读取无关角色的完整存档", async () => {
    const repository = new MemoryCharacterSaveStore();
    const currentSystem = systemJson as SystemPackageDocument;
    const sheetSystemPackage = minimalSheetSystemPackage(currentSystem);
    const storage = new PlatformRuntimeStorage({
      currentSystem, characterSaves: repository,
      installedPackages: async () => new Map(), localStorage: new MemoryStorage(),
    });
    await storage.saveCurrentSystemPackage(sheetSystemPackage, []);
    const data = createEmptyCharacterData(sheetSystemPackage, "current");
    await storage.saveCharacterSave({ id: "current", packageId: currentSystem.package.id,
      name: "当前角色", updatedAt: data.updatedAt, data });
    await storage.setActiveCharacterSaveId(currentSystem.package.id, "current");
    const fullScan = vi.spyOn(repository, "list").mockRejectedValue(new Error("无关角色媒体损坏"));
    const lookup = vi.spyOn(repository, "get");
    data.character.values.name = "只修改当前角色";
    await storage.saveCurrentCharacterData(data);
    expect(fullScan).not.toHaveBeenCalled();
    expect(lookup).toHaveBeenCalledExactlyOnceWith("current");
    expect((await storage.loadCharacterSave(currentSystem.package.id, "current"))?.character.values.name)
      .toBe("只修改当前角色");
  });

  it.each([false, true])("保存失败时保留编辑并允许重试切换（定时器已触发：%s）", async (timerFired) => {
    vi.useFakeTimers();
    const repository = new MemoryCharacterSaveStore();
    const currentSystem = systemJson as SystemPackageDocument;
    const sheetSystemPackage = minimalSheetSystemPackage(currentSystem);
    const storage = new PlatformRuntimeStorage({
      currentSystem,
      characterSaves: repository,
      installedPackages: async () => new Map(),
      localStorage: new MemoryStorage(),
    });
    await storage.saveCurrentSystemPackage(sheetSystemPackage, []);
    const environment = createRuntimeEnvironment();
    configureRuntimeEnvironment(environment, { storage });
    const runtime = createRuntimeStore(environment);
    runtime.setState({ currentPackage: sheetSystemPackage });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await runtime.getState().createCharacterSave("目标角色");
      const targetId = runtime.getState().activeCharacterSaveId!;
      await runtime.getState().createCharacterSave("原角色");
      const originalId = runtime.getState().activeCharacterSaveId!;
      const save = vi.spyOn(repository, "save").mockRejectedValue(new Error("storage unavailable"));
      runtime.getState().updateModuleValue("name", "未保存的新名字");
      if (timerFired) await vi.advanceTimersByTimeAsync(250);

      await runtime.getState().switchCharacterSave(targetId);

      expect(runtime.getState().activeCharacterSaveId).toBe(originalId);
      expect(runtime.getState().characterData?.character.values.name).toBe("未保存的新名字");
      expect(runtime.getState().storageStatus).toBe("error");
      save.mockRestore();
      await runtime.getState().switchCharacterSave(targetId);
      expect(runtime.getState().activeCharacterSaveId).toBe(targetId);
      expect((await storage.loadCharacterSave(currentSystem.package.id, originalId))?.character.values.name)
        .toBe("未保存的新名字");
    } finally {
      if (environment.autosaveTimer) clearTimeout(environment.autosaveTimer);
      errorLog.mockRestore();
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });

  it("切换等待正在进行的自动保存，再保存较新的编辑", async () => {
    vi.useFakeTimers();
    const repository = new MemoryCharacterSaveStore();
    const currentSystem = systemJson as SystemPackageDocument;
    const sheetSystemPackage = minimalSheetSystemPackage(currentSystem);
    const storage = new PlatformRuntimeStorage({
      currentSystem, characterSaves: repository,
      installedPackages: async () => new Map(), localStorage: new MemoryStorage(),
    });
    await storage.saveCurrentSystemPackage(sheetSystemPackage, []);
    const environment = createRuntimeEnvironment();
    configureRuntimeEnvironment(environment, { storage });
    const runtime = createRuntimeStore(environment);
    runtime.setState({ currentPackage: sheetSystemPackage });
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    try {
      await runtime.getState().createCharacterSave("目标角色");
      const targetId = runtime.getState().activeCharacterSaveId!;
      await runtime.getState().createCharacterSave("原角色");
      const originalId = runtime.getState().activeCharacterSaveId!;
      const persist = repository.save.bind(repository);
      const save = vi.spyOn(repository, "save").mockImplementationOnce(async (...args) => {
        await barrier;
        return persist(...args);
      });
      runtime.getState().updateModuleValue("name", "旧编辑");
      await vi.advanceTimersByTimeAsync(250);
      runtime.getState().updateModuleValue("name", "新编辑");
      const switching = runtime.getState().switchCharacterSave(targetId);
      await vi.advanceTimersByTimeAsync(0);
      expect(save).toHaveBeenCalledTimes(1);
      expect(runtime.getState().activeCharacterSaveId).toBe(originalId);
      release();
      await switching;
      expect(runtime.getState().activeCharacterSaveId).toBe(targetId);
      expect((await storage.loadCharacterSave(currentSystem.package.id, originalId))?.character.values.name).toBe("新编辑");
    } finally {
      release();
      if (environment.autosaveTimer) clearTimeout(environment.autosaveTimer);
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });

  it("刷新后从浏览器缓存恢复用户上传的系统包及素材", async () => {
    const repository = new MemoryCharacterSaveStore();
    const cache = new MemoryRuntimeCacheStore<SystemPackageCacheSnapshot>();
    const currentSystem = heartSystemJson as SystemPackageDocument;
    const sheetSystemPackage = minimalSheetSystemPackage(currentSystem);
    const asset = { 路径: "assets/portrait.webp", 类型: "image/webp", bytes: new Uint8Array([1, 2, 3]) } as const;
    const first = new PlatformRuntimeStorage({
      currentSystem: () => undefined,
      characterSaves: repository,
      installedPackages: async () => new Map(),
      localStorage: new MemoryStorage(),
      systemPackageCache: cache,
    });
    await first.saveCurrentSystemPackage(sheetSystemPackage, [asset], {
      source: "imported",
      systemDocument: currentSystem,
    });

    const restored = new PlatformRuntimeStorage({
      currentSystem: () => undefined,
      characterSaves: repository,
      installedPackages: async () => new Map(),
      localStorage: new MemoryStorage(),
      systemPackageCache: cache,
    });

    await expect(restored.loadCurrentSystemPackage()).resolves.toEqual(sheetSystemPackage);
    await expect(restored.loadCurrentPackageAssets(currentSystem.package.id)).resolves.toEqual([asset]);
    await expect(restored.loadCurrentSystemPackageCacheMetadata()).resolves.toMatchObject({
      source: "imported",
      systemDocument: { package: { id: currentSystem.package.id } },
    });
  });

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

  it("预置系统包装载抛错时退出加载态并报告错误", async () => {
    const currentSystem = systemJson as SystemPackageDocument;
    const environment = createRuntimeEnvironment();
    configureRuntimeEnvironment(environment, {
      loadPresetSystemPackage: async () => {
        throw new Error("资源包内容无效");
      },
    });
    const runtime = createRuntimeStore(environment);

    await expect(runtime.getState().switchToPresetSystemPackage(minimalPreset(currentSystem), true)).resolves.toBeUndefined();

    expect(runtime.getState().bootStatus).toBe("error");
    expect(runtime.getState().packageLoadProgress).toBeNull();
    expect(runtime.getState().packageLoadingPresentation).toBeNull();
    expect(runtime.getState().packageIssues).toContainEqual({
      level: "error",
      code: "PACKAGE_LOAD_FAILED",
      text: "加载 System Package 时出错：资源包内容无效",
      path: "boot",
    });
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

  it("按 System Package ID 隔离两个真实预置包的人物存档", async () => {
    const repository = new MemoryCharacterSaveStore();
    const localStorage = new MemoryStorage();
    const systems = [systemJson, heartSystemJson] as SystemPackageDocument[];
    const storage = new PlatformRuntimeStorage({
      currentSystem: (packageId) => systems.find((system) => system.package.id === packageId),
      characterSaves: repository,
      installedPackages: async () => new Map(),
      localStorage,
    });

    for (const currentSystem of systems) {
      const sheetSystemPackage = minimalSheetSystemPackage(currentSystem);
      await storage.saveCurrentSystemPackage(sheetSystemPackage);
      const data = createEmptyCharacterData(sheetSystemPackage);
      data.character.values.name = currentSystem.package.name;
      await storage.saveCharacterSave({
        id: data.character.id,
        packageId: currentSystem.package.id,
        name: `${currentSystem.package.name}角色`,
        updatedAt: data.updatedAt,
        data,
      });
      await storage.setActiveCharacterSaveId(currentSystem.package.id, data.character.id);
    }

    expect(await storage.listCharacterSaves(systems[0]!.package.id)).toHaveLength(1);
    expect(await storage.listCharacterSaves(systems[1]!.package.id)).toHaveLength(1);
    expect((await storage.loadCurrentCharacterData(systems[0]!.package.id))?.character.values.name)
      .toBe(systems[0]!.package.name);
    expect((await storage.loadCurrentCharacterData(systems[1]!.package.id))?.character.values.name)
      .toBe(systems[1]!.package.name);
  });

  it("构造后注册的上传 System Document 仍可保存人物存档", async () => {
    const repository = new MemoryCharacterSaveStore();
    const systems = new Map<string, SystemPackageDocument>();
    const currentSystem = heartSystemJson as SystemPackageDocument;
    const sheetSystemPackage = minimalSheetSystemPackage(currentSystem);
    const storage = new PlatformRuntimeStorage({
      currentSystem: (packageId) => systems.get(packageId),
      characterSaves: repository,
      installedPackages: async () => new Map(),
      localStorage: new MemoryStorage(),
    });
    systems.set(currentSystem.package.id, currentSystem);
    await storage.saveCurrentSystemPackage(sheetSystemPackage);
    const data = createEmptyCharacterData(sheetSystemPackage);

    await storage.saveCharacterSave({
      id: data.character.id,
      packageId: currentSystem.package.id,
      name: "上传系统人物",
      updatedAt: data.updatedAt,
      data,
    });

    expect(await storage.listCharacterSaves(currentSystem.package.id)).toHaveLength(1);
  });

  it("缺少系统包的人物存档保持不可执行，注册匹配系统包后可自动打开", async () => {
    const repository = new MemoryCharacterSaveStore();
    const systems = new Map<string, SystemPackageDocument>();
    const localStorage = new MemoryStorage();
    const targetSystem = heartSystemJson as SystemPackageDocument;
    const targetPackage = minimalSheetSystemPackage(targetSystem);
    const data = createEmptyCharacterData(targetPackage);
    data.character.values.name = "等待系统包的人物";
    const candidate = await sheetCharacterToSave({
      name: "待匹配人物",
      data,
      currentSystem: {
        id: targetSystem.package.id,
        version: targetSystem.package.version,
        resourceCompatibility: targetSystem.resourceCompatibility,
      },
      sheetSystemPackage: targetPackage,
      installedPackages: new Map(),
    });
    await repository.save(candidate.document, candidate.media);
    const storage = new PlatformRuntimeStorage({
      currentSystem: (packageId) => systems.get(packageId),
      characterSaves: repository,
      installedPackages: async () => new Map(),
      localStorage,
    });
    await storage.setActiveCharacterSaveId(targetSystem.package.id, candidate.document.documentId);

    expect(await storage.listAllCharacterSaves()).toMatchObject([{
      id: candidate.document.documentId,
      packageId: targetSystem.package.id,
      name: "待匹配人物",
    }]);
    await expect(storage.loadCurrentCharacterData(targetSystem.package.id)).resolves.toBeNull();

    systems.set(targetSystem.package.id, targetSystem);
    await storage.saveCurrentSystemPackage(targetPackage);

    await expect(storage.loadCurrentCharacterData(targetSystem.package.id)).resolves.toMatchObject({
      character: { values: { name: "等待系统包的人物" } },
    });
  });

  it("先生成升级候选，确认前零写入，确认后一次保存并可正常打开", async () => {
    const repository = new MemoryCharacterSaveStore();
    const currentSystem = systemJson as SystemPackageDocument;
    const sheetSystemPackage = minimalSheetSystemPackage(currentSystem);
    sheetSystemPackage.manifest.角色数据版本 = "2.0.0";
    sheetSystemPackage.characterDataMigrations = [
      {
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        script: "migrations/1.0.0-2.0.0.js",
        scriptContent: "module.exports = ({ characterData }) => ({ name: characterData.oldName });",
      },
    ];
    const storage = new PlatformRuntimeStorage({
      currentSystem,
      characterSaves: repository,
      installedPackages: async () => new Map(),
      localStorage: new MemoryStorage(),
    });
    await storage.saveCurrentSystemPackage(sheetSystemPackage);
    const data = createEmptyCharacterData({ ...sheetSystemPackage, manifest: { ...sheetSystemPackage.manifest, 角色数据版本: "1.0.0" } });
    await storage.saveCharacterSave({ id: data.character.id, packageId: currentSystem.package.id, name: "旧人物", updatedAt: data.updatedAt, data });
    const stored = repository.saves.get(data.character.id)!;
    stored.document.characterDataVersion = "1.0.0";
    stored.document.characterData = { oldName: "迁移完成" };
    const before = structuredClone(stored.document);

    const preparation = await storage.prepareCharacterSaveMigration(currentSystem.package.id, data.character.id);

    expect(preparation.status).toBe("ready");
    expect(repository.saves.get(data.character.id)!.document).toEqual(before);
    if (preparation.status !== "ready") throw new Error("Expected migration candidate");
    const loaded = await storage.commitCharacterSaveMigration(currentSystem.package.id, preparation.candidate);
    expect(loaded.character.values.name).toBe("迁移完成");
    expect(repository.saves.get(data.character.id)!.document.characterDataVersion).toBe("2.0.0");
    expect(repository.saves.get(data.character.id)!.document.characterData).toEqual({ name: "迁移完成" });
  });

  it("升级脚本失败时保留原存档", async () => {
    const repository = new MemoryCharacterSaveStore();
    const currentSystem = systemJson as SystemPackageDocument;
    const sheetSystemPackage = minimalSheetSystemPackage(currentSystem);
    sheetSystemPackage.manifest.角色数据版本 = "2.0.0";
    sheetSystemPackage.characterDataMigrations = [{
      fromVersion: "1.0.0", toVersion: "2.0.0", script: "migrations/fail.js",
      scriptContent: "module.exports = () => { throw new Error('broken'); };",
    }];
    const storage = new PlatformRuntimeStorage({ currentSystem, characterSaves: repository, installedPackages: async () => new Map(), localStorage: new MemoryStorage() });
    await storage.saveCurrentSystemPackage(sheetSystemPackage);
    const data = createEmptyCharacterData({ ...sheetSystemPackage, manifest: { ...sheetSystemPackage.manifest, 角色数据版本: "1.0.0" } });
    await storage.saveCharacterSave({ id: data.character.id, packageId: currentSystem.package.id, name: "旧人物", updatedAt: data.updatedAt, data });
    repository.saves.get(data.character.id)!.document.characterDataVersion = "1.0.0";
    const before = structuredClone(repository.saves.get(data.character.id)!.document);

    await expect(storage.prepareCharacterSaveMigration(currentSystem.package.id, data.character.id)).resolves.toMatchObject({ status: "error", message: expect.stringContaining("broken") });
    expect(repository.saves.get(data.character.id)!.document).toEqual(before);
  });

  it("外部系统脚本首次和内容变化时重新确认，内置系统无需确认", async () => {
    const currentSystem = systemJson as SystemPackageDocument;
    const localStorage = new MemoryStorage();
    const storage = new PlatformRuntimeStorage({
      currentSystem,
      characterSaves: new MemoryCharacterSaveStore(),
      installedPackages: async () => new Map(),
      localStorage,
    });
    const external = minimalSheetSystemPackage(currentSystem);
    external.validationChecks = [{ ID: "check", 脚本: "scripts/check.js", scriptContent: "module.exports = () => [];" }];
    await storage.saveCurrentSystemPackage(external, [], { source: "imported" });

    const first = await storage.preparePackageScriptConsent(external);
    expect(first).toMatchObject({ status: "required", candidate: { scripts: [{ path: "scripts/check.js" }] } });
    if (first.status !== "required") throw new Error("Expected script consent");
    await storage.approvePackageScripts(first.candidate);
    await expect(storage.preparePackageScriptConsent(external)).resolves.toEqual({ status: "current" });

    const changed = structuredClone(external);
    changed.validationChecks![0]!.scriptContent = "module.exports = () => [{ level: 'info', text: 'changed' }];";
    await storage.saveCurrentSystemPackage(changed, [], { source: "imported" });
    const changedPreparation = await storage.preparePackageScriptConsent(changed);
    expect(changedPreparation.status).toBe("required");
    if (changedPreparation.status === "required") {
      expect(changedPreparation.candidate.scripts[0]!.digest).not.toBe(first.candidate.scripts[0]!.digest);
    }

    await storage.saveCurrentSystemPackage(changed, [], { source: "preset", presetId: "built-in", releaseVersion: "1" });
    await expect(storage.preparePackageScriptConsent(changed)).resolves.toEqual({ status: "current" });
  });

  it("外部脚本未确认时不打开或新建人物，确认后再继续", async () => {
    const currentSystem = systemJson as SystemPackageDocument;
    const repository = new MemoryCharacterSaveStore();
    const external = minimalSheetSystemPackage(currentSystem);
    external.validationChecks = [{ ID: "check", 脚本: "scripts/check.js", scriptContent: "module.exports = () => [];" }];
    const storage = new PlatformRuntimeStorage({ currentSystem, characterSaves: repository, installedPackages: async () => new Map(), localStorage: new MemoryStorage() });
    const environment = createRuntimeEnvironment();
    configureRuntimeEnvironment(environment, {
      storage,
      loadSystemPackageFromFile: async () => ({ ok: true, package: external, packageAssets: [], issues: [] }),
    });
    const runtime = createRuntimeStore(environment);

    await runtime.getState().uploadSystemPackageFromFile(new Blob());
    expect(runtime.getState().pendingSystemPackageImport).not.toBeNull();
    expect(runtime.getState().pendingPackageScriptConsent).toBeNull();
    expect(repository.saves.size).toBe(0);
    await expect(storage.loadCurrentSystemPackage()).resolves.toBeNull();

    await runtime.getState().confirmSystemPackageImport();
    expect(runtime.getState().pendingPackageScriptConsent).not.toBeNull();
    expect(runtime.getState().characterData).toBeNull();
    expect(repository.saves.size).toBe(0);

    await runtime.getState().confirmPackageScriptConsent();
    expect(runtime.getState().pendingPackageScriptConsent).toBeNull();
    expect(runtime.getState().characterData).not.toBeNull();
    expect(repository.saves.size).toBe(1);
  });

  it("资源包变化时原地更新资源和图片，不进入系统包加载状态", async () => {
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
    const characterBefore = runtime.getState().characterData;
    const refreshedPackage = {
      ...sheetSystemPackage,
      resourceLibraries: [{
        ID: "weapons",
        名称: "武器",
        路径: "platform-resource-library:weapons",
        fields: [{ key: "名称", label: "名称", visible: true, filterable: true, sortable: true, searchable: true }],
        entries: [{ ID: "package:weapon", fields: { 名称: "长剑" } }],
      }],
    } satisfies SheetSystemPackage;
    const asset = { 路径: "platform-resources/package/weapon.webp", 类型: "image/webp", bytes: new Uint8Array([1, 2, 3]) } as const;

    await runtime.getState().refreshPlatformResources(refreshedPackage, [asset]);

    expect(runtime.getState().bootStatus).toBe("ready");
    expect(runtime.getState().characterData).toBe(characterBefore);
    expect(runtime.getState().currentPackage?.resourceLibraries?.[0]?.entries[0]?.fields.名称).toBe("长剑");
    await expect(storage.loadCurrentPackageAssets(currentSystem.package.id)).resolves.toEqual([asset]);
  });

  it("预置系统包有新版时继续使用旧版，确认后才替换", async () => {
    vi.stubGlobal("sessionStorage", new MemoryStorage());
    const repository = new MemoryCharacterSaveStore();
    const currentSystem = systemJson as SystemPackageDocument;
    const oldPackage = minimalSheetSystemPackage(currentSystem);
    if (oldPackage.modules[0]?.类型 !== "freeText") throw new Error("Expected freeText module");
    oldPackage.modules[0].标签 = "旧版姓名";
    const nextPackage = structuredClone(oldPackage);
    if (nextPackage.modules[0]?.类型 !== "freeText") throw new Error("Expected freeText module");
    nextPackage.modules[0].标签 = "新版姓名";
    const storage = new PlatformRuntimeStorage({
      currentSystem,
      characterSaves: repository,
      installedPackages: async () => new Map(),
      localStorage: new MemoryStorage(),
    });
    await storage.saveCurrentSystemPackage(oldPackage, [], {
      source: "preset",
      presetId: currentSystem.package.id,
      releaseVersion: "old-release",
    });
    const environment = createRuntimeEnvironment();
    configureRuntimeEnvironment(environment, {
      storage,
      loadPresetSystemPackage: async () => ({ ok: true, package: nextPackage, packageAssets: [], issues: [] }),
    });
    const runtime = createRuntimeStore(environment);
    const preset = { ...minimalPreset(currentSystem), releaseVersion: "new-release" };

    await runtime.getState().initialize([preset]);

    expect(freeTextLabel(runtime.getState().currentPackage)).toBe("旧版姓名");
    expect(runtime.getState().pendingSystemPackageImport).not.toBeNull();
    await runtime.getState().confirmSystemPackageImport();
    expect(freeTextLabel(runtime.getState().currentPackage)).toBe("新版姓名");
    await expect(storage.loadCurrentSystemPackageCacheMetadata()).resolves.toEqual({
      source: "preset",
      presetId: currentSystem.package.id,
      releaseVersion: "new-release",
    });
  });
});

class MemoryCharacterSaveStore {
  readonly saves = new Map<string, StoredCharacterSave>();
  lastCloudAccountId: string | null = null;

  async list(): Promise<StoredCharacterSave[]> {
    return [...this.saves.values()];
  }

  async listMetadata() {
    return [...this.saves.values()].map(({ document, sync }) => {
      const { characterData: _characterData, ...metadata } = document;
      return { document: metadata, sync };
    });
  }

  async get(id: string) {
    const value = this.saves.get(id);
    return value ? structuredClone(value) : undefined;
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

class MemoryRuntimeCacheStore<T> {
  readonly values = new Map<string, T>();

  async load(id: string): Promise<T | null> {
    const value = this.values.get(id);
    return value === undefined ? null : structuredClone(value);
  }

  async save(id: string, value: T): Promise<void> {
    this.values.set(id, structuredClone(value));
  }

  async remove(id: string): Promise<void> {
    this.values.delete(id);
  }
}

function minimalSheetSystemPackage(currentSystem: SystemPackageDocument): SheetSystemPackage {
  return {
    manifest: {
      ID: currentSystem.package.id,
      名称: currentSystem.package.name,
      版本: currentSystem.package.version,
      角色数据版本: currentSystem.runtime.characterDataVersion,
    },
    pages: [],
    modules: [{ ID: "name", 类型: "freeText", 标签: "姓名" }],
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
    embeddedResourceIndex: [],
  };
}

function freeTextLabel(systemPackage: SheetSystemPackage | null): string | undefined {
  const module = systemPackage?.modules[0];
  return module?.类型 === "freeText" ? module.标签 : undefined;
}
