// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SealChatRollDialog } from "../../apps/player/src/sealchat/SealChatRollDialog.tsx";
import { daggerheartSystemId, emptyResources, type SyncState, type EmbedClient, type EmbedContext } from "../../apps/player/src/sealchat/adapter.ts";
import { SealChatResources } from "../../apps/player/src/sealchat/SealChatResources.tsx";
import { readDiceData, type RollRequest } from "../../apps/player/src/sealchat/roll.ts";

test("掷骰窗使用 Dice 零特质和经历，显示费用并保留反应/优势选项", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const element = document.createElement("div"); document.body.append(element);
  const root = createRoot(element);
  const roll = vi.fn(async (_request: RollRequest) => true); const close = vi.fn();
  const state: SyncState = { phase: "bound", cardName: "测试", busy: false, canBind: true, message: "",
    resources: { ...emptyResources(), hope: { current: 1, max: 6 } },
    dice: readDiceData({ 力量: 0, DH经历: JSON.stringify({ schemaVersion: 1, experiences: [{ name: "经历", modifier: 0 }] }) }) };
  try {
    await act(async () => root.render(<SealChatRollDialog trait="力量" state={state} roll={roll} close={close} />));
    const dialog = document.querySelector<HTMLDialogElement>("dialog")!;
    expect(dialog.open).toBe(true); expect(dialog.textContent).toContain("Dice 特质修正：0");
    const button = (text: string) => [...dialog.querySelectorAll("button")].find(item => item.textContent === text)!;
    await act(async () => { button("优势").click(); button("反应掷骰").click(); });
    await act(async () => dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(dialog.textContent).toContain("消耗 1 希望");
    expect(dialog.querySelector<HTMLInputElement>(".sealchat-roll-expression")!.value).toBe(".ddr 力量 adv exp=1@a779cedd");
    await act(async () => button("掷骰").click());
    expect(roll).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
    expect(roll.mock.calls[0]?.[0]).toMatchObject({ trait: "力量", options: { mode: "reaction", edge: "adv", experienceIndices: [1] } });
  } finally { await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals(); }
});

test("iframe 监听原有属性格点击；关联时开助手，暂停后保留原点击且不改存档", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const savedParent = Object.getOwnPropertyDescriptor(window, "parent");
  const savedLocation = Object.getOwnPropertyDescriptor(window, "location");
  Object.defineProperty(window, "parent", { configurable: true, value: {} });
  Object.defineProperty(window, "location", { configurable: true, value: { href: "http://127.0.0.1/player?sealchat=1&hostOrigin=http://127.0.0.1&sdkUrl=http://127.0.0.1/api/v1/channel-embed-sdk.js" } });
  const context: EmbedContext = { channel: { id: "local" }, currentUser: { id: "test" }, currentCharacter: null, connection: { state: "connected" }, permissions: { canSendMessage: true } };
  const client: EmbedClient = {
    capabilities: ["context.read", "characterCard.read", "messages.send"],
    context: { get: async () => context, onChanged: () => () => {} },
    connection: { getState: async () => context.connection, onChanged: () => () => {} },
    characterCard: { getCurrent: async () => ({ status: { available: true }, card: { name: "测试", sheetType: "dh", attrs: { 力量: 0 } } }) },
    messages: { send: vi.fn(async () => ({})) }, session: { onClosed: () => () => {} }, close: vi.fn(),
  };
  vi.stubGlobal("SealChatEmbed", { connect: async () => client });
  const element = document.createElement("div"); document.body.append(element); const root = createRoot(element);
  const originalClick = vi.fn();
  try {
    await act(async () => root.render(<SealChatResources systemPackageId={daggerheartSystemId} characterId="test" characterName="测试" visible>
      <div data-module-id="strength"><label>力量</label><input aria-label="力量" defaultValue="2" onClick={originalClick} /></div>
    </SealChatResources>));
    const button = (text: string) => [...element.querySelectorAll("button")].find(item => item.textContent === text)!;
    await act(async () => button("确认关联当前人物卡").click());
    await act(async () => element.querySelector<HTMLInputElement>("input")!.click());
    expect(document.querySelector("dialog")?.textContent).toContain("Dice 特质修正：0");
    expect(originalClick).not.toHaveBeenCalled(); expect(element.querySelector<HTMLInputElement>("input")!.value).toBe("2");
    // 关闭模态框不依赖其内部按钮排列。
    await act(async () => document.querySelector<HTMLDialogElement>("dialog")!.dispatchEvent(new Event("cancel", { bubbles: true })));
    await act(async () => button("暂停同步").click());
    await act(async () => element.querySelector<HTMLInputElement>("input")!.click());
    expect(originalClick).toHaveBeenCalledOnce(); expect(document.querySelector("dialog")).toBeNull();
    expect(client.messages.send).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals();
    if (savedParent) Object.defineProperty(window, "parent", savedParent); else Reflect.deleteProperty(window, "parent");
    if (savedLocation) Object.defineProperty(window, "location", savedLocation); else Reflect.deleteProperty(window, "location");
  }
});
