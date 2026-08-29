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
import { prepareCharacterDataMigration } from "../domain/characterDataMigration.ts";
import type { RuntimePackageAsset } from "../loaders/assetResolver.ts";
import {
  characterSaveToSheet,
  completeCharacterDataForSystemPackage,
  sheetCharacterToSave,
  validateCharacterDataForSystemPackage,
  type NormalizedPlayerImage,
} from "./characterSaveAdapter.ts";
import type {
  CharacterSaveRecord,
  CharacterDataMigrationCandidate,
  PackageScriptConsentCandidate,
  CharacterSaveSummary,
  RuntimeStorage,
  RuntimeCacheStore,
  SystemPackageCacheSnapshot,
  SystemPackageCacheMetadata,
} from "./runtimeStorage.ts";

type CharacterSaveStore = Pick<
  CharacterSaveRepository,
  "list" | "save" | "remove"
>;

export type PlatformRuntimeStorageOptions = {
  currentSystem: SystemPackageDocument | ((packageId: string) => SystemPackageDocument | undefined);
  characterSaves: CharacterSaveStore;
  installedPackages: () => Promise<PlatformResourceLibrary>;
  visibleCharacterSaves?: () => Promise<StoredCharacterSave[]>;
  cloudAccountId?: () => string | null;
  onCharacterSaved?: (saved: StoredCharacterSave) => Promise<void>;
  removeCharacterSave?: (stored: StoredCharacterSave) => Promise<void>;
  localStorage?: Storage;
  createMediaUrl?: (assetId: string, bytes: Uint8Array, mediaType: string) => string;
  admitPlayerImage?: (image: PlayerImageData) => Promise<NormalizedPlayerImage>;
  systemPackageCache?: RuntimeCacheStore<SystemPackageCacheSnapshot>;
};

const activeCharacterKeyPrefix = "pbdh:player:active-character:";
const skinKeyPrefix = "pbdh:player:skin:";
const cardTableHeightsKeyPrefix = "pbdh:player:card-table-heights:";
const colorSchemeKey = "pbdh:player:color-scheme";
const packageScriptConsentKeyPrefix = "pbdh:player:script-consent:";
const currentSystemPackageCacheId = "player-current-system-package";

export class PlatformRuntimeStorage implements RuntimeStorage {
  readonly #resolveSystem: (packageId: string) => SystemPackageDocument | undefined;
  readonly #characterSaves: CharacterSaveStore;
  readonly #installedPackages: () => Promise<PlatformResourceLibrary>;
  readonly #visibleCharacterSaves: () => Promise<StoredCharacterSave[]>;
  readonly #cloudAccountId: () => string | null;
  readonly #onCharacterSaved?: (saved: StoredCharacterSave) => Promise<void>;
  readonly #removeCharacterSave?: (stored: StoredCharacterSave) => Promise<void>;
  readonly #localStorage?: Storage;
  readonly #createMediaUrl: PlatformRuntimeStorageOptions["createMediaUrl"];
  readonly #admitPlayerImage: (image: PlayerImageData) => Promise<NormalizedPlayerImage>;
  readonly #systemPackageCache?: RuntimeCacheStore<SystemPackageCacheSnapshot>;
  #currentPackage: SystemPackage | null = null;
  readonly #loadedPackages = new Map<string, SystemPackage>();
  #currentPackageAssets: RuntimePackageAsset[] = [];
  #cacheMetadata: SystemPackageCacheMetadata | null = null;
  #cacheHydrated = false;

  constructor(options: PlatformRuntimeStorageOptions) {
    const currentSystem = options.currentSystem;
    this.#resolveSystem = typeof currentSystem === "function"
      ? currentSystem
      : (packageId) => currentSystem.package.id === packageId ? currentSystem : undefined;
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
    this.#systemPackageCache = options.systemPackageCache;
  }

  async loadCurrentSystemPackage(): Promise<SystemPackage | null> {
    await this.#hydrateSystemPackageCache();
    return this.#currentPackage ? structuredClone(this.#currentPackage) : null;
  }

  async loadCurrentSystemPackageCacheMetadata(): Promise<SystemPackageCacheMetadata | null> {
    await this.#hydrateSystemPackageCache();
    return this.#cacheMetadata ? structuredClone(this.#cacheMetadata) : null;
  }

  async saveCurrentSystemPackage(
    systemPackage: SystemPackage,
    packageAssets: RuntimePackageAsset[] = [],
    cacheMetadata: SystemPackageCacheMetadata = { source: "imported" },
  ): Promise<void> {
    this.#currentPackage = structuredClone(systemPackage);
    this.#loadedPackages.set(systemPackage.manifest.ID, structuredClone(systemPackage));
    this.#currentPackageAssets = packageAssets.map(copyRuntimeAsset);
    this.#cacheMetadata = structuredClone(cacheMetadata);
    this.#cacheHydrated = true;
    await this.#systemPackageCache?.save(currentSystemPackageCacheId, {
      systemPackage: structuredClone(systemPackage),
      packageAssets: packageAssets.map(copyRuntimeAsset),
      metadata: structuredClone(cacheMetadata),
    });
  }

  async clearCurrentSystemPackage(): Promise<void> {
    this.#currentPackage = null;
    this.#currentPackageAssets = [];
    this.#cacheMetadata = null;
    this.#loadedPackages.clear();
    this.#cacheHydrated = true;
    await this.#systemPackageCache?.remove(currentSystemPackageCacheId);
  }

  async loadCurrentPackageAssets(packageId: string): Promise<RuntimePackageAsset[]> {
    await this.#hydrateSystemPackageCache();
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
    return (await this.listAllCharacterSaves())
      .filter((candidate) => candidate.packageId === packageId)
  }

  async listAllCharacterSaves(): Promise<CharacterSaveSummary[]> {
    return (await this.#visibleCharacterSaves())
      .map(toSummary)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async loadCharacterSave(packageId: string, saveId: string) {
    const stored = await this.#findSave(packageId, saveId);
    if (!stored) return null;
    const currentSystem = this.#resolveSystemDocument(packageId);
    if (!currentSystem) return null;
    const sheetSystemPackage = this.#requireSheetSystemPackage(packageId);
    return characterSaveToSheet({
      candidate: stored,
      currentSystem: {
        resourceCompatibility: currentSystem.resourceCompatibility,
      },
      sheetSystemPackage,
      installedPackages: await this.#installedPackages(),
      mediaUrl: (assetId, bytes) => this.#createMediaUrl!(assetId, bytes, "image/webp"),
    });
  }

  async preparePackageScriptConsent(systemPackage: SystemPackage) {
    if (this.#cacheMetadata?.source === "preset") return { status: "current" as const };
    const scripts = collectPackageScripts(systemPackage);
    if (scripts.length === 0) return { status: "current" as const };
    const withDigests = await Promise.all(scripts.map(async (script) => ({
      label: script.label,
      path: script.path,
      digest: await sha256Text(script.content),
    })));
    const candidate: PackageScriptConsentCandidate = {
      packageId: systemPackage.manifest.ID,
      packageVersion: systemPackage.manifest.版本,
      packageName: systemPackage.manifest.名称,
      scripts: withDigests.sort((left, right) => left.path.localeCompare(right.path) || left.label.localeCompare(right.label)),
    };
    const stored = this.#localStorage?.getItem(packageScriptConsentKey(candidate));
    if (stored === JSON.stringify(candidate.scripts.map(({ digest, label, path }) => ({ digest, label, path })))) {
      return { status: "current" as const };
    }
    return { status: "required" as const, candidate };
  }

  async approvePackageScripts(candidate: PackageScriptConsentCandidate): Promise<void> {
    const current = this.#currentPackage;
    if (!current || current.manifest.ID !== candidate.packageId || current.manifest.版本 !== candidate.packageVersion) {
      throw new Error("待确认脚本所属的系统包已经变化，请重新检查。 ");
    }
    const fresh = await this.preparePackageScriptConsent(current);
    if (fresh.status === "current") return;
    if (JSON.stringify(fresh.candidate.scripts) !== JSON.stringify(candidate.scripts)) {
      throw new Error("脚本内容在确认前已经变化，请重新检查。");
    }
    this.#localStorage?.setItem(
      packageScriptConsentKey(candidate),
      JSON.stringify(candidate.scripts.map(({ digest, label, path }) => ({ digest, label, path }))),
    );
  }

  async prepareCharacterSaveMigration(packageId: string, saveId: string) {
    const stored = await this.#findSave(packageId, saveId);
    if (!stored) return { status: "error" as const, message: "人物存档不存在。" };
    const sheetSystemPackage = this.#requireSheetSystemPackage(packageId);
    const result = await prepareCharacterDataMigration({
      fromVersion: stored.document.characterDataVersion,
      toVersion: sheetSystemPackage.manifest.角色数据版本,
      characterData: stored.document.characterData,
      migrations: sheetSystemPackage.characterDataMigrations ?? [],
    });
    if (result.status !== "ready") return result;
    const currentSystem = this.#resolveSystemDocument(packageId);
    if (!currentSystem) return { status: "error" as const, message: "当前系统包不存在。" };
    const migratedDocument = completeMigratedDocument(stored, currentSystem, result.candidate);
    const completed = completeCharacterDataForSystemPackage(migratedDocument, sheetSystemPackage);
    const diagnostics = validateCharacterDataForSystemPackage(completed, sheetSystemPackage);
    if (diagnostics.length > 0) {
      return { status: "error" as const, message: `人物数据升级后的最终校验失败：${diagnostics.join("；")}` };
    }
    return {
      status: "ready" as const,
      candidate: {
        saveId,
        saveName: stored.document.name,
        sourceUpdatedAt: stored.document.updatedAt,
        ...result.candidate,
        characterData: completed.characterData,
      },
    };
  }

  async commitCharacterSaveMigration(packageId: string, candidate: CharacterDataMigrationCandidate) {
    const stored = await this.#findSave(packageId, candidate.saveId);
    if (!stored || stored.document.updatedAt !== candidate.sourceUpdatedAt
      || stored.document.characterDataVersion !== candidate.fromVersion) {
      throw new Error("人物存档在确认升级前已发生变化，请重新打开后再试。");
    }
    const currentSystem = this.#resolveSystemDocument(packageId);
    if (!currentSystem) throw new Error("当前系统包不存在。");
    const sheetSystemPackage = this.#requireSheetSystemPackage(packageId);
    const document = completeCharacterDataForSystemPackage(
      completeMigratedDocument(stored, currentSystem, candidate),
      sheetSystemPackage,
    );
    const diagnostics = validateCharacterDataForSystemPackage(document, sheetSystemPackage);
    if (diagnostics.length > 0) throw new Error(`人物数据升级后的最终校验失败：${diagnostics.join("；")}`);
    const saved = await this.#characterSaves.save(
      { ...document, updatedAt: new Date().toISOString() },
      stored.media,
      this.#cloudAccountId(),
    );
    await this.#onCharacterSaved?.(saved);
    return characterSaveToSheet({
      candidate: saved,
      currentSystem: { resourceCompatibility: currentSystem.resourceCompatibility },
      sheetSystemPackage,
      installedPackages: await this.#installedPackages(),
      mediaUrl: (assetId, bytes) => this.#createMediaUrl!(assetId, bytes, "image/webp"),
    });
  }

  async saveCharacterSave(record: CharacterSaveRecord): Promise<void> {
    const currentSystem = this.#resolveSystemDocument(record.packageId);
    if (!currentSystem) return;
    const sheetSystemPackage = this.#requireSheetSystemPackage();
    if (sheetSystemPackage.manifest.ID !== currentSystem.package.id) return;
    const existing = await this.#findSave(record.packageId, record.id);
    const data = record.data.character.id === record.id
      ? record.data
      : { ...record.data, character: { ...record.data.character, id: record.id } };
    const candidate = await sheetCharacterToSave({
      name: record.name,
      data,
      currentSystem: {
        id: currentSystem.package.id,
        version: currentSystem.package.version,
        resourceCompatibility: currentSystem.resourceCompatibility,
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

  #requireSheetSystemPackage(packageId?: string): SystemPackage {
    const systemPackage = packageId ? this.#loadedPackages.get(packageId) : this.#currentPackage;
    if (!systemPackage) throw new Error("人物存档前必须先加载系统包。");
    return systemPackage;
  }

  #resolveSystemDocument(packageId: string): SystemPackageDocument | undefined {
    const configured = this.#resolveSystem(packageId);
    if (configured) return configured;
    const metadata = this.#cacheMetadata;
    return metadata?.source === "imported" && metadata.systemDocument?.package.id === packageId
      ? metadata.systemDocument
      : undefined;
  }

  async #hydrateSystemPackageCache(): Promise<void> {
    if (this.#cacheHydrated) return;
    this.#cacheHydrated = true;
    const snapshot = await this.#systemPackageCache?.load(currentSystemPackageCacheId);
    if (!snapshot) return;
    this.#currentPackage = structuredClone(snapshot.systemPackage);
    this.#loadedPackages.set(snapshot.systemPackage.manifest.ID, structuredClone(snapshot.systemPackage));
    this.#currentPackageAssets = snapshot.packageAssets.map(copyRuntimeAsset);
    this.#cacheMetadata = structuredClone(snapshot.metadata);
  }
}

function toSummary(candidate: StoredCharacterSave): CharacterSaveSummary {
  return {
    id: candidate.document.documentId,
    packageId: candidate.document.systemPackage.id,
    systemPackageVersion: candidate.document.systemPackage.version,
    name: candidate.document.name,
    updatedAt: candidate.document.updatedAt,
    characterDataVersion: candidate.document.characterDataVersion,
    syncScope: candidate.sync.scope,
    syncState: candidate.sync.state,
  };
}

function completeMigratedDocument(
  stored: StoredCharacterSave,
  currentSystem: SystemPackageDocument,
  candidate: Pick<CharacterDataMigrationCandidate, "toVersion" | "characterData">,
) {
  return {
    ...stored.document,
    systemPackage: { id: currentSystem.package.id, version: currentSystem.package.version },
    characterDataVersion: candidate.toVersion,
    characterData: structuredClone(candidate.characterData),
  };
}

function copyRuntimeAsset(asset: RuntimePackageAsset): RuntimePackageAsset {
  if (asset.staticUrl !== undefined) return { ...asset, staticUrl: asset.staticUrl };
  return { ...asset, bytes: new Uint8Array(asset.bytes) };
}

function packageScriptConsentKey(candidate: Pick<PackageScriptConsentCandidate, "packageId" | "packageVersion">): string {
  return `${packageScriptConsentKeyPrefix}${candidate.packageId}:${candidate.packageVersion}`;
}

function collectPackageScripts(systemPackage: SystemPackage): Array<{ label: string; path: string; content: string }> {
  return [
    ...(systemPackage.validationChecks ?? []).map((script) => ({ label: `校验：${script.ID}`, path: script.脚本, content: script.scriptContent })),
    ...(systemPackage.characterDataMigrations ?? []).map((script) => ({ label: `人物升级：${script.fromVersion} → ${script.toVersion}`, path: script.script, content: script.scriptContent })),
    ...(systemPackage.resourceFormatAdapters ?? []).map((script) => ({ label: `资源导入：${script.名称}`, path: script.导入脚本, content: script.importScriptContent })),
    ...(systemPackage.characterFormatAdapters ?? []).flatMap((script) => [
      ...(script.导入脚本 && script.importScriptContent
        ? [{ label: `人物导入：${script.名称}`, path: script.导入脚本, content: script.importScriptContent }]
        : []),
      ...(script.导出脚本 && script.exportScriptContent
        ? [{ label: `人物导出：${script.名称}`, path: script.导出脚本, content: script.exportScriptContent }]
        : []),
    ]),
  ];
}

async function sha256Text(content: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
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
