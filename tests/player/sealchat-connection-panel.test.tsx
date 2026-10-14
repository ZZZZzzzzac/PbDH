// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SealChatResources } from "../../apps/player/src/sealchat/SealChatResources.tsx";
import { daggerheartSystemId } from "../../apps/player/src/sealchat/adapter.ts";

test.each([
  ["?sealchat=1", undefined, "连接异常", "缺少 SealChat 连接参数"],
  ["?sealchat=1&hostOrigin=http://chat.example&sdkUrl=http://chat.example/api/v1/channel-embed-sdk.js", undefined, "等待人物卡", "正在等待人物卡加载"],
  ["?sealchat=1&hostOrigin=http://chat.example&sdkUrl=http://chat.example/api/v1/channel-embed-sdk.js", "other-system", "不支持", "仅支持匕首之心"],
])("连接参数错误与尚未加载的系统包不误报为不支持：%s", async (query, systemPackageId, status, notice) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const savedParent = Object.getOwnPropertyDescriptor(window, "parent");
  const savedLocation = Object.getOwnPropertyDescriptor(window, "location");
  Object.defineProperty(window, "parent", { configurable: true, value: {} });
  Object.defineProperty(window, "location", { configurable: true, value: { href: `https://daggerheart.cn/player${query}` } });
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<SealChatResources systemPackageId={systemPackageId} characterName="" visible>{null}</SealChatResources>));
    expect(container.querySelector(".sealchat-sync-status")?.textContent).toBe(status);
    expect(container.querySelector(".sealchat-sync-notice")?.textContent).toContain(notice);
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
    if (savedParent) Object.defineProperty(window, "parent", savedParent); else Reflect.deleteProperty(window, "parent");
    if (savedLocation) Object.defineProperty(window, "location", savedLocation); else Reflect.deleteProperty(window, "location");
  }
});

test("普通网页默认不显示实验面板，菜单请求给出入口说明；收起后再次请求可恢复", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const render = async (connectionRequest: number) => act(async () => root.render(
    <SealChatResources systemPackageId={daggerheartSystemId} characterId="test-character" characterName="测试" visible connectionRequest={connectionRequest}>
      <p>人物卡保持显示</p>
    </SealChatResources>,
  ));
  try {
    await render(0);
    expect(container.querySelector('[aria-label="SealChat 资源同步"]')).toBeNull();
    await render(1);
    expect(container.querySelector(".sealchat-sync-notice")?.textContent).toContain("请从海豹聊天");
    expect(container.textContent).toContain("人物卡保持显示");
    const close = container.querySelector<HTMLButtonElement>('[aria-label="收起连接面板"]');
    if (!close) throw Error("缺少收起入口");
    await act(async () => close.click());
    expect(container.querySelector('[aria-label="SealChat 资源同步"]')).toBeNull();
    await render(2);
    expect(container.querySelector('[aria-label="SealChat 资源同步"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
  }
});
