import type { SystemPackageDocument } from "@pbdh/contract-runtime";
import { createBrowserImageAdmission, playerAvatarPolicy } from "@pbdh/media-admission";

import type {
  CharacterSaveRepository,
  StoredCharacterSave,
} from "../../character-saves/character-save-repository.ts";
import type { ResourceLibrary as PlatformResourceLibrary } from "../../resources/resource-library.ts";
import type { PlayerImageData } from "../domain/characterData.ts";
import type { ResourceExtension } from "../domain/resourceExtension.ts";
import type { SystemPackage } from "../domain/systemPackage.ts";
import type { RuntimePackageAsset } from "../loaders/assetResolver.ts";
import {
  characterSaveToSheet,
  sheetCharacterToSave,
  type NormalizedPlayerImage,
} from "./characterSaveAdapter.ts";
import type {
  CharacterSaveRecord,
  CharacterSaveSummary,
  RuntimeStorage,
  SystemPackageCacheMetadata,
} from "./runtimeStorage.ts";

type CharacterSaveStore = Pick<
  CharacterSaveRepository,
  "list" | "save" | "remove"
>;

export type PlatformRuntimeStorageOptions = {
  currentSystem: SystemPackageDocument;
  characterSaves: CharacterSaveStore;
  installedPackages: () => Promise<PlatformResourceLibrary>;
  visibleCharacterSaves?: () => Promise<StoredCharacterSave[]>;
  cloudAccountId?: () => string | null;
  onCharacterSaved?: (saved: StoredCharacterSave) => Promise<void>;
  removeCharacterSave?: (stored: StoredCharacterSave) => Promise<void>;
  localStorage?: Storage;
  createMediaUrl?: (assetId: string, bytes: Uint8Array, mediaType: string) => string;
  admitPlayerImage?: (image: PlayerImageData) => Promise<NormalizedPlayerImage>;
};

const activeCharacterKeyPrefix = "pbdh:player:active-character:";
const skinKeyPrefix = "pbdh:player:skin:";
const cardTableHeightsKeyPrefix = "pbdh:player:card-table-heights:";
const colorSchemeKey = "pbdh:player:color-scheme";

export class PlatformRuntimeStorage implements RuntimeStorage {
  readonly #currentSystem: SystemPackageDocument;
  readonly #characterSaves: CharacterSaveStore;
  readonly #installedPackages: () => Promise<PlatformResourceLibrary>;
  readonly #visibleCharacterSaves: () => Promise<StoredCharacterSave[]>;
  readonly #cloudAccountId: () => string | null;
  readonly #onCharacterSaved?: (saved: StoredCharacterSave) => Promise<void>;
  readonly #removeCharacterSave?: (stored: StoredCharacterSave) => Promise<void>;
  readonly #localStorage?: Storage;
  readonly #createMediaUrl: PlatformRuntimeStorageOptions["createMediaUrl"];
  readonly #admitPlayerImage: (image: PlayerImageData) => Promise<NormalizedPlayerImage>;
  #currentPackage: SystemPackage | null = null;
  #currentPackageAssets: RuntimePackageAsset[] = [];
  #cacheMetadata: SystemPackageCacheMetadata | null = null;

  constructor(options: PlatformRuntimeStorageOptions) {
    this.#currentSystem = options.currentSystem;
    this.#characterSaves = options.characterSaves;
    this.#installedPackages = options.installedPackages;
    this.#visibleCharacterSaves = options.visibleCharacterSaves ?? (() => this.#characterSaves.list());
    this.#cloudAccountId = options.cloudAccountId ?? (() => null);
    this.#onCharacterSaved = options.onCharacterSaved;
    this.#removeCharacterSave = options.removeCharacterSave;
    this.#localStorage = options.localStorage ?? globalThis.localStorage;
    this.#createMediaUrl = options.createMediaUrl ?? ((_assetId, bytes, mediaType) =>
      URL.createObjectURL(new Blob([bytes.slice()], { type: mediaType })));
    this.#admitPlayerImage = options.admitPlayerImage ?? admitPlayerImage;
  }

  async loadCurrentSystemPackage(): Promise<SystemPackage | null> {
    return this.#currentPackage ? structuredClone(this.#currentPackage) : null;
  }

  async loadCurrentSystemPackageCacheMetadata(): Promise<SystemPackageCacheMetadata | null> {
    return this.#cacheMetadata ? structuredClone(this.#cacheMetadata) : null;
  }

  async saveCurrentSystemPackage(
    systemPackage: SystemPackage,
    packageAssets: RuntimePackageAsset[] = [],
    cacheMetadata: SystemPackageCacheMetadata = { source: "imported" },
  ): Promise<void> {
    this.#currentPackage = structuredClone(systemPackage);
    this.#currentPackageAssets = packageAssets.map(copyRuntimeAsset);
    this.#cacheMetadata = structuredClone(cacheMetadata);
  }

  async clearCurrentSystemPackage(): Promise<void> {
    this.#currentPackage = null;
    this.#currentPackageAssets = [];
    this.#cacheMetadata = null;
  }

  async loadCurrentPackageAssets(packageId: string): Promise<RuntimePackageAsset[]> {
    return this.#currentPackage?.manifest.ID === packageId
      ? this.#currentPackageAssets.map(copyRuntimeAsset)
      : [];
  }

  async loadCurrentCharacterData(packageId: string) {
    const activeId = await this.loadActiveCharacterSaveId(packageId);
    if (activeId) return this.loadCharacterSave(packageId, activeId);
    const first = (await this.listCharacterSaves(packageId))[0];
    return first ? this.loadCharacterSave(packageId, first.id) : null;
  }

  async saveCurrentCharacterData(data: CharacterSaveRecord["data"]): Promise<void> {
    const packageId = data.systemPackage.id;
    const saveId = await this.loadActiveCharacterSaveId(packageId) ?? data.character.id;
    const summary = (await this.listCharacterSaves(packageId)).find((item) => item.id === saveId);
    await this.saveCharacterSave({
      id: saveId,
      packageId,
      name: summary?.name ?? "未命名角色",
      updatedAt: data.updatedAt,
      data: { ...data, character: { ...data.character, id: saveId } },
    });
    await this.setActiveCharacterSaveId(packageId, saveId);
  }

  async listCharacterSaves(packageId: string): Promise<CharacterSaveSummary[]> {
    return (await this.#visibleCharacterSaves())
      .filter((candidate) => candidate.document.systemPackage.id === packageId)
      .map(toSummary)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async loadCharacterSave(packageId: string, saveId: string) {
    const stored = await this.#findSave(packageId, saveId);
    if (!stored) return null;
    return characterSaveToSheet({
      candidate: stored,
      currentSystem: {
        resourceCompatibility: this.#currentSystem.resourceCompatibility,
      },
      mediaUrl: (assetId, bytes) => {
        const asset = stored.document.characterData.assets.find((candidate) => candidate.id === assetId);
        return this.#createMediaUrl!(assetId, bytes, asset?.mediaType ?? "image/webp");
      },
    });
  }

  async saveCharacterSave(record: CharacterSaveRecord): Promise<void> {
    if (record.packageId !== this.#currentSystem.package.id) return;
    const sheetSystemPackage = this.#requireSheetSystemPackage();
    const existing = await this.#findSave(record.packageId, record.id);
    const data = record.data.character.id === record.id
      ? record.data
      : { ...record.data, character: { ...record.data.character, id: record.id } };
    const candidate = await sheetCharacterToSave({
      name: record.name,
      data,
      currentSystem: {
        id: this.#currentSystem.package.id,
        version: this.#currentSystem.package.version,
        resourceCompatibility: this.#currentSystem.resourceCompatibility,
      },
      sheetSystemPackage,
      installedPackages: await this.#installedPackages(),
      existing,
      admitPlayerImage: this.#admitPlayerImage,
    });
    const saved = await this.#characterSaves.save(
      candidate.document,
      candidate.media,
      this.#cloudAccountId(),
    );
    await this.#onCharacterSaved?.(saved);
  }

  async renameCharacterSave(packageId: string, saveId: string, name: string): Promise<void> {
    const stored = await this.#findSave(packageId, saveId);
    if (!stored) return;
    const saved = await this.#characterSaves.save(
      { ...stored.document, name },
      stored.media,
      this.#cloudAccountId(),
    );
    await this.#onCharacterSaved?.(saved);
  }

  async deleteCharacterSave(packageId: string, saveId: string): Promise<void> {
    const stored = await this.#findSave(packageId, saveId);
    if (stored) {
      if (this.#removeCharacterSave) await this.#removeCharacterSave(stored);
      else await this.#characterSaves.remove(saveId);
    }
    if (await this.loadActiveCharacterSaveId(packageId) === saveId) {
      this.#localStorage?.removeItem(`${activeCharacterKeyPrefix}${packageId}`);
    }
  }

  async loadActiveCharacterSaveId(packageId: string): Promise<string | null> {
    return this.#localStorage?.getItem(`${activeCharacterKeyPrefix}${packageId}`) ?? null;
  }

  async setActiveCharacterSaveId(packageId: string, saveId: string): Promise<void> {
    this.#localStorage?.setItem(`${activeCharacterKeyPrefix}${packageId}`, saveId);
  }

  loadSystemPackageSkinPreference(packageId: string): string | null {
    return this.#localStorage?.getItem(`${skinKeyPrefix}${packageId}`) ?? null;
  }

  setSystemPackageSkinPreference(packageId: string, skinId: string): void {
    this.#localStorage?.setItem(`${skinKeyPrefix}${packageId}`, skinId);
  }

  loadCardTableSurfaceHeights(packageId: string): Record<string, number> {
    const raw = this.#localStorage?.getItem(`${cardTableHeightsKeyPrefix}${packageId}`);
    if (!raw) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] >= 420));
    } catch {
      return {};
    }
  }

  setCardTableSurfaceHeight(packageId: string, tableModuleId: string, heightPx: number | null): void {
    const key = `${cardTableHeightsKeyPrefix}${packageId}`;
    const next = this.loadCardTableSurfaceHeights(packageId);
    if (heightPx === null) delete next[tableModuleId];
    else next[tableModuleId] = Math.max(420, Math.round(heightPx));
    if (Object.keys(next).length === 0) this.#localStorage?.removeItem(key);
    else this.#localStorage?.setItem(key, JSON.stringify(next));
  }

  loadFrameworkColorSchemePreference(): "follow-skin" | "light" | "dark" {
    const value = this.#localStorage?.getItem(colorSchemeKey);
    return value === "light" || value === "dark" ? value : "follow-skin";
  }

  setFrameworkColorSchemePreference(preference: "follow-skin" | "light" | "dark"): void {
    this.#localStorage?.setItem(colorSchemeKey, preference);
  }

  async listResourceExtensions(_targetSystemPackageId: string): Promise<ResourceExtension[]> {
    return [];
  }

  async loadResourceExtensionAssets(_targetSystemPackageId: string): Promise<RuntimePackageAsset[]> {
    return [];
  }

  async saveResourceExtension(): Promise<void> {
    throw new Error("Player 使用原生 .pbres 资源包，不支持旧 Sheet Resource Extension。");
  }

  async deleteResourceExtension(): Promise<void> {
    throw new Error("Player 使用原生 .pbres 资源包，不支持旧 Sheet Resource Extension。");
  }

  async #findSave(packageId: string, saveId: string): Promise<StoredCharacterSave | undefined> {
    return (await this.#visibleCharacterSaves()).find((candidate) =>
      candidate.document.documentId === saveId
      && candidate.document.systemPackage.id === packageId);
  }

  #requireSheetSystemPackage(): SystemPackage {
    if (!this.#currentPackage) throw new Error("人物存档前必须先加载系统包。");
    return this.#currentPackage;
  }
}

function toSummary(candidate: StoredCharacterSave): CharacterSaveSummary {
  return {
    id: candidate.document.documentId,
    packageId: candidate.document.systemPackage.id,
    name: candidate.document.name,
    updatedAt: candidate.document.updatedAt,
    syncScope: candidate.sync.scope,
    syncState: candidate.sync.state,
  };
}

function copyRuntimeAsset(asset: RuntimePackageAsset): RuntimePackageAsset {
  if (asset.staticUrl !== undefined) return { ...asset, staticUrl: asset.staticUrl };
  return { ...asset, bytes: new Uint8Array(asset.bytes) };
}

async function admitPlayerImage(image: PlayerImageData): Promise<NormalizedPlayerImage> {
  const response = await fetch(image.dataUrl);
  if (!response.ok) throw new Error(`无法读取玩家图片：${image.id}`);
  const blob = await response.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (/^sha256:[0-9a-f]{64}$/u.test(image.id)
    && image.mimeType === "image/webp"
    && image.width
    && image.height) {
    return {
      asset: {
        id: image.id,
        mediaType: "image/webp",
        byteLength: String(bytes.byteLength),
        width: String(image.width),
        height: String(image.height),
      },
      bytes,
    };
  }
  const extension = blob.type === "image/png" ? "png" : blob.type === "image/jpeg" ? "jpg" : "webp";
  const file = new File([blob], `player-avatar.${extension}`, { type: blob.type });
  const admitted = await createBrowserImageAdmission().admit(file, playerAvatarPolicy);
  return {
    asset: {
      id: admitted.id,
      mediaType: admitted.mediaType,
      byteLength: String(admitted.byteLength),
      width: String(admitted.width),
      height: String(admitted.height),
    },
    bytes: admitted.bytes,
  };
}
