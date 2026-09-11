import "fake-indexeddb/auto";

import { afterEach, describe, expect, test, vi } from "vitest";

import type {
  CloudCredentials,
  CloudDocumentApi,
  RemoteCloudDocument,
} from "@pbdh/cloud-documents";
import type {
  CharacterSaveDocument,
} from "@pbdh/contract-runtime";
import { DexieLocalDocumentStore, PbDHLocalDatabase } from "@pbdh/local-storage";

import characterJson from "../../contracts/conformance/character-save/1.0.0/valid/module-state.json";
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
  readonly deleted: Array<{ documentId: string; baseRevision: number }> = [];
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

  async deleteDocument(documentId: string, baseRevision: number): Promise<void> {
    this.deleted.push({ documentId, baseRevision });
  }
}

describe("Player Character Save cloud recovery", () => {
  test("云端删除后的恢复扫描保留未同步本地内容，恢复后不自动上传", async () => {
    const store = new DexieLocalDocumentStore(database());
    const repository = new CharacterSaveRepository(store);
    const document = structuredClone(characterJson) as CharacterSaveDocument;
    await repository.save(document, new Map(), credentials.accountId);
    await store.updateSync("character-save", document.documentId, (local) => ({ ...local.sync, state: "conflict", baseRevision: "1" }));
    const local = (await store.get("character-save", document.documentId))!;
    const api = new RecoveryApi([{ ...local, revision: 3, deletedAt: new Date().toISOString(), purgeAfter: null }], new Map());
    const put = vi.spyOn(api, "putDocument");
    const service = new PlayerCloudDocumentService(store, repository, api);
    expect(await service.recover(credentials)).toEqual([]);
    expect((await store.getTrash("character-save", document.documentId))?.payload).toEqual(local.payload);
    await repository.restore(document.documentId);
    await service.recover(credentials);
    expect((await store.get("character-save", document.documentId))?.sync.scope).toBe("local-only");
    expect(put).not.toHaveBeenCalled();
  });

  test("moves a signed-in save to local trash when its first cloud upload has not succeeded", async () => {
    const store = new DexieLocalDocumentStore(database());
    const repository = new CharacterSaveRepository(store);
    const document = structuredClone(characterJson) as CharacterSaveDocument;
    await repository.save(document, new Map(), credentials.accountId);
    const service = new PlayerCloudDocumentService(
      store,
      repository,
      new RecoveryApi([], new Map()),
    );

    await service.trash(document.documentId, credentials);

    expect(await repository.list()).toEqual([]);
    expect(await repository.listTrashMetadata()).toMatchObject([{
      document: { documentId: document.documentId },
      sync: { scope: "local-only", state: "clean", baseRevision: null },
    }]);
  });

  test("restores final weapon data and tabletop Resource Copy without a source resource package", async () => {
    const document = structuredClone(characterJson) as CharacterSaveDocument;
    const remote: RemoteCloudDocument = {
      documentId: document.documentId,
      documentKind: "character-save",
      contractFamily: "character-save",
      contractVersion: document.contractVersion,
      revision: 6,
      assetIds: [],
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
      new RecoveryApi([remote], new Map()),
    );

    const recovered = await service.recover(credentials);

    expect(recovered[0]?.sync).toMatchObject({
      scope: "cloud",
      state: "clean",
      baseRevision: "6",
      accountId: "account-1",
    });
    expect(recovered[0]?.document.characterData["primary-weapon-name"])
      .toContain("长弓");
    expect((recovered[0]?.document.characterData["character-card-table"] as { instances: unknown[] }).instances[0]).toMatchObject({
      state: { value: "配置", indicators: "[]" },
      resourceCopy: {
        data: { 名称: "牛头人破坏者" },
      },
    });
    expect(recovered[0]?.media.size).toBe(0);
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

  test("does not persist a cloud save rejected by target System Package module validation", async () => {
    const document = structuredClone(characterJson) as CharacterSaveDocument;
    const remote: RemoteCloudDocument = {
      documentId: document.documentId,
      documentKind: "character-save",
      contractFamily: "character-save",
      contractVersion: document.contractVersion,
      revision: 1,
      assetIds: [],
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
      new RecoveryApi([remote], new Map()),
      () => { throw new Error("Module 状态无效"); },
    );

    await expect(service.recover(credentials)).rejects.toThrow("Module 状态无效");
    expect(await repository.list()).toEqual([]);
  });

  test("缺少目标系统包时保留云端人物供稍后匹配，不运行人物数据校验", async () => {
    const document = structuredClone(characterJson) as CharacterSaveDocument;
    document.systemPackage = {
      id: "01989f4e-7b2c-7000-8000-000000000099",
      version: "1.0.0",
    };
    const remote: RemoteCloudDocument = {
      documentId: document.documentId,
      documentKind: "character-save",
      contractFamily: "character-save",
      contractVersion: document.contractVersion,
      revision: 2,
      assetIds: [],
      payload: document,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      deletedAt: null,
      purgeAfter: null,
    };
    const store = new DexieLocalDocumentStore(database());
    const repository = new CharacterSaveRepository(store);
    let moduleValidationRuns = 0;
    const service = new PlayerCloudDocumentService(
      store,
      repository,
      new RecoveryApi([remote], new Map()),
      (candidate) => {
        if (candidate.document.systemPackage.id === document.systemPackage.id) return;
        moduleValidationRuns += 1;
      },
    );

    const recovered = await service.recover(credentials);

    expect(moduleValidationRuns).toBe(0);
    expect(recovered).toMatchObject([{
      document: { documentId: document.documentId, systemPackage: document.systemPackage },
      sync: { scope: "cloud", state: "clean", accountId: credentials.accountId },
    }]);
  });

  test("permanently deletes only a Character Save that is already in cloud trash", async () => {
    const document = structuredClone(characterJson) as CharacterSaveDocument;
    const remote: RemoteCloudDocument = {
      documentId: document.documentId,
      documentKind: "character-save",
      contractFamily: "character-save",
      contractVersion: document.contractVersion,
      revision: 4,
      assetIds: [],
      payload: document,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      deletedAt: "2026-08-28T00:00:00.000Z",
      purgeAfter: "2026-09-27T00:00:00.000Z",
    };
    const store = new DexieLocalDocumentStore(database());
    const api = new RecoveryApi([remote], new Map());
    const service = new PlayerCloudDocumentService(store, new CharacterSaveRepository(store), api);

    await service.deleteFromTrash(remote, credentials);
    expect(api.deleted).toEqual([{ documentId: remote.documentId, baseRevision: 4 }]);
    await expect(service.deleteFromTrash({ ...remote, deletedAt: null }, credentials))
      .rejects.toThrow("只有回收站里的人物存档可以永久删除");
  });
});
