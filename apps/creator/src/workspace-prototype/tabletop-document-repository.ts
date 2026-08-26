import {
  TABLETOP_DOCUMENT_VERSION,
  type TabletopDocument,
  type TabletopDocumentCandidate,
} from "@pbdh/contract-runtime";
import {
  pendingSync,
  type RemoteCloudDocument,
} from "@pbdh/cloud-documents";
import {
  DexieLocalDocumentStore,
  type LocalDocumentEnvelope,
  type LocalMediaAssetRecord,
  type LocalDocumentSync,
} from "@pbdh/local-storage";
import type { TabletopDocumentModel } from "@pbdh/tabletop/core";

import { validateTabletopDocumentCandidate } from "./tabletop-document-validator.ts";

function toContract(
  model: TabletopDocumentModel,
  createdAt: string,
  updatedAt: string,
): TabletopDocument {
  return {
    contractVersion: TABLETOP_DOCUMENT_VERSION,
    documentId: model.id,
    name: model.name,
    createdAt,
    updatedAt,
    instances: model.instances.map((instance) => ({
      instanceId: instance.id,
      resourceCopy: structuredClone(instance.resource),
      state: structuredClone(instance.state),
      geometry: {
        x: instance.position.x,
        y: instance.position.y,
        layer: instance.layer,
        rotation: instance.rotation,
        flipped: instance.flipped,
        scale: instance.scale,
      },
    })),
    assets: structuredClone(model.assets),
  };
}

function toModel(document: TabletopDocument): TabletopDocumentModel {
  return {
    id: document.documentId,
    name: document.name,
    instances: document.instances.map((instance) => ({
      id: instance.instanceId,
      resource: structuredClone(instance.resourceCopy),
      state: structuredClone(instance.state),
      position: { x: instance.geometry.x, y: instance.geometry.y },
      layer: instance.geometry.layer,
      rotation: instance.geometry.rotation,
      flipped: instance.geometry.flipped,
      scale: instance.geometry.scale,
    })),
    assets: structuredClone(document.assets),
  };
}

function mediaRecords(
  document: TabletopDocument,
  media: ReadonlyMap<string, Uint8Array>,
): LocalMediaAssetRecord[] {
  return document.assets.flatMap((asset) => {
    const bytes = media.get(asset.id);
    return bytes ? [{
      assetId: asset.id,
      mediaType: asset.mediaType,
      byteLength: asset.byteLength,
      bytes: new Uint8Array(bytes),
    }] : [];
  });
}

export type StoredTabletopDocument = TabletopDocumentCandidate & {
  model: TabletopDocumentModel;
  sync: LocalDocumentSync;
};

export class TabletopDocumentRepository {
  readonly #store: DexieLocalDocumentStore;
  readonly #now: () => string;

  constructor(
    store = new DexieLocalDocumentStore(),
    now = () => new Date().toISOString(),
  ) {
    this.#store = store;
    this.#now = now;
  }

  async list(): Promise<StoredTabletopDocument[]> {
    const envelopes = await this.#store.list<TabletopDocument>("gm-tabletop-document");
    const results: StoredTabletopDocument[] = [];
    for (const envelope of envelopes) {
      const media = await this.#store.getMedia(envelope.assetIds);
      const diagnostics = await validateTabletopDocumentCandidate(envelope.payload, media);
      if (diagnostics.some((item) => item.severity === "error")) {
        throw new Error(`Invalid stored Tabletop Document: ${diagnostics[0]!.code}`);
      }
      results.push({ document: envelope.payload, media, model: toModel(envelope.payload), sync: envelope.sync });
    }
    return results;
  }

  async save(
    model: TabletopDocumentModel,
    media: ReadonlyMap<string, Uint8Array>,
    cloudAccountId: string | null = null,
  ): Promise<TabletopDocumentCandidate> {
    const existing = await this.#store.get<TabletopDocument>("gm-tabletop-document", model.id);
    const now = this.#now();
    const document = toContract(model, existing?.createdAt ?? now, now);
    const diagnostics = await validateTabletopDocumentCandidate(document, media);
    if (diagnostics.some((item) => item.severity === "error")) {
      throw new Error(`Invalid Tabletop Document: ${diagnostics[0]!.code}`);
    }
    if (existing && sameTabletopContent(existing.payload, document)) {
      return { document: existing.payload, media: new Map(media) };
    }
    const initialSync: LocalDocumentSync = cloudAccountId
      ? { scope: "cloud", state: "clean", baseRevision: null, accountId: cloudAccountId }
      : { scope: "local-only", state: "clean", baseRevision: null };
    await this.#put(document, media, pendingSync(existing?.sync ?? initialSync));
    return { document, media: new Map(media) };
  }

  async import(candidate: TabletopDocumentCandidate, cloudAccountId: string | null = null): Promise<TabletopDocumentModel> {
    const diagnostics = await validateTabletopDocumentCandidate(candidate.document, candidate.media);
    if (diagnostics.some((item) => item.severity === "error")) {
      throw new Error(`Invalid Tabletop Document import: ${diagnostics[0]!.code}`);
    }
    const sync: LocalDocumentSync = cloudAccountId
      ? pendingSync({ scope: "cloud", state: "clean", baseRevision: null, accountId: cloudAccountId })
      : { scope: "local-only", state: "clean", baseRevision: null };
    await this.#put(candidate.document, candidate.media, sync);
    return toModel(candidate.document);
  }

  async restoreRemote(
    remote: RemoteCloudDocument,
    media: ReadonlyMap<string, Uint8Array>,
    accountId: string,
  ): Promise<StoredTabletopDocument> {
    if (remote.documentKind !== "gm-tabletop-document"
      || remote.contractFamily !== "tabletop-document"
      || remote.contractVersion !== TABLETOP_DOCUMENT_VERSION
      || remote.deletedAt !== null) {
      throw new Error("云端 GM 桌面格式无效。");
    }
    const document = remote.payload as TabletopDocument;
    if (document.documentId !== remote.documentId) throw new Error("云端 GM 桌面 Document ID 不一致。");
    const diagnostics = await validateTabletopDocumentCandidate(document, media);
    if (diagnostics.some((item) => item.severity === "error")) {
      throw new Error(`云端 GM 桌面无效：${diagnostics[0]!.code}`);
    }
    const sync: LocalDocumentSync = {
      scope: "cloud",
      state: "clean",
      baseRevision: String(remote.revision),
      accountId,
      mutationId: null,
      lastError: null,
    };
    await this.#put(document, media, sync);
    return { document, media: new Map(media), model: toModel(document), sync };
  }

  async syncState(documentId: string): Promise<LocalDocumentSync | undefined> {
    return (await this.#store.get("gm-tabletop-document", documentId))?.sync;
  }

  async remove(documentId: string): Promise<void> {
    await this.#store.remove("gm-tabletop-document", documentId);
  }

  async #put(
    document: TabletopDocument,
    media: ReadonlyMap<string, Uint8Array>,
    sync: LocalDocumentEnvelope["sync"] = {
      scope: "local-only",
      state: "clean",
      baseRevision: null,
    },
  ): Promise<void> {
    const envelope: LocalDocumentEnvelope<TabletopDocument> = {
      documentId: document.documentId,
      documentKind: "gm-tabletop-document",
      contractFamily: "tabletop-document",
      contractVersion: document.contractVersion,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      assetIds: document.assets.map((asset) => asset.id),
      sync,
      payload: structuredClone(document),
    };
    await this.#store.put(envelope, mediaRecords(document, media));
  }
}

function sameTabletopContent(current: TabletopDocument, next: TabletopDocument): boolean {
  const { updatedAt: _currentUpdatedAt, ...currentContent } = current;
  const { updatedAt: _nextUpdatedAt, ...nextContent } = next;
  return JSON.stringify(currentContent) === JSON.stringify(nextContent);
}
