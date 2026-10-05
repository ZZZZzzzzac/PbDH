import { vi } from "vitest";
import { SealChatSync, readResources, sourceField, type EmbedClient, type EmbedContext, type PlayerSnapshot, type PlayerSource } from "../../apps/player/src/sealchat/adapter.ts";
import { readPlayerRollData } from "../../apps/player/src/sealchat/roll.ts";
export const documentId = "01234567-89ab-4cde-8fab-0123456789ab";
export function fixture() {
  let context: EmbedContext = { channel: { id: "channel-1" }, currentUser: { id: "user-1" }, currentCharacter: { id: "identity-1" }, connection: { state: "connected" }, permissions: { canSendMessage: true } };
  const card = { name: "测试人物", sheetType: "daggerheart", attrs: { 生命: 0, 生命上限: 6, 压力: 0, 压力上限: 6, 护甲: 0, 护甲上限: 0, 希望: 2, 希望上限: 6, 金币把: 0, 金币袋: 0, 金币箱: 0, 闪避: 11, 重伤阈值: 11, 严重阈值: 22, 力量: 99, DH经历: "坏的旧经历" } as Record<string, unknown> };
  let local: PlayerSnapshot = { key: "local-1", documentId, name: "测试人物", resources: readResources(card.attrs), defenses: { evasion: 11, "major-threshold": 11, "severe-threshold": 22 }, rolls: readPlayerRollData({ strength: "0" }) };
  let changedContext = (_: EmbedContext) => {}, changedConnection = (_: { state: string }) => {}, closed = () => {};
  let execute = true;
  const source: PlayerSource = { read: () => structuredClone(local), applyResources: vi.fn((patch, key) => { if (key === local.key) local.resources = { ...local.resources, ...structuredClone(patch) }; }) };
  const client: EmbedClient = {
    capabilities: ["context.read", "characters.read", "characterCard.read", "messages.send"],
    context: { get: vi.fn(async () => structuredClone(context)), onChanged: cb => { changedContext = cb; return vi.fn(); } },
    connection: { getState: vi.fn(async () => context.connection), onChanged: cb => { changedConnection = cb; return vi.fn(); } },
    characterCard: { getCurrent: vi.fn(async () => ({ status: { available: true }, card: structuredClone(card) })) },
    messages: { send: vi.fn(async ({ text }) => {
      if (execute && text.startsWith(".dh pbdh ")) {
        const payload = JSON.parse(text.slice(9));
        Object.assign(card.attrs, payload.values, { [sourceField]: payload.source, DH姓名: payload.name });
      }
      if (execute && text.startsWith(".st ")) for (const token of text.slice(4).split(" ")) {
        const match = /^(.+?)(=|[+-])(.+)$/.exec(token); if (!match) continue;
        const [, name, operation, raw] = match;
        if (operation === "=") card.attrs[name!] = raw!.startsWith('"') ? JSON.parse(raw!) : Number(raw);
        else card.attrs[name!] = Number(card.attrs[name!]) + (operation === "+" ? 1 : -1) * Number(raw);
      }
      return {};
    }) }, session: { onClosed: cb => { closed = cb; return vi.fn(); } }, close: vi.fn(),
  };
  const sync = new SealChatSync(client, local.key, vi.fn(), source);
  return { client, source, sync, card, get local() { return local; }, set local(value: PlayerSnapshot) { local = value; },
    get context() { return context; }, setContext(value: EmbedContext) { context = value; changedContext(value); },
    holdWrites() { execute = false; }, emitCompanionEvents() { changedContext(context); changedConnection(context.connection); },
    disconnect() { context = { ...context, connection: { state: "offline" } }; changedConnection(context.connection); }, closeSession() { closed(); },
    async bind() { await sync.start(); await sync.bind(); vi.mocked(client.messages.send).mockClear(); vi.mocked(source.applyResources).mockClear(); } };
}
export { sourceField };

import { daggerheartSystemId } from "../../apps/player/src/sealchat/adapter.ts";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
export function playerFixture() {
  const f = fixture();
  const pkg: SystemPackage = { manifest: { ID: daggerheartSystemId, 名称: "测试", 版本: "1.0.0", 角色数据版本: "1.0.0" }, modules: [
    ...Object.entries(f.local.resources).map(([id, value]) => ({ ID: id, 类型: "countableResource" as const, 标签: id, 默认值: value!.current, ...(value!.max === null ? {} : { 最大值: value!.max }) })),
    ...["strength", "armor-value", "evasion", "major-threshold", "severe-threshold", "experience-1", "experience-modifier-1"].map(id => ({ ID: id, 类型: "freeText" as const, 标签: id, 默认值: id === "experience-1" ? "经历" : "0" })),
  ], pages: [] };
  const data = createEmptyCharacterData(pkg, documentId);
  return { ...f, pkg, data };
}
