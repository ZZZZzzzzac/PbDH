import {
  CloudDocumentCoordinator,
  HttpCloudDocumentApi,
  type CloudCredentials,
  type CloudDocumentApi,
  type RemoteCloudDocument,
} from "@pbdh/cloud-documents";
import {
  DexieLocalDocumentStore,
  type LocalDocumentKind,
} from "@pbdh/local-storage";

import {
  CreatorWorkspaceRepository,
  type StoredCreatorWorkspace,
} from "./creator-workspace-repository.ts";
import {
  TabletopDocumentRepository,
  type StoredTabletopDocument,
} from "./tabletop-document-repository.ts";

export type CreatorCloudRecovery = {
  workspaces: StoredCreatorWorkspace[];
  tabletops: StoredTabletopDocument[];
};

export class CreatorCloudDocumentService {
  readonly #store: DexieLocalDocumentStore;
  readonly #api: CloudDocumentApi;
  readonly #coordinator: CloudDocumentCoordinator;
  readonly #workspaceRepository: CreatorWorkspaceRepository;
  readonly #tabletopRepository: TabletopDocumentRepository;

  constructor(
    store: DexieLocalDocumentStore,
    workspaceRepository: CreatorWorkspaceRepository,
    tabletopRepository: TabletopDocumentRepository,
    api: CloudDocumentApi = new HttpCloudDocumentApi(),
  ) {
    this.#store = store;
    this.#workspaceRepository = workspaceRepository;
    this.#tabletopRepository = tabletopRepository;
    this.#api = api;
    this.#coordinator = new CloudDocumentCoordinator(store, api);
  }

  async recover(credentials: CloudCredentials): Promise<CreatorCloudRecovery> {
    await Promise.all([
      this.#recoverKind("creator-workspace", credentials),
      this.#recoverKind("gm-tabletop-document", credentials),
    ]);
    await Promise.all([
      this.#coordinator.flush("creator-workspace", credentials),
      this.#coordinator.flush("gm-tabletop-document", credentials),
    ]);
    return this.localSnapshot(credentials.accountId);
  }

  async localSnapshot(accountId: string): Promise<CreatorCloudRecovery> {
    const [workspaces, tabletops] = await Promise.all([
      this.#workspaceRepository.listStored(),
      this.#tabletopRepository.list(),
    ]);
    return {
      workspaces: workspaces.filter((item) => visibleToAccount(item.sync, accountId)),
      tabletops: tabletops.filter((item) => visibleToAccount(item.sync, accountId)),
    };
  }

  async enable(
    documentKind: Extract<LocalDocumentKind, "creator-workspace" | "gm-tabletop-document">,
    documentId: string,
    credentials: CloudCredentials,
  ): Promise<CreatorCloudRecovery> {
    await this.#coordinator.enableCloud(documentKind, documentId, credentials);
    await this.#coordinator.flush(documentKind, credentials);
    return this.localSnapshot(credentials.accountId);
  }

  async flush(
    documentKind: Extract<LocalDocumentKind, "creator-workspace" | "gm-tabletop-document">,
    credentials: CloudCredentials,
  ): Promise<CreatorCloudRecovery> {
    await this.#coordinator.flush(documentKind, credentials);
    return this.localSnapshot(credentials.accountId);
  }

  async overwriteWithLocal(
    documentKind: Extract<LocalDocumentKind, "creator-workspace" | "gm-tabletop-document">,
    documentId: string,
    credentials: CloudCredentials,
  ): Promise<CreatorCloudRecovery> {
    await this.#coordinator.overwriteWithLocal(documentKind, documentId, credentials);
    return this.localSnapshot(credentials.accountId);
  }

  async keepCloud(
    documentKind: Extract<LocalDocumentKind, "creator-workspace" | "gm-tabletop-document">,
    documentId: string,
    credentials: CloudCredentials,
  ): Promise<CreatorCloudRecovery> {
    const remote = await this.#api.getDocument(documentId, credentials);
    if (remote.documentKind !== documentKind || remote.deletedAt !== null) {
      throw new Error("云端文档当前不可恢复。");
    }
    await this.#restoreRemote(remote, credentials);
    return this.localSnapshot(credentials.accountId);
  }

  async trash(
    documentKind: Extract<LocalDocumentKind, "creator-workspace" | "gm-tabletop-document">,
    documentId: string,
    credentials: CloudCredentials,
  ): Promise<CreatorCloudRecovery> {
    let local = await this.#store.get(documentKind, documentId);
    if (!local) throw new Error("没有找到要移入回收站的本地文档。");
    if (local.sync.scope !== "cloud") {
      await this.#store.remove(documentKind, documentId);
      return this.localSnapshot(credentials.accountId);
    }
    await this.#coordinator.flush(documentKind, credentials);
    local = await this.#store.get(documentKind, documentId);
    if (!local || local.sync.state !== "clean" || local.sync.baseRevision === null) {
      throw new Error("文档尚未完成同步，暂时不能移到云端回收站。");
    }
    await this.#api.trashDocument(
      documentId,
      crypto.randomUUID(),
      revisionNumber(local.sync.baseRevision),
      credentials,
    );
    await this.#store.remove(documentKind, documentId);
    return this.localSnapshot(credentials.accountId);
  }

  async listTrash(credentials: CloudCredentials): Promise<RemoteCloudDocument[]> {
    const documents = await Promise.all([
      this.#api.listDocuments("creator-workspace", true, credentials),
      this.#api.listDocuments("gm-tabletop-document", true, credentials),
    ]);
    return documents.flat().filter((document) => document.deletedAt !== null);
  }

  async restoreFromTrash(
    remote: RemoteCloudDocument,
    credentials: CloudCredentials,
  ): Promise<CreatorCloudRecovery> {
    const local = await this.#store.get(remote.documentKind, remote.documentId);
    if (local && (local.sync.scope === "local-only" || local.sync.accountId !== credentials.accountId)) {
      throw new Error("本地已有同 ID 文档，不能直接恢复云端版本。");
    }
    const restored = await this.#api.restoreDocument(
      remote.documentId,
      crypto.randomUUID(),
      remote.revision,
      credentials,
    );
    await this.#restoreRemote(restored, credentials);
    return this.localSnapshot(credentials.accountId);
  }

  async deleteFromTrash(
    remote: RemoteCloudDocument,
    credentials: CloudCredentials,
  ): Promise<void> {
    if (remote.deletedAt === null) throw new Error("只有回收站里的云文档可以永久删除。");
    await this.#api.deleteDocument(remote.documentId, remote.revision, credentials);
  }

  async #recoverKind(
    documentKind: Extract<LocalDocumentKind, "creator-workspace" | "gm-tabletop-document">,
    credentials: CloudCredentials,
  ): Promise<void> {
    const remotes = await this.#api.listDocuments(documentKind, true, credentials);
    for (const remote of remotes) {
      const local = await this.#store.get(documentKind, remote.documentId);
      if (remote.deletedAt !== null) {
        if (local?.sync.scope === "cloud" && local.sync.accountId === credentials.accountId) {
          await this.#store.remove(documentKind, remote.documentId);
        }
        continue;
      }
      if (!local) {
        await this.#restoreRemote(remote, credentials);
        continue;
      }
      if (local.sync.scope !== "cloud"
        || local.sync.accountId !== credentials.accountId
        || local.sync.state !== "clean") continue;
      const localRevision = local.sync.baseRevision === null ? 0 : revisionNumber(local.sync.baseRevision);
      if (remote.revision > localRevision) await this.#restoreRemote(remote, credentials);
    }
  }

  async #restoreRemote(
    remote: RemoteCloudDocument,
    credentials: CloudCredentials,
  ): Promise<void> {
    const media = new Map<string, Uint8Array>();
    for (const assetId of remote.assetIds) {
      media.set(assetId, await this.#api.getMedia(remote.documentId, assetId, credentials));
    }
    if (remote.documentKind === "creator-workspace") {
      await this.#workspaceRepository.restoreRemote(remote, media, credentials.accountId);
      return;
    }
    if (remote.documentKind === "gm-tabletop-document") {
      await this.#tabletopRepository.restoreRemote(remote, media, credentials.accountId);
      return;
    }
    throw new Error("Creator 无法恢复该云文档类型。");
  }
}

function revisionNumber(revision: string): number {
  const parsed = Number(revision);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error("无效的云文档 revision。");
  return parsed;
}

function visibleToAccount(sync: { scope: "local-only" | "cloud"; accountId?: string | null }, accountId: string) {
  return sync.scope === "local-only" || sync.accountId === accountId;
}
