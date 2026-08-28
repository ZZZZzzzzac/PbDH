import {
  CloudDocumentCoordinator,
  HttpCloudDocumentApi,
  type CloudCredentials,
  type CloudDocumentApi,
  type RemoteCloudDocument,
} from "@pbdh/cloud-documents";
import { DexieLocalDocumentStore } from "@pbdh/local-storage";
import type { CharacterSaveCandidate } from "@pbdh/contract-runtime";

import {
  CharacterSaveRepository,
  type StoredCharacterSave,
} from "./character-save-repository.ts";

export class PlayerCloudDocumentService {
  readonly #store: DexieLocalDocumentStore;
  readonly #api: CloudDocumentApi;
  readonly #coordinator: CloudDocumentCoordinator;
  readonly #repository: CharacterSaveRepository;
  readonly #validateModuleState?: (candidate: CharacterSaveCandidate) => void | Promise<void>;

  constructor(
    store: DexieLocalDocumentStore,
    repository: CharacterSaveRepository,
    api: CloudDocumentApi = new HttpCloudDocumentApi(),
    validateModuleState?: (candidate: CharacterSaveCandidate) => void | Promise<void>,
  ) {
    this.#store = store;
    this.#repository = repository;
    this.#api = api;
    this.#validateModuleState = validateModuleState;
    this.#coordinator = new CloudDocumentCoordinator(store, api);
  }

  async recover(credentials: CloudCredentials): Promise<StoredCharacterSave[]> {
    const remotes = await this.#api.listDocuments("character-save", true, credentials);
    for (const remote of remotes) {
      const local = await this.#store.get("character-save", remote.documentId);
      if (remote.deletedAt !== null) {
        if (local?.sync.scope === "cloud" && local.sync.accountId === credentials.accountId) {
          await this.#store.remove("character-save", remote.documentId);
        }
        continue;
      }
      if (!local) {
        await this.#restoreRemote(remote, credentials);
        continue;
      }
      if (local.sync.scope !== "cloud"
        || local.sync.accountId !== credentials.accountId
        || local.sync.state !== "clean") continue;
      const localRevision = local.sync.baseRevision === null ? 0 : revisionNumber(local.sync.baseRevision);
      if (remote.revision > localRevision) await this.#restoreRemote(remote, credentials);
    }
    await this.#coordinator.flush("character-save", credentials);
    return this.localSnapshot(credentials.accountId);
  }

  async localSnapshot(accountId?: string): Promise<StoredCharacterSave[]> {
    const saves = await this.#repository.list();
    return saves.filter((save) => accountId
      ? save.sync.scope === "local-only" || save.sync.accountId === accountId
      : save.sync.scope === "local-only");
  }

  async enable(documentId: string, credentials: CloudCredentials): Promise<StoredCharacterSave[]> {
    await this.#coordinator.enableCloud("character-save", documentId, credentials);
    await this.#coordinator.flush("character-save", credentials);
    return this.localSnapshot(credentials.accountId);
  }

  async flush(credentials: CloudCredentials): Promise<StoredCharacterSave[]> {
    await this.#coordinator.flush("character-save", credentials);
    return this.localSnapshot(credentials.accountId);
  }

  async overwriteWithLocal(
    documentId: string,
    credentials: CloudCredentials,
  ): Promise<StoredCharacterSave[]> {
    await this.#coordinator.overwriteWithLocal("character-save", documentId, credentials);
    return this.localSnapshot(credentials.accountId);
  }

  async keepCloud(
    documentId: string,
    credentials: CloudCredentials,
  ): Promise<StoredCharacterSave[]> {
    const remote = await this.#api.getDocument(documentId, credentials);
    if (remote.documentKind !== "character-save" || remote.deletedAt !== null) {
      throw new Error("云端人物存档当前不可恢复。");
    }
    await this.#restoreRemote(remote, credentials);
    return this.localSnapshot(credentials.accountId);
  }

  async trash(
    documentId: string,
    credentials: CloudCredentials,
  ): Promise<StoredCharacterSave[]> {
    let local = await this.#store.get("character-save", documentId);
    if (!local) throw new Error("没有找到要删除的人物存档。");
    if (local.sync.scope !== "cloud") {
      await this.#store.remove("character-save", documentId);
      return this.localSnapshot(credentials.accountId);
    }
    await this.#coordinator.flush("character-save", credentials);
    local = await this.#store.get("character-save", documentId);
    if (!local || local.sync.state !== "clean" || local.sync.baseRevision === null) {
      throw new Error("人物存档尚未完成同步，暂时不能移到云端回收站。");
    }
    await this.#api.trashDocument(
      documentId,
      crypto.randomUUID(),
      revisionNumber(local.sync.baseRevision),
      credentials,
    );
    await this.#store.remove("character-save", documentId);
    return this.localSnapshot(credentials.accountId);
  }

  async listTrash(credentials: CloudCredentials): Promise<RemoteCloudDocument[]> {
    return (await this.#api.listDocuments("character-save", true, credentials))
      .filter((document) => document.deletedAt !== null);
  }

  async restoreFromTrash(
    remote: RemoteCloudDocument,
    credentials: CloudCredentials,
  ): Promise<StoredCharacterSave[]> {
    const local = await this.#store.get("character-save", remote.documentId);
    if (local && (local.sync.scope === "local-only" || local.sync.accountId !== credentials.accountId)) {
      throw new Error("本地已有同 ID 人物存档，不能直接恢复云端版本。");
    }
    const restored = await this.#api.restoreDocument(
      remote.documentId,
      crypto.randomUUID(),
      remote.revision,
      credentials,
    );
    await this.#restoreRemote(restored, credentials);
    return this.localSnapshot(credentials.accountId);
  }

  async #restoreRemote(
    remote: RemoteCloudDocument,
    credentials: CloudCredentials,
  ): Promise<void> {
    const media = new Map<string, Uint8Array>();
    for (const assetId of remote.assetIds) {
      media.set(assetId, await this.#api.getMedia(remote.documentId, assetId, credentials));
    }
    await this.#repository.restoreRemote(remote, media, credentials.accountId, this.#validateModuleState);
  }
}

function revisionNumber(revision: string): number {
  const parsed = Number(revision);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error("无效的云文档 revision。");
  return parsed;
}
