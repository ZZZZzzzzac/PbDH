import { expect, test, vi } from "vitest";
import { SealChatSync } from "../../apps/player/src/sealchat/adapter.ts";
import { fixture, documentId, sourceField } from "./sealchat-fixture.ts";

function markLinked(f: ReturnType<typeof fixture>) {
  Object.assign(f.card.attrs, { [sourceField]: documentId, DH姓名: f.local.name });
}

test("关闭后的新会话可重连同一存档，保留 Dice 最新资源，不发送初始化或资源写入", async () => {
  const f = fixture();
  await f.bind();
  f.sync.stop();
  f.card.attrs.希望 = 0;
  f.card.attrs.金币箱 = 1;
  f.card.name = "已改昵称";
  const reopened = new SealChatSync(f.client, f.local.key, vi.fn(), f.source);
  await reopened.start();
  expect(reopened.state.phase).toBe("ready");
  expect(f.source.applyResources).not.toHaveBeenCalled();
  expect(await reopened.reconnect()).toBe(true);
  expect(reopened.state.phase).toBe("bound");
  expect(reopened.state.cardName).toBe(f.local.name);
  expect(f.local.resources.hope?.current).toBe(0);
  expect(f.local.resources["chest-gold"]?.current).toBe(1);
  await reopened.refresh();
  expect(f.client.messages.send).not.toHaveBeenCalled();
  expect(await reopened.change("hope", 1)).toBe(true);
  expect(f.client.messages.send).toHaveBeenCalledOnce();
  expect(f.client.messages.send).toHaveBeenLastCalledWith(expect.objectContaining({ text: ".st 希望+1" }));
});

test.each(["missing-source", "other-source", "missing-name", "other-name"])(
  "关联标记不匹配（%s）拒绝重连，不替用户重新初始化",
  async (condition) => {
    const f = fixture();
    markLinked(f);
    if (condition === "missing-source") delete f.card.attrs[sourceField];
    if (condition === "other-source") f.card.attrs[sourceField] = "11234567-89ab-4cde-8fab-0123456789ab";
    if (condition === "missing-name") delete f.card.attrs.DH姓名;
    if (condition === "other-name") f.card.attrs.DH姓名 = "其他人物";
    await f.sync.start();
    expect(await f.sync.reconnect()).toBe(false);
    expect(f.sync.state.phase).not.toBe("bound");
    expect(f.source.applyResources).not.toHaveBeenCalled();
    expect(f.client.messages.send).not.toHaveBeenCalled();
    expect(f.sync.state.message).toContain("关联");
  },
);

test.each(["missing-resource", "invalid-resource", "invalid-local-defense", "no-permission", "other-type"])(
  "资源、属性或权限不满足（%s）时重连不写入或重试初始化",
  async (condition) => {
    const f = fixture();
    markLinked(f);
    if (condition === "missing-resource") delete f.card.attrs.生命上限;
    if (condition === "invalid-resource") f.card.attrs.金币袋 = 20;
    if (condition === "invalid-local-defense") f.local.defenses.evasion = null;
    if (condition === "no-permission") f.setContext({ ...f.context, permissions: { canSendMessage: false } });
    if (condition === "other-type") f.card.sheetType = "coc7";
    await f.sync.start();
    expect(await f.sync.reconnect()).toBe(false);
    expect(f.sync.state.phase).not.toBe("bound");
    expect(f.source.applyResources).not.toHaveBeenCalled();
    expect(f.client.messages.send).not.toHaveBeenCalled();
  },
);

test("重连读取期间切换人物不能把旧资源写进新卡", async () => {
  const f = fixture(); markLinked(f); await f.sync.start();
  vi.mocked(f.client.characterCard.getCurrent).mockImplementationOnce(async () => {
    f.local = { ...f.local, key: "new-key", documentId: "11234567-89ab-4cde-8fab-0123456789ab" };
    f.sync.setLocalKey(f.local.key);
    return { status: { available: true }, card: structuredClone(f.card) };
  });
  expect(await f.sync.reconnect()).toBe(false);
  expect(f.source.applyResources).not.toHaveBeenCalled();
  expect(f.client.messages.send).not.toHaveBeenCalled();
});

test("重连期间新的本地资源编辑保留，后续轮询只同步变化字段", async () => {
  const f = fixture(); markLinked(f); await f.sync.start(); f.card.attrs.希望 = 4;
  vi.mocked(f.client.characterCard.getCurrent).mockImplementationOnce(async () => {
    f.local.resources.hp = { current: 0, max: 7 };
    return { status: { available: true }, card: structuredClone(f.card) };
  });
  expect(await f.sync.reconnect()).toBe(true);
  expect(f.local.resources.hp?.max).toBe(7);
  expect(f.local.resources.hope?.current).toBe(4);
  expect(f.client.messages.send).not.toHaveBeenCalled();
  await f.sync.refresh();
  expect(f.client.messages.send).toHaveBeenLastCalledWith(expect.objectContaining({ text: ".st 生命上限=7" }));
});

test("旧版关联缺失徽标字段时也能重连，后续只补齐徽标数值", async () => {
  const f = fixture(); markLinked(f); delete f.card.attrs.闪避; delete f.card.attrs.重伤阈值; delete f.card.attrs.严重阈值;
  await f.sync.start(); expect(await f.sync.reconnect()).toBe(true);
  expect(f.client.messages.send).not.toHaveBeenCalled(); await f.sync.refresh();
  expect(f.client.messages.send).toHaveBeenCalledOnce();
  expect(f.client.messages.send).toHaveBeenLastCalledWith(expect.objectContaining({ text: ".st 闪避=11 重伤阈值=11 严重阈值=22" }));
  expect(f.sync.state.phase).toBe("bound");
});
