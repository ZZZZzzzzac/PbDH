import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import {
  DexieLocalDocumentStore,
  type LocalDocumentEnvelope,
  type LocalMediaAssetRecord,
} from "@pbdh/local-storage";

import {
  createWorkspace,
  type CreatorWorkspace,
  type WorkspaceFolder,
  type WorkspaceResourceLocation,
} from "./workspace-model.ts";

type CreatorWorkspacePayload = {
  version: 1;
  key: string;
  dirty: boolean;
  dirtyResourceIds?: string[];
  /** 兼容修正前“关闭但保留”产生的本地记录。 */
  closed?: boolean;
  document: ResourcePackageLogicalDocument;
  folders: WorkspaceFolder[];
  resourceLocations: WorkspaceResourceLocation[];
  openResourceIds: string[];
  previewResourceId: string | null;
  currentFolderId: string | null;
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
    const envelopes = await this.#store.list<CreatorWorkspacePayload>("creator-workspace");
    const workspaces: CreatorWorkspace[] = [];
    for (const envelope of envelopes) {
      if (envelope.payload.version !== 1) throw new Error("Unsupported stored Creator Workspace version");
      if (envelope.payload.closed) {
        await this.#store.remove("creator-workspace", envelope.documentId);
        continue;
      }
      const media = await this.#store.getMedia(envelope.assetIds);
      workspaces.push(createWorkspace({
        document: envelope.payload.document,
        media,
        folders: envelope.payload.folders,
        resourceLocations: envelope.payload.resourceLocations,
        openResourceIds: envelope.payload.openResourceIds,
        previewResourceId: envelope.payload.previewResourceId,
        currentFolderId: envelope.payload.currentFolderId,
        dirtyResourceIds: envelope.payload.dirtyResourceIds ?? [],
      } as CreatorWorkspace, envelope.payload.dirty));
    }
    return workspaces;
  }

  async save(workspace: CreatorWorkspace): Promise<void> {
    const existing = await this.#store.get<CreatorWorkspacePayload>("creator-workspace", workspace.key);
    const now = this.#now();
    const envelope: LocalDocumentEnvelope<CreatorWorkspacePayload> = {
      documentId: workspace.key,
      documentKind: "creator-workspace",
      contractFamily: "creator-workspace-draft",
      contractVersion: "1",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      assetIds: workspace.document.assets.map((asset) => asset.id),
      sync: existing?.sync ?? { scope: "local-only", state: "clean", baseRevision: null },
      payload: payload(workspace),
    };
    await this.#store.put(envelope, mediaRecords(workspace));
  }

  async remove(workspaceKey: string): Promise<void> {
    await this.#store.remove("creator-workspace", workspaceKey);
  }
}
