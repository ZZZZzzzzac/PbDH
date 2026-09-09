import { describe, expect, it, vi } from "vitest";

import { characterFormatAdapterSchema, characterFormatAdapterSourceSchema } from "../../apps/player/src/sheet-runtime/domain/formatAdapter.ts";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import { createRuntimeEnvironment, configureRuntimeEnvironment } from "../../apps/player/src/sheet-runtime/store/runtimeEnvironment.ts";
import { createRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";
import { unconfiguredRuntimeStorage, type CharacterSaveRecord } from "../../apps/player/src/sheet-runtime/storage/runtimeStorage.ts";

const carrier = { 类型: "json" as const, 检测: [{ 路径: ["format"], 等于: "external" }] };

describe("Character Format Adapter directions and confirmation", () => {
  it("允许只导入、只导出和双向声明，拒绝没有方向的声明", () => {
    expect(characterFormatAdapterSourceSchema.safeParse({ ID: "import", 名称: "只导入", 载体: [carrier], 导入脚本: "import.js" }).success).toBe(true);
    expect(characterFormatAdapterSourceSchema.safeParse({ ID: "export", 名称: "只导出", 导出脚本: "export.js" }).success).toBe(true);
    expect(characterFormatAdapterSourceSchema.safeParse({ ID: "both", 名称: "双向", 载体: [carrier], 导入脚本: "import.js", 导出脚本: "export.js" }).success).toBe(true);
    expect(characterFormatAdapterSourceSchema.safeParse({ ID: "none", 名称: "无方向" }).success).toBe(false);
  });

  it("外部人物导入总是先形成候选，确认前不写存档", async () => {
    let saved: CharacterSaveRecord | undefined;
    const saveCharacterSave = vi.fn(async (record: CharacterSaveRecord) => { saved = record; });
    const environment = createRuntimeEnvironment();
    configureRuntimeEnvironment(environment, { storage: {
      ...unconfiguredRuntimeStorage,
      saveCharacterSave,
      loadCharacterSave: async () => saved?.data ?? null,
      setActiveCharacterSaveId: vi.fn(async () => undefined),
      listCharacterSaves: vi.fn(async () => []),
      listAllCharacterSaves: vi.fn(async () => []),
    } });
    const runtime = createRuntimeStore(environment);
    const adapter = characterFormatAdapterSchema.parse({
      ID: "external", 名称: "外部格式", 载体: [carrier], 导入脚本: "import.js",
      importScriptContent: "module.exports = ({ document }) => ({ values: { name: document.name }, counts: {} });",
    });
    const systemPackage = {
      manifest: { ID: "system", 名称: "System", 版本: "1.0.0", 角色数据版本: "1.0.0" },
      pages: [], modules: [{ ID: "name", 类型: "freeText", 标签: "姓名" }], characterFormatAdapters: [adapter],
    } as SystemPackage;
    runtime.setState({ currentPackage: systemPackage, basePackage: systemPackage });

    await runtime.getState().importCharacterDataFromFile(new File([JSON.stringify({ format: "external", name: "候选人物" })], "person.json", { type: "application/json" }));

    expect(runtime.getState().pendingCharacterConversion?.data.character.values.name).toBe("候选人物");
    expect(saveCharacterSave).not.toHaveBeenCalled();
    await runtime.getState().confirmCharacterConversion();
    expect(saveCharacterSave).toHaveBeenCalledTimes(1);
  });
});
