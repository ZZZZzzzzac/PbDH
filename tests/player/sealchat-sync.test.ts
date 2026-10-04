import { expect, test, vi } from "vitest";
import { readEmbedConfig, readResources } from "../../apps/player/src/sealchat/adapter.ts";
import { readPlayerRollData, rollCommand, type RollRequest } from "../../apps/player/src/sealchat/roll.ts";
import { fixture, documentId, sourceField } from "./sealchat-fixture.ts";
const request = (): RollRequest => ({ trait: "力量", options: { mode: "action", edge: "normal", modifier: "", difficulty: "", reason: "", experienceIndices: [], experienceRevision: "" } });
test("资源区分未知与明确的零，拒绝无界标记", () => {
  expect(readResources({ 生命: 0, 生命上限: 6, 希望: "0", 希望上限: "6" }).hp).toEqual({ current: 0, max: 6 });
  expect(readResources({ hp: 7, hpMax: 6 }).hp).toBeNull(); expect(readResources({ stress: 1, stressMax: 1000000 }).stress).toBeNull();
});
test("仅显式 iframe 接入宿主 SDK，验证 origin 和路径", () => {
  const url = "https://daggerheart.cn/pbdh/player?sealchat=1&hostOrigin=https://chat.example&sdkUrl=https://chat.example/chat/api/v1/channel-embed-sdk.js";
  expect(readEmbedConfig(url, true)?.sdkUrl).toContain("/chat/api/v1/"); expect(readEmbedConfig(url, false)).toBeNull();
  expect(() => readEmbedConfig(url.replace("sdkUrl=https://chat.example", "sdkUrl=https://evil.example"), true)).toThrow();
});
test("关联以 PbDH 初始化且只写资源和存档标识，基础数值与经历不写 Dice", async () => {
  const f = fixture(); f.local.resources.hope = { current: 0, max: 6 };
  await f.sync.start(); expect(f.client.messages.send).not.toHaveBeenCalled(); await f.sync.bind();
  const sent = vi.mocked(f.client.messages.send).mock.calls[0]![0].text;
  expect(sent).toContain(sourceField + '="' + documentId + '"'); expect(sent).toContain("希望=0");
  expect(sent).not.toMatch(/力量|DH经历|闪避|阈值/); expect(f.card.attrs.力量).toBe(99); expect(f.card.attrs.DH经历).toBe("坏的旧经历");
  expect(f.sync.state.phase).toBe("bound"); expect(f.sync.state.rolls.traits.力量).toBe(0);
});
test("未执行的回执不会覆盖 PbDH 存档，确认资源写入后才关联", async () => {
  const f = fixture(); f.holdWrites(); f.local.resources.hope = { current: 1, max: 6 }; await f.sync.start(); await f.sync.bind();
  expect(f.sync.state.phase).toBe("binding"); expect(f.source.applyResources).not.toHaveBeenCalled(); expect(f.local.resources.hope?.current).toBe(1);
  await f.sync.refresh(); expect(f.client.messages.send).toHaveBeenCalledTimes(1);
  f.card.attrs[sourceField] = documentId; f.card.attrs.希望 = 1; await f.sync.refresh(); expect(f.sync.state.phase).toBe("bound");
});
test("Dice 资源结果进入人物存档，重复轮询没有反向写回循环", async () => {
  const f = fixture(); await f.bind(); f.card.attrs.希望 = 3; f.card.attrs.金币箱 = 2; await f.sync.refresh();
  expect(f.local.resources.hope?.current).toBe(3); expect(f.local.resources["chest-gold"]?.current).toBe(2);
  await f.sync.refresh(); expect(f.client.messages.send).not.toHaveBeenCalled();
});
test("普通 PbDH 修改资源上限自动同步，保留同时到达的 Dice 当前值变化", async () => {
  const f = fixture(); await f.bind(); f.local.resources.hp = { current: 0, max: 7 }; f.card.attrs.生命 = 1;
  await f.sync.refresh(); expect(f.client.messages.send).toHaveBeenCalledWith(expect.objectContaining({ text: ".st 生命上限=7" }));
  expect(f.local.resources.hp).toEqual({ current: 1, max: 7 }); await f.sync.refresh(); expect(f.client.messages.send).toHaveBeenCalledTimes(1);
});
test("资源按钮发相对指令，发送前回读最新余额；金币和右键上限都回写存档", async () => {
  const f = fixture(); await f.bind(); f.card.attrs.希望 = 5; await f.sync.change("hope", -1);
  expect(f.client.messages.send).toHaveBeenLastCalledWith(expect.objectContaining({ text: ".st 希望-1" })); expect(f.local.resources.hope?.current).toBe(4);
  await f.sync.change("handful-gold", 1); expect(f.local.resources["handful-gold"]?.current).toBe(1);
  await f.sync.changeMax("armor-slots", 1); expect(f.local.resources["armor-slots"]?.max).toBe(1);
});
test("切存档、频道、身份、同名卡来源或断线会取消关联，旧草稿不能发送", async () => {
  const f = fixture(); await f.bind(); const token = f.sync.state.bindingToken;
  f.local = { ...f.local, key: "local-2", documentId: "11234567-89ab-4cde-8fab-0123456789ab" }; f.sync.setLocalKey("local-2"); await f.sync.refresh();
  expect(await f.sync.change("hope", 1, token)).toBe(false); expect(f.source.applyResources).not.toHaveBeenCalled();
  await f.sync.bind(); vi.mocked(f.source.applyResources).mockClear(); f.card.attrs[sourceField] = "another"; await f.sync.refresh(); expect(f.sync.state.phase).toBe("ready"); expect(f.source.applyResources).not.toHaveBeenCalled();
  await f.sync.bind(); f.setContext({ ...f.context, currentCharacter: { id: "other" } }); await f.sync.refresh(); expect(f.sync.state.phase).toBe("ready");
  await f.sync.bind(); f.disconnect(); expect(await f.sync.roll(request())).toBe(false);
});
test("回读期间切卡的旧数据不能写入新存档", async () => {
  const f = fixture(); await f.bind(); f.card.attrs.希望 = 4;
  vi.mocked(f.client.characterCard.getCurrent).mockImplementationOnce(async () => {
    f.local = { ...f.local, key: "local-2" }; f.sync.setLocalKey("local-2");
    return { status: { available: true }, card: structuredClone(f.card) };
  });
  await f.sync.refresh(); expect(f.source.applyResources).not.toHaveBeenCalled(); expect(f.local.resources.hope?.current).toBe(2);
});
test("零特质生成数值公式，经历修正内联、单独传费用，不使用 Dice 属性或经历", () => {
  const data = readPlayerRollData({ strength: "0", "experience-1": "世界旅行者", "experience-modifier-1": "2" });
  const r = request(); r.options = { ...r.options, experienceIndices: [1], experienceRevision: data.experienceRevision, modifier: "-1", difficulty: "0", mode: "reaction", edge: "adv" };
  expect(rollCommand(r, data, 2)).toBe(".ddr 0+2-1 adv hope=1 dc0 -- 力量 · 世界旅行者");
  expect(rollCommand(r, data, 2, documentId)).toContain("pbdh=" + documentId);
  expect(() => rollCommand(r, data, 0)).toThrow("希望不足"); expect(() => rollCommand({ ...r, trait: "知识" }, data, 2)).toThrow("尚未填写");
  expect(() => rollCommand({ ...r, expression: ".st 希望+1" }, data, 2)).toThrow("手动公式");
});
test("发送前读取最新 PbDH 经历；过期选项、费用不足和双击均不重复发送", async () => {
  const f = fixture(); f.local.rolls = readPlayerRollData({ strength: "0", "experience-1": "经历", "experience-modifier-1": "2" }); await f.bind();
  const r = request(); r.options.experienceIndices = [1]; r.options.experienceRevision = f.local.rolls.experienceRevision;
  await Promise.all([f.sync.roll(r), f.sync.roll(r)]); expect(f.client.messages.send).toHaveBeenCalledTimes(1);
  expect(vi.mocked(f.client.messages.send).mock.calls[0]![0].text).toBe(".dd 0+2 hope=1 pbdh=" + documentId + " -- 力量 · 经历");
  f.local.rolls = readPlayerRollData({ strength: "0", "experience-1": "改变了", "experience-modifier-1": "3" }); expect(await f.sync.roll(r)).toBe(false);
  f.card.attrs.希望 = 0; expect(await f.sync.roll(r)).toBe(false); expect(f.client.messages.send).toHaveBeenCalledTimes(1);
});
test("请求结果未知时不重发，停止时释放 SDK", async () => {
  const f = fixture(); await f.bind(); vi.mocked(f.client.messages.send).mockRejectedValueOnce(Error("timeout"));
  expect(await f.sync.change("hope", 1)).toBe(false); expect(f.sync.state.phase).toBe("error"); expect(f.client.messages.send).toHaveBeenCalledTimes(1);
  f.sync.stop(); expect(f.client.close).toHaveBeenCalledOnce();
});

test("外部非法资源不进入人物存档或云保存", async () => {
  const f = fixture(); await f.bind(); f.card.attrs.金币袋 = 20; await f.sync.refresh();
  expect(f.sync.state.phase).toBe("error"); expect(f.source.applyResources).not.toHaveBeenCalled(); expect(f.local.resources["bag-gold"]?.current).toBe(0);
});
