// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SealChatDamageDialog } from "../../apps/player/src/sealchat/SealChatDamageDialog.tsx";
import { emptyResources, type SyncState } from "../../apps/player/src/sealchat/adapter.ts";
import { readDiceData } from "../../apps/player/src/sealchat/roll.ts";
import { readNumbers } from "../../apps/player/src/sealchat/numbers.ts";
test("主副武器伤害窗显示基础公式，额外骰与固定修正随请求发送", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const element = document.createElement("div"); document.body.append(element); const root = createRoot(element);
  const state: SyncState = { phase: "bound", cardName: "角色", bindingToken: "test", busy: false, canBind: true, message: "", resources: emptyResources(), numbers: readNumbers({}), dice: readDiceData({}) };
  const weapon = { id: "secondary-weapon-name" as const, text: "匕首｜灵巧｜近战｜d6+1 物理｜单手", proficiency: 2 };
  const roll = vi.fn(async () => true), close = vi.fn();
  try {
    await act(async () => root.render(<SealChatDamageDialog weapon={weapon} state={state} roll={roll} close={close} />));
    const dialog = document.querySelector<HTMLDialogElement>("dialog")!; expect(dialog.open).toBe(true); expect(dialog.textContent).toContain("2d6+1");
    const extra = [...dialog.querySelectorAll("label")].find(label => label.textContent?.startsWith("额外伤害骰"))!.querySelector("input")!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(extra, "1d4"); extra.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(dialog.querySelector("footer code")?.textContent).toBe("2d6+1+1d4");
    await act(async () => dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
    expect(roll).toHaveBeenCalledWith({ weapon, adjustments: [{ diceCountDelta: 0, flat: 0, extraDice: "1d4" }], reason: "" }); expect(close).toHaveBeenCalledOnce();
  } finally { await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals(); }
});
