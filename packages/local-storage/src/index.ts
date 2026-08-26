import Dexie, { type Table } from "dexie";

export type LocalDocumentKind =
  | "creator-workspace"
  | "gm-tabletop-document"
  | "character-save";

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
  packageId: string;
  snapshotDigest: string;
  version: string;
  installedAt: string;
  source: string;
  document: unknown;
};

type LegacyResourceMediaRecord = LocalMediaAssetRecord;

export class PbDHLocalDatabase extends Dexie {
  installedResourcePackages!: Table<InstalledResourcePackageRecord, string>;
  localDocuments!: Table<LocalDocumentEnvelope, string>;
  mediaAssets!: Table<LocalMediaAssetRecord, string>;

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
  }
}

function copyMedia(record: LocalMediaAssetRecord): LocalMediaAssetRecord {
  return { ...record, bytes: new Uint8Array(record.bytes) };
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
    return records.reverse().map((record) => structuredClone(record) as LocalDocumentEnvelope<T>);
  }

  async get<T>(
    documentKind: LocalDocumentKind,
    documentId: string,
  ): Promise<LocalDocumentEnvelope<T> | undefined> {
    const record = await this.#database.localDocuments.get(documentId);
    if (!record || record.documentKind !== documentKind) return undefined;
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
        if (media.length > 0) await this.#database.mediaAssets.bulkPut(media.map(copyMedia));
        const stored = await this.#database.mediaAssets.bulkGet(envelope.assetIds);
        const missing = envelope.assetIds.filter((_, index) => !stored[index]);
        if (missing.length > 0) throw new Error(`Missing local media: ${missing.join(", ")}`);
        await this.#database.localDocuments.put(structuredClone(envelope));
      },
    );
  }

  async remove(documentKind: LocalDocumentKind, documentId: string): Promise<void> {
    await this.#database.transaction("rw", this.#database.localDocuments, async () => {
      const record = await this.#database.localDocuments.get(documentId);
      if (record?.documentKind === documentKind) await this.#database.localDocuments.delete(documentId);
    });
  }

  async getMedia(assetIds: readonly string[]): Promise<Map<string, Uint8Array>> {
    const records = await this.#database.mediaAssets.bulkGet([...assetIds]);
    const result = new Map<string, Uint8Array>();
    records.forEach((record) => {
      if (record) result.set(record.assetId, new Uint8Array(record.bytes));
    });
    return result;
  }
}
