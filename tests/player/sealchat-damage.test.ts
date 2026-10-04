import { expect, test, vi } from "vitest";
import { damageCommand, damageFormula, type DamageRequest } from "../../apps/player/src/sealchat/damage.ts";
import { SealChatSync, type EmbedClient, type EmbedContext } from "../../apps/player/src/sealchat/adapter.ts";
const weapon = { id: "primary-weapon-name" as const, text: "**长弓**｜敏捷｜远距离｜d8+3 物理｜双手", proficiency: 2 };
const request: DamageRequest = { weapon, adjustments: [], reason: "" };
test("伤害为熟练度个武器骰加固定值，支持额外骰、同类骰及固定因素；保留 0 熟练度", () => {
  expect(damageCommand(request, weapon)).toBe(".r 2d8+3 伤害：长弓");
  expect(damageFormula({ ...request, adjustments: [{ diceCountDelta: 1, flat: -2, extraDice: "1d6+1d4" }] })).toBe("3d8+1+1d6+1d4");
  expect(damageFormula({ ...request, weapon: { ...weapon, proficiency: 0 } })).toBe("0+3");
  expect(damageFormula({ ...request, weapon: { ...weapon, id: "secondary-weapon-name", text: "匕首｜灵巧｜近战｜d6-1 魔法｜单手" } })).toBe("2d6-1");
});
test("武器或熟练变化须重开助手，拒绝含混武器、负骰数和注入", () => {
  expect(() => damageCommand(request, { ...weapon, proficiency: 3 })).toThrow("已变化");
  expect(() => damageFormula({ ...request, weapon: { ...weapon, text: "名称｜属性｜距离｜2d8｜双手" } })).toThrow("武器伤害");
  expect(() => damageFormula({ ...request, adjustments: [{ diceCountDelta: -3, flat: 0, extraDice: "" }] })).toThrow();
  expect(() => damageFormula({ ...request, adjustments: [{ diceCountDelta: 0, flat: 0, extraDice: "d6;希望=6" }] })).toThrow();
  expect(() => damageCommand({ ...request, reason: "伤害\n.st 希望=6" }, weapon)).toThrow("单行");
});
test("伤害复用发送前读取与关联保护，更新武器时取消，不会发送旧伤害", async () => {
  const context: EmbedContext = { channel: { id: "test" }, currentUser: { id: "test" }, currentCharacter: null, connection: { state: "connected" }, permissions: { canSendMessage: true } };
  let latest = weapon;
  const client: EmbedClient = { capabilities: ["context.read", "characterCard.read", "messages.send"],
    context: { get: async () => context, onChanged: () => () => {} }, connection: { getState: async () => context.connection, onChanged: () => () => {} },
    characterCard: { getCurrent: async () => ({ status: { available: true }, card: { name: "测试", sheetType: "dh", attrs: {} } }) },
    messages: { send: vi.fn(async () => ({})) }, session: { onClosed: () => () => {} }, close: vi.fn() };
  const sync = new SealChatSync(client, "local", vi.fn()); await sync.start(); await sync.bind();
  latest = { ...weapon, proficiency: 3 };
  expect(await sync.sendBound(() => damageCommand(request, latest))).toBe(false); expect(client.messages.send).not.toHaveBeenCalled();
  expect(sync.state.phase).toBe("bound"); latest = weapon;
  expect(await sync.sendBound(() => damageCommand(request, latest))).toBe(true);
  expect(client.messages.send).toHaveBeenCalledWith({ text: ".r 2d8+3 伤害：长弓", icMode: "ooc" });
  sync.stop();
});
