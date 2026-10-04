// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SealChatResources } from "../../apps/player/src/sealchat/SealChatResources.tsx";
import { daggerheartSystemId } from "../../apps/player/src/sealchat/adapter.ts";

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
    expect(container.querySelector('[role="status"]')?.textContent).toContain("请从海豹聊天");
    expect(container.textContent).toContain("人物卡保持显示");
    const close = [...container.querySelectorAll("button")].find(button => button.textContent === "收起连接面板");
    if (!close) throw Error("缺少收起入口");
    await act(async () => close.click());
    expect(container.querySelector('[aria-label="SealChat 资源同步"]')).toBeNull();
    await render(2);
    expect(container.querySelector('[aria-label="SealChat 资源同步"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
  }
});
