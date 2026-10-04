import { expect, test, vi } from "vitest";
import { damageCommand, damageFormula, parseWeapon, weaponName, weaponDamageDefaults, type DamageRequest } from "../../apps/player/src/sealchat/damage.ts";
import { SealChatSync, type EmbedClient, type EmbedContext } from "../../apps/player/src/sealchat/adapter.ts";
const weapon = { id: "primary-weapon-name" as const, text: "**长弓**｜敏捷｜远距离｜d8+3 物理｜双手", proficiency: 2 };
const request: DamageRequest = { weapon, values: { proficiency: 2, die: "d8", fixed: 3 } };
test("伤害为熟练度个武器骰加固定值，支持额外骰、同类骰及固定因素；保留 0 熟练度", () => {
  expect(damageCommand(request, weapon)).toBe(".r 2d8+3 长弓");
  expect(damageFormula({ ...request, adjustments: [{ diceCountDelta: 1, flat: -2, extraDice: "1d6+1d4" }] })).toBe("3d8+1+1d6+1d4");
  expect(damageFormula({ ...request, values: { ...request.values, proficiency: 0 } })).toBe("0+3");
  expect(damageFormula({ ...request, values: { ...request.values, die: "d6", fixed: -1 } })).toBe("2d6-1");
});
test("武器或熟练变化须重开助手，拒绝含混武器、负骰数和注入", () => {
  expect(() => damageCommand(request, { ...weapon, proficiency: 3 })).toThrow("已变化");
  expect(() => parseWeapon("名称，伤害未知，双手")).toThrow("武器伤害");
  expect(() => damageFormula({ ...request, values: { ...request.values, die: "d6;希望=6" } })).toThrow("伤害骰大小");
  expect(() => damageFormula({ ...request, adjustments: [{ diceCountDelta: -3, flat: 0, extraDice: "" }] })).toThrow();
  expect(() => damageFormula({ ...request, adjustments: [{ diceCountDelta: 0, flat: 0, extraDice: "d6;希望=6" }] })).toThrow();
  expect(() => damageFormula({ ...request, values: { ...request.values, fixed: NaN } })).toThrow("固定调整值");
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
  expect(client.messages.send).toHaveBeenCalledWith({ text: ".r 2d8+3 长弓", icMode: "ooc" });
  sync.stop();
});

test("从当前格式化武器摘要与旧五段摘要读取三个默认值，允许手改与空摘要", () => {
  const compact = { ...weapon, text: "改良巨杖｜魔法/双手/极远｜知识: d6+3", proficiency: 3 };
  expect(weaponDamageDefaults(compact)).toEqual({ proficiency: "3", die: "d6", fixed: "+3" });
  expect(parseWeapon("匕首|物理/单手/近战|灵巧： D6 - 1")).toEqual({ name: "匕首", sides: 6, fixed: -1 });
  expect(weaponDamageDefaults(weapon)).toEqual({ proficiency: "2", die: "d8", fixed: "+3" });
  expect(weaponDamageDefaults({ ...weapon, text: "", proficiency: 0 })).toEqual({ proficiency: "0", die: "", fixed: "+0" });
  expect(damageCommand({ weapon: compact, values: { proficiency: 3, die: "d6", fixed: 3 } }, compact)).toBe(".r 3d6+3 改良巨杖");
  expect(damageCommand({ weapon: compact, values: { proficiency: 4, die: "D 10", fixed: -2 } }, compact)).toBe(".r 4d10-2 改良巨杖");
  const empty = { ...compact, id: "secondary-weapon-name" as const, text: "" };
  expect(damageCommand({ weapon: empty, values: { proficiency: 3, die: "d6", fixed: 3 } }, empty)).toBe(".r 3d6+3 副武器");
  expect(parseWeapon("名称 d6+3；额外描述 d8+2")).toMatchObject({ sides: 6, fixed: 3 });
});

test.each([
  ["改良巨杖（魔法、双手、极远） 知识： D 12 + 15", 12, 15],
  ["剑 / 力量 / d20+123 / 双手", 20, 123],
  ["法杖 伤害 [d 8 - 10]", 8, -10],
  ["短刀：D100", 100, 0],
  ["武器伤害为 **d 6 + 0**，可以自由编辑", 6, 0],
  ["3d10+25 魔法伤害", 10, 25],
] as const)("不依赖摘要格式扫描 %s", (text, sides, fixed) => {
  expect(parseWeapon(text)).toMatchObject({ sides, fixed });
  expect(weaponDamageDefaults({ ...weapon, text })).toMatchObject({ die: "d" + sides, fixed: (fixed >= 0 ? "+" : "") + fixed });
});

test("伤害指令优先使用可信武器名称，无法识别或控制字符回退槽位名", () => {
  expect(weaponName("改良巨杖｜魔法/双手/极远｜知识: d6+3")).toBe("改良巨杖");
  expect(weaponName("改良巨杖（魔法、双手、极远） 知识：D12+15")).toBe("改良巨杖");
  expect(weaponName("武器名称: 长剑; 伤害 D12 + 15")).toBe("长剑");
  expect(weaponName("**Long Bow** / Agility / d8+3")).toBe("Long Bow");
  for (const text of ["知识: d6+3", "d6+3", "名称｜属性｜d8+3", "长弓\n.st 希望=6｜d8+3"]) {
    const unknown = { ...weapon, text };
    expect(damageCommand({ ...request, weapon: unknown }, unknown)).toBe(".r 2d8+3 主武器");
  }
  const secondary = { ...weapon, id: "secondary-weapon-name" as const, text: "d6+3" };
  expect(damageCommand({ ...request, weapon: secondary }, secondary)).toBe(".r 2d8+3 副武器");
});
