// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SealChatRollDialog } from "../../apps/player/src/sealchat/SealChatRollDialog.tsx";
import { daggerheartSystemId, emptyResources, type SyncState, type EmbedClient, type EmbedContext } from "../../apps/player/src/sealchat/adapter.ts";
import { SealChatRollButton, SealChatResources } from "../../apps/player/src/sealchat/SealChatResources.tsx";
import { useRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";
import { playerFixture } from "./sealchat-fixture.ts";
import { readPlayerRollData, type RollRequest } from "../../apps/player/src/sealchat/roll.ts";

test("掷骰窗使用 PbDH 零特质和经历，显示费用并保留反应/优势选项", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const element = document.createElement("div"); document.body.append(element);
  const root = createRoot(element);
  const roll = vi.fn(async (_request: RollRequest) => true); const close = vi.fn();
  const state: SyncState = { phase: "bound", cardName: "测试", busy: false, canBind: true, message: "", bindingToken: "test",
    resources: { ...emptyResources(), hope: { current: 1, max: 6 } },
    rolls: readPlayerRollData({ strength: "0", "experience-1": "经历", "experience-modifier-1": "0" }) };
  try {
    await act(async () => root.render(<SealChatRollDialog trait="力量" state={state} roll={roll} close={close} />));
    const dialog = document.querySelector<HTMLDialogElement>("dialog")!;
    expect(dialog.open).toBe(true); expect(dialog.textContent).toContain("力量掷骰 +0");
    const button = (text: string) => [...dialog.querySelectorAll("button")].find(item => item.textContent === text)!;
    await act(async () => { button("优势").click(); button("反应掷骰").click(); });
    await act(async () => dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(dialog.textContent).toContain("消耗 1 希望");
    expect(dialog.querySelector<HTMLInputElement>(".sealchat-roll-expression")!.value).toBe(".ddr 0 adv hope=1 -- 力量 · 经历");
    await act(async () => button("掷骰").click());
    expect(roll).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
    expect(roll.mock.calls[0]?.[0]).toMatchObject({ trait: "力量", options: { mode: "reaction", edge: "adv", experienceIndices: [1] } });
  } finally { await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals(); }
});

test("属性点击仍可编辑，独立骰子按钮开助手；暂停后禁用掷骰且不改存档", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const savedParent = Object.getOwnPropertyDescriptor(window, "parent");
  const savedLocation = Object.getOwnPropertyDescriptor(window, "location");
  Object.defineProperty(window, "parent", { configurable: true, value: {} });
  Object.defineProperty(window, "location", { configurable: true, value: { href: "http://127.0.0.1/player?sealchat=1&hostOrigin=http://127.0.0.1&sdkUrl=http://127.0.0.1/api/v1/channel-embed-sdk.js" } });
  const f = playerFixture(); const client = f.client;
  const original = useRuntimeStore.getState(); useRuntimeStore.setState({ currentPackage: f.pkg, characterData: f.data });
  vi.stubGlobal("SealChatEmbed", { connect: async () => client });
  const element = document.createElement("div"); document.body.append(element); const root = createRoot(element);
  const originalClick = vi.fn();
  try {
    await act(async () => root.render(<SealChatResources systemPackageId={daggerheartSystemId} characterId={f.data.character.id} characterName="测试" visible>
      <div data-module-id="strength"><label>力量</label><input aria-label="力量" defaultValue="2" onClick={originalClick} /><SealChatRollButton moduleId="strength" /></div>
    </SealChatResources>));
    const button = (label: string) => element.querySelector<HTMLButtonElement>('[aria-label="' + label + '"]')!;
    await act(async () => button("关联并使用 PbDH 资源").click());
    expect(element.querySelector(".sealchat-sync-status")?.textContent).toBe("已连接");
    expect(element.querySelector(".sealchat-sync-notice")).toBeNull();
    expect(element.textContent).not.toContain("PbDH 保存人物");
    await act(async () => element.querySelector<HTMLInputElement>("input")!.click());
    expect(document.querySelector("dialog")).toBeNull();
    expect(originalClick).toHaveBeenCalledOnce();
    await act(async () => element.querySelector<HTMLButtonElement>('[aria-label="力量掷骰"]')!.click());
    expect(document.querySelector("dialog")?.textContent).toContain("力量掷骰 +0"); expect(element.querySelector<HTMLInputElement>("input")!.value).toBe("2");
    // 关闭模态框不依赖其内部按钮排列。
    await act(async () => document.querySelector<HTMLDialogElement>("dialog")!.dispatchEvent(new Event("cancel", { bubbles: true })));
    await act(async () => button("暂停同步").click());
    await act(async () => element.querySelector<HTMLInputElement>("input")!.click());
    expect(originalClick).toHaveBeenCalledTimes(2); expect(document.querySelector("dialog")).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('[aria-label="力量掷骰"]')!.disabled).toBe(true);
    expect(client.messages.send).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount()); element.remove(); useRuntimeStore.setState(original, true); vi.unstubAllGlobals();
    if (savedParent) Object.defineProperty(window, "parent", savedParent); else Reflect.deleteProperty(window, "parent");
    if (savedLocation) Object.defineProperty(window, "location", savedLocation); else Reflect.deleteProperty(window, "location");
  }
});
