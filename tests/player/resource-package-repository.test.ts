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

const root = process.cwd();
const databases: PbDHLocalDatabase[] = [];

function fixture(): ResourcePackageCandidate {
  const document = JSON.parse(readFileSync(path.join(
    root,
    "contracts/conformance/resource-package/1.0.0-alpha.1/valid/minotaur-wrecker.json",
  ), "utf8")) as ResourcePackageLogicalDocument;
  const bytes = new Uint8Array(readFileSync(path.join(
    root,
    "contracts/conformance/resource-package/1.0.0-alpha.1/media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp",
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

    await store.replace(candidate, "file");
    const [installed] = await store.list();

    expect(installed?.document).toEqual(candidate.document);
    expect(installed?.media.get(candidate.document.assets[0]!.id)).toEqual(
      candidate.media.get(candidate.document.assets[0]!.id),
    );
    expect(installed?.source).toBe("file");
  });

  test("rejects an incomplete update and preserves the previous snapshot", async () => {
    const store = repository().repository;
    const original = fixture();
    await store.replace(original, "bundled");
    const incomplete = fixture();
    incomplete.document.package.version = "1.1.0";
    incomplete.document.snapshotDigest = "sha256:incoming";
    incomplete.media.clear();

    await expect(store.replace(incomplete, "file")).rejects.toThrow("Missing installed media");

    const [installed] = await store.list();
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

    await store.replace(first, "file");
    await store.replace(second, "market");
    expect(await database.resourceMedia.count()).toBe(1);

    await store.remove(first.document.package.id);
    expect(await database.resourceMedia.count()).toBe(1);

    await store.remove(second.document.package.id);
    expect(await database.resourceMedia.count()).toBe(0);
  });
});
