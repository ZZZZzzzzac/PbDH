import { expect, test, vi } from "vitest";
import { readEmbedConfig, readResources, SealChatSync, type EmbedClient, type EmbedContext } from "../../apps/player/src/sealchat/adapter.ts";

function fixture() {
  let context: EmbedContext = { channel: { id: "channel-1" }, currentUser: { id: "user-1" },
    currentCharacter: { id: "identity-1" }, connection: { state: "connected" }, permissions: { canSendMessage: true } };
  let card = { name: "测试人物", sheetType: "daggerheart", attrs: { 生命: 0, 生命上限: 6, 压力: 0, 压力上限: 6, 护甲: 0, 护甲上限: 0, 希望: 2, 希望上限: 6 } };
  let changedContext = (_value: EmbedContext) => {};
  let changedConnection = (_value: { state: string }) => {};
  let closed = () => {};
  const client: EmbedClient = {
    capabilities: ["context.read", "characterCard.read", "messages.send"],
    context: { get: vi.fn(async () => structuredClone(context)), onChanged: cb => { changedContext = cb; return vi.fn(); } },
    connection: { getState: vi.fn(async () => context.connection), onChanged: cb => { changedConnection = cb; return vi.fn(); } },
    characterCard: { getCurrent: vi.fn(async () => ({ status: { available: true }, card: structuredClone(card) })) },
    messages: { send: vi.fn(async () => ({})) }, session: { onClosed: cb => { closed = cb; return vi.fn(); } }, close: vi.fn(),
  };
  const sync = new SealChatSync(client, "local-1", vi.fn());
  return { client, sync, get card() { return card; }, set card(value) { card = value; },
    setContext(value: EmbedContext) { context = value; changedContext(value); },
    get context() { return context; },
    emitCompanionEvents() { changedContext(context); changedConnection(context.connection); },
    disconnect() { context = { ...context, connection: { state: "offline" } }; changedConnection(context.connection); },
    closeSession() { closed(); } };
}

test("四项资源区分未知与 0，护甲槽不读取护甲值，拒绝无界或越界标记", () => {
  expect(readResources({ 生命: 0, 生命上限: 6, 护甲值: 8, 希望: "0", 希望上限: "6" })).toEqual({
    hp: { current: 0, max: 6 }, stress: null, "armor-slots": null, hope: { current: 0, max: 6 },
  });
  expect(readResources({ hp: 7, hpMax: 6, stress: 1, stressMax: 1_000_000, hope: null, hopeMax: 6 }).hp).toBeNull();
});

test("只在显式 iframe 模式加载宿主 SDK，并检查实例地址和路径", () => {
  const url = "https://daggerheart.cn/pbdh/player?sealchat=1&hostOrigin=https://chat.example&sdkUrl=https://chat.example/chat/api/v1/channel-embed-sdk.js";
  expect(readEmbedConfig(url, true)?.sdkUrl).toContain("/chat/api/v1/");
  expect(readEmbedConfig(url, false)).toBeNull();
  expect(readEmbedConfig("https://daggerheart.cn/pbdh/player", true)).toBeNull();
  expect(() => readEmbedConfig(url.replace("sdkUrl=https://chat.example", "sdkUrl=https://evil.example"), true)).toThrow();
  expect(() => readEmbedConfig(url.replace("hostOrigin=https://chat.example", "hostOrigin=https://chat.example/other"), true)).toThrow();
});

test("关联和刷新无写入；外部 .dd 的资源变化回读到显示", async () => {
  const f = fixture(); await f.sync.start();
  expect(f.sync.state.phase).toBe("ready");
  expect(f.sync.state.resources.hope).toBeNull();
  await f.sync.bind();
  f.card.attrs.希望 = 3;
  await f.sync.refresh();
  expect(f.sync.state.resources.hope).toEqual({ current: 3, max: 6 });
  expect(f.client.messages.send).not.toHaveBeenCalled();
});

test("按钮始终发相对指令，执行前读取最新余额，不回传旧整卡", async () => {
  const f = fixture(); await f.sync.start(); await f.sync.bind();
  f.card.attrs.希望 = 5;
  await f.sync.change("hope", -1);
  expect(f.client.messages.send).toHaveBeenCalledWith({ text: ".st 希望-1", identityId: "identity-1", icMode: "ooc" });
  expect(f.sync.state.resources.hope?.current).toBe(5);
  f.card.attrs.希望 = 0;
  await f.sync.change("hope", -1);
  expect(f.client.messages.send).toHaveBeenCalledTimes(1);
});

test("缺失资源和护甲上限 0 不自动初始化，不发送修改", async () => {
  const f = fixture(); f.card.attrs.希望上限 = NaN;
  await f.sync.start(); await f.sync.bind();
  await f.sync.change("armor-slots", 1); await f.sync.change("hope", -1);
  expect(f.client.messages.send).not.toHaveBeenCalled();
});

test("伴随 context/connection 事件会排队刷新，不丢失新卡", async () => {
  const f = fixture(); await f.sync.start(); await f.sync.bind();
  let release!: () => void;
  vi.mocked(f.client.characterCard.getCurrent).mockImplementationOnce(async () => {
    await new Promise<void>(resolve => { release = resolve; });
    return { status: { available: true }, card: structuredClone(f.card) };
  });
  const pending = f.sync.refresh();
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  f.emitCompanionEvents(); f.card.attrs.希望 = 4; release(); await pending;
  expect(f.sync.state.phase).toBe("bound");
  expect(f.sync.state.resources.hope?.current).toBe(4);
});

test("切换本地人物或 SealChat 身份使关联失效，旧读取不能恢复关联", async () => {
  const f = fixture(); await f.sync.start(); await f.sync.bind();
  f.sync.setLocalKey("local-2"); await f.sync.refresh();
  await f.sync.change("hope", 1);
  expect(f.client.messages.send).not.toHaveBeenCalled();
  await f.sync.bind();
  f.setContext({ ...f.context, currentCharacter: { id: "identity-2" } });
  await f.sync.refresh();
  expect(f.sync.state.phase).toBe("ready");
  expect(f.sync.state.resources.hope).toBeNull();
});

test("活动 Dice 卡变化、断线、权限撤销和会话关闭均暂停操作", async () => {
  const f = fixture(); await f.sync.start(); await f.sync.bind();
  f.card.name = "另一个人物"; await f.sync.change("hope", 1);
  expect(f.sync.state.phase).toBe("ready");
  await f.sync.bind(); f.disconnect(); await f.sync.change("hope", 1);
  f.setContext({ ...f.context, connection: { state: "connected" } });
  f.emitCompanionEvents(); await f.sync.refresh(); await f.sync.bind();
  f.setContext({ ...f.context, permissions: { canSendMessage: false } });
  await f.sync.refresh(); await f.sync.change("hope", 1);
  expect(f.sync.state.canBind).toBe(false);
  f.setContext({ ...f.context, permissions: { canSendMessage: true } });
  await f.sync.refresh(); await f.sync.bind();
  f.closeSession(); await f.sync.change("hope", 1);
  expect(f.sync.state.phase).toBe("closed");
  expect(f.client.messages.send).not.toHaveBeenCalled();
});

test("请求超时结果未知，不重发，快速双击只发送一次", async () => {
  const f = fixture(); await f.sync.start(); await f.sync.bind();
  vi.mocked(f.client.messages.send).mockRejectedValue(new Error("timeout"));
  await Promise.all([f.sync.change("hope", -1), f.sync.change("hope", -1)]);
  expect(f.client.messages.send).toHaveBeenCalledTimes(1);
  expect(f.sync.state.phase).toBe("error");
  expect(f.sync.state.message).toContain("不会自动重发");
});

test("未授予最小能力时拒绝接入，卸载关闭会话", async () => {
  const f = fixture(); f.client.capabilities = ["context.read"];
  await f.sync.start();
  expect(f.sync.state.phase).toBe("error");
  f.sync.stop(); expect(f.client.close).toHaveBeenCalledOnce();
});
