import type {
  ResourcePackageCandidate,
  ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";
import {
  PbDHLocalDatabase,
  type InstalledResourcePackageRecord,
} from "@pbdh/local-storage";

export type ResourcePackageSource = "bundled" | "file" | "market";

export type StoredResourcePackage = ResourcePackageCandidate & {
  installedAt: string;
  source: ResourcePackageSource;
};

export interface ResourcePackageRepository {
  list(): Promise<StoredResourcePackage[]>;
  replace(candidate: ResourcePackageCandidate, source: ResourcePackageSource): Promise<void>;
  remove(packageId: string): Promise<void>;
}

export { PbDHLocalDatabase } from "@pbdh/local-storage";

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
      const document = record.document as ResourcePackageLogicalDocument;
      const mediaRecords = await this.#database.mediaAssets.bulkGet(
        document.assets.map((asset) => asset.id),
      );
      const media = new Map<string, Uint8Array>();
      document.assets.forEach((asset, index) => {
        const stored = mediaRecords[index];
        if (!stored) throw new Error(`Installed media record is missing: ${asset.id}`);
        media.set(asset.id, copyBytes(stored.bytes));
      });
      result.push({
        document: structuredClone(document),
        media,
        installedAt: record.installedAt,
        source: record.source as ResourcePackageSource,
      });
    }
    return result;
  }

  async replace(candidate: ResourcePackageCandidate, source: ResourcePackageSource): Promise<void> {
    assertCompleteCandidate(candidate);
    await this.#database.transaction(
      "rw",
      this.#database.installedResourcePackages,
      this.#database.localDocuments,
      this.#database.mediaAssets,
      async () => {
        await this.#database.mediaAssets.bulkPut(candidate.document.assets.map((asset) => ({
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
        } satisfies InstalledResourcePackageRecord);
        await this.#removeUnreferencedMedia();
      },
    );
  }

  async remove(packageId: string): Promise<void> {
    await this.#database.transaction(
      "rw",
      this.#database.installedResourcePackages,
      this.#database.localDocuments,
      this.#database.mediaAssets,
      async () => {
        await this.#database.installedResourcePackages.delete(packageId);
        await this.#removeUnreferencedMedia();
      },
    );
  }

  async #removeUnreferencedMedia(): Promise<void> {
    const packages = await this.#database.installedResourcePackages.toArray();
    const documents = await this.#database.localDocuments.toArray();
    const referenced = new Set([
      ...packages.flatMap((record) =>
        (record.document as ResourcePackageLogicalDocument).assets.map((asset) => asset.id)),
      ...documents.flatMap((record) => record.assetIds),
    ]);
    const storedIds = await this.#database.mediaAssets.toCollection().primaryKeys();
    const unreferenced = storedIds.filter((assetId) => !referenced.has(assetId));
    if (unreferenced.length) await this.#database.mediaAssets.bulkDelete(unreferenced);
  }
}
