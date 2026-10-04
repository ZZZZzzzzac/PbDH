// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SheetRenderer } from "../../apps/player/src/sheet-runtime/rendering/SheetRenderer.tsx";
import type { SheetValue } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import { FreeTextModule } from "../../apps/player/src/sheet-runtime/rendering/FreeTextModule.tsx";
import { useRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";
import { SealChatResourceContext } from "../../apps/player/src/sealchat/SealChatResources.tsx";
import { emptyResources, type SyncState } from "../../apps/player/src/sealchat/adapter.ts";
import { readPlayerRollData } from "../../apps/player/src/sealchat/roll.ts";

test("六特质与主副武器各有独立骰子按钮，属性原输入可编辑；基础数值保持 PbDH 原生编辑", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const original = useRuntimeStore.getState(); const write = vi.fn((id: string, value: SheetValue) => { const data = useRuntimeStore.getState().characterData!; useRuntimeStore.setState({ characterData: { ...data, character: { ...data.character, values: { ...data.character.values, [id]: value } } } }); }), commit = vi.fn(), openRoll = vi.fn();
  useRuntimeStore.setState({ updateModuleValue: write, commitFreeTextChange: commit });
  const element = document.createElement("div"); document.body.append(element); const root = createRoot(element);
  const state: SyncState = { phase: "bound", cardName: "角色", bindingToken: "test", busy: false, canBind: true, message: "", resources: emptyResources(),
    rolls: readPlayerRollData({}) };
  const ids = ["agility", "strength", "finesse", "instinct", "presence", "knowledge", "evasion", "primary-weapon-name", "secondary-weapon-name"];
  const system: SystemPackage = { manifest: { ID: "test", 名称: "测试", 版本: "1.0.0", 角色数据版本: "1.0.0" },
    modules: ids.map(id => ({ ID: id, 类型: "freeText", 标签: id })),
    pages: [{ ID: "main", 名称: "测试", layout: { 类型: "htmlTemplate", htmlContent: ids.slice(0, 7).map(id => `<pb-module id="${id}"></pb-module>`).join("") +
      ["primary", "secondary"].map(id => `<article class="equipment-slot"><h3 class="equipment-slot-title">武器</h3><pb-module id="${id}-weapon-name"></pb-module></article>`).join("") } }] };
  useRuntimeStore.setState({ currentPackage: system, characterData: createEmptyCharacterData(system) });
  try {
    await act(async () => root.render(<SealChatResourceContext.Provider value={{ state, change: vi.fn(), openRoll }}>
      <SheetRenderer systemPackage={system} />
    </SealChatResourceContext.Provider>));
    expect(element.querySelectorAll(".sealchat-dice-button")).toHaveLength(8);
    expect(element.querySelectorAll("h3 .sealchat-dice-heading")).toHaveLength(2);
    expect(element.querySelector('[data-module-id="primary-weapon-name"] .sealchat-dice-button')).toBeNull();
    expect([...element.querySelectorAll(".sealchat-dice-button")].every(button => button.textContent === "🎲")).toBe(true);
    const strength = element.querySelector<HTMLInputElement>('[data-module-id="strength"] input')!;
    await act(async () => strength.click()); expect(openRoll).not.toHaveBeenCalled(); expect(strength.disabled).toBe(false);
    await act(async () => element.querySelector<HTMLButtonElement>('[aria-label="力量掷骰"]')!.click());
    expect(openRoll).toHaveBeenLastCalledWith({ kind: "trait", trait: "力量" });
    await act(async () => element.querySelector<HTMLButtonElement>('[aria-label="副武器伤害掷骰"]')!.click());
    expect(openRoll).toHaveBeenLastCalledWith({ kind: "weapon", weapon: { id: "secondary-weapon-name", text: "", proficiency: 1 } });
    const input = element.querySelector<HTMLInputElement>('[data-module-id="evasion"] input')!;
    await act(async () => input.focus());
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "12"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => input.blur());
    expect(write).toHaveBeenCalledWith("evasion", "12"); expect(commit).toHaveBeenCalledWith("evasion", "12");
    await act(async () => root.render(<SealChatResourceContext.Provider value={{ state: { ...state, busy: true }, change: vi.fn(), openRoll }}><FreeTextModule module={{ ID: "strength", 类型: "freeText", 标签: "力量" }} /></SealChatResourceContext.Provider>));
    const dice = element.querySelector<HTMLButtonElement>('[aria-label="力量掷骰"]')!;
    expect(dice.disabled).toBe(false); await act(async () => dice.click());
    expect(openRoll).toHaveBeenLastCalledWith({ kind: "trait", trait: "力量" });
  } finally { await act(async () => root.unmount()); element.remove(); useRuntimeStore.setState(original, true); vi.unstubAllGlobals(); }
});
