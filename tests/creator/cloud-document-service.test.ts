import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import type {
  CloudCredentials,
  CloudDocumentApi,
  RemoteCloudDocument,
} from "@pbdh/cloud-documents";
import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import { DexieLocalDocumentStore, PbDHLocalDatabase } from "@pbdh/local-storage";
import {
  createTabletopDocument,
  executeTabletopCommand,
  type TabletopCapability,
} from "@pbdh/tabletop/core";

import minotaurPackage from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import { CreatorCloudDocumentService } from "../../apps/creator/src/workspace-prototype/cloud-document-service.ts";
import { CreatorWorkspaceRepository } from "../../apps/creator/src/workspace-prototype/creator-workspace-repository.ts";
import { TabletopDocumentRepository } from "../../apps/creator/src/workspace-prototype/tabletop-document-repository.ts";
import { createBlankWorkspace, createWorkspace } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";

const databases: PbDHLocalDatabase[] = [];
const credentials: CloudCredentials = {
  accessToken: "token",
  siteSessionId: "session",
  accountId: "account-1",
  canWrite: true,
};

function database() {
  const value = new PbDHLocalDatabase(`pbdh-cloud-recovery-test-${crypto.randomUUID()}`);
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

  async deleteDocument(): Promise<void> {
    throw new Error("unexpected delete");
  }
}

test("同步回执只刷新同步状态，不重读文档媒体或重新恢复文档", async () => {
  const store = new DexieLocalDocumentStore(database());
  const workspaceRepository = new CreatorWorkspaceRepository(store);
  const tabletopRepository = new TabletopDocumentRepository(store);
  const service = new CreatorCloudDocumentService(store, workspaceRepository, tabletopRepository, new RecoveryApi([], new Map()));
  const id = crypto.randomUUID();
  await store.put({ documentId: id, documentKind: "gm-tabletop-document", contractFamily: "tabletop-document", contractVersion: "1.0.0",
    createdAt: "2026-09-09T00:00:00.000Z", updatedAt: "2026-09-09T00:00:00.000Z", assetIds: [],
    sync: { scope: "cloud", state: "clean", baseRevision: "1", accountId: credentials.accountId }, payload: { unread: true } });
  const workspaces = vi.spyOn(workspaceRepository, "listStored");
  const tabletops = vi.spyOn(tabletopRepository, "list");
  const media = vi.spyOn(store, "getMedia");
  try {
    const snapshot = await service.flush("creator-workspace", credentials);
    expect(snapshot.tabletopSync.get(id)?.baseRevision).toBe("1");
    expect(workspaces).not.toHaveBeenCalled();
    expect(tabletops).not.toHaveBeenCalled();
    expect(media).not.toHaveBeenCalled();
  } finally { vi.restoreAllMocks(); }
});

describe("Creator and GM cloud recovery", () => {
  test("首次上传途中删除会等待回执，再删除云端文档，后台 flush 不会重建它", async () => {
    const store = new DexieLocalDocumentStore(database());
    const repository = new CreatorWorkspaceRepository(store);
    const workspace = await createBlankWorkspace("上传中的资源包");
    await repository.save(workspace, credentials.accountId);
    const local = (await store.get("creator-workspace", workspace.key))!;
    const remote: RemoteCloudDocument = { ...local, revision: 1, deletedAt: null, purgeAfter: null };
    const api = new RecoveryApi([remote], new Map());
    let complete!: (value: RemoteCloudDocument) => void;
    let started!: () => void;
    const uploading = new Promise<void>((resolve) => { started = resolve; });
    const put = vi.spyOn(api, "putDocument").mockImplementation(() => {
      started(); return new Promise((resolve) => { complete = resolve; });
    });
    const trash = vi.spyOn(api, "trashDocument").mockResolvedValue({ ...remote, deletedAt: new Date().toISOString() });
    const service = new CreatorCloudDocumentService(store, repository, new TabletopDocumentRepository(store), api);
    const flush = service.flush("creator-workspace", credentials);
    await uploading;
    const deletion = service.trash("creator-workspace", workspace.key, credentials);
    await service.flush("creator-workspace", credentials);
    expect(trash).not.toHaveBeenCalled();
    complete(remote);
    await Promise.all([flush, deletion]);
    await service.flush("creator-workspace", credentials);
    expect(put).toHaveBeenCalledTimes(1);
    expect(trash).toHaveBeenCalledWith(workspace.key, expect.any(String), 1, credentials);
    expect((await store.getTrash("creator-workspace", workspace.key))?.sync.scope).toBe("local-only");
  });

  test("冲突工作区可以直接删除，保留本地内容且不先上传", async () => {
    const store = new DexieLocalDocumentStore(database());
    const repository = new CreatorWorkspaceRepository(store);
    const workspace = await createBlankWorkspace("冲突资源包");
    await repository.save(workspace, credentials.accountId);
    await store.updateSync("creator-workspace", workspace.key, (local) => ({
      ...local.sync, state: "conflict", baseRevision: "1",
    }));
    const local = (await store.get("creator-workspace", workspace.key))!;
    const remote: RemoteCloudDocument = { ...local, revision: 3, deletedAt: null, purgeAfter: null };
    const api = new RecoveryApi([remote], new Map());
    const put = vi.spyOn(api, "putDocument");
    const trash = vi.spyOn(api, "trashDocument").mockResolvedValue({ ...remote, deletedAt: new Date().toISOString() });
    const service = new CreatorCloudDocumentService(store, repository, new TabletopDocumentRepository(store), api);

    await service.trash("creator-workspace", workspace.key, credentials);

    expect(trash).toHaveBeenCalledWith(workspace.key, expect.any(String), 3, credentials);
    expect(put).not.toHaveBeenCalled();
    expect(await repository.list()).toEqual([]);
    expect(await store.getTrash("creator-workspace", workspace.key)).toMatchObject({
      payload: local.payload, sync: { scope: "local-only", state: "clean", baseRevision: null },
    });
    await service.recover(credentials);
    expect(await store.getTrash("creator-workspace", workspace.key)).toBeDefined();
    await repository.restore(workspace.key);
    expect((await repository.list())[0]?.key).toBe(workspace.key);
  });

  test("closes a signed-in workspace locally when its first cloud upload has not succeeded", async () => {
    const store = new DexieLocalDocumentStore(database());
    const workspaceRepository = new CreatorWorkspaceRepository(store);
    const tabletopRepository = new TabletopDocumentRepository(store);
    const workspace = await createBlankWorkspace("匕首之心官方资源");
    await workspaceRepository.save(workspace, credentials.accountId);
    const api = new RecoveryApi([], new Map());
    const service = new CreatorCloudDocumentService(
      store,
      workspaceRepository,
      tabletopRepository,
      api,
    );

    await service.trash("creator-workspace", workspace.key, credentials);

    expect(await workspaceRepository.list()).toEqual([]);
    expect(await workspaceRepository.listTrash()).toMatchObject([{
      workspace: { key: workspace.key },
      sync: { scope: "local-only", state: "clean", baseRevision: null },
    }]);
  });

  test("restores a real workspace media and an independent tabletop instance", async () => {
    const sourceStore = new DexieLocalDocumentStore(database());
    const sourceWorkspaceRepository = new CreatorWorkspaceRepository(sourceStore);
    const sourceTabletopRepository = new TabletopDocumentRepository(sourceStore);
    const packageDocument = minotaurPackage as ResourcePackageLogicalDocument;
    const asset = packageDocument.assets[0]!;
    const bytes = new Uint8Array(readFileSync(path.join(
      process.cwd(),
      "contracts/conformance/resource-package/1.0.0/media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp",
    )));
    const workspace = createWorkspace({ document: packageDocument, media: new Map([[asset.id, bytes]]) });
    await sourceWorkspaceRepository.save(workspace);
    const workspaceEnvelope = await sourceStore.get("creator-workspace", workspace.key);

    const capabilities = new Set<TabletopCapability>(["place"]);
    const emptyTabletop = createTabletopDocument("01989f4e-7b2c-7000-8000-000000000041", "陨落神殿");
    const tabletop = executeTabletopCommand(emptyTabletop, {
      type: "place",
      instanceId: "01989f4e-7b2c-7000-8000-000000000042",
      resource: {
        source: { packageId: workspace.key, resourceId: packageDocument.resources[0]!.id },
        template: structuredClone(packageDocument.resources[0]!.template),
        presentation: structuredClone(packageDocument.resources[0]!.presentation),
        data: structuredClone(packageDocument.resources[0]!.data) as Record<string, unknown>,
        labels: [],
        replacements: [],
        media: structuredClone(packageDocument.resources[0]!.media),
      },
      state: { currentHp: "4", currentStress: "2", focused: "false", notes: "" },
      position: { x: 128, y: 256 },
    }, { capabilities }).document;
    tabletop.assets = structuredClone(packageDocument.assets);
    const tabletopCandidate = await sourceTabletopRepository.save(tabletop, new Map([[asset.id, bytes]]));

    const remotes: RemoteCloudDocument[] = [
      {
        documentId: workspace.key,
        documentKind: "creator-workspace",
        contractFamily: workspaceEnvelope!.contractFamily,
        contractVersion: workspaceEnvelope!.contractVersion,
        revision: 3,
        assetIds: [...workspaceEnvelope!.assetIds],
        payload: structuredClone(workspaceEnvelope!.payload),
        createdAt: workspaceEnvelope!.createdAt,
        updatedAt: workspaceEnvelope!.updatedAt,
        deletedAt: null,
        purgeAfter: null,
      },
      {
        documentId: tabletop.id,
        documentKind: "gm-tabletop-document",
        contractFamily: "tabletop-document",
        contractVersion: tabletopCandidate.document.contractVersion,
        revision: 8,
        assetIds: [asset.id],
        payload: structuredClone(tabletopCandidate.document),
        createdAt: tabletopCandidate.document.createdAt,
        updatedAt: tabletopCandidate.document.updatedAt,
        deletedAt: null,
        purgeAfter: null,
      },
    ];

    const targetStore = new DexieLocalDocumentStore(database());
    const targetWorkspaceRepository = new CreatorWorkspaceRepository(targetStore);
    const targetTabletopRepository = new TabletopDocumentRepository(targetStore);
    const service = new CreatorCloudDocumentService(
      targetStore,
      targetWorkspaceRepository,
      targetTabletopRepository,
      new RecoveryApi(remotes, new Map([[asset.id, bytes]])),
    );

    const recovered = await service.recover(credentials);

    expect(recovered.workspaces[0]?.sync.baseRevision).toBe("3");
    expect(recovered.workspaces[0]?.sync.accountId).toBe("account-1");
    expect(recovered.workspaces[0]?.workspace.media.get(asset.id)).toEqual(bytes);
    expect(recovered.tabletops[0]?.sync.baseRevision).toBe("8");
    expect(recovered.tabletops[0]?.sync.accountId).toBe("account-1");
    expect(recovered.tabletops[0]?.model.instances[0]).toMatchObject({
      state: { currentHp: "4", currentStress: "2", focused: "false", notes: "" },
      position: { x: 128, y: 256 },
    });
    expect(recovered.tabletops[0]?.media.get(asset.id)).toEqual(bytes);

    const tabletopOnlyStore = new DexieLocalDocumentStore(database());
    const tabletopOnlyService = new CreatorCloudDocumentService(
      tabletopOnlyStore,
      new CreatorWorkspaceRepository(tabletopOnlyStore),
      new TabletopDocumentRepository(tabletopOnlyStore),
      new RecoveryApi(remotes.filter((remote) => remote.documentKind === "gm-tabletop-document"), new Map([[asset.id, bytes]])),
    );
    const tabletopOnlyRecovery = await tabletopOnlyService.recover(credentials);
    expect(tabletopOnlyRecovery.workspaces).toEqual([]);
    expect(tabletopOnlyRecovery.tabletops[0]?.model.instances[0]?.resource).toMatchObject({
      source: { packageId: workspace.key, resourceId: packageDocument.resources[0]!.id },
      data: { 名称: "牛头人破坏者" },
      media: { portrait: asset.id },
    });
    expect(tabletopOnlyRecovery.tabletops[0]?.media.get(asset.id)).toEqual(bytes);
  });
});
