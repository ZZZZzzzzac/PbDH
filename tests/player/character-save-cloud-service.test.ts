import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import type {
  CloudCredentials,
  CloudDocumentApi,
  RemoteCloudDocument,
} from "@pbdh/cloud-documents";
import type {
  CharacterSaveDocument,
  ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";
import { DexieLocalDocumentStore, PbDHLocalDatabase } from "@pbdh/local-storage";

import characterJson from "../../contracts/conformance/character-save/1.0.0-alpha.1/valid/weapon-and-tabletop.json";
import minotaurJson from "../../contracts/conformance/resource-package/1.0.0-alpha.1/valid/minotaur-wrecker.json";
import { CharacterSaveRepository } from "../../apps/player/src/character-saves/character-save-repository.ts";
import { PlayerCloudDocumentService } from "../../apps/player/src/character-saves/cloud-document-service.ts";

const databases: PbDHLocalDatabase[] = [];
const credentials: CloudCredentials = {
  accessToken: "token",
  siteSessionId: "session",
  accountId: "account-1",
  canWrite: true,
};

function database() {
  const value = new PbDHLocalDatabase(`pbdh-player-cloud-test-${crypto.randomUUID()}`);
  databases.push(value);
  return value;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (value) => {
    value.close();
    await value.delete();
  }));
});

class RecoveryApi implements CloudDocumentApi {
  constructor(
    readonly documents: RemoteCloudDocument[],
    readonly media: ReadonlyMap<string, Uint8Array>,
  ) {}

  async listDocuments(documentKind: RemoteCloudDocument["documentKind"], includeDeleted: boolean) {
    return this.documents.filter((document) => document.documentKind === documentKind
      && (includeDeleted || document.deletedAt === null));
  }

  async getDocument(documentId: string) {
    return structuredClone(this.documents.find((document) => document.documentId === documentId)!);
  }

  async getMedia(_documentId: string, assetId: string) {
    return new Uint8Array(this.media.get(assetId)!);
  }

  async prepareMedia() {}

  async putDocument(): Promise<RemoteCloudDocument> {
    throw new Error("unexpected put");
  }

  async trashDocument(): Promise<RemoteCloudDocument> {
    throw new Error("unexpected trash");
  }

  async restoreDocument(): Promise<RemoteCloudDocument> {
    throw new Error("unexpected restore");
  }
}

describe("Player Character Save cloud recovery", () => {
  test("restores final weapon data, tabletop state and media without a source resource package", async () => {
    const document = structuredClone(characterJson) as CharacterSaveDocument;
    const resourcePackage = minotaurJson as ResourcePackageLogicalDocument;
    const asset = resourcePackage.assets[0]!;
    const bytes = new Uint8Array(readFileSync(path.join(
      process.cwd(),
      "contracts/conformance/resource-package/1.0.0-alpha.1/media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp",
    )));
    document.characterData.assets = [structuredClone(asset)];
    document.characterData.tabletop.instances[0]!.resourceCopy.media = { portrait: asset.id };
    const remote: RemoteCloudDocument = {
      documentId: document.documentId,
      documentKind: "character-save",
      contractFamily: "character-save",
      contractVersion: document.contractVersion,
      revision: 6,
      assetIds: [asset.id],
      payload: document,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      deletedAt: null,
      purgeAfter: null,
    };
    const store = new DexieLocalDocumentStore(database());
    const repository = new CharacterSaveRepository(store);
    const service = new PlayerCloudDocumentService(
      store,
      repository,
      new RecoveryApi([remote], new Map([[asset.id, bytes]])),
    );

    const recovered = await service.recover(credentials);

    expect(recovered[0]?.sync).toMatchObject({
      scope: "cloud",
      state: "clean",
      baseRevision: "6",
      accountId: "account-1",
    });
    expect(recovered[0]?.document.characterData.values["primary-weapon-name"])
      .toContain("长弓");
    expect(recovered[0]?.document.characterData.tabletop.instances[0]).toMatchObject({
      state: { currentHp: "4", currentStress: "2" },
      resourceCopy: {
        data: { 名称: "牛头人破坏者" },
        media: { portrait: asset.id },
      },
    });
    expect(recovered[0]?.media.get(asset.id)).toEqual(bytes);
  });

  test("shows local-only saves plus only the active account's cloud saves", async () => {
    const store = new DexieLocalDocumentStore(database());
    const repository = new CharacterSaveRepository(store);
    const local = structuredClone(characterJson) as CharacterSaveDocument;
    const accountOne = structuredClone(local);
    accountOne.documentId = "01989f4e-7b2c-7000-8000-000000000046";
    accountOne.name = "账号一";
    const accountTwo = structuredClone(local);
    accountTwo.documentId = "01989f4e-7b2c-7000-8000-000000000047";
    accountTwo.name = "账号二";
    await repository.save(local, new Map());
    await repository.save(accountOne, new Map(), "account-1");
    await repository.save(accountTwo, new Map(), "account-2");
    const service = new PlayerCloudDocumentService(
      store,
      repository,
      new RecoveryApi([], new Map()),
    );

    expect((await service.localSnapshot()).map((save) => save.document.name)).toEqual([local.name]);
    expect((await service.localSnapshot("account-1")).map((save) => save.document.name).sort())
      .toEqual([local.name, "账号一"].sort());
    expect((await service.localSnapshot("account-2")).map((save) => save.document.name).sort())
      .toEqual([local.name, "账号二"].sort());
  });
});
