import Dexie, { type Table } from "dexie";

export type LocalDocumentKind =
  | "creator-workspace"
  | "gm-tabletop-document"
  | "character-save";

type LegacyLocalDocumentKind = LocalDocumentKind | "gm-tabletop-document-trash";

export const LOCAL_TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

export type LocalDocumentSync = {
  scope: "local-only" | "cloud";
  state: "clean" | "pending" | "conflict";
  baseRevision: string | null;
  accountId?: string | null;
  mutationId?: string | null;
  lastError?: string | null;
};

export type LocalDocumentEnvelope<T = unknown> = {
  documentId: string;
  documentKind: LocalDocumentKind;
  contractFamily: string;
  contractVersion: string;
  createdAt: string;
  updatedAt: string;
  /** 缺省表示尚未删除；保留可选字段以兼容既有 IndexedDB 记录。 */
  deletedAt?: string | null;
  /** 本地回收站自动清理时间；缺省表示尚未删除。 */
  purgeAfter?: string | null;
  assetIds: string[];
  sync: LocalDocumentSync;
  payload: T;
};

export type LocalMediaAssetRecord = {
  assetId: string;
  mediaType: "image/webp";
  byteLength: string;
  bytes: Uint8Array;
};

export type InstalledResourcePackageRecord = {
  systemPackageId: string;
  packageId: string;
  snapshotDigest: string;
  version: string;
  installedAt: string;
  source: string;
  document: unknown;
};

type LegacyInstalledResourcePackageRecord = Omit<InstalledResourcePackageRecord, "systemPackageId">;

type AuthorPreviewHandleRecord = {
  id: string;
  handle: unknown;
};

type RuntimeCacheRecord = {
  id: string;
  value: unknown;
};

type LegacyResourceMediaRecord = LocalMediaAssetRecord;

export class PbDHLocalDatabase extends Dexie {
  authorPreviewHandles!: Table<AuthorPreviewHandleRecord, string>;
  installedResourcePackages!: Table<LegacyInstalledResourcePackageRecord, string>;
  installedSystemResourcePackages!: Table<InstalledResourcePackageRecord, [string, string]>;
  localDocuments!: Table<LocalDocumentEnvelope, string>;
  mediaAssets!: Table<LocalMediaAssetRecord, string>;
  runtimeCaches!: Table<RuntimeCacheRecord, string>;

  constructor(name = "pbdh-platform") {
    super(name);
    this.version(1).stores({
      installedResourcePackages: "&packageId, snapshotDigest, version, installedAt",
      resourceMedia: "&assetId, byteLength",
    });
    this.version(2).stores({
      installedResourcePackages: "&packageId, snapshotDigest, version, installedAt",
      resourceMedia: "&assetId, byteLength",
      localDocuments: "&documentId, documentKind, [documentKind+updatedAt], updatedAt",
      mediaAssets: "&assetId, byteLength",
    }).upgrade(async (transaction) => {
      const legacy = await transaction.table<LegacyResourceMediaRecord>("resourceMedia").toArray();
      if (legacy.length > 0) await transaction.table("mediaAssets").bulkPut(legacy);
    });
    this.version(3).stores({
      installedResourcePackages: "&packageId, snapshotDigest, version, installedAt",
      resourceMedia: null,
      localDocuments: "&documentId, documentKind, [documentKind+updatedAt], updatedAt",
      mediaAssets: "&assetId, byteLength",
    });
    this.version(4).stores({
      installedResourcePackages: "&packageId, snapshotDigest, version, installedAt",
      localDocuments: "&documentId, documentKind, [documentKind+updatedAt], updatedAt",
      mediaAssets: "&assetId, byteLength",
      authorPreviewHandles: "&id",
    });
    this.version(5).stores({
      installedResourcePackages: "&packageId, snapshotDigest, version, installedAt",
      localDocuments: "&documentId, documentKind, [documentKind+updatedAt], updatedAt",
      mediaAssets: "&assetId, byteLength",
      authorPreviewHandles: "&id",
      runtimeCaches: "&id",
    });
    this.version(6).stores({
      installedResourcePackages: "&packageId, snapshotDigest, version, installedAt",
      installedSystemResourcePackages: "&[systemPackageId+packageId], systemPackageId, packageId, snapshotDigest, version, installedAt",
      localDocuments: "&documentId, documentKind, [documentKind+updatedAt], updatedAt",
      mediaAssets: "&assetId, byteLength",
      authorPreviewHandles: "&id",
      runtimeCaches: "&id",
    }).upgrade(async (transaction) => {
      const legacyTable = transaction.table("installedResourcePackages");
      const targetTable = transaction.table("installedSystemResourcePackages");
      const legacyRecords = await legacyTable.toArray() as LegacyInstalledResourcePackageRecord[];
      const migrated = legacyRecords.flatMap((record) => {
        const document = record.document as { targets?: Array<{ systemPackageId?: unknown }> };
        const targetIds = [...new Set((document.targets ?? []).flatMap((target) =>
          typeof target.systemPackageId === "string" ? [target.systemPackageId] : []))];
        const systemPackageIds = targetIds.length > 0
          ? targetIds
          : ["01a0132c-4eef-7703-94ac-ec8d1a660001"];
        return systemPackageIds.map((systemPackageId) => ({ ...record, systemPackageId }));
      });
      if (migrated.length > 0) await targetTable.bulkPut(migrated);
      await legacyTable.clear();
    });
    this.version(7).stores({
      installedResourcePackages: "&packageId, snapshotDigest, version, installedAt",
      installedSystemResourcePackages: "&[systemPackageId+packageId], systemPackageId, packageId, snapshotDigest, version, installedAt",
      localDocuments: "&documentId, documentKind, [documentKind+updatedAt], updatedAt, deletedAt, purgeAfter",
      mediaAssets: "&assetId, byteLength",
      authorPreviewHandles: "&id",
      runtimeCaches: "&id",
    }).upgrade(async (transaction) => {
      const table = transaction.table<LocalDocumentEnvelope & { documentKind: LegacyLocalDocumentKind }>("localDocuments");
      const legacyRecords = await table.where("documentKind").equals("gm-tabletop-document-trash").toArray();
      for (const legacy of legacyRecords) {
        const documentId = legacy.documentId.replace(/^gm-tabletop-document-trash:/, "");
        if (await table.get(documentId)) continue;
        const deletedAt = legacy.updatedAt;
        await table.delete(legacy.documentId);
        await table.put({
          ...legacy,
          documentId,
          documentKind: "gm-tabletop-document",
          deletedAt,
          purgeAfter: new Date(Date.parse(deletedAt) + LOCAL_TRASH_RETENTION_MS).toISOString(),
        });
      }
    });
  }
}

export class DexieRuntimeCacheStore<T> {
  readonly #database: PbDHLocalDatabase;

  constructor(database = new PbDHLocalDatabase()) {
    this.#database = database;
  }

  async load(id: string): Promise<T | null> {
    const record = await this.#database.runtimeCaches.get(id);
    return record ? structuredClone(record.value) as T : null;
  }

  async save(id: string, value: T): Promise<void> {
    await this.#database.runtimeCaches.put({ id, value: structuredClone(value) });
  }

  async remove(id: string): Promise<void> {
    await this.#database.runtimeCaches.delete(id);
  }
}

const authorPreviewHandleId = "current-author-preview-directory";

export class DexieAuthorPreviewHandleStore<THandle> {
  readonly #database: PbDHLocalDatabase;

  constructor(database = new PbDHLocalDatabase()) {
    this.#database = database;
  }

  async load(): Promise<THandle | null> {
    const record = await this.#database.authorPreviewHandles.get(authorPreviewHandleId);
    return record ? record.handle as THandle : null;
  }

  async save(handle: THandle): Promise<void> {
    await this.#database.authorPreviewHandles.put({ id: authorPreviewHandleId, handle });
  }
}

function copyMedia(record: LocalMediaAssetRecord): LocalMediaAssetRecord {
  return { ...record, bytes: new Uint8Array(record.bytes) };
}

function installedResourceAssetIds(record: InstalledResourcePackageRecord): string[] {
  const assets = (record.document as { assets?: unknown }).assets;
  if (!Array.isArray(assets)) return [];
  return assets.flatMap((asset) => {
    const id = (asset as { id?: unknown })?.id;
    return typeof id === "string" ? [id] : [];
  });
}

export class DexieLocalDocumentStore {
  readonly #database: PbDHLocalDatabase;

  constructor(database = new PbDHLocalDatabase()) {
    this.#database = database;
  }

  async list<T>(documentKind: LocalDocumentKind): Promise<Array<LocalDocumentEnvelope<T>>> {
    const records = await this.#database.localDocuments
      .where("documentKind")
      .equals(documentKind)
      .sortBy("updatedAt");
    return records
      .filter((record) => !record.deletedAt)
      .reverse()
      .map((record) => structuredClone(record) as LocalDocumentEnvelope<T>);
  }

  async get<T>(
    documentKind: LocalDocumentKind,
    documentId: string,
  ): Promise<LocalDocumentEnvelope<T> | undefined> {
    const record = await this.#database.localDocuments.get(documentId);
    if (!record || record.documentKind !== documentKind || record.deletedAt) return undefined;
    return structuredClone(record) as LocalDocumentEnvelope<T>;
  }

  async updateSync(
    documentKind: LocalDocumentKind,
    documentId: string,
    update: (current: LocalDocumentEnvelope) => LocalDocumentSync | undefined,
  ): Promise<LocalDocumentEnvelope | undefined> {
    return this.#database.transaction("rw", this.#database.localDocuments, async () => {
      const current = await this.#database.localDocuments.get(documentId);
      if (!current || current.documentKind !== documentKind || current.deletedAt) return undefined;
      const sync = update(structuredClone(current));
      if (!sync) return undefined;
      await this.#database.localDocuments.update(documentId, { sync: structuredClone(sync) });
      return structuredClone({ ...current, sync });
    });
  }

  async listTrash<T>(documentKind: LocalDocumentKind): Promise<Array<LocalDocumentEnvelope<T>>> {
    await this.purgeExpiredTrash();
    const records = await this.#database.localDocuments
      .where("documentKind")
      .equals(documentKind)
      .sortBy("deletedAt");
    return records
      .filter((record) => Boolean(record.deletedAt))
      .reverse()
      .map((record) => structuredClone(record) as LocalDocumentEnvelope<T>);
  }

  async getTrash<T>(
    documentKind: LocalDocumentKind,
    documentId: string,
  ): Promise<LocalDocumentEnvelope<T> | undefined> {
    const record = await this.#database.localDocuments.get(documentId);
    if (!record || record.documentKind !== documentKind || !record.deletedAt) return undefined;
    return structuredClone(record) as LocalDocumentEnvelope<T>;
  }

  async put<T>(
    envelope: LocalDocumentEnvelope<T>,
    media: readonly LocalMediaAssetRecord[] = [],
  ): Promise<void> {
    await this.#database.transaction(
      "rw",
      this.#database.localDocuments,
      this.#database.mediaAssets,
      async () => {
        const existing = await this.#database.localDocuments.get(envelope.documentId);
        if (existing?.deletedAt && !envelope.deletedAt) {
          throw new Error("同编号文档仍在回收站，请先恢复或永久删除。");
        }
        if (media.length > 0) await this.#database.mediaAssets.bulkPut(media.map(copyMedia));
        const stored = await this.#database.mediaAssets.bulkGet(envelope.assetIds);
        const missing = envelope.assetIds.filter((_, index) => !stored[index]);
        if (missing.length > 0) throw new Error(`Missing local media: ${missing.join(", ")}`);
        await this.#database.localDocuments.put(structuredClone(envelope));
      },
    );
  }

  async remove(documentKind: LocalDocumentKind, documentId: string): Promise<void> {
    await this.#database.transaction(
      "rw",
      this.#database.installedSystemResourcePackages,
      this.#database.localDocuments,
      this.#database.mediaAssets,
      async () => {
        const record = await this.#database.localDocuments.get(documentId);
        if (record?.documentKind !== documentKind) return;
        await this.#database.localDocuments.delete(documentId);
        await this.#removeUnreferencedMedia(record.assetIds);
      },
    );
  }

  async trash(
    documentKind: LocalDocumentKind,
    documentId: string,
    deletedAt = new Date().toISOString(),
  ): Promise<void> {
    await this.#database.transaction("rw", this.#database.localDocuments, async () => {
      const record = await this.#database.localDocuments.get(documentId);
      if (!record || record.documentKind !== documentKind || record.deletedAt) return;
      await this.#database.localDocuments.put({
        ...record,
        deletedAt,
        purgeAfter: new Date(Date.parse(deletedAt) + LOCAL_TRASH_RETENTION_MS).toISOString(),
      });
    });
  }

  async restore(documentKind: LocalDocumentKind, documentId: string): Promise<void> {
    await this.#database.transaction("rw", this.#database.localDocuments, async () => {
      const record = await this.#database.localDocuments.get(documentId);
      if (!record || record.documentKind !== documentKind || !record.deletedAt) {
        throw new Error("回收站里找不到这个文档。");
      }
      const restored = { ...record };
      delete restored.deletedAt;
      delete restored.purgeAfter;
      await this.#database.localDocuments.put(restored);
    });
  }

  async deletePermanently(documentKind: LocalDocumentKind, documentId: string): Promise<void> {
    await this.#database.transaction(
      "rw",
      this.#database.installedSystemResourcePackages,
      this.#database.localDocuments,
      this.#database.mediaAssets,
      async () => {
        const record = await this.#database.localDocuments.get(documentId);
        if (!record || record.documentKind !== documentKind || !record.deletedAt) {
          throw new Error("只有回收站里的文档可以永久删除。");
        }
        await this.#database.localDocuments.delete(documentId);
        await this.#removeUnreferencedMedia(record.assetIds);
      },
    );
  }

  async purgeExpiredTrash(now = new Date().toISOString()): Promise<number> {
    const expired = (await this.#database.localDocuments.toArray())
      .filter((record) => record.deletedAt && record.purgeAfter && record.purgeAfter <= now);
    for (const record of expired) {
      await this.deletePermanently(record.documentKind, record.documentId);
    }
    return expired.length;
  }

  async replace<T>(
    currentKind: LocalDocumentKind,
    currentDocumentId: string,
    replacement: LocalDocumentEnvelope<T>,
  ): Promise<void> {
    await this.#database.transaction(
      "rw",
      this.#database.localDocuments,
      this.#database.mediaAssets,
      async () => {
        const current = await this.#database.localDocuments.get(currentDocumentId);
        if (!current || current.documentKind !== currentKind) {
          throw new Error(`Local document not found: ${currentDocumentId}`);
        }
        const stored = await this.#database.mediaAssets.bulkGet(replacement.assetIds);
        const missing = replacement.assetIds.filter((_, index) => !stored[index]);
        if (missing.length > 0) throw new Error(`Missing local media: ${missing.join(", ")}`);
        await this.#database.localDocuments.delete(currentDocumentId);
        await this.#database.localDocuments.put(structuredClone(replacement));
      },
    );
  }

  async getMedia(assetIds: readonly string[]): Promise<Map<string, Uint8Array>> {
    const records = await this.#database.mediaAssets.bulkGet([...assetIds]);
    const result = new Map<string, Uint8Array>();
    records.forEach((record) => {
      if (record) result.set(record.assetId, new Uint8Array(record.bytes));
    });
    return result;
  }

  async #removeUnreferencedMedia(candidateAssetIds: readonly string[]): Promise<void> {
    const documents = await this.#database.localDocuments.toArray();
    const packages = await this.#database.installedSystemResourcePackages.toArray();
    const referenced = new Set([
      ...documents.flatMap((record) => record.assetIds),
      ...packages.flatMap(installedResourceAssetIds),
    ]);
    const orphaned = candidateAssetIds.filter((assetId) => !referenced.has(assetId));
    if (orphaned.length > 0) await this.#database.mediaAssets.bulkDelete(orphaned);
  }
}
