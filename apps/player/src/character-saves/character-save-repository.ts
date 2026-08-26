import {
  CHARACTER_SAVE_VERSION,
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

import { validateCharacterSaveCandidate } from "./character-save-validator.ts";

export type StoredCharacterSave = CharacterSaveCandidate & {
  sync: LocalDocumentSync;
};

export function createCharacterSave(input: {
  name: string;
  systemPackage: CharacterSaveDocument["systemPackage"];
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
    characterData: structuredClone(input.characterData ?? {
      values: {},
      tabletop: { instances: [] },
      assets: [],
    }),
  };
}

function mediaRecords(
  document: CharacterSaveDocument,
  media: ReadonlyMap<string, Uint8Array>,
): LocalMediaAssetRecord[] {
  return document.characterData.assets.flatMap((asset) => {
    const bytes = media.get(asset.id);
    return bytes ? [{
      assetId: asset.id,
      mediaType: asset.mediaType,
      byteLength: asset.byteLength,
      bytes: new Uint8Array(bytes),
    }] : [];
  });
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

  async list(): Promise<StoredCharacterSave[]> {
    const envelopes = await this.#store.list<CharacterSaveDocument>("character-save");
    const results: StoredCharacterSave[] = [];
    for (const envelope of envelopes) {
      const media = await this.#store.getMedia(envelope.assetIds);
      await assertValid(envelope.payload, media, "Invalid stored Character Save");
      results.push({ document: envelope.payload, media, sync: envelope.sync });
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
    await assertValid(candidate, media, "Invalid Character Save");
    if (existing && sameCharacterSaveContent(existing.payload, candidate)) {
      return { document: existing.payload, media: new Map(media), sync: existing.sync };
    }
    const initialSync: LocalDocumentSync = cloudAccountId
      ? { scope: "cloud", state: "clean", baseRevision: null, accountId: cloudAccountId }
      : { scope: "local-only", state: "clean", baseRevision: null };
    const sync = pendingSync(existing?.sync ?? initialSync);
    await this.#put(candidate, media, sync);
    return { document: candidate, media: new Map(media), sync };
  }

  async import(
    candidate: CharacterSaveCandidate,
    cloudAccountId: string | null = null,
  ): Promise<StoredCharacterSave> {
    await assertValid(candidate.document, candidate.media, "Invalid Character Save import");
    const sync: LocalDocumentSync = cloudAccountId
      ? pendingSync({ scope: "cloud", state: "clean", baseRevision: null, accountId: cloudAccountId })
      : { scope: "local-only", state: "clean", baseRevision: null };
    await this.#put(candidate.document, candidate.media, sync);
    return { document: structuredClone(candidate.document), media: new Map(candidate.media), sync };
  }

  async restoreRemote(
    remote: RemoteCloudDocument,
    media: ReadonlyMap<string, Uint8Array>,
    accountId: string,
  ): Promise<StoredCharacterSave> {
    if (remote.documentKind !== "character-save"
      || remote.contractFamily !== "character-save"
      || remote.contractVersion !== CHARACTER_SAVE_VERSION
      || remote.deletedAt !== null) {
      throw new Error("云端人物存档格式无效。");
    }
    const document = remote.payload as CharacterSaveDocument;
    if (document.documentId !== remote.documentId) throw new Error("云端人物存档 Document ID 不一致。");
    await assertValid(document, media, "云端人物存档无效");
    const sync: LocalDocumentSync = {
      scope: "cloud",
      state: "clean",
      baseRevision: String(remote.revision),
      accountId,
      mutationId: null,
      lastError: null,
    };
    await this.#put(document, media, sync);
    return { document: structuredClone(document), media: new Map(media), sync };
  }

  async syncState(documentId: string): Promise<LocalDocumentSync | undefined> {
    return (await this.#store.get("character-save", documentId))?.sync;
  }

  async remove(documentId: string): Promise<void> {
    await this.#store.remove("character-save", documentId);
  }

  async #put(
    document: CharacterSaveDocument,
    media: ReadonlyMap<string, Uint8Array>,
    sync: LocalDocumentSync,
  ): Promise<void> {
    const envelope: LocalDocumentEnvelope<CharacterSaveDocument> = {
      documentId: document.documentId,
      documentKind: "character-save",
      contractFamily: "character-save",
      contractVersion: document.contractVersion,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      assetIds: document.characterData.assets.map((asset) => asset.id),
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

function sameCharacterSaveContent(
  current: CharacterSaveDocument,
  next: CharacterSaveDocument,
): boolean {
  const { updatedAt: _currentUpdatedAt, ...currentContent } = current;
  const { updatedAt: _nextUpdatedAt, ...nextContent } = next;
  return JSON.stringify(currentContent) === JSON.stringify(nextContent);
}
