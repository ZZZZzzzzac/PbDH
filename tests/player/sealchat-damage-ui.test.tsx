// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SealChatDamageDialog } from "../../apps/player/src/sealchat/SealChatDamageDialog.tsx";
import { emptyResources, type SyncState } from "../../apps/player/src/sealchat/adapter.ts";
import { readDiceData } from "../../apps/player/src/sealchat/roll.ts";
import { readNumbers } from "../../apps/player/src/sealchat/numbers.ts";
test("伤害窗只有三个输入，识别格式化武器摘要，手改后完整指令随请求发送", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const element = document.createElement("div"); document.body.append(element); const root = createRoot(element);
  const state: SyncState = { phase: "bound", cardName: "角色", bindingToken: "test", busy: false, canBind: true, message: "", resources: emptyResources(), numbers: readNumbers({}), dice: readDiceData({}) };
  const weapon = { id: "secondary-weapon-name" as const, text: "改良巨杖｜魔法/双手/极远｜知识: d6+3", proficiency: 3 };
  const roll = vi.fn(async () => true), close = vi.fn();
  try {
    await act(async () => root.render(<SealChatDamageDialog weapon={weapon} state={state} roll={roll} close={close} />));
    const dialog = document.querySelector<HTMLDialogElement>("dialog")!; expect(dialog.open).toBe(true);
    const inputs = [...dialog.querySelectorAll("input")]; expect(inputs).toHaveLength(3);
    expect(inputs.map(input => input.value)).toEqual(["3", "d6", "+3"]);
    expect(dialog.querySelector("footer code")?.textContent).toBe(".r 3d6+3 副武器");
    for (const [index, value] of ["4", "d8", "-2"].entries()) await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(inputs[index], value);
      inputs[index].dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(dialog.querySelector("footer code")?.textContent).toBe(".r 4d8-2 副武器");
    await act(async () => dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
    expect(roll).toHaveBeenCalledWith({ weapon, values: { proficiency: 4, die: "d8", fixed: -2 } }); expect(close).toHaveBeenCalledOnce();
  } finally { await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals(); }
});
