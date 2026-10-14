import "fake-indexeddb/auto";
import { afterEach, expect, test, vi } from "vitest";
import { computeResourcePackageSnapshotDigest, type ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import { DexieLocalDocumentStore, PbDHLocalDatabase } from "@pbdh/local-storage";
import resource from "../../contracts/conformance/resource-package/1.0.0/valid/daggerheart-core-primary-weapon.json";
import character from "../../contracts/conformance/character-save/1.0.0/valid/module-state.json";
import { CharacterSaveRepository, createCharacterSave } from "../../apps/player/src/character-saves/character-save-repository.ts";
import { readEmbedConfig } from "../../apps/player/src/sealchat/adapter.ts";

afterEach(() => vi.unstubAllGlobals());

test("HTTP SealChat 保留准确通信 origin，SDK 使用可信 HTTPS 官方入口", () => {
  const config = readEmbedConfig("https://daggerheart.cn/pbdh/player?sealchat=1&hostOrigin=http://203.0.113.20:3212&sdkUrl=http://203.0.113.20:3212/chat/api/v1/channel-embed-sdk.js", true);
  expect(config).toEqual({ hostOrigin: "http://203.0.113.20:3212", sdkUrl: "https://daggerheart.cn/chat/api/v1/channel-embed-sdk.js" });
});

test.each([
  ["http://chat.example:3212", "http://evil.example/api/v1/channel-embed-sdk.js"],
  ["http://chat.example:3212", "http://chat.example:3212/other.js"],
  ["http://chat.example:3212", "http://chat.example:3212/api/v1/channel-embed-sdk.js?code=bad"],
  ["http://user:pass@chat.example", "http://chat.example/api/v1/channel-embed-sdk.js"],
  ["http://chat.example/path", "http://chat.example/api/v1/channel-embed-sdk.js"],
  ["ftp://chat.example", "ftp://chat.example/api/v1/channel-embed-sdk.js"],
])("HTTP 兼容不放宽来源和 SDK 路径校验：%s %s", (hostOrigin, sdkUrl) => {
  const query = new URLSearchParams({ sealchat: "1", hostOrigin, sdkUrl });
  expect(() => readEmbedConfig(`https://daggerheart.cn/player?${query}`, true)).toThrow();
});

test("HTTPS 和本机宿主仍使用其提供的 SDK，并保留部署前缀", () => {
  for (const hostOrigin of ["https://chat.example:3212", "http://localhost:3212", "http://127.0.0.1:3212"]) {
    const sdkUrl = `${hostOrigin}/sealchat/api/v1/channel-embed-sdk.js`;
    const query = new URLSearchParams({ sealchat: "1", hostOrigin, sdkUrl });
    expect(readEmbedConfig(`https://daggerheart.cn/player?${query}`, true)).toEqual({ hostOrigin, sdkUrl });
  }
});

test("HTTP 外层使 WebCrypto 缺失时，资源摘要和人物新建保存重读仍可用", async () => {
  const document = { ...resource, assets: [] } as ResourcePackageLogicalDocument;
  const expected = await computeResourcePackageSnapshotDigest(document, new Map());
  const native = globalThis.crypto;
  vi.stubGlobal("crypto", { getRandomValues: native.getRandomValues.bind(native) });
  expect(await computeResourcePackageSnapshotDigest(document, new Map())).toBe(expected);
  const save = createCharacterSave({ name: "HTTP 嵌入测试", systemPackage: character.systemPackage, characterDataVersion: character.characterDataVersion, characterData: character.characterData });
  expect(save.documentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const db = new PbDHLocalDatabase(`http-embed-${save.documentId}`);
  try {
    const repository = new CharacterSaveRepository(new DexieLocalDocumentStore(db));
    const saved = await repository.save(save, new Map());
    expect((await repository.getDocument(save.documentId))?.document).toEqual(saved.document);
  } finally { db.close(); await db.delete(); }
});
