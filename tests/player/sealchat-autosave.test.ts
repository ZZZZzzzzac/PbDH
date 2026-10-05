// @vitest-environment happy-dom
import { expect, test, vi } from "vitest";
import { applyPlayerResources } from "../../apps/player/src/sealchat/SealChatResources.tsx";
import { useRuntimeStore, configureRuntimeDependencies, resetRuntimeDependencies } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";
import { unconfiguredRuntimeStorage } from "../../apps/player/src/sheet-runtime/storage/runtimeStorage.ts";
import { readPlayerSnapshot } from "../../apps/player/src/sealchat/source.ts";
import { playerFixture } from "./sealchat-fixture.ts";
test("确认资源更新进入正常 250ms 保存链，重复回读不保存，旧人物结果不写新卡", async () => {
  vi.useFakeTimers(); const original = useRuntimeStore.getState(); const f = playerFixture();
  const save = vi.fn(async (_data: unknown) => {});
  configureRuntimeDependencies({ storage: { ...unconfiguredRuntimeStorage, saveCurrentCharacterData: save } });
  useRuntimeStore.setState({ currentPackage: f.pkg, characterData: f.data, activeCharacterSaveId: f.data.character.id });
  const key = readPlayerSnapshot(f.data, f.pkg)!.key;
  try {
    applyPlayerResources({ hope: { current: 3, max: 6 }, "chest-gold": { current: 1, max: 1 }, "armor-slots": { current: 0, max: 4 } }, key);
    expect(useRuntimeStore.getState().characterData!.character.values["armor-value"]).toBe("4");
    expect(save).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(250);
    expect(save).toHaveBeenCalledOnce(); expect(save.mock.calls[0]![0]).toMatchObject({ character: { values: { hope: { current: 3, max: 6 }, "chest-gold": { current: 1, max: 1 } } } });
    applyPlayerResources({ hope: { current: 3, max: 6 } }, key); await vi.advanceTimersByTimeAsync(250); expect(save).toHaveBeenCalledOnce();
    useRuntimeStore.setState({ characterData: { ...f.data, character: { ...f.data.character, id: "other" } } });
    applyPlayerResources({ hope: { current: 5, max: 6 } }, key); await vi.advanceTimersByTimeAsync(250); expect(save).toHaveBeenCalledOnce();
  } finally { resetRuntimeDependencies(); useRuntimeStore.setState(original, true); vi.useRealTimers(); }
});

test("人物姓名读取存档姓名字段，空白姓名有明确回退", () => {
  const f = playerFixture(); f.data.character.values["character-name"] = '  汉妮 - Hope "旅者"  ';
  expect(readPlayerSnapshot(f.data,f.pkg)?.name).toBe('汉妮 - Hope "旅者"');
  f.data.character.values["character-name"] = " "; expect(readPlayerSnapshot(f.data,f.pkg)?.name).toBe("未命名人物卡");
});

test("徽标数值直接读取 PbDH 存档，保留零和缺失的区别", () => {
  const f = playerFixture(); Object.assign(f.data.character.values, { evasion: " 11 ", "major-threshold": "0", "severe-threshold": "22" });
  expect(readPlayerSnapshot(f.data, f.pkg)?.defenses).toEqual({ evasion: 11, "major-threshold": 0, "severe-threshold": 22 });
  f.data.character.values.evasion = ""; expect(readPlayerSnapshot(f.data, f.pkg)?.defenses.evasion).toBeNull();
});
