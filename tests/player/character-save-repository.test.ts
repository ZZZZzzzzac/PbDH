import "fake-indexeddb/auto";

import { afterEach, describe, expect, test } from "vitest";

import type { CharacterSaveDocument, ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import { DexieLocalDocumentStore, PbDHLocalDatabase } from "@pbdh/local-storage";

import fixtureJson from "../../contracts/conformance/character-save/1.0.0/valid/module-state.json";
import weaponPackageJson from "../../contracts/conformance/resource-package/1.0.0-alpha.1/valid/daggerheart-core-primary-weapon.json";
import {
  CharacterSaveRepository,
  createCharacterSave,
} from "../../apps/player/src/character-saves/character-save-repository.ts";
import { DexieResourcePackageRepository } from "../../apps/player/src/resources/resource-package-repository.ts";

const databases: PbDHLocalDatabase[] = [];

function database() {
  const value = new PbDHLocalDatabase(`pbdh-character-save-test-${crypto.randomUUID()}`);
  databases.push(value);
  return value;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (value) => {
    value.close();
    await value.delete();
  }));
});

describe("CharacterSaveRepository", () => {
  test("restores final weapon fields and a self-contained tabletop after a local restart", async () => {
    const store = new DexieLocalDocumentStore(database());
    const source = new CharacterSaveRepository(store, () => "2026-08-26T08:06:00.000Z");
    const fixture = structuredClone(fixtureJson) as CharacterSaveDocument;

    await source.save(fixture, new Map());
    const restored = await new CharacterSaveRepository(store).list();

    expect(restored).toHaveLength(1);
    expect(restored[0]?.document.characterData["primary-weapon-name"]).toBe("**长弓**｜敏捷｜远距离｜d8+2 物理｜双手");
    expect((restored[0]?.document.characterData["character-card-table"] as { instances: unknown[] }).instances[0]).toMatchObject({
      resourceCopy: {
        source: { resourceId: "minotaur-wrecker" },
        data: { 名称: "牛头人破坏者" },
      },
      state: { value: "配置", indicators: "[]" },
      geometry: { x: 128, y: 256 },
    });
    expect(restored[0]?.sync.scope).toBe("local-only");
  });

  test("does not upload a pre-login save merely because the user signed in", async () => {
    const store = new DexieLocalDocumentStore(database());
    const repository = new CharacterSaveRepository(store, () => "2026-08-26T08:10:00.000Z");
    let local = structuredClone(fixtureJson) as CharacterSaveDocument;
    await repository.save(local, new Map());

    local = { ...local, characterData: { ...local.characterData, notes: "登录后的本地修改" } };
    const saved = await repository.save(local, new Map(), "account-1");

    expect(saved.sync).toEqual({
      scope: "local-only",
      state: "clean",
      baseRevision: null,
    });
  });

  test("puts a newly created signed-in save into the persistent outbox", async () => {
    const store = new DexieLocalDocumentStore(database());
    const repository = new CharacterSaveRepository(store, () => "2026-08-26T08:10:00.000Z");
    const document = createCharacterSave({
      name: "新人物",
      systemPackage: {
        id: "01a0132c-4eef-7703-94ac-ec8d1a660001",
        version: "1.0.0-alpha.1",
      },
      characterDataVersion: "1.0.0",
      documentId: "01989f4e-7b2c-7000-8000-000000000046",
      now: "2026-08-26T08:09:00.000Z",
    });

    const saved = await repository.save(document, new Map(), "account-1");
    const restored = await repository.list();

    expect(saved.sync).toMatchObject({
      scope: "cloud",
      state: "pending",
      baseRevision: null,
      accountId: "account-1",
    });
    expect(restored[0]?.sync.mutationId).toBe(saved.sync.mutationId);
  });

  test("resource package replacement and removal do not rewrite an existing Character Save", async () => {
    const value = database();
    const store = new DexieLocalDocumentStore(value);
    const characters = new CharacterSaveRepository(store, () => "2026-08-26T08:10:00.000Z");
    const resources = new DexieResourcePackageRepository(value);
    const character = structuredClone(fixtureJson) as CharacterSaveDocument;
    const resourcePackage = structuredClone(weaponPackageJson) as ResourcePackageLogicalDocument;
    resourcePackage.assets = [];
    for (const resource of resourcePackage.resources) resource.media = {};
    await characters.save(character, new Map());
    await resources.replace({ document: resourcePackage, media: new Map() }, "file");

    const replacement = structuredClone(resourcePackage);
    replacement.package.version = "1.0.1";
    replacement.snapshotDigest = `sha256:${"1".repeat(64)}`;
    (replacement.resources[0]!.data as Record<string, unknown>)["名称"] = "已经改变的武器";
    await resources.replace({ document: replacement, media: new Map() }, "file");
    await resources.remove(resourcePackage.package.id);

    const restored = (await new CharacterSaveRepository(store).list())[0]!.document;
    expect(restored.characterData).toEqual(character.characterData);
  });
});
