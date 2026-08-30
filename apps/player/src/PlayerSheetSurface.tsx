import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  loadPbcha,
  loadPbres,
  writePbcha,
  type CharacterSaveCandidate,
  type ResourcePackageCandidate,
  type SystemPackageDocument,
} from "@pbdh/contract-runtime";
import type { RemoteCloudDocument } from "@pbdh/cloud-documents";
import {
  DexieAuthorPreviewHandleStore,
  DexieLocalDocumentStore,
  DexieRuntimeCacheStore,
} from "@pbdh/local-storage";
import { platformRequestHeaders, useAuth } from "@pbdh/platform-auth/provider";
import {
  OperationStatus,
  usePlatformAppBarActions,
  usePlatformNotifications,
  usePlatformTrashSource,
  type PlatformTrashSource,
} from "@pbdh/platform-ui";

import { CharacterSaveRepository } from "./character-saves/character-save-repository.ts";
import { PlayerCloudDocumentService } from "./character-saves/cloud-document-service.ts";
import { validateCharacterSaveCandidate } from "./character-saves/character-save-validator.ts";
import {
  completeCharacterDataForSystemPackage,
  validateCharacterDataForSystemPackage,
} from "./sheet-runtime/storage/characterSaveAdapter.ts";
import {
  defaultPlayerSystemPackage,
  findPlayerSystemPackage,
  playerSystemPackageCatalog,
  type PlayerSystemPackageCatalogEntry,
} from "./playerSystemPackageCatalog.ts";
import {
  ResourceManager,
  type ResourcePackageIngress,
} from "./resource-manager/ResourceManager.tsx";
import { installMissingEmbeddedResourcePackages } from "./resources/install-embedded-resource-packages.ts";
import {
  parsePlayerMarketHandoff,
  playerMarketArchiveUrl,
  withoutPlayerMarketHandoff,
} from "./resources/market-handoff.ts";
import {
  commitResourcePackageInstall,
  commitResourcePackageRemoval,
  type ResourceLibrary,
  type ResourcePackageInstallPlan,
} from "./resources/resource-library.ts";
import {
  DexieResourcePackageRepository,
  type ResourcePackageRepository,
  type ResourcePackageSource,
} from "./resources/resource-package-repository.ts";
import { routeResourcePackage } from "./resources/route-resource-package.ts";
import { validateResourcePackageCandidate } from "./resources/resource-package-validator.ts";
import {
  buildSheetResourceLibraryInputs,
  buildSheetRuntimeMediaAssets,
  replacePlatformResourceLibraries,
  replacePlatformRuntimeMediaAssets,
} from "./sheet-runtime/adapters/platformResourceLibraries.ts";
import {
  createVirtualFileSystemFromDirectoryFiles,
  createVirtualFileSystemFromDirectoryHandle,
  createVirtualFileSystemFromZipFile,
  type PackageDirectoryHandle,
  type PackageVirtualFileSystem,
} from "./sheet-runtime/loaders/packageVfs.ts";
import { loadSystemPackageFromVfs } from "./sheet-runtime/loaders/systemPackageLoader.ts";
import { prepareCharacterDataMigration } from "./sheet-runtime/domain/characterDataMigration.ts";
import {
  nextGuideStep,
  previousGuideStep,
  startGuideSession,
  type GuideSession,
} from "./sheet-runtime/domain/characterCreationGuide.ts";
import { GuideSpotlight } from "./sheet-runtime/rendering/GuideSpotlight.tsx";
import { QuestionnaireResultDialog } from "./sheet-runtime/rendering/QuestionnaireResultDialog.tsx";
import { CharacterDataMigrationDialog } from "./sheet-runtime/rendering/CharacterDataMigrationDialog.tsx";
import { PackageScriptConsentDialog } from "./sheet-runtime/rendering/PackageScriptConsentDialog.tsx";
import { CharacterImportDialogs } from "./sheet-runtime/rendering/CharacterImportDialogs.tsx";
import { CharacterExportDialog } from "./sheet-runtime/rendering/CharacterExportDialog.tsx";
import { openQuestionnaireHost, type QuestionnaireHostSession } from "./sheet-runtime/rendering/questionnaireHost.ts";
import {
  PackageIssuePanel,
  ValidationIssueDialog,
} from "./sheet-runtime/rendering/app/AppDiagnostics.tsx";
import { PackageLoadingSurface } from "./sheet-runtime/rendering/app/PackageLoadingSurface.tsx";
import { resolveGuideTargetPageId } from "./sheet-runtime/rendering/app/guideTarget.ts";
import { useSheetOutput } from "./sheet-runtime/rendering/app/useSheetOutput.ts";
import { SheetRenderer } from "./sheet-runtime/rendering/SheetRenderer.tsx";
import { PlatformRuntimeStorage } from "./sheet-runtime/storage/platformRuntimeStorage.ts";
import type { SystemPackageCacheSnapshot } from "./sheet-runtime/storage/runtimeStorage.ts";
import type { RuntimePackageLoadResult } from "./sheet-runtime/store/runtimeTypes.ts";
import {
  configureRuntimeDependencies,
  resetRuntimeDependencies,
  useRuntimeStore,
} from "./sheet-runtime/store/runtimeStore.ts";
import { loadPlatformSystemPackageFromVfs } from "./system-package-ingress.ts";

const preferredSystemPackageKey = "pbdh:player:preferred-system-package";

export async function restorePlayerResourceLibrary(
  repository: ResourcePackageRepository,
  currentSystem: SystemPackageDocument = defaultPlayerSystemPackage.system,
): Promise<ResourceLibrary> {
  const stored = await repository.list(currentSystem.package.id);
  return new Map(stored.map((candidate) => [candidate.document.package.id, {
    document: candidate.document,
    media: candidate.media,
    routes: routeResourcePackage({ currentSystem, resourcePackage: candidate.document }),
  }] as const));
}

export function PlayerSheetSurface({
  handoffUrl = window.location.href,
  onHandoffConsumed,
}: {
  handoffUrl?: string;
  onHandoffConsumed?(cleanedUrl: URL): void;
} = {}) {
  const auth = useAuth();
  const { notify } = usePlatformNotifications();
  const importedSystemsRef = useRef(new Map<string, SystemPackageDocument>());
  const importedEmbeddedPackageIdsRef = useRef(new Map<string, Set<string>>());
  const importedEmbeddedPackagesRef = useRef(new Map<string, ReadonlyMap<string, ResourcePackageCandidate>>());
  const currentPackage = useRuntimeStore((state) => state.currentPackage);
  const currentCatalogEntry = findPlayerSystemPackage(currentPackage?.manifest.ID)
    ?? null;
  const currentSystem = currentCatalogEntry?.system
    ?? importedSystemsRef.current.get(currentPackage?.manifest.ID ?? "")
    ?? defaultPlayerSystemPackage.system;
  const resourceRepository = useMemo(() => new DexieResourcePackageRepository(), []);
  const localDocumentStore = useMemo(() => new DexieLocalDocumentStore(), []);
  const authorPreviewHandleStore = useMemo(
    () => new DexieAuthorPreviewHandleStore<PackageDirectoryHandle>(),
    [],
  );
  const systemPackageCache = useMemo(
    () => new DexieRuntimeCacheStore<SystemPackageCacheSnapshot>(),
    [],
  );
  const characterSaveRepository = useMemo(
    () => new CharacterSaveRepository(localDocumentStore),
    [localDocumentStore],
  );
  const preparePresetCharacterSave = useCallback(async (candidate: CharacterSaveCandidate): Promise<CharacterSaveCandidate> => {
    const targetSystem = findPlayerSystemPackage(candidate.document.systemPackage.id);
    if (!targetSystem) throw new Error("该人物存档所属的预置系统包不可用。");
    const targetResources = await restorePlayerResourceLibrary(resourceRepository, targetSystem.system);
    const targetRuntime = await targetSystem.load({
      currentSystem: targetSystem.system,
      installedPackages: targetResources,
    });
    if (!targetRuntime.ok) throw new Error(`目标系统包不可用：${targetRuntime.issues[0]?.text ?? "unknown"}`);
    const migration = await prepareCharacterDataMigration({
      fromVersion: candidate.document.characterDataVersion,
      toVersion: targetRuntime.package.manifest.角色数据版本,
      characterData: candidate.document.characterData,
      migrations: targetRuntime.package.characterDataMigrations ?? [],
    });
    if (migration.status === "error") throw new Error(migration.message);
    const migratedDocument = {
      ...candidate.document,
      systemPackage: { id: targetSystem.system.package.id, version: targetSystem.system.package.version },
      ...(migration.status === "ready" ? {
        characterDataVersion: migration.candidate.toVersion,
        characterData: migration.candidate.characterData,
      } : {}),
    };
    const completedDocument = completeCharacterDataForSystemPackage(migratedDocument, targetRuntime.package);
    const moduleDiagnostics = validateCharacterDataForSystemPackage(completedDocument, targetRuntime.package);
    if (moduleDiagnostics.length > 0) throw new Error(`人物存档 Module 状态无效：${moduleDiagnostics[0]}`);
    return { document: completedDocument, media: new Map(candidate.media) };
  }, [resourceRepository]);
  const validatePresetCharacterSave = useCallback(async (candidate: CharacterSaveCandidate) => {
    if (!findPlayerSystemPackage(candidate.document.systemPackage.id)) return;
    await preparePresetCharacterSave(candidate);
  }, [preparePresetCharacterSave]);
  const cloudDocumentService = useMemo(
    () => new PlayerCloudDocumentService(
      localDocumentStore,
      characterSaveRepository,
      undefined,
      validatePresetCharacterSave,
    ),
    [characterSaveRepository, localDocumentStore, validatePresetCharacterSave],
  );
  const credentialsRef = useRef(auth.credentials);
  credentialsRef.current = auth.credentials;
  const libraryRef = useRef<ResourceLibrary>(new Map());
  const runtimeStorageRef = useRef<PlatformRuntimeStorage | null>(null);
  const runtimeStorage = useMemo(() => new PlatformRuntimeStorage({
    currentSystem: (packageId) => findPlayerSystemPackage(packageId)?.system
      ?? importedSystemsRef.current.get(packageId),
    characterSaves: characterSaveRepository,
    installedPackages: async () => libraryRef.current,
    visibleCharacterSaves: () => cloudDocumentService.localSnapshot(credentialsRef.current?.accountId),
    cloudAccountId: () => credentialsRef.current?.accountId ?? null,
    onCharacterSaved: async (saved) => {
      const credentials = credentialsRef.current;
      if (credentials && saved.sync.scope === "cloud") await cloudDocumentService.flush(credentials);
      const storage = runtimeStorageRef.current;
      if (storage) {
        useRuntimeStore.setState({
          characterSaves: await storage.listCharacterSaves(saved.document.systemPackage.id),
          allCharacterSaves: await storage.listAllCharacterSaves(),
        });
      }
    },
    removeCharacterSave: async (stored) => {
      const credentials = credentialsRef.current;
      if (credentials && stored.sync.scope === "cloud" && stored.sync.accountId === credentials.accountId) {
        await cloudDocumentService.trash(stored.document.documentId, credentials);
      } else {
        await characterSaveRepository.trash(stored.document.documentId);
      }
    },
    systemPackageCache,
  }), [characterSaveRepository, cloudDocumentService, systemPackageCache]);
  runtimeStorageRef.current = runtimeStorage;
  const [library, setLibrary] = useState<ResourceLibrary>(libraryRef.current);
  const [libraryReady, setLibraryReady] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [incomingPackage, setIncomingPackage] = useState<ResourcePackageIngress>();
  const [surfaceError, setSurfaceError] = useState<string>();
  const [cloudNotice, setCloudNotice] = useState<string>();
  const [cloudDialog, setCloudDialog] = useState<"conflict" | null>(null);
  const [playerOperation, setPlayerOperation] = useState<"save" | "cloud-sync" | "cloud-conflict" | "character-import" | "character-export" | "pending-delete" | null>(null);
  const [selectedCharacterSaveId, setSelectedCharacterSaveId] = useState("");
  const [guideSession, setGuideSession] = useState<GuideSession | null>(null);
  const [pendingNativeCharacterImport, setPendingNativeCharacterImport] = useState<{
    candidate: CharacterSaveCandidate;
    targetSystem: PlayerSystemPackageCatalogEntry | null;
    importKind: "new" | "conflict";
  } | null>(null);
  const handoffStartedRef = useRef<string | null>(null);
  const runtimeReadyRef = useRef(false);
  const recoveredAccountRef = useRef<string | undefined>(undefined);
  const characterFileInputRef = useRef<HTMLInputElement>(null);
  const packageFileInputRef = useRef<HTMLInputElement>(null);
  const guideButtonRef = useRef<HTMLButtonElement>(null);
  const questionnaireSessionRef = useRef<QuestionnaireHostSession | null>(null);

  const characterData = useRuntimeStore((state) => state.characterData);
  const characterSaves = useRuntimeStore((state) => state.characterSaves);
  const allCharacterSaves = useRuntimeStore((state) => state.allCharacterSaves);
  const activeCharacterSaveId = useRuntimeStore((state) => state.activeCharacterSaveId);
  const bootStatus = useRuntimeStore((state) => state.bootStatus);
  const packageLoadProgress = useRuntimeStore((state) => state.packageLoadProgress);
  const packageLoadingPresentation = useRuntimeStore((state) => state.packageLoadingPresentation);
  const packageIssues = useRuntimeStore((state) => state.packageIssues);
  const importError = useRuntimeStore((state) => state.importError);
  const importNotice = useRuntimeStore((state) => state.importNotice);
  const pendingSystemPackageImport = useRuntimeStore((state) => state.pendingSystemPackageImport);
  const pendingQuestionnaireResult = useRuntimeStore((state) => state.pendingQuestionnaireResult);
  const pendingCharacterDataMigration = useRuntimeStore((state) => state.pendingCharacterDataMigration);
  const pendingPackageScriptConsent = useRuntimeStore((state) => state.pendingPackageScriptConsent);
  const pendingCharacterConversion = useRuntimeStore((state) => state.pendingCharacterConversion);
  const pendingCharacterFormatSelection = useRuntimeStore((state) => state.pendingCharacterFormatSelection);
  const cardTableCardWidths = useRuntimeStore((state) => state.cardTableCardWidths);
  const initialize = useRuntimeStore((state) => state.initialize);
  const refreshPlatformResources = useRuntimeStore((state) => state.refreshPlatformResources);
  const switchToPresetSystemPackage = useRuntimeStore((state) => state.switchToPresetSystemPackage);
  const uploadSystemPackageFromFile = useRuntimeStore((state) => state.uploadSystemPackageFromFile);
  const confirmSystemPackageImport = useRuntimeStore((state) => state.confirmSystemPackageImport);
  const cancelSystemPackageImport = useRuntimeStore((state) => state.cancelSystemPackageImport);
  const authorPreviewActive = useRuntimeStore((state) => state.authorPreviewActive);
  const enterAuthorPreview = useRuntimeStore((state) => state.enterAuthorPreview);
  const exitAuthorPreview = useRuntimeStore((state) => state.exitAuthorPreview);
  const createCharacterSave = useRuntimeStore((state) => state.createCharacterSave);
  const switchCharacterSave = useRuntimeStore((state) => state.switchCharacterSave);
  const renameCharacterSave = useRuntimeStore((state) => state.renameCharacterSave);
  const duplicateCharacterSave = useRuntimeStore((state) => state.duplicateCharacterSave);
  const deleteCharacterSave = useRuntimeStore((state) => state.deleteCharacterSave);
  const prepareQuestionnaireResult = useRuntimeStore((state) => state.prepareQuestionnaireResult);
  const confirmQuestionnaireResult = useRuntimeStore((state) => state.confirmQuestionnaireResult);
  const cancelQuestionnaireResult = useRuntimeStore((state) => state.cancelQuestionnaireResult);
  const confirmCharacterDataMigration = useRuntimeStore((state) => state.confirmCharacterDataMigration);
  const cancelCharacterDataMigration = useRuntimeStore((state) => state.cancelCharacterDataMigration);
  const confirmPackageScriptConsent = useRuntimeStore((state) => state.confirmPackageScriptConsent);
  const cancelPackageScriptConsent = useRuntimeStore((state) => state.cancelPackageScriptConsent);
  const importCharacterDataFromFile = useRuntimeStore((state) => state.importCharacterDataFromFile);
  const selectCharacterFormatAdapter = useRuntimeStore((state) => state.selectCharacterFormatAdapter);
  const confirmCharacterConversion = useRuntimeStore((state) => state.confirmCharacterConversion);
  const cancelCharacterConversion = useRuntimeStore((state) => state.cancelCharacterConversion);
  const tidyCardTable = useRuntimeStore((state) => state.tidyCardTable);
  const runValidationChecks = useRuntimeStore((state) => state.runValidationChecks);
  const runPreOutputValidation = useRuntimeStore((state) => state.runPreOutputValidation);
  const validationIssues = useRuntimeStore((state) => state.validationIssues);
  const activeCharacterSave = characterSaves.find((save) => save.id === activeCharacterSaveId);
  const activeCharacterSaveName = activeCharacterSave?.name ?? "未命名角色";
  const selectedCharacterSave = allCharacterSaves.find((save) => save.id === selectedCharacterSaveId);
  useEffect(() => {
    if (activeCharacterSaveId) setSelectedCharacterSaveId(activeCharacterSaveId);
  }, [activeCharacterSaveId]);
  const {
    printMode,
    validationDialogOpen,
    pendingExternalExport,
    outputOperation,
    beginOutput,
    handleValidation,
    exportCharacterText,
    exportWithCharacterAdapter,
    closeValidationDialog,
    continuePendingOutput,
    cancelExternalExport,
    confirmExternalExport,
  } = useSheetOutput({
    currentPackage,
    characterData,
    activeCharacterSaveName,
    cardTableCardWidths,
    tidyCardTable,
    runValidationChecks,
    runPreOutputValidation,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const credentials = credentialsRef.current;
        if (credentials) await cloudDocumentService.recover(credentials);
        else await cloudDocumentService.localSnapshot();
        recoveredAccountRef.current = credentials?.accountId ?? "local";
        for (const entry of playerSystemPackageCatalog) {
          await installMissingEmbeddedResourcePackages({
            systemPackage: entry.system,
            embeddedResourceIndex: entry.preset.embeddedResourceIndex,
            systemPackageBaseUrl: `${import.meta.env.BASE_URL}system-packages/${entry.preset.directory}`,
            repository: resourceRepository,
          });
        }
        const restored = await restorePlayerResourceLibrary(
          resourceRepository,
          defaultPlayerSystemPackage.system,
        );
        if (cancelled) return;
        libraryRef.current = restored;
        setLibrary(restored);
        setLibraryReady(true);
        configureRuntimeDependencies({
          storage: runtimeStorage,
          loadSystemPackageFromFile: async (file) => {
            const vfs = await createVirtualFileSystemFromZipFile(file);
            return vfs.ok
              ? loadImportedSystemPackage(vfs.vfs, true)
              : { ok: false, issues: vfs.issues };
          },
          loadSystemPackageFromDirectory: async (files) => {
            const vfs = await createVirtualFileSystemFromDirectoryFiles(files);
            return vfs.ok
              ? loadImportedSystemPackage(vfs.vfs, true)
              : { ok: false, issues: vfs.issues };
          },
          loadSystemPackageFromDirectoryHandle: async (handle) => {
            const vfs = await createVirtualFileSystemFromDirectoryHandle(handle);
            return vfs.ok
              ? loadImportedSystemPackage(vfs.vfs, false)
              : { ok: false, issues: vfs.issues };
          },
          loadPreviewDirectoryHandle: () => authorPreviewHandleStore.load(),
          savePreviewDirectoryHandle: (handle) => authorPreviewHandleStore.save(handle),
          loadPresetSystemPackage: async (preset, onProgress) => {
            const entry = findPlayerSystemPackage(preset.id);
            if (!entry) throw new Error(`未知预置系统包：${preset.id}`);
            const routed = await restorePlayerResourceLibrary(resourceRepository, entry.system);
            libraryRef.current = routed;
            setLibrary(routed);
            onProgress?.({ completed: 0, total: entry.preset.metadataFileCount });
            return entry.load({
              currentSystem: entry.system,
              installedPackages: routed,
            });
          },
        });
        const cachedMetadata = await runtimeStorage.loadCurrentSystemPackageCacheMetadata();
        if (cachedMetadata?.source === "imported" && cachedMetadata.systemDocument) {
          const system = cachedMetadata.systemDocument;
          const embedded = cachedMetadata.embeddedResources ?? [];
          importedSystemsRef.current.set(system.package.id, system);
          importedEmbeddedPackageIdsRef.current.set(
            system.package.id,
            new Set(embedded.map((candidate) => candidate.document.package.id)),
          );
          importedEmbeddedPackagesRef.current.set(
            system.package.id,
            new Map(embedded.map((candidate) => [candidate.document.package.id, candidate])),
          );
          const routed = await restorePlayerResourceLibrary(resourceRepository, system);
          libraryRef.current = routed;
          setLibrary(routed);
        }
        await initialize(playerSystemPackageCatalog.map((entry) => entry.preset));
        if (cancelled) return;
        const state = useRuntimeStore.getState();
        if (!state.authorPreviewActive) {
          const preferred = findPlayerSystemPackage(localStorage.getItem(preferredSystemPackageKey) ?? undefined)
            ?? defaultPlayerSystemPackage;
          const importedWasRestored = cachedMetadata?.source === "imported"
            && cachedMetadata.systemDocument?.package.id === state.currentPackage?.manifest.ID;
          if (!importedWasRestored) {
            await switchToPresetSystemPackage(preferred.preset, true);
          }
        }
        runtimeReadyRef.current = true;
      } catch (error) {
        if (!cancelled) setSurfaceError(error instanceof Error ? error.message : "Player 初始化失败");
      }
    })();
    return () => {
      cancelled = true;
      runtimeReadyRef.current = false;
      resetRuntimeDependencies();
    };
  }, [authorPreviewHandleStore, cloudDocumentService, initialize, resourceRepository, runtimeStorage, switchToPresetSystemPackage]);

  async function loadImportedSystemPackage(
    vfs: PackageVirtualFileSystem,
    persistEmbeddedResources: boolean,
  ): Promise<RuntimePackageLoadResult> {
    const platform = await loadPlatformSystemPackageFromVfs(vfs);
    if (!platform.ok) return { ok: false, issues: platform.issues };

    const system = platform.package.document;
    const installed = await restorePlayerResourceLibrary(resourceRepository, system);
    const routed = new Map(installed);
    for (const candidate of platform.package.embeddedResources.values()) {
      routed.set(candidate.document.package.id, {
        document: structuredClone(candidate.document),
        media: new Map(candidate.media),
        routes: routeResourcePackage({ currentSystem: system, resourcePackage: candidate.document }),
      });
    }
    const runtime = await loadSystemPackageFromVfs(vfs, {
      resourceLibraries: buildSheetResourceLibraryInputs({
        currentSystem: system,
        installedPackages: routed,
      }),
      packageAssets: buildSheetRuntimeMediaAssets(routed),
    });
    if (!runtime.ok) return runtime;

    const embeddedResources = [...platform.package.embeddedResources.values()].map((candidate) => ({
      document: structuredClone(candidate.document),
      media: new Map(candidate.media),
    }));
    const commit = async () => {
      if (persistEmbeddedResources) {
        for (const candidate of embeddedResources) {
          await resourceRepository.replace(system.package.id, candidate, "bundled");
        }
      }
      importedSystemsRef.current.set(system.package.id, system);
      importedEmbeddedPackageIdsRef.current.set(
        system.package.id,
        new Set(embeddedResources.map((candidate) => candidate.document.package.id)),
      );
      importedEmbeddedPackagesRef.current.set(
        system.package.id,
        new Map(embeddedResources.map((candidate) => [candidate.document.package.id, candidate])),
      );
      libraryRef.current = routed;
      setLibrary(routed);
    };
    if (!persistEmbeddedResources) {
      await commit();
      return runtime;
    }
    return {
      ...runtime,
      cacheMetadata: {
        source: "imported",
        systemDocument: structuredClone(system),
        embeddedResources,
      },
      commit,
    };
  }

  useEffect(() => {
    if (auth.status === "loading" || auth.status === "working" || !runtimeReadyRef.current) return;
    const accountKey = auth.credentials?.accountId ?? "local";
    if (recoveredAccountRef.current === accountKey) return;
    recoveredAccountRef.current = accountKey;
    void (async () => {
      try {
        if (auth.credentials) await cloudDocumentService.recover(auth.credentials);
        else await cloudDocumentService.localSnapshot();
        await reloadActiveSystemPackage();
      } catch (error) {
        setCloudNotice(error instanceof Error ? error.message : "人物存档恢复失败");
      }
    })();
  }, [auth.credentials, auth.status, cloudDocumentService, switchToPresetSystemPackage]);

  useEffect(() => {
    setGuideSession(null);
    questionnaireSessionRef.current?.close();
    questionnaireSessionRef.current = null;
  }, [currentPackage?.manifest.ID, currentPackage?.manifest.版本]);

  useEffect(() => () => questionnaireSessionRef.current?.close(), []);

  useEffect(() => {
    if (!importNotice) return;
    notify(importNotice);
    useRuntimeStore.setState({ importNotice: null });
  }, [importNotice, notify]);

  useEffect(() => {
    if (!cloudNotice) return;
    notify(cloudNotice);
    setCloudNotice(undefined);
  }, [cloudNotice, notify]);

  useEffect(() => {
    if (!libraryReady || handoffStartedRef.current === handoffUrl) return;
    const handoff = parsePlayerMarketHandoff(handoffUrl);
    if (!handoff) return;
    handoffStartedRef.current = handoffUrl;
    const cleanedUrl = withoutPlayerMarketHandoff(handoffUrl);
    if (onHandoffConsumed) onHandoffConsumed(cleanedUrl);
    else window.history.replaceState(null, "", `${cleanedUrl.pathname}${cleanedUrl.search}${cleanedUrl.hash}`);
    setManagerOpen(true);
    const ingressId = `market:${handoff.publicationId}:${handoff.snapshotDigest}`;
    void fetch(playerMarketArchiveUrl(handoff), auth.credentials
      ? { headers: platformRequestHeaders(auth.credentials) }
      : undefined)
      .then(async (response) => {
        if (!response.ok) throw new Error("无法取得市场资源包");
        return new Uint8Array(await response.arrayBuffer());
      })
      .then((bytes) => setIncomingPackage({
        id: ingressId,
        source: "market",
        bytes,
        expectedMarketHandoff: handoff,
      }))
      .catch((error) => setIncomingPackage({
        id: ingressId,
        source: "market",
        diagnostics: [{
          code: "player.market-handoff.request-failed",
          severity: "error",
          family: "player",
          version: "1",
          location: "/publication",
          params: { message: error instanceof Error ? error.message : "unknown" },
        }],
      }));
  }, [auth.credentials, handoffUrl, libraryReady, onHandoffConsumed]);

  async function flushCurrentCharacter(): Promise<void> {
    const state = useRuntimeStore.getState();
    const data = state.characterData;
    const saveId = state.activeCharacterSaveId;
    if (!data || !saveId) return;
    const summary = state.characterSaves.find((save) => save.id === saveId);
    await runtimeStorage.saveCharacterSave({
      id: saveId,
      packageId: data.systemPackage.id,
      name: summary?.name ?? "未命名角色",
      updatedAt: data.updatedAt,
      data,
    });
  }

  async function reloadActiveSystemPackage(): Promise<void> {
    const activePackageId = useRuntimeStore.getState().currentPackage?.manifest.ID;
    const entry = findPlayerSystemPackage(activePackageId);
    if (entry) {
      await switchToPresetSystemPackage(entry.preset, true);
      return;
    }
    await initialize(playerSystemPackageCatalog.map((candidate) => candidate.preset));
  }

  async function refreshInstalledResources(next: ResourceLibrary): Promise<void> {
    const basePackage = useRuntimeStore.getState().basePackage;
    if (!basePackage) throw new Error("当前系统包尚未准备完成。");
    const refreshedBasePackage = replacePlatformResourceLibraries({
      currentSystem,
      basePackage,
      installedPackages: next,
      ...(currentCatalogEntry?.embeddedResourceLibraries === "legacy-static"
        ? { preloadedPackageIds: new Set(currentEmbeddedPackageIndex().keys()) }
        : {}),
    });
    const currentAssets = await runtimeStorage.loadCurrentPackageAssets(currentSystem.package.id);
    await refreshPlatformResources(
      refreshedBasePackage,
      replacePlatformRuntimeMediaAssets(currentAssets, next),
    );
  }

  async function handleSwitchSystem(entry: PlayerSystemPackageCatalogEntry): Promise<void> {
    if (entry.system.package.id === currentSystem.package.id && !authorPreviewActive) return;
    try {
      await flushCurrentCharacter();
      if (authorPreviewActive) exitAuthorPreview();
      await switchToPresetSystemPackage(entry.preset, true);
      if (useRuntimeStore.getState().currentPackage?.manifest.ID === entry.system.package.id) {
        localStorage.setItem(preferredSystemPackageKey, entry.system.package.id);
      }
    } catch (error) {
      setCloudNotice(error instanceof Error ? error.message : "系统包切换失败");
    }
  }

  async function handlePackageFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (authorPreviewActive) exitAuthorPreview();
    await uploadSystemPackageFromFile(file);
    event.target.value = "";
  }

  function handleSystemSelection(event: ChangeEvent<HTMLSelectElement>) {
    const entry = playerSystemPackageCatalog.find((candidate) =>
      candidate.system.package.id === event.target.value);
    if (entry) void handleSwitchSystem(entry);
  }

  async function handleEnterAuthorPreview() {
    const previewWindow = window as typeof window & {
      showDirectoryPicker?: () => Promise<PackageDirectoryHandle>;
    };
    if (!previewWindow.showDirectoryPicker) {
      useRuntimeStore.setState({
        importNotice: "当前浏览器不支持 File System Access API，无法进入系统包预览。",
      });
      return;
    }
    try {
      await enterAuthorPreview(await previewWindow.showDirectoryPicker());
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      useRuntimeStore.setState({ importError: "无法选择或授权预览开发目录。" });
    }
  }

  async function commitInstall(
    plan: Exclude<ResourcePackageInstallPlan, { kind: "no-op" }>,
    source: ResourcePackageSource,
  ) {
    await resourceRepository.replace(currentSystem.package.id, plan.candidate, source);
    const next = commitResourcePackageInstall(libraryRef.current, plan);
    libraryRef.current = next;
    setLibrary(next);
    await refreshInstalledResources(next);
  }

  async function removePackage(packageId: string) {
    if (currentEmbeddedPackageIndex().has(packageId)) {
      throw new Error("系统包内置资源不能移除；如已安装更新版，可恢复内置版本。");
    }
    await resourceRepository.remove(currentSystem.package.id, packageId);
    const next = commitResourcePackageRemoval(libraryRef.current, packageId);
    libraryRef.current = next;
    setLibrary(next);
    await refreshInstalledResources(next);
  }

  async function handleCreateSave() {
    if (playerOperation) return;
    const name = window.prompt("新角色存档名称", "未命名角色")?.trim();
    setPlayerOperation("save");
    try {
      await createCharacterSave(name || "未命名角色");
    } finally {
      setPlayerOperation(null);
    }
  }

  async function handleRenameSave() {
    if (!activeCharacterSaveId || playerOperation) return;
    const currentName = characterSaves.find((save) => save.id === activeCharacterSaveId)?.name ?? "未命名角色";
    const name = window.prompt("角色存档名称", currentName)?.trim();
    if (!name) return;
    setPlayerOperation("save");
    try {
      await renameCharacterSave(activeCharacterSaveId, name);
    } finally {
      setPlayerOperation(null);
    }
  }

  async function handleDeleteSave() {
    if (!activeCharacterSaveId || playerOperation || !window.confirm("删除当前角色存档？")) return;
    setPlayerOperation("save");
    try {
      await deleteCharacterSave(activeCharacterSaveId);
    } finally {
      setPlayerOperation(null);
    }
  }

  async function handleDuplicateSave() {
    if (!activeCharacterSaveId || playerOperation) return;
    setPlayerOperation("save");
    try {
      await duplicateCharacterSave(activeCharacterSaveId);
    } finally {
      setPlayerOperation(null);
    }
  }

  async function syncActiveCharacter() {
    const credentials = credentialsRef.current;
    if (!credentials || !activeCharacterSaveId || playerOperation) return;
    setPlayerOperation("cloud-sync");
    try {
      await flushCurrentCharacter();
      const stored = (await cloudDocumentService.localSnapshot(credentials.accountId)).find((save) =>
        save.document.documentId === activeCharacterSaveId);
      if (!stored) throw new Error("没有找到当前人物存档。");
      if (stored.sync.scope === "local-only") {
        await cloudDocumentService.enable(activeCharacterSaveId, credentials);
        setCloudNotice("当前人物存档已复制到云端。");
      } else if (stored.sync.state === "conflict") {
        setCloudDialog("conflict");
        return;
      } else {
        await cloudDocumentService.flush(credentials);
        setCloudNotice("当前人物存档已同步。");
      }
      await reloadActiveSystemPackage();
    } catch (error) {
      setCloudNotice(error instanceof Error ? error.message : "人物存档同步失败");
    } finally {
      setPlayerOperation(null);
    }
  }

  async function resolveConflict(action: "local" | "cloud" | "copy") {
    const credentials = credentialsRef.current;
    if (!credentials || !activeCharacterSaveId || playerOperation) return;
    setPlayerOperation("cloud-conflict");
    try {
      if (action === "local") {
        await cloudDocumentService.overwriteWithLocal(activeCharacterSaveId, credentials);
      } else if (action === "cloud") {
        await cloudDocumentService.keepCloud(activeCharacterSaveId, credentials);
      } else {
        const source = (await cloudDocumentService.localSnapshot(credentials.accountId)).find((save) =>
          save.document.documentId === activeCharacterSaveId);
        if (!source) throw new Error("没有找到冲突人物存档。");
        const now = new Date().toISOString();
        await characterSaveRepository.import({
          document: {
            ...structuredClone(source.document),
            documentId: crypto.randomUUID(),
            name: `${source.document.name} 本地副本`,
            createdAt: now,
            updatedAt: now,
          },
          media: source.media,
        });
        await cloudDocumentService.keepCloud(activeCharacterSaveId, credentials);
      }
      setCloudDialog(null);
      await reloadActiveSystemPackage();
    } catch (error) {
      setCloudNotice(error instanceof Error ? error.message : "人物存档冲突处理失败");
    } finally {
      setPlayerOperation(null);
    }
  }

  const playerTrashSource = useMemo<PlatformTrashSource>(() => ({
    id: "player-character-saves",
    async list() {
      const local = (await characterSaveRepository.listTrash()).map((item) => ({
        id: `local:${item.document.documentId}`,
        name: item.document.name || "未命名角色",
        documentType: "人物存档" as const,
        location: "local" as const,
        deletedAt: item.deletedAt,
        purgeAfter: item.purgeAfter,
      }));
      const credentials = credentialsRef.current;
      if (!credentials) return local;
      const cloud = (await cloudDocumentService.listTrash(credentials)).map((remote) => ({
        id: `cloud:${remote.documentId}`,
        name: remoteDocumentName(remote),
        documentType: "人物存档" as const,
        location: "cloud" as const,
        deletedAt: remote.deletedAt!,
        purgeAfter: remote.purgeAfter,
      }));
      return [...local, ...cloud];
    },
    async restore(itemId) {
      const [location, documentId] = splitTrashItemId(itemId);
      if (location === "local") await characterSaveRepository.restore(documentId);
      else {
        const credentials = credentialsRef.current;
        if (!credentials) throw new Error("请先登录再恢复云端人物存档。");
        const remote = (await cloudDocumentService.listTrash(credentials))
          .find((item) => item.documentId === documentId);
        if (!remote) throw new Error("云端回收站里找不到这个人物存档。");
        await cloudDocumentService.restoreFromTrash(remote, credentials);
      }
      await reloadActiveSystemPackage();
    },
    async deletePermanently(itemId) {
      const [location, documentId] = splitTrashItemId(itemId);
      if (location === "local") return characterSaveRepository.deleteFromTrash(documentId);
      const credentials = credentialsRef.current;
      if (!credentials) throw new Error("请先登录再永久删除云端人物存档。");
      const remote = (await cloudDocumentService.listTrash(credentials))
        .find((item) => item.documentId === documentId);
      if (!remote) throw new Error("云端回收站里找不到这个人物存档。");
      await cloudDocumentService.deleteFromTrash(remote, credentials);
    },
  }), [characterSaveRepository, cloudDocumentService]);
  usePlatformTrashSource(playerTrashSource);

  function currentEmbeddedPackageIndex(): Map<string, { version: string; snapshotDigest: string }> {
    if (currentCatalogEntry) {
      return new Map(currentCatalogEntry.preset.embeddedResourceIndex.map((item) => [item.packageId, {
        version: item.version,
        snapshotDigest: item.snapshotDigest,
      }]));
    }
    const candidates = importedEmbeddedPackagesRef.current.get(currentSystem.package.id) ?? new Map();
    return new Map([...candidates].map(([packageId, candidate]) => [packageId, {
      version: candidate.document.package.version,
      snapshotDigest: candidate.document.snapshotDigest,
    }]));
  }

  async function loadCurrentEmbeddedPackage(packageId: string): Promise<ResourcePackageCandidate | null> {
    const imported = importedEmbeddedPackagesRef.current.get(currentSystem.package.id)?.get(packageId);
    if (imported) return { document: structuredClone(imported.document), media: new Map(imported.media) };
    const indexed = currentCatalogEntry?.preset.embeddedResourceIndex.find((item) => item.packageId === packageId);
    if (!indexed || !currentCatalogEntry) return null;
    const base = `${import.meta.env.BASE_URL}system-packages/${currentCatalogEntry.preset.directory}`.replace(/\/$/u, "");
    const path = indexed.path.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(`${base}/${path}`);
    if (!response.ok) throw new Error(`无法读取系统包内置资源（HTTP ${response.status}）。`);
    const loaded = await loadPbres(new Uint8Array(await response.arrayBuffer()), validateResourcePackageCandidate);
    const candidate = loaded.candidate;
    if (!candidate
      || candidate.document.package.id !== indexed.packageId
      || candidate.document.package.version !== indexed.version
      || candidate.document.snapshotDigest !== indexed.snapshotDigest) {
      throw new Error("系统包内置资源身份不匹配。");
    }
    return candidate;
  }

  async function openCharacterSave(save: (typeof allCharacterSaves)[number]) {
    if (save.packageId === currentPackage?.manifest.ID) {
      await switchCharacterSave(save.id);
      return;
    }
    const target = findPlayerSystemPackage(save.packageId);
    if (!target) {
      setCloudNotice(`“${save.name}”所需的系统包尚未导入。请先上传对应的 .pbsys 或目录。`);
      return;
    }
    await runtimeStorage.setActiveCharacterSaveId(save.packageId, save.id);
    await switchToPresetSystemPackage(target.preset, true);
    if (useRuntimeStore.getState().currentPackage?.manifest.ID === save.packageId) {
      localStorage.setItem(preferredSystemPackageKey, save.packageId);
    }
  }

  function characterSystemName(packageId: string): string {
    return findPlayerSystemPackage(packageId)?.system.package.name
      ?? importedSystemsRef.current.get(packageId)?.package.name
      ?? "缺少系统包";
  }

  function characterSystemAvailable(packageId: string): boolean {
    return Boolean(findPlayerSystemPackage(packageId) || importedSystemsRef.current.has(packageId));
  }

  function characterSaveOptionLabel(save: (typeof allCharacterSaves)[number]): string {
    return `${save.name}・${characterSystemName(save.packageId)}`;
  }

  function characterAdapterExportLabel(adapter: { ID: string; 名称: string }): string {
    if (adapter.ID === "zzz-character-json") return "导出为ZZZ格式";
    if (adapter.ID === "dhsheet-character") return "导出为dhsheet格式";
    return `导出为${adapter.名称}格式`;
  }

  function characterTextExportLabel(definition: { ID: string; 名称: string }): string {
    if (definition.ID === "sealdice") return "导出为海豹骰";
    return `导出为${definition.名称}`;
  }

  async function refreshAllCharacterSaves(): Promise<void> {
    useRuntimeStore.setState({ allCharacterSaves: await runtimeStorage.listAllCharacterSaves() });
  }

  async function handleCharacterFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || playerOperation) return;
    setPlayerOperation("character-import");
    try {
      if (!file.name.toLowerCase().endsWith(".pbcha")) {
        await importCharacterDataFromFile(file);
        return;
      }
      const result = await loadPbcha(
        new Uint8Array(await file.arrayBuffer()),
        validateCharacterSaveCandidate,
      );
      if (!result.candidate) {
        throw new Error(`人物存档无效：${result.diagnostics[0]?.code ?? "unknown"}`);
      }
      const targetSystem = findPlayerSystemPackage(result.candidate.document.systemPackage.id);
      const prepared = targetSystem
        ? await preparePresetCharacterSave(result.candidate)
        : result.candidate;
      const plan = await characterSaveRepository.planImport(prepared);
      if (plan.kind === "duplicate") {
        setCloudNotice(`人物存档“${plan.existing.document.name}”已存在，未重复导入。`);
        return;
      }
      setPendingNativeCharacterImport({
        candidate: plan.candidate,
        targetSystem: targetSystem ?? null,
        importKind: plan.kind,
      });
    } catch (error) {
      setCloudNotice(error instanceof Error ? error.message : "人物存档导入失败");
    } finally {
      event.target.value = "";
      setPlayerOperation(null);
    }
  }

  async function confirmNativeCharacterImport(mode: "new" | "copy" | "replace") {
    const pending = pendingNativeCharacterImport;
    if (!pending || playerOperation) return;
    setPlayerOperation("character-import");
    try {
      const imported = mode === "copy"
        ? await characterSaveRepository.importAsCopy(
          pending.candidate,
          pending.targetSystem ? credentialsRef.current?.accountId ?? null : null,
        )
        : await characterSaveRepository.import(
          pending.candidate,
          pending.targetSystem ? credentialsRef.current?.accountId ?? null : null,
        );
      await runtimeStorage.setActiveCharacterSaveId(
        imported.document.systemPackage.id,
        imported.document.documentId,
      );
      if (pending.targetSystem && credentialsRef.current && imported.sync.scope === "cloud") {
        await cloudDocumentService.flush(credentialsRef.current);
      }
      if (pending.targetSystem) {
        await switchToPresetSystemPackage(pending.targetSystem.preset, true);
        if (useRuntimeStore.getState().currentPackage?.manifest.ID === pending.targetSystem.system.package.id) {
          localStorage.setItem(preferredSystemPackageKey, pending.targetSystem.system.package.id);
        }
        setCloudNotice(`已导入人物存档：${imported.document.name}`);
      } else {
        await refreshAllCharacterSaves();
        setCloudNotice(`已保存待匹配人物存档：${imported.document.name}。上传对应系统包后会自动打开。`);
      }
      setPendingNativeCharacterImport(null);
    } catch (error) {
      setCloudNotice(error instanceof Error ? error.message : "人物存档导入失败");
    } finally {
      setPlayerOperation(null);
    }
  }

  async function exportCharacterSave(saveId: string) {
    if (playerOperation) return;
    setPlayerOperation("character-export");
    try {
      if (saveId === activeCharacterSaveId) await flushCurrentCharacter();
      const stored = (await cloudDocumentService.localSnapshot(credentialsRef.current?.accountId)).find((save) =>
        save.document.documentId === saveId);
      if (!stored) throw new Error("没有找到人物存档。");
      const bytes = writePbcha(stored.document, stored.media);
      const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: "application/zip" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeFileName(stored.document.name)}.pbcha`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setCloudNotice(error instanceof Error ? error.message : "人物存档导出失败");
    } finally {
      setPlayerOperation(null);
    }
  }

  async function exportActiveCharacter() {
    if (activeCharacterSaveId) await exportCharacterSave(activeCharacterSaveId);
  }

  async function deletePendingCharacterSave(saveId: string) {
    const save = allCharacterSaves.find((candidate) => candidate.id === saveId);
    if (!save || playerOperation || characterSystemAvailable(save.packageId)) return;
    if (!window.confirm(`删除待匹配人物存档“${save.name}”？`)) return;
    setPlayerOperation("pending-delete");
    try {
      await runtimeStorage.deleteCharacterSave(save.packageId, save.id);
      await refreshAllCharacterSaves();
      setCloudNotice(`已删除待匹配人物存档：${save.name}`);
    } catch (error) {
      setCloudNotice(error instanceof Error ? error.message : "待匹配人物存档删除失败");
    } finally {
      setPlayerOperation(null);
    }
  }

  function startQuestionnaire() {
    const questionnaire = currentPackage?.questionnaireCharacterCreation;
    if (!questionnaire || !characterData) return;
    questionnaireSessionRef.current?.close();
    const opened = openQuestionnaireHost(questionnaire, (result) => {
      questionnaireSessionRef.current = null;
      prepareQuestionnaireResult(questionnaire.ID, result);
    });
    if (!opened.ok) {
      useRuntimeStore.setState({ importError: opened.error, importNotice: null });
      return;
    }
    questionnaireSessionRef.current = opened.session;
  }

  function closeGuide() {
    setGuideSession(null);
    window.requestAnimationFrame(() => guideButtonRef.current?.focus());
  }

  const appBarActions = useMemo(() => (
    <nav className="player-toolbar" aria-label="玩家工具栏">
      <div className="player-menu">
        <button className="player-menu-trigger" type="button" aria-haspopup="menu"><span>玩家功能</span>{outputOperation === "validation" ? <OperationStatus label="正在审核…" /> : null}</button>
        <div className="player-menu-panel" role="menu">
          <button className="player-menu-resource-manager" type="button" role="menuitem" onClick={() => setManagerOpen(true)}><span>资源管理器</span><strong>{library.size}</strong></button>
          {currentPackage?.characterCreationGuide ? (
            <button ref={guideButtonRef} type="button" role="menuitem" disabled={!characterData} onClick={() => setGuideSession(startGuideSession())}>创建向导</button>
          ) : null}
          {currentPackage?.questionnaireCharacterCreation ? (
            <button type="button" role="menuitem" disabled={!characterData} onClick={startQuestionnaire}>问卷创建</button>
          ) : null}
          <button type="button" role="menuitem" disabled={!characterData || Boolean(outputOperation)} onClick={() => void handleValidation()}>车卡审核</button>
        </div>
      </div>

      <div className="player-menu">
        <button className="player-menu-trigger" type="button" aria-haspopup="menu"><span>玩家存档</span>{playerOperation === "cloud-sync" ? <OperationStatus label="正在同步云端…" /> : playerOperation === "save" ? <OperationStatus label="正在保存…" /> : playerOperation === "pending-delete" ? <OperationStatus label="正在删除…" /> : null}</button>
        <div className="player-menu-panel" role="menu">
          <label className="player-menu-field">
            <span>切换存档</span>
            <select
              aria-label="切换人物"
              value={selectedCharacterSaveId || activeCharacterSaveId || ""}
              onChange={(event) => {
                const save = allCharacterSaves.find((candidate) => candidate.id === event.target.value);
                if (!save) return;
                setSelectedCharacterSaveId(save.id);
                void openCharacterSave(save);
              }}
              disabled={allCharacterSaves.length === 0 || Boolean(playerOperation)}
            >
              {allCharacterSaves.map((save) => <option key={save.id} value={save.id}>{characterSaveOptionLabel(save)}</option>)}
            </select>
          </label>
          {selectedCharacterSave && !characterSystemAvailable(selectedCharacterSave.packageId) ? (
            <div className="player-menu-character-actions">
              <button type="button" role="menuitem" disabled={Boolean(playerOperation)} onClick={() => void exportCharacterSave(selectedCharacterSave.id)}>导出待匹配存档</button>
              <button className="danger" type="button" role="menuitem" disabled={Boolean(playerOperation)} onClick={() => void deletePendingCharacterSave(selectedCharacterSave.id)}>删除待匹配存档</button>
            </div>
          ) : null}
          {auth.credentials ? (
            <button type="button" role="menuitem" disabled={!activeCharacterSaveId || Boolean(playerOperation)} onClick={() => void syncActiveCharacter()}>同步到云</button>
          ) : null}
          <button type="button" role="menuitem" disabled={Boolean(playerOperation)} onClick={() => void handleCreateSave()}>新建人物</button>
          <button type="button" role="menuitem" disabled={!activeCharacterSaveId || Boolean(playerOperation)} onClick={() => void handleRenameSave()}>重命名</button>
          <button type="button" role="menuitem" disabled={!activeCharacterSaveId || Boolean(playerOperation)} onClick={() => void handleDuplicateSave()}>复制</button>
          <button className="danger" type="button" role="menuitem" disabled={!activeCharacterSaveId || Boolean(playerOperation)} onClick={() => void handleDeleteSave()}>删除</button>
        </div>
      </div>

      <div className="player-menu">
        <button className="player-menu-trigger" type="button" aria-haspopup="menu"><span>导入导出</span>{playerOperation === "character-import" ? <OperationStatus label="正在导入人物…" /> : playerOperation === "character-export" ? <OperationStatus label="正在导出人物…" /> : outputOperation === "export" ? <OperationStatus label="正在生成导出文件…" /> : null}</button>
        <div className="player-menu-panel" role="menu">
          <button type="button" role="menuitem" disabled={Boolean(playerOperation)} onClick={() => characterFileInputRef.current?.click()}>导入人物</button>
          <button type="button" role="menuitem" disabled={!activeCharacterSaveId || Boolean(playerOperation)} onClick={() => void exportActiveCharacter()}>导出人物</button>
          {currentPackage?.characterFormatAdapters?.filter((adapter) => adapter.exportScriptContent).map((adapter) => (
            <button key={adapter.ID} type="button" role="menuitem" disabled={!characterData || Boolean(outputOperation)} onClick={() => void exportWithCharacterAdapter(adapter.ID)}>{characterAdapterExportLabel(adapter)}</button>
          ))}
          {currentPackage?.characterTextExports?.map((definition) => (
            <button key={definition.ID} type="button" role="menuitem" disabled={!characterData || Boolean(outputOperation)} onClick={() => void exportCharacterText(definition.ID)}>{characterTextExportLabel(definition)}</button>
          ))}
          <button type="button" role="menuitem" disabled={!characterData || Boolean(outputOperation)} onClick={() => void beginOutput("html")}>导出HTML</button>
          <button type="button" role="menuitem" disabled={!characterData || Boolean(outputOperation)} onClick={() => void beginOutput("print")}>导出PDF</button>
        </div>
      </div>

      <div className="player-menu">
        <button className="player-menu-trigger" type="button" aria-haspopup="menu"><span>系统包</span></button>
        <div className="player-menu-panel is-right" role="menu">
          <label className="player-menu-field player-menu-system">
            <span>当前系统包</span>
            <div>
              <select aria-label="当前系统包" value={currentSystem.package.id} disabled={bootStatus === "loading"} onChange={handleSystemSelection}>
                {currentCatalogEntry ? null : <option value={currentSystem.package.id}>{currentSystem.package.name}</option>}
                {playerSystemPackageCatalog.map((entry) => <option key={entry.system.package.id} value={entry.system.package.id}>{entry.system.package.name}</option>)}
              </select>
              <strong>v{currentSystem.package.version}</strong>
            </div>
          </label>
          <button type="button" role="menuitem" disabled={bootStatus === "loading"} onClick={() => packageFileInputRef.current?.click()}>上传系统包(.pbsys)</button>
          <button type="button" role="menuitem" disabled={bootStatus === "loading"} onClick={() => void handleEnterAuthorPreview()}>上传系统包(文件夹)</button>
         </div>
      </div>
    </nav>
  ), [activeCharacterSaveId, allCharacterSaves, auth.credentials, authorPreviewActive, bootStatus, characterData, currentCatalogEntry, currentPackage, currentSystem, exitAuthorPreview, library.size, outputOperation, playerOperation, selectedCharacterSave, selectedCharacterSaveId]);
  usePlatformAppBarActions("player", appBarActions);

  const guideTargetPageId = currentPackage?.characterCreationGuide && guideSession
    ? resolveGuideTargetPageId(
        currentPackage,
        currentPackage.characterCreationGuide.步骤[guideSession.stepIndex],
      )
    : null;

  return (
    <div className={`app-shell player-sheet-runtime${printMode ? " print-mode" : ""}`} data-framework-color-scheme="light">
      <input ref={characterFileInputRef} hidden type="file" accept=".pbcha,.json,.html,application/zip,application/json,text/html" onChange={(event) => void handleCharacterFile(event)} />
      <input ref={packageFileInputRef} hidden type="file" accept=".pbsys,application/zip" onChange={(event) => void handlePackageFile(event)} />
      {bootStatus === "loading"
        ? <PackageLoadingSurface progress={packageLoadProgress} presentation={packageLoadingPresentation} />
        : null}
      {surfaceError || importError ? <div className="message message-error" role="alert">{surfaceError ?? importError}</div> : null}
      {packageIssues.length ? <PackageIssuePanel issues={packageIssues} /> : null}
      <ValidationIssueDialog
        issues={validationIssues}
        open={validationDialogOpen}
        onClose={closeValidationDialog}
        onContinue={continuePendingOutput}
      />
      {currentPackage ? (
        <div className="player-runtime-layout">
          <main className="player-runtime-sheet">
            <SheetRenderer systemPackage={currentPackage} requestedPageId={guideTargetPageId} outputMode={printMode} />
          </main>
        </div>
      ) : null}
      {currentPackage?.characterCreationGuide && guideSession ? (
        <GuideSpotlight
          guide={currentPackage.characterCreationGuide}
          session={guideSession}
          onPrevious={() => setGuideSession((current) => current ? previousGuideStep(current) : current)}
          onNext={() => setGuideSession((current) => current
            ? nextGuideStep(current, currentPackage.characterCreationGuide?.步骤.length ?? 0)
            : current)}
          onFinish={closeGuide}
          onExit={closeGuide}
        />
      ) : null}
      {pendingQuestionnaireResult ? (
        <QuestionnaireResultDialog
          pending={pendingQuestionnaireResult}
          onConfirm={confirmQuestionnaireResult}
          onCancel={cancelQuestionnaireResult}
        />
      ) : null}
      {pendingCharacterDataMigration ? (
        <CharacterDataMigrationDialog
          pending={pendingCharacterDataMigration}
          onConfirm={confirmCharacterDataMigration}
          onCancel={cancelCharacterDataMigration}
        />
      ) : null}
      {pendingPackageScriptConsent ? (
        <PackageScriptConsentDialog
          pending={pendingPackageScriptConsent}
          onConfirm={confirmPackageScriptConsent}
          onCancel={cancelPackageScriptConsent}
        />
      ) : null}
      {pendingSystemPackageImport ? (
        <div className="character-save-dialog-backdrop">
          <section className="character-save-dialog" role="alertdialog" aria-modal="true" aria-label="确认导入系统包">
            <h2>确认切换系统包</h2>
            <p>“{pendingSystemPackageImport.packageName}” v{pendingSystemPackageImport.packageVersion} 已通过检查。</p>
            <p>{pendingSystemPackageImport.replacesCurrent
              ? "确认后才会保存并切换；取消会继续使用当前系统包。"
              : "确认后才会保存并打开这个系统包。"}</p>
            <footer>
              <button type="button" onClick={cancelSystemPackageImport}>取消</button>
              <button className="primary" type="button" onClick={() => void confirmSystemPackageImport()}>确认导入并切换</button>
            </footer>
          </section>
        </div>
      ) : null}
      <CharacterImportDialogs
        pendingConversion={pendingCharacterConversion}
        pendingSelection={pendingCharacterFormatSelection}
        onSelect={selectCharacterFormatAdapter}
        onConfirm={confirmCharacterConversion}
        onCancel={cancelCharacterConversion}
      />
      <CharacterExportDialog pending={pendingExternalExport} onConfirm={confirmExternalExport} onCancel={cancelExternalExport} />
      {pendingNativeCharacterImport ? (
        <div className="character-save-dialog-backdrop">
          <section className="character-save-dialog" role="alertdialog" aria-modal="true" aria-label="确认导入 PbDH 人物存档">
            <h2>确认导入人物存档</h2>
            <p>“{pendingNativeCharacterImport.candidate.document.name}”已通过 Character Save 文件校验。</p>
            <p>{pendingNativeCharacterImport.importKind === "conflict"
              ? "本地已有相同身份但内容不同的人物。默认另存副本；只有明确选择替换才会保留原 Save ID。"
              : pendingNativeCharacterImport.targetSystem
                ? `目标系统人物数据也已校验。确认后才会写入本地存档并切换到 ${pendingNativeCharacterImport.targetSystem.system.package.name}。`
                : `尚未安装系统包 ${pendingNativeCharacterImport.candidate.document.systemPackage.id} v${pendingNativeCharacterImport.candidate.document.systemPackage.version}。确认后会仅在本机保存为待匹配存档，不会运行人物数据或上传云端。`}</p>
            {playerOperation === "character-import" ? <OperationStatus label="正在写入人物存档…" size="regular" /> : null}
            <footer>
              <button type="button" disabled={Boolean(playerOperation)} onClick={() => setPendingNativeCharacterImport(null)}>取消</button>
              {pendingNativeCharacterImport.importKind === "conflict" ? (
                <>
                  <button type="button" disabled={Boolean(playerOperation)} onClick={() => void confirmNativeCharacterImport("replace")}>替换现有存档</button>
                  <button className="primary" type="button" disabled={Boolean(playerOperation)} onClick={() => void confirmNativeCharacterImport("copy")}>另存为副本</button>
                </>
              ) : <button className="primary" type="button" disabled={Boolean(playerOperation)} onClick={() => void confirmNativeCharacterImport("new")}>确认导入</button>}
            </footer>
          </section>
        </div>
      ) : null}
      {managerOpen ? (
        <ResourceManager
          currentSystem={currentSystem}
          library={library}
          embeddedPackageIndex={currentEmbeddedPackageIndex()}
          loadEmbeddedPackage={loadCurrentEmbeddedPackage}
          incomingPackage={incomingPackage}
          onIncomingPackageHandled={(id) => setIncomingPackage((current) => current?.id === id ? undefined : current)}
          onCommitInstall={commitInstall}
          onRemovePackage={removePackage}
          onClose={() => setManagerOpen(false)}
        />
      ) : null}
      {cloudDialog === "conflict" ? (
        <div className="character-save-dialog-backdrop">
          <section className="character-save-dialog" role="dialog" aria-modal="true">
            <h2>人物存档存在冲突</h2>
            <p>选择要保留的版本，或先把本地版本另存为副本。</p>
            {playerOperation === "cloud-conflict" ? <OperationStatus label="正在处理云端版本…" size="regular" /> : null}
            <footer>
              <button disabled={Boolean(playerOperation)} onClick={() => void resolveConflict("cloud")}>使用云端版本</button>
              <button disabled={Boolean(playerOperation)} onClick={() => void resolveConflict("copy")}>另存本地副本并使用云端</button>
              <button className="primary" disabled={Boolean(playerOperation)} onClick={() => void resolveConflict("local")}>使用本地版本覆盖云端</button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function remoteDocumentName(remote: RemoteCloudDocument): string {
  if (remote.payload && typeof remote.payload === "object" && !Array.isArray(remote.payload)) {
    const name = (remote.payload as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim()) return name;
  }
  return "未命名角色";
}

function splitTrashItemId(itemId: string): ["local" | "cloud", string] {
  const separator = itemId.indexOf(":");
  const location = itemId.slice(0, separator);
  if ((location !== "local" && location !== "cloud") || separator < 0) {
    throw new Error("回收站项目编号无效。");
  }
  return [location, itemId.slice(separator + 1)];
}

function safeFileName(value: string): string {
  return value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "-") || "未命名角色";
}
