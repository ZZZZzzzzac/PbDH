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

export const gmTabletopBaseCardWidth = 250;

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
    canvas: structuredClone(model.canvas),
    instances: model.instances.map((instance) => ({
      instanceId: instance.id,
      resourceCopy: {
        source: structuredClone(instance.resource.source),
        template: structuredClone(instance.resource.template),
        presentation: {
          mode: instance.resource.presentation.mode,
          fixedRatio: instance.resource.presentation.fixedRatio,
        },
        data: structuredClone(instance.resource.data),
        labels: structuredClone(instance.resource.labels),
        replacements: structuredClone(instance.resource.replacements),
        media: structuredClone(instance.resource.media),
      },
      state: structuredClone(instance.state),
      geometry: {
        x: instance.position.x,
        y: instance.position.y,
        layer: instance.layer,
        rotation: instance.rotation,
        flipped: instance.flipped,
        width: gmTabletopBaseCardWidth * instance.scale,
      },
    })),
    assets: structuredClone(model.assets),
  };
}

function toModel(document: TabletopDocument): TabletopDocumentModel {
  return {
    id: document.documentId,
    name: document.name,
    canvas: structuredClone(document.canvas ?? { width: 2400, height: 1600 }),
    instances: document.instances.map((instance) => ({
      id: instance.instanceId,
      resource: {
        ...structuredClone(instance.resourceCopy),
        presentation: {
          width: instance.resourceCopy.presentation.width ?? "63",
          height: instance.resourceCopy.presentation.height ?? "88",
          unit: instance.resourceCopy.presentation.unit ?? "mm",
          mode: instance.resourceCopy.presentation.mode,
          fixedRatio: instance.resourceCopy.presentation.fixedRatio,
        },
        replacements: structuredClone(instance.resourceCopy.replacements ?? []),
      },
      state: structuredClone(instance.state) as Record<string, string>,
      position: { x: instance.geometry.x, y: instance.geometry.y },
      layer: instance.geometry.layer,
      rotation: instance.geometry.rotation,
      flipped: instance.geometry.flipped,
      scale: instance.geometry.width / gmTabletopBaseCardWidth,
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

export type TrashedTabletopDocument = StoredTabletopDocument & {
  deletedAt: string;
  purgeAfter: string | null;
};

export type TabletopImportConflictResolution = "reject" | "replace" | "copy";
export type TabletopImportDisposition = "new" | "same" | "conflict";

export function duplicateTabletopModel(
  source: TabletopDocumentModel,
  documentId: string,
  instanceIds: readonly string[],
  name = `${source.name} 副本`,
): TabletopDocumentModel {
  if (instanceIds.length !== source.instances.length) {
    throw new Error("复制桌面时，卡片编号数量不正确。");
  }
  const copy = structuredClone(source);
  copy.id = documentId;
  copy.name = name;
  copy.instances.forEach((instance, index) => {
    instance.id = instanceIds[index]!;
  });
  return copy;
}

export class TabletopDocumentRepository {
  readonly #store: DexieLocalDocumentStore;
  readonly #now: () => string;
  readonly #newId: () => string;

  constructor(
    store = new DexieLocalDocumentStore(),
    now = () => new Date().toISOString(),
    newId = () => crypto.randomUUID(),
  ) {
    this.#store = store;
    this.#now = now;
    this.#newId = newId;
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

  async import(
    candidate: TabletopDocumentCandidate,
    cloudAccountId: string | null = null,
    conflictResolution: TabletopImportConflictResolution = "reject",
  ): Promise<TabletopDocumentModel> {
    const diagnostics = await validateTabletopDocumentCandidate(candidate.document, candidate.media);
    if (diagnostics.some((item) => item.severity === "error")) {
      throw new Error(`Invalid Tabletop Document import: ${diagnostics[0]!.code}`);
    }
    const existing = await this.#store.get<TabletopDocument>(
      "gm-tabletop-document",
      candidate.document.documentId,
    );
    if (existing && sameTabletopContent(existing.payload, candidate.document)) {
      return toModel(existing.payload);
    }
    if (existing && conflictResolution === "reject") {
      throw new Error("已有编号相同的桌面，请选择保留副本或覆盖。");
    }
    if (existing && conflictResolution === "copy") {
      return this.duplicate(
        toModel(candidate.document),
        candidate.media,
        cloudAccountId,
      );
    }
    const sync: LocalDocumentSync = cloudAccountId
      ? pendingSync({ scope: "cloud", state: "clean", baseRevision: null, accountId: cloudAccountId })
      : { scope: "local-only", state: "clean", baseRevision: null };
    await this.#put(candidate.document, candidate.media, sync);
    return toModel(candidate.document);
  }

  async importDisposition(candidate: TabletopDocumentCandidate): Promise<TabletopImportDisposition> {
    const diagnostics = await validateTabletopDocumentCandidate(candidate.document, candidate.media);
    if (diagnostics.some((item) => item.severity === "error")) {
      throw new Error(`Invalid Tabletop Document import: ${diagnostics[0]!.code}`);
    }
    const existing = await this.#store.get<TabletopDocument>("gm-tabletop-document", candidate.document.documentId);
    if (!existing) return "new";
    return sameTabletopContent(existing.payload, candidate.document) ? "same" : "conflict";
  }

  async duplicate(
    source: TabletopDocumentModel,
    media: ReadonlyMap<string, Uint8Array>,
    cloudAccountId: string | null = null,
  ): Promise<TabletopDocumentModel> {
    const copy = duplicateTabletopModel(
      source,
      this.#newId(),
      source.instances.map(() => this.#newId()),
    );
    await this.save(copy, media, cloudAccountId);
    return copy;
  }

  async listTrash(): Promise<TrashedTabletopDocument[]> {
    const envelopes = await this.#store.listTrash<TabletopDocument>("gm-tabletop-document");
    const results: TrashedTabletopDocument[] = [];
    for (const envelope of envelopes) {
      const media = await this.#store.getMedia(envelope.assetIds);
      const diagnostics = await validateTabletopDocumentCandidate(envelope.payload, media);
      if (diagnostics.some((item) => item.severity === "error")) {
        throw new Error(`Invalid trashed Tabletop Document: ${diagnostics[0]!.code}`);
      }
      results.push({
        document: envelope.payload,
        media,
        model: toModel(envelope.payload),
        sync: envelope.sync,
        deletedAt: envelope.deletedAt!,
        purgeAfter: envelope.purgeAfter ?? null,
      });
    }
    return results;
  }

  async trash(documentId: string): Promise<void> {
    await this.#store.trash("gm-tabletop-document", documentId, this.#now());
  }

  async restore(documentId: string): Promise<StoredTabletopDocument> {
    const trashed = await this.#store.getTrash<TabletopDocument>("gm-tabletop-document", documentId);
    if (!trashed) throw new Error("回收站里找不到这个桌面。");
    await this.#store.restore("gm-tabletop-document", documentId);
    const media = await this.#store.getMedia(trashed.assetIds);
    return {
      document: trashed.payload,
      media,
      model: toModel(trashed.payload),
      sync: trashed.sync,
    };
  }

  async deleteFromTrash(documentId: string): Promise<void> {
    await this.#store.deletePermanently("gm-tabletop-document", documentId);
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
  const normalize = (document: TabletopDocument) => {
    const { updatedAt: _updatedAt, ...content } = document;
    return {
      ...content,
      canvas: content.canvas ?? { width: 2400, height: 1600 },
      instances: content.instances.map((instance) => ({
        ...instance,
        resourceCopy: {
          ...instance.resourceCopy,
          replacements: instance.resourceCopy.replacements ?? [],
        },
      })),
    };
  };
  return stableJson(normalize(current)) === stableJson(normalize(next));
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
