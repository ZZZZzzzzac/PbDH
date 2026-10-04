// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SheetRenderer } from "../../apps/player/src/sheet-runtime/rendering/SheetRenderer.tsx";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import { FreeTextModule } from "../../apps/player/src/sheet-runtime/rendering/FreeTextModule.tsx";
import { useRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";
import { SealChatResourceContext } from "../../apps/player/src/sealchat/SealChatResources.tsx";
import { emptyResources, type SyncState } from "../../apps/player/src/sealchat/adapter.ts";
import { readDiceData } from "../../apps/player/src/sealchat/roll.ts";
import { readNumbers } from "../../apps/player/src/sealchat/numbers.ts";

test("六特质与主副武器各有独立骰子按钮，属性原输入可编辑；数值失焦只发送 Dice 单字段", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const original = useRuntimeStore.getState(); const write = vi.fn(), commit = vi.fn(), openRoll = vi.fn(), setNumber = vi.fn(async () => true);
  useRuntimeStore.setState({ updateModuleValue: write, commitFreeTextChange: commit });
  const element = document.createElement("div"); document.body.append(element); const root = createRoot(element);
  const state: SyncState = { phase: "bound", cardName: "角色", bindingToken: "test", busy: false, canBind: true, message: "", resources: emptyResources(),
    numbers: readNumbers({ 敏捷: 0, 力量: 0, 灵巧: 0, 本能: 0, 风度: 0, 知识: 0, 闪避: 0 }), dice: readDiceData({}) };
  const ids = ["agility", "strength", "finesse", "instinct", "presence", "knowledge", "evasion", "primary-weapon-name", "secondary-weapon-name"];
  const system: SystemPackage = { manifest: { ID: "test", 名称: "测试", 版本: "1.0.0", 角色数据版本: "1.0.0" },
    modules: ids.map(id => ({ ID: id, 类型: "freeText", 标签: id })),
    pages: [{ ID: "main", 名称: "测试", layout: { 类型: "htmlTemplate", htmlContent: ids.slice(0, 7).map(id => `<pb-module id="${id}"></pb-module>`).join("") +
      ["primary", "secondary"].map(id => `<article class="equipment-slot"><h3 class="equipment-slot-title">武器</h3><pb-module id="${id}-weapon-name"></pb-module></article>`).join("") } }] };
  try {
    await act(async () => root.render(<SealChatResourceContext.Provider value={{ state, change: vi.fn(), setNumber, openRoll }}>
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
    expect(setNumber).toHaveBeenCalledWith("evasion", "12", "test"); expect(write).not.toHaveBeenCalled(); expect(commit).not.toHaveBeenCalled();
    // Escape 丢弃草稿，不以失焦保存；换关联后复用的旧草稿也不能写入。
    await act(async () => input.focus());
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "13"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(setNumber).toHaveBeenCalledTimes(1);
    await act(async () => input.focus());
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "+0"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => input.blur()); expect(setNumber).toHaveBeenCalledTimes(1);
    expect(input.getAttribute("aria-invalid")).toBe("false");
    await act(async () => root.render(<SealChatResourceContext.Provider value={{ state: { ...state, busy: true }, change: vi.fn(), setNumber, openRoll }}><FreeTextModule module={{ ID: "strength", 类型: "freeText", 标签: "力量" }} /></SealChatResourceContext.Provider>));
    const dice = element.querySelector<HTMLButtonElement>('[aria-label="力量掷骰"]')!;
    expect(dice.disabled).toBe(false); await act(async () => dice.click());
    expect(openRoll).toHaveBeenLastCalledWith({ kind: "trait", trait: "力量" });
  } finally { await act(async () => root.unmount()); element.remove(); useRuntimeStore.setState(original, true); vi.unstubAllGlobals(); }
});
