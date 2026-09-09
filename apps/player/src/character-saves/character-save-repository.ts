import {
  CHARACTER_SAVE_VERSION,
  selectCharacterSavePlayerMedia,
  characterSavePlayerAssetIds,
  validateCharacterSaveMedia,
  type CharacterData,
  type CharacterSaveCandidate,
  type CharacterSaveDocument,
} from "@pbdh/contract-runtime";
import {
  pendingSync,
  type RemoteCloudDocument,
} from "@pbdh/cloud-documents";
import {
  DexieLocalDocumentStore,
  type LocalDocumentEnvelope,
  type LocalDocumentSync,
  type LocalMediaAssetRecord,
} from "@pbdh/local-storage";

import { validateCharacterSaveCandidate, validateCharacterSaveDocument } from "./character-save-validator.ts";

export type StoredCharacterSave = CharacterSaveCandidate & {
  sync: LocalDocumentSync;
};
export type StoredCharacterSaveDocument = Pick<StoredCharacterSave, "document" | "sync">;

export type CharacterSaveMetadata = {
  document: Omit<CharacterSaveDocument, "characterData">;
  sync: LocalDocumentSync;
};

export type TrashedCharacterSaveMetadata = CharacterSaveMetadata & {
  deletedAt: string;
  purgeAfter: string | null;
};

export type CharacterSaveImportPlan =
  | { kind: "new"; candidate: CharacterSaveCandidate }
  | { kind: "duplicate"; existing: StoredCharacterSave }
  | { kind: "conflict"; candidate: CharacterSaveCandidate; existing: StoredCharacterSave };

export function createCharacterSave(input: {
  name: string;
  systemPackage: CharacterSaveDocument["systemPackage"];
  characterDataVersion: string;
  characterData?: CharacterData;
  documentId?: string;
  now?: string;
}): CharacterSaveDocument {
  const now = input.now ?? new Date().toISOString();
  return {
    contractVersion: CHARACTER_SAVE_VERSION,
    documentId: input.documentId ?? crypto.randomUUID(),
    name: input.name,
    createdAt: now,
    updatedAt: now,
    systemPackage: structuredClone(input.systemPackage),
    characterDataVersion: input.characterDataVersion,
    characterData: structuredClone(input.characterData ?? {}),
  };
}

function mediaRecords(
  _document: CharacterSaveDocument,
  media: ReadonlyMap<string, Uint8Array>,
): LocalMediaAssetRecord[] {
  return [...media].map(([assetId, bytes]) => ({
    assetId,
    mediaType: "image/webp" as const,
    byteLength: String(bytes.byteLength),
    bytes: new Uint8Array(bytes),
  }));
}

export class CharacterSaveRepository {
  readonly #store: DexieLocalDocumentStore;
  readonly #now: () => string;

  constructor(
    store = new DexieLocalDocumentStore(),
    now = () => new Date().toISOString(),
  ) {
    this.#store = store;
    this.#now = now;
  }

  async listMetadata(): Promise<CharacterSaveMetadata[]> {
    const envelopes = await this.#store.list<CharacterSaveDocument>("character-save");
    return envelopes.map(({ payload, sync }) => {
      const { characterData: _characterData, ...document } = payload;
      return { document, sync };
    });
  }

  async get(documentId: string): Promise<StoredCharacterSave | undefined> {
    const envelope = await this.#store.get<CharacterSaveDocument>("character-save", documentId);
    if (!envelope) return undefined;
    const media = await this.#store.getMedia(envelope.assetIds);
    const candidate = await normalizeValid(envelope.payload, media, "Invalid stored Character Save");
    return { ...candidate, sync: envelope.sync };
  }

  async getDocument(documentId: string): Promise<StoredCharacterSaveDocument | undefined> {
    const envelope = await this.#store.get<CharacterSaveDocument>("character-save", documentId);
    if (!envelope) return undefined;
    const diagnostics = validateCharacterSaveDocument(envelope.payload, new Set(envelope.assetIds));
    if (diagnostics.length) throw new Error(`Invalid stored Character Save: ${diagnostics[0]!.code}`);
    return { document: envelope.payload, sync: envelope.sync };
  }

  async saveUpdate(document: CharacterSaveDocument, mediaUpdates: ReadonlyMap<string, Uint8Array>, cloudAccountId: string | null = null): Promise<StoredCharacterSaveDocument> {
    const existing = await this.#store.get<CharacterSaveDocument>("character-save", document.documentId);
    const candidate = structuredClone(document);
    candidate.createdAt = existing?.payload.createdAt ?? candidate.createdAt;
    candidate.updatedAt = this.#now();
    const media = new Map([...selectCharacterSavePlayerMedia(candidate, mediaUpdates)].map(([id, bytes]) => [id, new Uint8Array(bytes)]));
    const assetIds = [...characterSavePlayerAssetIds(candidate)];
    const available = new Set([...(existing?.assetIds ?? []), ...media.keys()]);
    const diagnostics = [
      ...validateCharacterSaveDocument(candidate, new Set(assetIds.filter((id) => available.has(id)))),
      ...await validateCharacterSaveMedia(media),
    ];
    if (diagnostics.length) throw new Error(`Invalid Character Save: ${diagnostics[0]!.code}`);
    if (existing && sameCharacterSaveContent(existing.payload, candidate)) {
      if (media.size) await this.#put(existing.payload, media, existing.sync, assetIds);
      return { document: existing.payload, sync: existing.sync };
    }
    const initialSync: LocalDocumentSync = cloudAccountId
      ? { scope: "cloud", state: "clean", baseRevision: null, accountId: cloudAccountId }
      : { scope: "local-only", state: "clean", baseRevision: null };
    const sync = pendingSync(existing?.sync ?? initialSync);
    await this.#put(candidate, media, sync, assetIds);
    return { document: candidate, sync };
  }

  async list(): Promise<StoredCharacterSave[]> {
    const envelopes = await this.#store.list<CharacterSaveDocument>("character-save");
    const results: StoredCharacterSave[] = [];
    for (const envelope of envelopes) {
      const media = await this.#store.getMedia(envelope.assetIds);
      const candidate = await normalizeValid(
        envelope.payload,
        media,
        "Invalid stored Character Save",
      );
      results.push({ ...candidate, sync: envelope.sync });
    }
    return results;
  }

  async save(
    document: CharacterSaveDocument,
    media: ReadonlyMap<string, Uint8Array>,
    cloudAccountId: string | null = null,
  ): Promise<StoredCharacterSave> {
    const existing = await this.#store.get<CharacterSaveDocument>("character-save", document.documentId);
    const candidate = structuredClone(document);
    candidate.createdAt = existing?.payload.createdAt ?? candidate.createdAt;
    candidate.updatedAt = this.#now();
    const playerMedia = selectCharacterSavePlayerMedia(candidate, media);
    await assertValid(candidate, playerMedia, "Invalid Character Save");
    if (existing && sameCharacterSaveContent(existing.payload, candidate)) {
      return { document: existing.payload, media: playerMedia, sync: existing.sync };
    }
    const initialSync: LocalDocumentSync = cloudAccountId
      ? { scope: "cloud", state: "clean", baseRevision: null, accountId: cloudAccountId }
      : { scope: "local-only", state: "clean", baseRevision: null };
    const sync = pendingSync(existing?.sync ?? initialSync);
    await this.#put(candidate, playerMedia, sync);
    return { document: candidate, media: playerMedia, sync };
  }

  async import(
    candidate: CharacterSaveCandidate,
    cloudAccountId: string | null = null,
  ): Promise<StoredCharacterSave> {
    const playerMedia = selectCharacterSavePlayerMedia(candidate.document, candidate.media);
    await assertValid(candidate.document, playerMedia, "Invalid Character Save import");
    const sync: LocalDocumentSync = cloudAccountId
      ? pendingSync({ scope: "cloud", state: "clean", baseRevision: null, accountId: cloudAccountId })
      : { scope: "local-only", state: "clean", baseRevision: null };
    await this.#put(candidate.document, playerMedia, sync);
    return { document: structuredClone(candidate.document), media: playerMedia, sync };
  }

  async planImport(candidate: CharacterSaveCandidate): Promise<CharacterSaveImportPlan> {
    const playerMedia = selectCharacterSavePlayerMedia(candidate.document, candidate.media);
    await assertValid(candidate.document, playerMedia, "Invalid Character Save import");
    const existing = await this.get(candidate.document.documentId);
    const normalized = { document: structuredClone(candidate.document), media: playerMedia };
    if (!existing) return { kind: "new", candidate: normalized };
    if (sameCharacterSaveArchive(existing, normalized)) return { kind: "duplicate", existing };
    return { kind: "conflict", candidate: normalized, existing };
  }

  async importAsCopy(
    candidate: CharacterSaveCandidate,
    cloudAccountId: string | null = null,
  ): Promise<StoredCharacterSave> {
    const now = this.#now();
    return this.import({
      document: {
        ...structuredClone(candidate.document),
        documentId: crypto.randomUUID(),
        name: `${candidate.document.name} 副本`,
        createdAt: now,
        updatedAt: now,
      },
      media: new Map(candidate.media),
    }, cloudAccountId);
  }

  async restoreRemote(
    remote: RemoteCloudDocument,
    media: ReadonlyMap<string, Uint8Array>,
    accountId: string,
    validateModuleState?: (candidate: CharacterSaveCandidate) => void | Promise<void>,
  ): Promise<StoredCharacterSave> {
    if (remote.documentKind !== "character-save"
      || remote.contractFamily !== "character-save"
      || remote.contractVersion !== CHARACTER_SAVE_VERSION
      || remote.deletedAt !== null) {
      throw new Error("云端人物存档格式无效。");
    }
    const candidate = await normalizeValid(
      remote.payload as CharacterSaveDocument,
      media,
      "云端人物存档无效",
    );
    if (candidate.document.documentId !== remote.documentId) throw new Error("云端人物存档 Document ID 不一致。");
    await validateModuleState?.(candidate);
    const sync: LocalDocumentSync = {
      scope: "cloud",
      state: "clean",
      baseRevision: String(remote.revision),
      accountId,
      mutationId: null,
      lastError: null,
    };
    await this.#put(candidate.document, candidate.media, sync);
    return { document: structuredClone(candidate.document), media: candidate.media, sync };
  }

  async syncState(documentId: string): Promise<LocalDocumentSync | undefined> {
    return (await this.#store.get("character-save", documentId))?.sync;
  }

  async remove(documentId: string): Promise<void> {
    await this.#store.remove("character-save", documentId);
  }

  async trash(documentId: string): Promise<void> {
    await this.#store.trash("character-save", documentId, this.#now());
  }

  async listTrashMetadata(): Promise<TrashedCharacterSaveMetadata[]> {
    const envelopes = await this.#store.listTrash<CharacterSaveDocument>("character-save");
    return envelopes.map((envelope) => {
      const { characterData: _characterData, ...document } = envelope.payload;
      return {
        document,
        sync: envelope.sync,
        deletedAt: envelope.deletedAt!,
        purgeAfter: envelope.purgeAfter ?? null,
      };
    });
  }

  async restore(documentId: string): Promise<StoredCharacterSave> {
    const trashed = await this.#store.getTrash<CharacterSaveDocument>("character-save", documentId);
    if (!trashed) throw new Error("回收站里找不到这个人物存档。");
    const media = await this.#store.getMedia(trashed.assetIds);
    const candidate = await normalizeValid(trashed.payload, media, "Invalid trashed Character Save");
    await this.#store.restore("character-save", documentId);
    return { ...candidate, sync: trashed.sync };
  }

  async deleteFromTrash(documentId: string): Promise<void> {
    await this.#store.deletePermanently("character-save", documentId);
  }

  async #put(
    document: CharacterSaveDocument,
    media: ReadonlyMap<string, Uint8Array>,
    sync: LocalDocumentSync,
    assetIds: readonly string[] = [...media.keys()],
  ): Promise<void> {
    const envelope: LocalDocumentEnvelope<CharacterSaveDocument> = {
      documentId: document.documentId,
      documentKind: "character-save",
      contractFamily: "character-save",
      contractVersion: document.contractVersion,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      assetIds: [...assetIds].sort((left, right) => left.localeCompare(right)),
      sync,
      payload: structuredClone(document),
    };
    await this.#store.put(envelope, mediaRecords(document, media));
  }
}

async function assertValid(
  document: CharacterSaveDocument,
  media: ReadonlyMap<string, Uint8Array>,
  prefix: string,
): Promise<void> {
  const diagnostics = await validateCharacterSaveCandidate(document, media);
  if (diagnostics.some((item) => item.severity === "error")) {
    throw new Error(`${prefix}: ${diagnostics[0]!.code}`);
  }
}

async function normalizeValid(
  source: CharacterSaveDocument,
  media: ReadonlyMap<string, Uint8Array>,
  prefix: string,
): Promise<CharacterSaveCandidate> {
  const diagnostics = await validateCharacterSaveCandidate(source, media);
  if (diagnostics.some((item) => item.severity === "error")) {
    throw new Error(`${prefix}: ${diagnostics[0]!.code}`);
  }
  return { document: structuredClone(source), media: new Map(media) };
}

function sameCharacterSaveContent(
  current: CharacterSaveDocument,
  next: CharacterSaveDocument,
): boolean {
  const { updatedAt: _currentUpdatedAt, ...currentContent } = current;
  const { updatedAt: _nextUpdatedAt, ...nextContent } = next;
  return JSON.stringify(currentContent) === JSON.stringify(nextContent);
}

function sameCharacterSaveArchive(
  current: CharacterSaveCandidate,
  next: CharacterSaveCandidate,
): boolean {
  if (JSON.stringify(current.document) !== JSON.stringify(next.document)) return false;
  if (current.media.size !== next.media.size) return false;
  for (const [assetId, bytes] of current.media) {
    const other = next.media.get(assetId);
    if (!other || other.byteLength !== bytes.byteLength) return false;
    for (let index = 0; index < bytes.byteLength; index += 1) {
      if (bytes[index] !== other[index]) return false;
    }
  }
  return true;
}
