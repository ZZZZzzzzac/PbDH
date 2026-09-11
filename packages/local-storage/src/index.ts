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

class LocalTrashReadError extends Error {
  constructor(readonly stage: "cleanup" | "list", cause: unknown) {
    super(stage === "cleanup" ? "本机回收站过期清理失败" : "本机回收站列表读取失败", { cause });
    this.name = "LocalTrashReadError";
  }
}

/** 事务内比较完整信封时的并发冲突错误，调用方据此放弃本次写入。 */
export class LocalDocumentChangedError extends Error {
  constructor(readonly documentId?: string) {
    super(documentId
      ? `本地文档「${documentId}」已被其他操作更新，本次操作已停止；请先导出当前内容备份。`
      : "本地文档已被其他操作更新，本次操作已停止；请先导出当前内容备份。");
    this.name = "LocalDocumentChangedError";
  }
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const record = item as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]));
  });
}

/** 比较“当前信封（不存在视为 null）”与期望信封的 JSON 结构。 */
function sameEnvelopeJson(
  current: LocalDocumentEnvelope | null,
  expected: LocalDocumentEnvelope | null,
): boolean {
  if (current === null || expected === null) return current === expected;
  return canonicalJson(current) === canonicalJson(expected);
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
    try {
      await this.purgeExpiredTrash();
    } catch (cause) {
      throw new LocalTrashReadError("cleanup", cause);
    }
    try {
      const records = await this.#database.localDocuments
        .where("documentKind")
        .equals(documentKind)
        .sortBy("deletedAt");
      return records
        .filter((record) => Boolean(record.deletedAt))
        .reverse()
        .map((record) => structuredClone(record) as LocalDocumentEnvelope<T>);
    } catch (cause) {
      throw new LocalTrashReadError("list", cause);
    }
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
    options: { replaceTrash?: boolean; expected?: LocalDocumentEnvelope | null } = {},
  ): Promise<void> {
    await this.#database.transaction(
      "rw",
      this.#database.installedSystemResourcePackages,
      this.#database.localDocuments,
      this.#database.mediaAssets,
      async () => {
        const existing = await this.#database.localDocuments.get(envelope.documentId);
        // 并发写保护：比较事务内最新信封与调用方快照，变化或不一致就拒绝写入媒体与正文。
        if (options.expected !== undefined) {
          const current = existing ? structuredClone(existing) as LocalDocumentEnvelope : null;
          if (!sameEnvelopeJson(current, options.expected)) {
            throw new LocalDocumentChangedError(envelope.documentId);
          }
        }
        if (existing && existing.documentKind !== envelope.documentKind) {
          throw new Error(`同编号本地文档类型不一致：${envelope.documentId}`);
        }
        // 默认拒绝复活回收站文档；只有显式 replaceTrash 且同 kind 才允许原子替换。
        const replacingTrash = Boolean(options.replaceTrash && existing?.deletedAt && !envelope.deletedAt);
        if (existing?.deletedAt && !envelope.deletedAt && !replacingTrash) {
          throw new Error("同编号文档仍在回收站，请先恢复或永久删除。");
        }
        if (media.length > 0) await this.#database.mediaAssets.bulkPut(media.map(copyMedia));
        const stored = new Set(await this.#database.mediaAssets.where("assetId").anyOf(envelope.assetIds).primaryKeys());
        const missing = envelope.assetIds.filter((id) => !stored.has(id));
        if (missing.length > 0) throw new Error(`Missing local media: ${missing.join(", ")}`);
        await this.#database.localDocuments.put(structuredClone(envelope));
        if (replacingTrash && existing) {
          // 替换后只清理旧回收站中无人引用的媒体；新活动文档引用的媒体仍被文档表引用，不会被清理。
          await this.#removeUnreferencedMedia(existing.assetIds);
        }
      },
    );
  }

  async remove(
    documentKind: LocalDocumentKind,
    documentId: string,
    options: { expected?: LocalDocumentEnvelope | null } = {},
  ): Promise<void> {
    await this.#database.transaction(
      "rw",
      this.#database.installedSystemResourcePackages,
      this.#database.localDocuments,
      this.#database.mediaAssets,
      async () => {
        const record = await this.#database.localDocuments.get(documentId);
        // 删除同样按事务内最新信封做 CAS，避免云端删除期间出现的新本地副本被误删。
        if (options.expected !== undefined) {
          const current = record ? structuredClone(record) as LocalDocumentEnvelope : null;
          if (!sameEnvelopeJson(current, options.expected)) {
            throw new LocalDocumentChangedError(documentId);
          }
        }
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
    options: { expected?: LocalDocumentEnvelope | null } = {},
  ): Promise<void> {
    await this.#database.transaction("rw", this.#database.localDocuments, async () => {
      const record = await this.#database.localDocuments.get(documentId);
      if (options.expected !== undefined && !sameEnvelopeJson(record ?? null, options.expected)) {
        throw new LocalDocumentChangedError(documentId);
      }
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
    // 多个来源与浏览器标签可能同时清理；查找和删除必须共享事务。
    return this.#database.transaction("rw", this.#database.installedSystemResourcePackages,
      this.#database.localDocuments, this.#database.mediaAssets, async () => {
        const expired = (await this.#database.localDocuments.toArray())
          .filter((record) => record.deletedAt && record.purgeAfter && record.purgeAfter <= now);
        for (const record of expired) {
          await this.deletePermanently(record.documentKind, record.documentId);
        }
        return expired.length;
      });
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
        const stored = new Set(await this.#database.mediaAssets.where("assetId").anyOf(replacement.assetIds).primaryKeys());
        const missing = replacement.assetIds.filter((id) => !stored.has(id));
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
