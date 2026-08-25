import {
  TABLETOP_DOCUMENT_VERSION,
  type TabletopDocument,
  type TabletopDocumentCandidate,
} from "@pbdh/contract-runtime";
import {
  DexieLocalDocumentStore,
  type LocalDocumentEnvelope,
  type LocalMediaAssetRecord,
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
      results.push({ document: envelope.payload, media, model: toModel(envelope.payload) });
    }
    return results;
  }

  async save(
    model: TabletopDocumentModel,
    media: ReadonlyMap<string, Uint8Array>,
  ): Promise<TabletopDocumentCandidate> {
    const existing = await this.#store.get<TabletopDocument>("gm-tabletop-document", model.id);
    const now = this.#now();
    const document = toContract(model, existing?.createdAt ?? now, now);
    const diagnostics = await validateTabletopDocumentCandidate(document, media);
    if (diagnostics.some((item) => item.severity === "error")) {
      throw new Error(`Invalid Tabletop Document: ${diagnostics[0]!.code}`);
    }
    await this.#put(document, media, existing?.sync);
    return { document, media: new Map(media) };
  }

  async import(candidate: TabletopDocumentCandidate): Promise<TabletopDocumentModel> {
    const diagnostics = await validateTabletopDocumentCandidate(candidate.document, candidate.media);
    if (diagnostics.some((item) => item.severity === "error")) {
      throw new Error(`Invalid Tabletop Document import: ${diagnostics[0]!.code}`);
    }
    await this.#put(candidate.document, candidate.media);
    return toModel(candidate.document);
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
