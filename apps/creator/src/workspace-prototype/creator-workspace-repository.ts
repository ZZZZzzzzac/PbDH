import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import {
  pendingSync,
  type RemoteCloudDocument,
} from "@pbdh/cloud-documents";
import {
  DexieLocalDocumentStore,
  LocalDocumentChangedError,
  type LocalDocumentEnvelope,
  type LocalMediaAssetRecord,
  type LocalDocumentSync,
} from "@pbdh/local-storage";

import {
  createWorkspace,
  type CreatorWorkspace,
  type WorkspaceFolder,
  type WorkspaceResourceLocation,
} from "./workspace-model.ts";
import { validateResourcePackageCandidate } from "./resource-package-validator.ts";

type CreatorWorkspacePayload = {
  version: 1;
  key: string;
  dirty: boolean;
  dirtyResourceIds?: string[];
  document: ResourcePackageLogicalDocument;
  folders: WorkspaceFolder[];
  resourceLocations: WorkspaceResourceLocation[];
  openResourceIds: string[];
  previewResourceId: string | null;
  currentFolderId: string | null;
};

export type StoredCreatorWorkspace = {
  workspace: CreatorWorkspace;
  sync: LocalDocumentSync;
};

export type TrashedCreatorWorkspace = StoredCreatorWorkspace & {
  deletedAt: string;
  purgeAfter: string | null;
};

function payload(workspace: CreatorWorkspace): CreatorWorkspacePayload {
  return {
    version: 1,
    key: workspace.key,
    dirty: workspace.dirty,
    dirtyResourceIds: [...workspace.dirtyResourceIds],
    document: structuredClone(workspace.document),
    folders: structuredClone(workspace.folders),
    resourceLocations: structuredClone(workspace.resourceLocations),
    openResourceIds: [...workspace.openResourceIds],
    previewResourceId: workspace.previewResourceId,
    currentFolderId: workspace.currentFolderId,
  };
}

function mediaRecords(workspace: CreatorWorkspace): LocalMediaAssetRecord[] {
  return workspace.document.assets.flatMap((asset) => {
    const bytes = workspace.media.get(asset.id);
    return bytes ? [{
      assetId: asset.id,
      mediaType: asset.mediaType,
      byteLength: asset.byteLength,
      bytes: new Uint8Array(bytes),
    }] : [];
  });
}

export class CreatorWorkspaceRepository {
  readonly #store: DexieLocalDocumentStore;
  readonly #now: () => string;

  constructor(
    store = new DexieLocalDocumentStore(),
    now = () => new Date().toISOString(),
  ) {
    this.#store = store;
    this.#now = now;
  }

  async list(): Promise<CreatorWorkspace[]> {
    return (await this.listStored()).map((item) => item.workspace);
  }

  async listStored(): Promise<StoredCreatorWorkspace[]> {
    const envelopes = await this.#store.list<CreatorWorkspacePayload>("creator-workspace");
    const workspaces: StoredCreatorWorkspace[] = [];
    for (const envelope of envelopes) {
      if (envelope.payload.version !== 1) throw new Error("Unsupported stored Creator Workspace version");
      const media = await this.#store.getMedia(envelope.assetIds);
      workspaces.push({ workspace: createWorkspace({
        document: envelope.payload.document,
        media,
        folders: envelope.payload.folders,
        resourceLocations: envelope.payload.resourceLocations,
        openResourceIds: envelope.payload.openResourceIds,
        previewResourceId: envelope.payload.previewResourceId,
        currentFolderId: envelope.payload.currentFolderId,
        dirtyResourceIds: envelope.payload.dirtyResourceIds ?? [],
      } as CreatorWorkspace, envelope.payload.dirty), sync: envelope.sync });
    }
    return workspaces;
  }

  async save(
    workspace: CreatorWorkspace,
    cloudAccountId: string | null = null,
    enableExistingCloud = false,
  ): Promise<LocalDocumentSync> {
    return this.#save(workspace, cloudAccountId, enableExistingCloud, false);
  }

  /**
   * 导入云端资源包到本地；与 save 共用保存实现，但允许用新的初始同步替换同编号的回收站记录。
   */
  async saveImported(
    workspace: CreatorWorkspace,
    cloudAccountId: string | null = null,
  ): Promise<LocalDocumentSync> {
    return this.#save(workspace, cloudAccountId, false, true);
  }

  async #save(
    workspace: CreatorWorkspace,
    cloudAccountId: string | null,
    enableExistingCloud: boolean,
    replaceTrash: boolean,
  ): Promise<LocalDocumentSync> {
    const existing = await this.#store.get<CreatorWorkspacePayload>("creator-workspace", workspace.key);
    // 只有导入入口会读取回收站记录来构造 CAS 基准，普通 save 不能复活回收站文档。
    const trashed = replaceTrash
      ? await this.#store.getTrash<CreatorWorkspacePayload>("creator-workspace", workspace.key)
      : undefined;
    const expected: LocalDocumentEnvelope<CreatorWorkspacePayload> | null = existing ?? trashed ?? null;
    const now = this.#now();
    const nextPayload = payload(workspace);
    const assetIds = workspace.document.assets.map((asset) => asset.id);
    const shouldEnableExistingCloud = Boolean(
      existing?.sync.scope === "local-only" && cloudAccountId && enableExistingCloud,
    );
    if (existing && sameContent(existing, nextPayload, assetIds) && !shouldEnableExistingCloud) {
      return existing.sync;
    }
    const initialSync: LocalDocumentSync = cloudAccountId
      ? { scope: "cloud", state: "clean", baseRevision: null, accountId: cloudAccountId }
      : { scope: "local-only", state: "clean", baseRevision: null };
    // 替换回收站记录时沿用新的初始 sync，不继承回收站里的 revision。
    const currentSync = shouldEnableExistingCloud
      ? initialSync
      : existing?.sync ?? initialSync;
    const sync = pendingSync(currentSync);
    const envelope: LocalDocumentEnvelope<CreatorWorkspacePayload> = {
      documentId: workspace.key,
      documentKind: "creator-workspace",
      contractFamily: "creator-workspace-draft",
      contractVersion: "1",
      createdAt: existing?.createdAt ?? trashed?.createdAt ?? now,
      updatedAt: now,
      assetIds,
      sync,
      payload: nextPayload,
    };
    await this.#store.put(envelope, mediaRecords(workspace), { expected, replaceTrash });
    return sync;
  }

  async restoreRemote(
    remote: RemoteCloudDocument,
    media: ReadonlyMap<string, Uint8Array>,
    accountId: string,
    expected?: LocalDocumentEnvelope | null,
  ): Promise<StoredCreatorWorkspace> {
    // 未显式传入下载前快照时，以当前本地记录（含回收站）作为 CAS 基准。
    let baseline: LocalDocumentEnvelope | null;
    if (expected !== undefined) {
      baseline = expected;
    } else {
      const current = await this.#store.get("creator-workspace", remote.documentId);
      baseline = current
        ?? await this.#store.getTrash("creator-workspace", remote.documentId)
        ?? null;
    }
    if (remote.documentKind !== "creator-workspace"
      || remote.contractFamily !== "creator-workspace-draft"
      || remote.contractVersion !== "1"
      || remote.deletedAt !== null
      || !isCreatorWorkspacePayload(remote.payload)
      || remote.payload.key !== remote.documentId
      || remote.payload.document.package.id !== remote.documentId) {
      throw new Error("云端 Creator Workspace 格式无效。");
    }
    const diagnostics = await validateResourcePackageCandidate(remote.payload.document, media);
    if (diagnostics.some((item) => item.severity === "error")) {
      throw new Error(`云端 Creator Workspace 无效：${diagnostics[0]!.code}`);
    }
    const workspace = createWorkspace({
      document: remote.payload.document,
      media: new Map(media),
      folders: remote.payload.folders,
      resourceLocations: remote.payload.resourceLocations,
      openResourceIds: remote.payload.openResourceIds,
      previewResourceId: remote.payload.previewResourceId,
      currentFolderId: remote.payload.currentFolderId,
      dirtyResourceIds: remote.payload.dirtyResourceIds ?? [],
    } as CreatorWorkspace, remote.payload.dirty);
    const sync: LocalDocumentSync = {
      scope: "cloud",
      state: "clean",
      baseRevision: String(remote.revision),
      accountId,
      mutationId: null,
      lastError: null,
    };
    // 恢复远端时不启用 replaceTrash：本地回收站不能被下载结果静默复活。
    await this.#store.put({
      documentId: remote.documentId,
      documentKind: "creator-workspace",
      contractFamily: remote.contractFamily,
      contractVersion: remote.contractVersion,
      createdAt: remote.createdAt,
      updatedAt: remote.updatedAt,
      assetIds: [...remote.assetIds],
      sync,
      payload: structuredClone(remote.payload),
    }, mediaRecords(workspace), { expected: baseline });
    return { workspace, sync };
  }

  async syncState(documentId: string): Promise<LocalDocumentSync | undefined> {
    return (await this.#store.get("creator-workspace", documentId))?.sync;
  }

  async getUnchanged(workspace: CreatorWorkspace): Promise<LocalDocumentEnvelope> {
    const existing = await this.#store.get<CreatorWorkspacePayload>("creator-workspace", workspace.key);
    if (!existing || !sameContent(existing, payload(workspace), workspace.document.assets.map((asset) => asset.id))) {
      throw new LocalDocumentChangedError(workspace.key);
    }
    return existing;
  }

  async trash(workspaceKey: string, expectedWorkspace?: CreatorWorkspace): Promise<void> {
    const existing = await this.#store.get<CreatorWorkspacePayload>("creator-workspace", workspaceKey);
    if (expectedWorkspace && (!existing || !sameContent(existing, payload(expectedWorkspace), expectedWorkspace.document.assets.map((asset) => asset.id)))) {
      throw new LocalDocumentChangedError(workspaceKey);
    }
    await this.#store.trash("creator-workspace", workspaceKey, this.#now(), { expected: existing ?? null });
  }

  async listTrash(): Promise<TrashedCreatorWorkspace[]> {
    const envelopes = await this.#store.listTrash<CreatorWorkspacePayload>("creator-workspace");
    const results: TrashedCreatorWorkspace[] = [];
    for (const envelope of envelopes) {
      if (!isCreatorWorkspacePayload(envelope.payload)) continue;
      const media = await this.#store.getMedia(envelope.assetIds);
      results.push({
        workspace: createWorkspace({
          document: envelope.payload.document,
          media,
          folders: envelope.payload.folders,
          resourceLocations: envelope.payload.resourceLocations,
          openResourceIds: envelope.payload.openResourceIds,
          previewResourceId: envelope.payload.previewResourceId,
          currentFolderId: envelope.payload.currentFolderId,
          dirtyResourceIds: envelope.payload.dirtyResourceIds ?? [],
        } as CreatorWorkspace, envelope.payload.dirty),
        sync: envelope.sync,
        deletedAt: envelope.deletedAt!,
        purgeAfter: envelope.purgeAfter ?? null,
      });
    }
    return results;
  }

  async restore(workspaceKey: string): Promise<StoredCreatorWorkspace> {
    const trashed = (await this.listTrash()).find((item) => item.workspace.key === workspaceKey);
    if (!trashed) throw new Error("回收站里找不到这个资源工作区。");
    await this.#store.restore("creator-workspace", workspaceKey);
    return trashed;
  }

  async deleteFromTrash(workspaceKey: string): Promise<void> {
    await this.#store.deletePermanently("creator-workspace", workspaceKey);
  }
}

function sameContent(
  existing: LocalDocumentEnvelope<CreatorWorkspacePayload>,
  nextPayload: CreatorWorkspacePayload,
  assetIds: string[],
): boolean {
  return JSON.stringify(existing.payload) === JSON.stringify(nextPayload)
    && JSON.stringify(existing.assetIds) === JSON.stringify(assetIds);
}

function isCreatorWorkspacePayload(value: unknown): value is CreatorWorkspacePayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CreatorWorkspacePayload>;
  return candidate.version === 1
    && typeof candidate.key === "string"
    && typeof candidate.dirty === "boolean"
    && Boolean(candidate.document)
    && Array.isArray(candidate.folders)
    && Array.isArray(candidate.resourceLocations)
    && Array.isArray(candidate.openResourceIds)
    && (candidate.previewResourceId === null || typeof candidate.previewResourceId === "string")
    && (candidate.currentFolderId === null || typeof candidate.currentFolderId === "string");
}
