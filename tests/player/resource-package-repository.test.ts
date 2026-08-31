import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import type {
  ResourcePackageCandidate,
  ResourcePackageLogicalDocument,
} from "../../packages/contract-runtime/src/index.ts";
import {
  DexieResourcePackageRepository,
  PbDHLocalDatabase,
} from "../../apps/player/src/resources/resource-package-repository.ts";
import { DexieLocalDocumentStore } from "../../packages/local-storage/src/index.ts";
import { restorePlayerResourceLibrary } from "../../apps/player/src/PlayerSheetSurface.tsx";

const root = process.cwd();
const databases: PbDHLocalDatabase[] = [];
const systemPackageId = "01a0132c-4eef-7703-94ac-ec8d1a660001";

function fixture(): ResourcePackageCandidate {
  const document = JSON.parse(readFileSync(path.join(
    root,
    "contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json",
  ), "utf8")) as ResourcePackageLogicalDocument;
  const bytes = new Uint8Array(readFileSync(path.join(
    root,
    "contracts/conformance/resource-package/1.0.0/media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp",
  )));
  return { document, media: new Map([[document.assets[0]!.id, bytes]]) };
}

function repository() {
  const database = new PbDHLocalDatabase(`pbdh-platform-test-${crypto.randomUUID()}`);
  databases.push(database);
  return { database, repository: new DexieResourcePackageRepository(database) };
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => {
    database.close();
    await database.delete();
  }));
});

describe("Dexie Resource Package Repository", () => {
  test("round-trips a complete package and its offline media", async () => {
    const store = repository().repository;
    const candidate = fixture();

    await store.replace(systemPackageId, candidate, "file");
    const [installed] = await store.list(systemPackageId);

    expect(installed?.document).toEqual(candidate.document);
    expect(installed?.media.get(candidate.document.assets[0]!.id)).toEqual(
      candidate.media.get(candidate.document.assets[0]!.id),
    );
    expect(installed?.source).toBe("file");
  });

  test("isolates installed packages by System Package", async () => {
    const store = repository().repository;
    const candidate = fixture();
    const daggerheartId = "01a0132c-4eef-7703-94ac-ec8d1a660001";
    const tttriId = "01a05400-0000-7000-8000-000000000201";

    await store.replace(daggerheartId, candidate, "file");

    expect(await store.list(daggerheartId)).toHaveLength(1);
    expect(await store.list(tttriId)).toEqual([]);
  });

  test("restores a Market-installed package and media without a Market request", async () => {
    const store = repository().repository;
    const candidate = fixture();

    await store.replace(systemPackageId, candidate, "market");
    const [restored] = await store.list(systemPackageId);

    expect(restored?.source).toBe("market");
    expect(restored?.document.snapshotDigest).toBe(candidate.document.snapshotDigest);
    expect(restored?.media.get(candidate.document.assets[0]!.id)).toEqual(
      candidate.media.get(candidate.document.assets[0]!.id),
    );
  });

  test("restores only packages installed in IndexedDB", async () => {
    const store = repository().repository;
    const marketPackage = fixture();
    await store.replace(systemPackageId, marketPackage, "market");

    const restored = await restorePlayerResourceLibrary(store);

    expect(restored.size).toBe(1);
    expect(restored.has(marketPackage.document.package.id)).toBe(true);
  });

  test("rejects an incomplete update and preserves the previous snapshot", async () => {
    const store = repository().repository;
    const original = fixture();
    await store.replace(systemPackageId, original, "bundled");
    const incomplete = fixture();
    incomplete.document.package.version = "1.1.0";
    incomplete.document.snapshotDigest = "sha256:incoming";
    incomplete.media.clear();

    await expect(store.replace(systemPackageId, incomplete, "file")).rejects.toThrow("Missing installed media");

    const [installed] = await store.list(systemPackageId);
    expect(installed?.document.package.version).toBe(original.document.package.version);
    expect(installed?.document.snapshotDigest).toBe(original.document.snapshotDigest);
  });

  test("deduplicates shared media and removes it only after the last package is removed", async () => {
    const { database, repository: store } = repository();
    const first = fixture();
    const second = fixture();
    second.document.package.id = "01a0132c-4eef-7703-94ac-ec8d1a660099";
    second.document.package.name = "共享媒体测试包";
    second.document.snapshotDigest = "sha256:shared-media-test";

    await store.replace(systemPackageId, first, "file");
    await store.replace(systemPackageId, second, "market");
    expect(await database.mediaAssets.count()).toBe(1);

    await store.remove(systemPackageId, first.document.package.id);
    expect(await database.mediaAssets.count()).toBe(1);

    await store.remove(systemPackageId, second.document.package.id);
    expect(await database.mediaAssets.count()).toBe(0);
  });

  test("keeps installed package media when an expired local document shares the asset", async () => {
    const { database, repository: store } = repository();
    const candidate = fixture();
    const assetId = candidate.document.assets[0]!.id;
    await store.replace(systemPackageId, candidate, "bundled");

    const documents = new DexieLocalDocumentStore(database);
    await documents.put({
      documentId: "tabletop-sharing-package-media",
      documentKind: "gm-tabletop-document",
      contractFamily: "tabletop-document",
      contractVersion: "1.0.0",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      assetIds: [assetId],
      sync: { scope: "local-only", state: "clean", baseRevision: null },
      payload: {},
    });
    await documents.trash(
      "gm-tabletop-document",
      "tabletop-sharing-package-media",
      "2026-07-01T00:00:00.000Z",
    );

    await documents.purgeExpiredTrash("2026-08-01T00:00:00.000Z");

    await expect(store.list(systemPackageId)).resolves.toHaveLength(1);
  });
});
