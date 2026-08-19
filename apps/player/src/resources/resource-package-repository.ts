import Dexie, { type Table } from "dexie";

import type {
  ResourcePackageCandidate,
  ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";

export type ResourcePackageSource = "bundled" | "file" | "market";

type InstalledResourcePackageRecord = {
  packageId: string;
  snapshotDigest: string;
  version: string;
  installedAt: string;
  source: ResourcePackageSource;
  document: ResourcePackageLogicalDocument;
};

type ResourceMediaRecord = {
  assetId: string;
  mediaType: "image/webp";
  byteLength: string;
  bytes: Uint8Array;
};

export type StoredResourcePackage = ResourcePackageCandidate & {
  installedAt: string;
  source: ResourcePackageSource;
};

export interface ResourcePackageRepository {
  list(): Promise<StoredResourcePackage[]>;
  replace(candidate: ResourcePackageCandidate, source: ResourcePackageSource): Promise<void>;
  remove(packageId: string): Promise<void>;
}

export class PbDHLocalDatabase extends Dexie {
  installedResourcePackages!: Table<InstalledResourcePackageRecord, string>;
  resourceMedia!: Table<ResourceMediaRecord, string>;

  constructor(name = "pbdh-platform") {
    super(name);
    this.version(1).stores({
      installedResourcePackages: "&packageId, snapshotDigest, version, installedAt",
      resourceMedia: "&assetId, byteLength",
    });
  }
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function assertCompleteCandidate(candidate: ResourcePackageCandidate): void {
  for (const asset of candidate.document.assets) {
    const bytes = candidate.media.get(asset.id);
    if (!bytes) throw new Error(`Missing installed media: ${asset.id}`);
    if (String(bytes.byteLength) !== asset.byteLength) {
      throw new Error(`Installed media byte length mismatch: ${asset.id}`);
    }
  }
}

export class DexieResourcePackageRepository implements ResourcePackageRepository {
  readonly #database: PbDHLocalDatabase;

  constructor(database = new PbDHLocalDatabase()) {
    this.#database = database;
  }

  async list(): Promise<StoredResourcePackage[]> {
    const records = await this.#database.installedResourcePackages.orderBy("installedAt").toArray();
    const result: StoredResourcePackage[] = [];
    for (const record of records) {
      const mediaRecords = await this.#database.resourceMedia.bulkGet(
        record.document.assets.map((asset) => asset.id),
      );
      const media = new Map<string, Uint8Array>();
      record.document.assets.forEach((asset, index) => {
        const stored = mediaRecords[index];
        if (!stored) throw new Error(`Installed media record is missing: ${asset.id}`);
        media.set(asset.id, copyBytes(stored.bytes));
      });
      result.push({
        document: structuredClone(record.document),
        media,
        installedAt: record.installedAt,
        source: record.source,
      });
    }
    return result;
  }

  async replace(candidate: ResourcePackageCandidate, source: ResourcePackageSource): Promise<void> {
    assertCompleteCandidate(candidate);
    await this.#database.transaction(
      "rw",
      this.#database.installedResourcePackages,
      this.#database.resourceMedia,
      async () => {
        await this.#database.resourceMedia.bulkPut(candidate.document.assets.map((asset) => ({
          assetId: asset.id,
          mediaType: asset.mediaType,
          byteLength: asset.byteLength,
          bytes: copyBytes(candidate.media.get(asset.id)!),
        })));
        await this.#database.installedResourcePackages.put({
          packageId: candidate.document.package.id,
          snapshotDigest: candidate.document.snapshotDigest,
          version: candidate.document.package.version,
          installedAt: new Date().toISOString(),
          source,
          document: structuredClone(candidate.document),
        });
        await this.#removeUnreferencedMedia();
      },
    );
  }

  async remove(packageId: string): Promise<void> {
    await this.#database.transaction(
      "rw",
      this.#database.installedResourcePackages,
      this.#database.resourceMedia,
      async () => {
        await this.#database.installedResourcePackages.delete(packageId);
        await this.#removeUnreferencedMedia();
      },
    );
  }

  async #removeUnreferencedMedia(): Promise<void> {
    const packages = await this.#database.installedResourcePackages.toArray();
    const referenced = new Set(packages.flatMap((record) =>
      record.document.assets.map((asset) => asset.id)));
    const storedIds = await this.#database.resourceMedia.toCollection().primaryKeys();
    const unreferenced = storedIds.filter((assetId) => !referenced.has(assetId));
    if (unreferenced.length) await this.#database.resourceMedia.bulkDelete(unreferenced);
  }
}
