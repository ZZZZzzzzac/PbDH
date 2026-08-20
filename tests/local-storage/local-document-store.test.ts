import "fake-indexeddb/auto";

import Dexie from "dexie";
import { afterEach, describe, expect, test } from "vitest";

import {
  DexieLocalDocumentStore,
  PbDHLocalDatabase,
  type LocalDocumentEnvelope,
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
    contractVersion: "1.0.0-alpha.1",
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

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (value) => {
    value.close();
    await value.delete();
  }));
});

describe("shared local document store", () => {
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
});
