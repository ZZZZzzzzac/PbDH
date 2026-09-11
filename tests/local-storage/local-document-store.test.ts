import "fake-indexeddb/auto";

import Dexie from "dexie";
import { afterEach, describe, expect, test } from "vitest";

import {
  DexieAuthorPreviewHandleStore,
  DexieLocalDocumentStore,
  DexieRuntimeCacheStore,
  LocalDocumentChangedError,
  PbDHLocalDatabase,
  type LocalDocumentEnvelope,
  type LocalMediaAssetRecord,
} from "../../packages/local-storage/src/index.ts";

const databases: PbDHLocalDatabase[] = [];

function envelope(
  documentId: string,
  documentKind: LocalDocumentEnvelope["documentKind"],
  assetIds: string[] = [],
): LocalDocumentEnvelope<{ name: string }> {
  return {
    documentId,
    documentKind,
    contractFamily: documentKind === "gm-tabletop-document" ? "tabletop-document" : "test",
    contractVersion: "1.0.0",
    createdAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-20T10:00:00.000Z",
    assetIds,
    sync: { scope: "local-only", state: "clean", baseRevision: null },
    payload: { name: documentKind },
  };
}

function database() {
  const value = new PbDHLocalDatabase(`pbdh-platform-test-${crypto.randomUUID()}`);
  databases.push(value);
  return value;
}

function mediaRecord(assetId: string, byte: number): LocalMediaAssetRecord {
  return { assetId, mediaType: "image/webp", byteLength: "1", bytes: new Uint8Array([byte]) };
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (value) => {
    value.close();
    await value.delete();
  }));
});

describe("shared local document store", () => {
  test("多个来源并发读取回收站时过期清理不会重复删除报错", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    await store.put(envelope("expired", "creator-workspace"));
    await store.trash("creator-workspace", "expired", "2020-01-01T00:00:00.000Z");
    const results = await Promise.allSettled([
      store.listTrash("creator-workspace"), store.listTrash("gm-tabletop-document"), store.listTrash("character-save"),
    ]);
    expect(results).toEqual([
      { status: "fulfilled", value: [] }, { status: "fulfilled", value: [] }, { status: "fulfilled", value: [] },
    ]);
  });
  test("同步字段更新在事务中读取最新内容，不重写正文或复活回收站记录", async () => {
    const store = new DexieLocalDocumentStore(database());
    const original = envelope("sync-update", "creator-workspace");
    await store.put(original);
    const edited = { ...original, payload: { name: "新内容" } };
    const saving = store.put(edited);
    const acknowledging = store.updateSync("creator-workspace", original.documentId, (latest) => {
      expect(latest.payload).toEqual(edited.payload);
      return { ...latest.sync, baseRevision: "2" };
    });
    await Promise.all([saving, acknowledging]);
    expect(await store.get("creator-workspace", original.documentId)).toMatchObject({
      payload: edited.payload, sync: { baseRevision: "2" },
    });
    await store.trash("creator-workspace", original.documentId);
    expect(await store.updateSync("creator-workspace", original.documentId, () => original.sync)).toBeUndefined();
    expect(await store.get("creator-workspace", original.documentId)).toBeUndefined();
  });

  test("isolates each document kind and survives reopening", async () => {
    const firstDatabase = database();
    const name = firstDatabase.name;
    const store = new DexieLocalDocumentStore(firstDatabase);
    await store.put(envelope("workspace-1", "creator-workspace"));
    await store.put(envelope("tabletop-1", "gm-tabletop-document"));
    await store.put(envelope("character-1", "character-save"));
    firstDatabase.close();

    const reopened = new PbDHLocalDatabase(name);
    databases.push(reopened);
    const reopenedStore = new DexieLocalDocumentStore(reopened);

    expect((await reopenedStore.list("creator-workspace")).map((item) => item.documentId))
      .toEqual(["workspace-1"]);
    expect((await reopenedStore.list("gm-tabletop-document")).map((item) => item.documentId))
      .toEqual(["tabletop-1"]);
    expect((await reopenedStore.list("character-save")).map((item) => item.documentId))
      .toEqual(["character-1"]);
    expect(await reopenedStore.get("creator-workspace", "tabletop-1")).toBeUndefined();
  });

  test("commits document and media atomically", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    const assetId = `sha256:${"a".repeat(64)}`;
    const document = envelope("tabletop-1", "gm-tabletop-document", [assetId]);

    await expect(store.put(document)).rejects.toThrow("Missing local media");
    expect(await value.localDocuments.count()).toBe(0);

    await store.put(document, [{
      assetId,
      mediaType: "image/webp",
      byteLength: "3",
      bytes: new Uint8Array([1, 2, 3]),
    }]);
    expect(await value.localDocuments.count()).toBe(1);
    expect(await store.getMedia([assetId])).toEqual(new Map([[assetId, new Uint8Array([1, 2, 3])]]));
  });

  test("migrates v1 resource media into the shared media store", async () => {
    const name = `pbdh-platform-test-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(1).stores({
      installedResourcePackages: "&packageId, snapshotDigest, version, installedAt",
      resourceMedia: "&assetId, byteLength",
    });
    await legacy.table("resourceMedia").put({
      assetId: `sha256:${"b".repeat(64)}`,
      mediaType: "image/webp",
      byteLength: "2",
      bytes: new Uint8Array([4, 5]),
    });
    legacy.close();

    const upgraded = new PbDHLocalDatabase(name);
    databases.push(upgraded);
    expect(await upgraded.mediaAssets.count()).toBe(1);
    expect(upgraded.tables.map((table) => table.name)).not.toContain("resourceMedia");
  });

  test("persists an Author Preview directory handle across database reopening", async () => {
    const firstDatabase = database();
    const name = firstDatabase.name;
    const firstStore = new DexieAuthorPreviewHandleStore<{ kind: "directory"; name: string }>(firstDatabase);
    await firstStore.save({ kind: "directory", name: "system-package-dev" });
    firstDatabase.close();

    const reopened = new PbDHLocalDatabase(name);
    databases.push(reopened);
    const reopenedStore = new DexieAuthorPreviewHandleStore<{ kind: "directory"; name: string }>(reopened);

    expect(await reopenedStore.load()).toEqual({ kind: "directory", name: "system-package-dev" });
  });

  test("keeps active documents separate from the shared 30-day trash", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    await store.put(envelope("character-1", "character-save"));

    await store.trash("character-save", "character-1", "2026-08-20T10:00:00.000Z");

    expect(await store.get("character-save", "character-1")).toBeUndefined();
    expect(await store.list("character-save")).toEqual([]);
    expect(await store.listTrash("character-save")).toMatchObject([{
      documentId: "character-1",
      deletedAt: "2026-08-20T10:00:00.000Z",
      purgeAfter: "2026-09-19T10:00:00.000Z",
    }]);

    await store.restore("character-save", "character-1");
    expect(await store.get("character-save", "character-1")).toMatchObject({ documentId: "character-1" });
    expect(await store.listTrash("character-save")).toEqual([]);
  });

  test("purges expired trash and releases media that no remaining document uses", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    const assetId = `sha256:${"d".repeat(64)}`;
    await store.put(envelope("tabletop-1", "gm-tabletop-document", [assetId]), [{
      assetId,
      mediaType: "image/webp",
      byteLength: "1",
      bytes: new Uint8Array([9]),
    }]);
    await store.trash("gm-tabletop-document", "tabletop-1", "2026-08-01T00:00:00.000Z");

    expect(await store.purgeExpiredTrash("2026-09-01T00:00:00.000Z")).toBe(1);
    expect(await store.getTrash("gm-tabletop-document", "tabletop-1")).toBeUndefined();
    expect(await store.getMedia([assetId])).toEqual(new Map());
  });

  test("migrates the former GM-only trash document into the shared lifecycle", async () => {
    const name = `pbdh-platform-test-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(6).stores({
      installedResourcePackages: "&packageId, snapshotDigest, version, installedAt",
      installedSystemResourcePackages: "&[systemPackageId+packageId], systemPackageId, packageId, snapshotDigest, version, installedAt",
      localDocuments: "&documentId, documentKind, [documentKind+updatedAt], updatedAt",
      mediaAssets: "&assetId, byteLength",
      authorPreviewHandles: "&id",
      runtimeCaches: "&id",
    });
    await legacy.table("localDocuments").put({
      ...envelope("gm-tabletop-document-trash:tabletop-1", "gm-tabletop-document"),
      documentKind: "gm-tabletop-document-trash",
      updatedAt: "2026-08-20T10:00:00.000Z",
      payload: { name: "旧桌面" },
    });
    legacy.close();

    const upgraded = new PbDHLocalDatabase(name);
    databases.push(upgraded);
    const store = new DexieLocalDocumentStore(upgraded);
    expect(await store.listTrash("gm-tabletop-document")).toMatchObject([{
      documentId: "tabletop-1",
      documentKind: "gm-tabletop-document",
      payload: { name: "旧桌面" },
    }]);
  });

  test("migrates globally installed resource packages into their target System Package", async () => {
    const name = `pbdh-platform-test-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(5).stores({
      installedResourcePackages: "&packageId, snapshotDigest, version, installedAt",
      localDocuments: "&documentId, documentKind, [documentKind+updatedAt], updatedAt",
      mediaAssets: "&assetId, byteLength",
      authorPreviewHandles: "&id",
      runtimeCaches: "&id",
    });
    await legacy.table("installedResourcePackages").put({
      packageId: "01a05400-0000-7000-8000-000000000202",
      snapshotDigest: `sha256:${"c".repeat(64)}`,
      version: "1.0.1",
      installedAt: "2026-08-29T00:00:00.000Z",
      source: "bundled",
      document: {
        targets: [{ systemPackageId: "01a05400-0000-7000-8000-000000000201", version: "1.0.1" }],
      },
    });
    legacy.close();

    const upgraded = new PbDHLocalDatabase(name);
    databases.push(upgraded);
    const records = await upgraded.installedSystemResourcePackages.toArray();
    expect(records).toMatchObject([{
      systemPackageId: "01a05400-0000-7000-8000-000000000201",
      packageId: "01a05400-0000-7000-8000-000000000202",
    }]);
  });

  test("persists runtime snapshots with binary assets across database reopening", async () => {
    const firstDatabase = database();
    const name = firstDatabase.name;
    const firstStore = new DexieRuntimeCacheStore<{ id: string; bytes: Uint8Array }>(firstDatabase);
    await firstStore.save("player-current-system-package", {
      id: "system.example",
      bytes: new Uint8Array([7, 8, 9]),
    });
    firstDatabase.close();

    const reopened = new PbDHLocalDatabase(name);
    databases.push(reopened);
    const reopenedStore = new DexieRuntimeCacheStore<{ id: string; bytes: Uint8Array }>(reopened);

    expect(await reopenedStore.load("player-current-system-package")).toEqual({
      id: "system.example",
      bytes: new Uint8Array([7, 8, 9]),
    });
    await reopenedStore.remove("player-current-system-package");
    expect(await reopenedStore.load("player-current-system-package")).toBeNull();
  });

  test("显式 replaceTrash 可原子替换同 kind 回收站文档并只清理无人引用的旧媒体", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    const sharedAssetId = `sha256:${"e".repeat(64)}`;
    const trashOnlyAssetId = `sha256:${"f".repeat(64)}`;
    const newAssetId = `sha256:${"1".repeat(64)}`;
    // 另一个活动文档共享旧媒体，替换后该媒体必须保留。
    await store.put(
      envelope("other", "gm-tabletop-document", [sharedAssetId]),
      [mediaRecord(sharedAssetId, 1)],
    );
    await store.put(
      envelope("tabletop-1", "gm-tabletop-document", [sharedAssetId, trashOnlyAssetId]),
      [mediaRecord(sharedAssetId, 1), mediaRecord(trashOnlyAssetId, 2)],
    );
    await store.trash("gm-tabletop-document", "tabletop-1");

    // 默认拒绝复活回收站文档。
    await expect(store.put(envelope("tabletop-1", "gm-tabletop-document", [newAssetId])))
      .rejects.toThrow("同编号文档仍在回收站");

    await store.put(
      envelope("tabletop-1", "gm-tabletop-document", [newAssetId]),
      [mediaRecord(newAssetId, 3)],
      { replaceTrash: true },
    );

    expect(await store.getTrash("gm-tabletop-document", "tabletop-1")).toBeUndefined();
    expect(await store.get("gm-tabletop-document", "tabletop-1")).toMatchObject({ assetIds: [newAssetId] });
    // 旧回收站独有媒体被清理，共享旧媒体与其他文档引用保留，新活动媒体完整。
    expect(await store.getMedia([trashOnlyAssetId])).toEqual(new Map());
    expect((await store.getMedia([sharedAssetId])).get(sharedAssetId)).toEqual(new Uint8Array([1]));
    expect((await store.getMedia([newAssetId])).get(newAssetId)).toEqual(new Uint8Array([3]));
  });

  test("跨 kind 同编号不可覆盖", async () => {
    const store = new DexieLocalDocumentStore(database());
    await store.put(envelope("shared-id", "creator-workspace"));
    await expect(store.put(envelope("shared-id", "gm-tabletop-document"))).rejects.toThrow();
    await expect(store.put(
      envelope("shared-id", "gm-tabletop-document"),
      [],
      { replaceTrash: true },
    )).rejects.toThrow();
    expect(await store.get("creator-workspace", "shared-id")).toBeDefined();
    expect(await store.get("gm-tabletop-document", "shared-id")).toBeUndefined();
  });

  test("expected 不匹配时拒绝写入且不写媒体或正文", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    await store.put(envelope("cas-1", "creator-workspace"));
    const snapshot = (await store.get("creator-workspace", "cas-1"))!;
    await store.put({ ...snapshot, payload: { name: "并发更新" } }, [], { expected: snapshot });

    const newAssetId = `sha256:${"2".repeat(64)}`;
    await expect(store.put(
      envelope("cas-1", "creator-workspace", [newAssetId]),
      [mediaRecord(newAssetId, 4)],
      { expected: snapshot },
    )).rejects.toBeInstanceOf(LocalDocumentChangedError);

    expect((await store.get("creator-workspace", "cas-1"))?.payload).toEqual({ name: "并发更新" });
    expect(await store.getMedia([newAssetId])).toEqual(new Map());

    // 原不存在但随后出现时同样拒绝写入。
    await store.put(envelope("cas-new", "creator-workspace"), [], { expected: null });
    await expect(store.put(envelope("cas-new", "creator-workspace"), [], { expected: null }))
      .rejects.toBeInstanceOf(LocalDocumentChangedError);
  });

  test("remove 按 expected 校验，防止删除网络期间出现的新本地副本", async () => {
    const store = new DexieLocalDocumentStore(database());
    await store.put(envelope("remove-1", "creator-workspace"));
    const snapshot = (await store.get("creator-workspace", "remove-1"))!;
    await store.put({ ...snapshot, payload: { name: "本地更新" } }, [], { expected: snapshot });

    await expect(store.remove("creator-workspace", "remove-1", { expected: snapshot }))
      .rejects.toBeInstanceOf(LocalDocumentChangedError);
    expect(await store.get("creator-workspace", "remove-1")).toBeDefined();

    // 原不存在但随后出现时同样拒绝删除。
    await expect(store.remove("creator-workspace", "remove-missing", { expected: null })).resolves.toBeUndefined();
    await store.put(envelope("remove-missing", "creator-workspace"));
    await expect(store.remove("creator-workspace", "remove-missing", { expected: null }))
      .rejects.toBeInstanceOf(LocalDocumentChangedError);
    expect(await store.get("creator-workspace", "remove-missing")).toBeDefined();

    // expected 与当前一致时正常删除。
    const latest = (await store.get("creator-workspace", "remove-1"))!;
    await store.remove("creator-workspace", "remove-1", { expected: latest });
    expect(await store.get("creator-workspace", "remove-1")).toBeUndefined();
  });
});
