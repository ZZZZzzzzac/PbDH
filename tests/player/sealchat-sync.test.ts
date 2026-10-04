import { expect, test, vi } from "vitest";
import { readEmbedConfig, readResources, SealChatSync, type EmbedClient, type EmbedContext } from "../../apps/player/src/sealchat/adapter.ts";
import { readNumbers } from "../../apps/player/src/sealchat/numbers.ts";
import { readDiceData, rollCommand, type RollRequest } from "../../apps/player/src/sealchat/roll.ts";

function fixture() {
  let context: EmbedContext = { channel: { id: "channel-1" }, currentUser: { id: "user-1" },
    currentCharacter: { id: "identity-1" }, connection: { state: "connected" }, permissions: { canSendMessage: true } };
  let card = { name: "测试人物", sheetType: "daggerheart", attrs: { 生命: 0, 生命上限: 6, 压力: 0, 压力上限: 6, 护甲: 0, 护甲上限: 0, 希望: 2, 希望上限: 6, 力量: 0, 闪避: 0, 重伤阈值: 0, 严重阈值: 0, 金币把: 0, 金币袋: 0, 金币箱: 0, DH经历: "" } };
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
    hp: { current: 0, max: 6 }, stress: null, "armor-slots": null, hope: { current: 0, max: 6 }, "handful-gold": null, "bag-gold": null, "chest-gold": null,
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

const rollRequest = (): RollRequest => ({ trait: "力量", options: { mode: "action", edge: "normal", modifier: "", difficulty: "", reason: "", experienceIndices: [], experienceRevision: "" } });

test("零特质可掷骰，未知不能冒充 0；公式使用实际 .dd/.ddr 语法", () => {
  const data = readDiceData({ 力量: "0", 敏捷: -1 });
  expect(data.traits.力量).toBe(0); expect(data.traits.灵巧).toBeNull();
  const request = rollRequest();
  request.options = { ...request.options, mode: "reaction", edge: "dis", modifier: "-2", difficulty: "0", reason: "测试" };
  expect(rollCommand(request, data, 0)).toBe(".ddr 力量 -2 dis dc0 -- 测试");
  expect(() => rollCommand({ ...request, trait: "灵巧" }, data, 2)).toThrow("尚未录入");
  expect(() => rollCommand({ ...request, expression: ".st 希望+1" }, data, 2)).toThrow("手动公式");
  expect(() => rollCommand({ ...request, expression: ".dd 力量\n.dd 力量" }, data, 2)).toThrow();
  expect(rollCommand({ ...request, expression: ".dd 力量+1d6 adv" }, data, 2)).toBe(".dd 力量+1d6 adv");
});

test("掷骰执行前回读经历版本与希望，费用交由插件；过期选项不发送", async () => {
  const f = fixture();
  f.card.attrs.DH经历 = JSON.stringify({ schemaVersion: 1, experiences: [{ name: "经历", modifier: 0 }] });
  await f.sync.start(); await f.sync.bind();
  const request = rollRequest(); request.options.experienceIndices = [1]; request.options.experienceRevision = f.sync.state.dice.experienceRevision;
  expect(request.options.experienceRevision).toBe("a779cedd");
  expect(await f.sync.roll(request)).toBe(true);
  expect(f.client.messages.send).toHaveBeenCalledWith({ text: ".dd 力量 exp=1@a779cedd", identityId: "identity-1", icMode: "ooc" });
  f.card.attrs.希望 = 0; expect(await f.sync.roll(request)).toBe(false);
  f.card.attrs.希望 = 2; f.card.attrs.DH经历 = JSON.stringify({ schemaVersion: 1, experiences: [{ name: "另一个经历", modifier: 2 }] });
  expect(await f.sync.roll(request)).toBe(false);
  expect(f.client.messages.send).toHaveBeenCalledTimes(1);
});

test("掷骰在卡切换时取消；双击、请求未知与断线不重发", async () => {
  const f = fixture(); const request = rollRequest();
  await f.sync.start(); await f.sync.bind();
  f.card.name = "其他卡"; expect(await f.sync.roll(request)).toBe(false);
  expect(f.client.messages.send).not.toHaveBeenCalled();
  await f.sync.bind(); vi.mocked(f.client.messages.send).mockRejectedValue(new Error("timeout"));
  await Promise.all([f.sync.roll(request), f.sync.roll(request)]);
  expect(f.client.messages.send).toHaveBeenCalledTimes(1); expect(f.sync.state.phase).toBe("error");
  await f.sync.bind(); f.disconnect(); expect(await f.sync.roll(request)).toBe(false);
  expect(f.client.messages.send).toHaveBeenCalledTimes(1);
});

test("金币三单位逐项同步，0 有效；较大外部值可以逐次减少，箱不强制上限", async () => {
  const f = fixture(); await f.sync.start(); await f.sync.bind();
  expect(f.sync.state.resources["handful-gold"]).toEqual({ current: 0, max: 9 });
  await f.sync.change("handful-gold", 1);
  expect(f.client.messages.send).toHaveBeenLastCalledWith({ text: ".st 金币把+1", identityId: "identity-1", icMode: "ooc" });
  f.card.attrs.金币袋 = 20; await f.sync.change("bag-gold", -1);
  expect(f.client.messages.send).toHaveBeenLastCalledWith({ text: ".st 金币袋-1", identityId: "identity-1", icMode: "ooc" });
  f.card.attrs.金币箱 = 20; await f.sync.change("chest-gold", 1);
  expect(f.client.messages.send).toHaveBeenLastCalledWith({ text: ".st 金币箱+1", identityId: "identity-1", icMode: "ooc" });
});
test("右键上限使用最新相对值，拒绝降到当前值以下，不附带清空当前值", async () => {
  const f = fixture(); await f.sync.start(); await f.sync.bind();
  f.card.attrs.生命 = 6;
  await f.sync.changeMax("hp", -1); expect(f.client.messages.send).not.toHaveBeenCalled();
  f.card.attrs.生命上限 = 7;
  await f.sync.changeMax("hp", -1);
  expect(f.client.messages.send).toHaveBeenCalledWith({ text: ".st 生命上限-1", identityId: "identity-1", icMode: "ooc" });
  await f.sync.changeMax("armor-slots", 1);
  expect(f.client.messages.send).toHaveBeenLastCalledWith({ text: ".st 护甲上限+1", identityId: "identity-1", icMode: "ooc" });
  await f.sync.changeMax("chest-gold", 1); expect(f.client.messages.send).toHaveBeenCalledTimes(2);
});
test("闪避、护甲上限、阈值和特质显示明确 0，编辑只发单字段，旧关联草稿不发送", async () => {
  const f = fixture(); await f.sync.start(); await f.sync.bind(); const binding = f.sync.state.bindingToken;
  expect(f.sync.state.numbers.evasion).toBe(0); expect(f.sync.state.numbers["armor-value"]).toBe(0);
  expect(f.sync.state.numbers["major-threshold"]).toBe(0); expect(f.sync.state.numbers["severe-threshold"]).toBe(0);
  await f.sync.setNumber("evasion", "12", binding);
  expect(f.client.messages.send).toHaveBeenLastCalledWith({ text: ".st 闪避=12", identityId: "identity-1", icMode: "ooc" });
  expect(f.sync.state.numbers.evasion).toBe(0);
  await f.sync.setNumber("armor-value", "3", binding);
  expect(f.client.messages.send).toHaveBeenLastCalledWith({ text: ".st 护甲上限=3", identityId: "identity-1", icMode: "ooc" });
  await f.sync.setNumber("strength", "-1", binding);
  expect(f.client.messages.send).toHaveBeenLastCalledWith({ text: ".st 力量=-1", identityId: "identity-1", icMode: "ooc" });
  await f.sync.setNumber("evasion", "0\n.st 希望=6", binding); expect(f.client.messages.send).toHaveBeenCalledTimes(3);
  f.sync.pause(); await f.sync.bind(); await f.sync.setNumber("evasion", "10", binding);
  expect(f.client.messages.send).toHaveBeenCalledTimes(3);
  expect(readNumbers({ 闪避: "0", 重伤阈值: "" }).evasion).toBe(0);
});
