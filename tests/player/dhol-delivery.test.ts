import { afterEach, describe, expect, it, vi } from "vitest";
import type { CharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage";
import { buildDholDelivery, DHOL_PACKAGE_ID, normalizeDholRoomCode, sendDholDelivery, supportsDholDelivery } from "../../apps/player/src/sheet-runtime/export/dholDelivery";

const data: CharacterData = {
  kind: "pbdh-character-data", schemaVersion: "0.1.0", systemPackage: { id: DHOL_PACKAGE_ID, version: "1.0.2" },
  character: { id: "hero-1", values: {
    "character-name": "阿岚", "background-story": "手动改写的背景", "custom-extension-text": "第三方资源原文",
    "handful-gold": { current: 2, max: 9 }, "bag-gold": { current: 1, max: 9 }, "chest-gold": { current: 1, max: null },
    "character-avatar": { kind: "player-image", imageId: "portrait" },
  } },
  cards: { instances: [] }, compositeResources: {}, embeddedResourceEntries: {}, playerImages: {
    portrait: { id: "portrait", mimeType: "image/png", dataUrl: "data:image/png;base64,secret" },
  }, updatedAt: "2026-10-13T00:00:00.000Z",
};

const exported = {
  ruleSetId: "daggerheart", name: "阿岚", characterImage: "data:image/png;base64,secret", companionImage: "data:image/png;base64,secret",
  hope: 4, hopeMax: 6, hp: [false, true, false, false, false, false], hpMax: 6,
  stress: [false, false, false, false, false, false], stressMax: 6,
  armorBoxes: [false, true], armorMax: 2, cards: [{ id: "extension-1", name: "第三方卡牌", description: "扩展原文" }],
  inventory_cards: [], evasion: "13", armorValue: "2", minorThreshold: "17", majorThreshold: "25",
  agility: { value: "+2" }, strength: { value: "0" }, finesse: { value: "1" }, instinct: { value: "0" }, presence: { value: "-1" }, knowledge: { value: "1" },
  primaryWeaponTrait: "力量 / 近战", secondaryWeaponTrait: "灵巧 / 远距离",
};
const systemPackage: SystemPackage = { manifest: { ID: DHOL_PACKAGE_ID, 名称: "匕首之心", 版本: "1.0.2", 角色数据版本: "1.0.0" }, pages: [], modules: [], resourceLibraries: [] };

afterEach(() => vi.unstubAllGlobals());

it("当前 dhsheet 导出器的伤害前缀保留主副武器属性", () => {
  const delivery = buildDholDelivery(data, {
    ...exported,
    primaryWeaponTrait: "物理/双手/远距离", primaryWeaponDamage: "敏捷: d6+3",
    secondaryWeaponTrait: "物理/单手/近战", secondaryWeaponDamage: "力量: d4+2",
  }, systemPackage);
  expect(delivery.sheet.desktopView).toMatchObject({
    primaryWeaponAttribute: "敏捷", primaryWeaponRange: "远距离",
    secondaryWeaponAttribute: "力量", secondaryWeaponRange: "近战",
  });
});

describe("PbDH delivery through the existing dhSheet contract", () => {
  it("keeps edited values and extension text while dropping both portraits", () => {
    const delivery = buildDholDelivery(data, exported, systemPackage);
    expect(delivery.schemaVersion).toBe(2);
    expect(delivery.sheet).toMatchObject({
      name: "阿岚", characterImage: "", companionImage: "", cards: exported.cards,
      gold: [true, true, false, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false, false, false, true],
      desktopView: { evasion: "13", minorThreshold: "17", hpMax: 6, armorMax: 2,
        attributes: { agility: "+2" }, primaryWeaponAttribute: "力量", primaryWeaponRange: "近战" },
      pbdhSource: { values: { "background-story": "手动改写的背景", "custom-extension-text": "第三方资源原文" } },
    });
    expect(JSON.stringify(delivery)).not.toContain("base64");
    expect(JSON.stringify(delivery)).not.toContain("character-avatar");
    expect(exported.characterImage).toContain("base64");
  });

  it("only accepts the Daggerheart system package and valid resource tracks", () => {
    const adapter = { ID: "dhsheet-character", exportScriptContent: "module.exports=()=>({})" };
    expect(supportsDholDelivery({ ...systemPackage, characterFormatAdapters: [adapter] } as SystemPackage)).toBe(true);
    expect(supportsDholDelivery({ manifest: { ID: "witchy" }, characterFormatAdapters: [adapter] } as SystemPackage)).toBe(false);
    expect(() => buildDholDelivery({ ...data, systemPackage: { id: "witchy", version: "1" } }, exported, systemPackage)).toThrow("只有匕首之心");
    expect(() => buildDholDelivery(data, { ...exported, hpMax: 7 }, systemPackage)).toThrow("hpMax");
  });

  it("keeps cards from a third-party library unknown to the dhSheet adapter", () => {
    const extendedData: CharacterData = { ...data, cards: { instances: [{
      instanceId: "extra", tableModuleId: "character-card-table", state: "配置",
      definitionRef: { type: "resourceLibrary", libraryId: "new-library", entryId: "extra-card" },
      xPct: 0, yPct: 0, zIndex: 1, face: "front", rotation: 0, scale: 1,
    }] } };
    const extendedPackage = { ...systemPackage, resourceLibraries: [{
      ID: "new-library", 名称: "自定义", 路径: "custom.json", fields: [], entries: [{ ID: "extra-card", fields: { 名称: "额外能力", 描述: "未被旧适配器识别的原文" } }],
    }] } as SystemPackage;
    const delivery = buildDholDelivery(extendedData, exported, extendedPackage);
    expect(delivery.sheet.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "额外能力", description: "未被旧适配器识别的原文" }),
    ]));
  });

  it("sends the v2 body with the same endpoint and headers as dhSheet", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true, action: "created", name: "阿岚", generation: 1, seq: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(normalizeDholRoomCode("ab-c123")).toBe("ABC123");
    const result = await sendDholDelivery("ab-c123", "request-1", buildDholDelivery(data, exported, systemPackage), "https://rooms.example/");
    expect(result.action).toBe("created");
    expect(fetchMock).toHaveBeenCalledWith("https://rooms.example/api/v2/rooms/ABC123/characters", expect.objectContaining({
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "request-1" },
    }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).sheet.desktopView.minorThreshold).toBe("17");
  });

  it("使用人物自带的资源副本补卡，保留重复实例，不依赖已卸载的资源包", () => {
    const snapshot: CharacterData = { ...data, embeddedResourceEntries: {
      extra: { libraryId: "custom", entry: { ID: "extra", fields: { 名称: "自有卡牌", 描述: "玩家修改后的描述" } } },
    }, cards: { instances: ["first", "second"].map((instanceId) => ({
      instanceId, tableModuleId: "character-card-table", state: "配置",
      definitionRef: { type: "resourceLibrary", libraryId: "custom", entryId: "extra" },
      xPct: 0, yPct: 0, zIndex: 1, face: "front", rotation: 0, scale: 1,
    })) } };
    const result = buildDholDelivery(snapshot, { ...exported, cards: [] }, systemPackage);
    expect(result.sheet.cards).toHaveLength(2);
    expect(result.sheet.cards).toEqual(Array(2).fill(expect.objectContaining({ name: "自有卡牌", description: "玩家修改后的描述" })));
    expect(JSON.stringify(result)).not.toContain("base64");
  });

  it("原生身份转换后的卡牌不重复补入", () => {
    const snapshot: CharacterData = { ...data, embeddedResourceEntries: {
      local: { libraryId: "domain-cards", entry: { ID: "local", fields: { 名称: "卡牌", 原名: "local-english", 描述: "描述" } } },
    }, cards: { instances: [{
      instanceId: "instance", tableModuleId: "character-card-table", state: "配置",
      definitionRef: { type: "resourceLibrary", libraryId: "domain-cards", entryId: "local" },
      xPct: 0, yPct: 0, zIndex: 1, face: "front", rotation: 0, scale: 1,
    }] } };
    const cards = [{ id: "native-id", name: "卡牌", description: "描述" }];
    expect(buildDholDelivery(snapshot, { ...exported, cards }, systemPackage).sheet.cards).toEqual(cards);
  });

  it("拒绝无效希望值和超限数据，不截断正文", () => {
    expect(() => buildDholDelivery(data, { ...exported, hope: 7 }, systemPackage)).toThrow("希望");
    expect(() => buildDholDelivery(data, { ...exported, notes: "字".repeat(180_000) }, systemPackage)).toThrow("512 KiB");
  });

  it.each([
    ["ROOM_NOT_FOUND", "房间不存在"], ["ROOM_EXPIRED", "房间已过期"],
    ["ORIGIN_NOT_ALLOWED", "尚未被在线面板允许"], ["RATE_LIMITED", "投递过于频繁"],
    ["PERSISTENCE_FAILED", "房间保存失败"],
  ])("将 %s 映射为可读失败提示", async (code, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code }, { status: 400 })));
    await expect(sendDholDelivery("ABC123", "request", buildDholDelivery(data, exported, systemPackage))).rejects.toThrow(message);
  });

  it("网络失败可重试；错误房间码不发出请求", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    const delivery = buildDholDelivery(data, exported, systemPackage);
    await expect(sendDholDelivery("ABC", "request", delivery)).rejects.toThrow("6 位");
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(sendDholDelivery("ABC123", "request", delivery)).rejects.toThrow("重试");
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
