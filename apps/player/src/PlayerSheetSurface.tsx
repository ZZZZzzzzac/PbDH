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
  writePbcha,
  type SystemPackageDocument,
} from "@pbdh/contract-runtime";
import type { RemoteCloudDocument } from "@pbdh/cloud-documents";
import {
  DexieAuthorPreviewHandleStore,
  DexieLocalDocumentStore,
} from "@pbdh/local-storage";
import { platformRequestHeaders, useAuth } from "@pbdh/platform-auth/provider";
import {
  usePlatformAccountManagement,
  usePlatformAppBarActions,
  usePlatformNotifications,
} from "@pbdh/platform-ui";

import { CharacterSaveRepository } from "./character-saves/character-save-repository.ts";
import { PlayerCloudDocumentService } from "./character-saves/cloud-document-service.ts";
import { validateCharacterSaveCandidate } from "./character-saves/character-save-validator.ts";
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
} from "./resources/resource-package-repository.ts";
import { routeResourcePackage } from "./resources/route-resource-package.ts";
import {
  buildSheetResourceLibraryInputs,
  buildSheetRuntimeMediaAssets,
} from "./sheet-runtime/adapters/platformResourceLibraries.ts";
import {
  createVirtualFileSystemFromDirectoryFiles,
  createVirtualFileSystemFromDirectoryHandle,
  createVirtualFileSystemFromZipFile,
  type PackageDirectoryHandle,
  type PackageVirtualFileSystem,
} from "./sheet-runtime/loaders/packageVfs.ts";
import { loadSystemPackageFromVfs, type PackageLoadResult } from "./sheet-runtime/loaders/systemPackageLoader.ts";
import {
  nextGuideStep,
  previousGuideStep,
  startGuideSession,
  type GuideSession,
} from "./sheet-runtime/domain/characterCreationGuide.ts";
import { GuideSpotlight } from "./sheet-runtime/rendering/GuideSpotlight.tsx";
import { QuestionnaireResultDialog } from "./sheet-runtime/rendering/QuestionnaireResultDialog.tsx";
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
  const stored = await repository.list();
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
  const characterSaveRepository = useMemo(
    () => new CharacterSaveRepository(localDocumentStore),
    [localDocumentStore],
  );
  const cloudDocumentService = useMemo(
    () => new PlayerCloudDocumentService(localDocumentStore, characterSaveRepository),
    [characterSaveRepository, localDocumentStore],
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
        });
      }
    },
    removeCharacterSave: async (stored) => {
      const credentials = credentialsRef.current;
      if (credentials && stored.sync.scope === "cloud" && stored.sync.accountId === credentials.accountId) {
        await cloudDocumentService.trash(stored.document.documentId, credentials);
      } else {
        await characterSaveRepository.remove(stored.document.documentId);
      }
    },
  }), [characterSaveRepository, cloudDocumentService]);
  runtimeStorageRef.current = runtimeStorage;
  const [library, setLibrary] = useState<ResourceLibrary>(libraryRef.current);
  const [libraryReady, setLibraryReady] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [incomingPackage, setIncomingPackage] = useState<ResourcePackageIngress>();
  const [surfaceError, setSurfaceError] = useState<string>();
  const [cloudNotice, setCloudNotice] = useState<string>();
  const [cloudTrash, setCloudTrash] = useState<RemoteCloudDocument[]>([]);
  const [cloudDialog, setCloudDialog] = useState<"conflict" | "trash" | null>(null);
  const [guideSession, setGuideSession] = useState<GuideSession | null>(null);
  const handoffStartedRef = useRef<string | null>(null);
  const runtimeReadyRef = useRef(false);
  const recoveredAccountRef = useRef<string | undefined>(undefined);
  const characterFileInputRef = useRef<HTMLInputElement>(null);
  const packageFileInputRef = useRef<HTMLInputElement>(null);
  const guideButtonRef = useRef<HTMLButtonElement>(null);
  const questionnaireSessionRef = useRef<QuestionnaireHostSession | null>(null);

  const characterData = useRuntimeStore((state) => state.characterData);
  const characterSaves = useRuntimeStore((state) => state.characterSaves);
  const activeCharacterSaveId = useRuntimeStore((state) => state.activeCharacterSaveId);
  const bootStatus = useRuntimeStore((state) => state.bootStatus);
  const packageLoadProgress = useRuntimeStore((state) => state.packageLoadProgress);
  const packageLoadingPresentation = useRuntimeStore((state) => state.packageLoadingPresentation);
  const packageIssues = useRuntimeStore((state) => state.packageIssues);
  const importError = useRuntimeStore((state) => state.importError);
  const importNotice = useRuntimeStore((state) => state.importNotice);
  const pendingQuestionnaireResult = useRuntimeStore((state) => state.pendingQuestionnaireResult);
  const cardTableCardWidths = useRuntimeStore((state) => state.cardTableCardWidths);
  const initialize = useRuntimeStore((state) => state.initialize);
  const switchToPresetSystemPackage = useRuntimeStore((state) => state.switchToPresetSystemPackage);
  const uploadSystemPackageFromFile = useRuntimeStore((state) => state.uploadSystemPackageFromFile);
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
  const tidyCardTable = useRuntimeStore((state) => state.tidyCardTable);
  const runValidationChecks = useRuntimeStore((state) => state.runValidationChecks);
  const runPreOutputValidation = useRuntimeStore((state) => state.runPreOutputValidation);
  const validationIssues = useRuntimeStore((state) => state.validationIssues);
  const activeCharacterSave = characterSaves.find((save) => save.id === activeCharacterSaveId);
  const activeCharacterSaveName = activeCharacterSave?.name ?? "未命名角色";
  const {
    printMode,
    validationDialogOpen,
    beginOutput,
    closeValidationDialog,
    continuePendingOutput,
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
        await initialize(playerSystemPackageCatalog.map((entry) => entry.preset));
        if (cancelled) return;
        const state = useRuntimeStore.getState();
        if (!state.authorPreviewActive) {
          const preferred = findPlayerSystemPackage(localStorage.getItem(preferredSystemPackageKey) ?? undefined)
            ?? defaultPlayerSystemPackage;
          await switchToPresetSystemPackage(preferred.preset, true);
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
  ): Promise<PackageLoadResult> {
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

    if (persistEmbeddedResources) {
      for (const candidate of platform.package.embeddedResources.values()) {
        await resourceRepository.replace(candidate, "file");
      }
    }
    importedSystemsRef.current.set(system.package.id, system);
    importedEmbeddedPackageIdsRef.current.set(
      system.package.id,
      new Set([...platform.package.embeddedResources.values()].map((candidate) => candidate.document.package.id)),
    );
    libraryRef.current = routed;
    setLibrary(routed);
    return runtime;
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
    const entry = findPlayerSystemPackage(activePackageId) ?? defaultPlayerSystemPackage;
    await switchToPresetSystemPackage(entry.preset, true);
  }

  async function reloadResourceCatalog(): Promise<void> {
    await flushCurrentCharacter();
    await reloadActiveSystemPackage();
  }

  async function handleSwitchSystem(entry: PlayerSystemPackageCatalogEntry): Promise<void> {
    if (entry.system.package.id === currentSystem.package.id && !authorPreviewActive) return;
    try {
      await flushCurrentCharacter();
      if (authorPreviewActive) exitAuthorPreview();
      await switchToPresetSystemPackage(entry.preset, true);
      if (useRuntimeStore.getState().currentPackage?.manifest.ID === entry.system.package.id) {
        localStorage.setItem(preferredSystemPackageKey, entry.system.package.id);
        setCloudNotice(`已切换到系统包：${entry.system.package.name}`);
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
    source: "file" | "market",
  ) {
    await resourceRepository.replace(plan.candidate, source);
    const next = commitResourcePackageInstall(libraryRef.current, plan);
    libraryRef.current = next;
    setLibrary(next);
    await reloadResourceCatalog();
  }

  async function removePackage(packageId: string) {
    await resourceRepository.remove(packageId);
    const next = commitResourcePackageRemoval(libraryRef.current, packageId);
    libraryRef.current = next;
    setLibrary(next);
    await reloadResourceCatalog();
  }

  async function handleCreateSave() {
    const name = window.prompt("新角色存档名称", "未命名角色")?.trim();
    await createCharacterSave(name || "未命名角色");
  }

  async function handleRenameSave() {
    if (!activeCharacterSaveId) return;
    const currentName = characterSaves.find((save) => save.id === activeCharacterSaveId)?.name ?? "未命名角色";
    const name = window.prompt("角色存档名称", currentName)?.trim();
    if (name) await renameCharacterSave(activeCharacterSaveId, name);
  }

  async function handleDeleteSave() {
    if (activeCharacterSaveId && window.confirm("删除当前角色存档？")) {
      await deleteCharacterSave(activeCharacterSaveId);
    }
  }

  async function syncActiveCharacter() {
    const credentials = credentialsRef.current;
    if (!credentials || !activeCharacterSaveId) return;
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
    }
  }

  async function resolveConflict(action: "local" | "cloud" | "copy") {
    const credentials = credentialsRef.current;
    if (!credentials || !activeCharacterSaveId) return;
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
    }
  }

  const openCloudTrash = useCallback(async () => {
    const credentials = credentialsRef.current;
    if (!credentials) return setCloudNotice("请先登录再查看云端回收站。");
    try {
      setCloudTrash(await cloudDocumentService.listTrash(credentials));
      setCloudDialog("trash");
    } catch (error) {
      setCloudNotice(error instanceof Error ? error.message : "云端回收站读取失败");
    }
  }, [cloudDocumentService]);
  usePlatformAccountManagement("player", "云端回收站", openCloudTrash);

  async function restoreTrashItem(remote: RemoteCloudDocument) {
    const credentials = credentialsRef.current;
    if (!credentials) return;
    try {
      await cloudDocumentService.restoreFromTrash(remote, credentials);
      setCloudTrash(await cloudDocumentService.listTrash(credentials));
      await reloadActiveSystemPackage();
    } catch (error) {
      setCloudNotice(error instanceof Error ? error.message : "云端人物存档恢复失败");
    }
  }

  async function handleCharacterFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await loadPbcha(
        new Uint8Array(await file.arrayBuffer()),
        validateCharacterSaveCandidate,
      );
      if (!result.candidate) {
        throw new Error(`人物存档无效：${result.diagnostics[0]?.code ?? "unknown"}`);
      }
      const targetSystem = findPlayerSystemPackage(result.candidate.document.systemPackage.id);
      if (!targetSystem) throw new Error("该人物存档所属的预置系统包不可用。");
      const imported = await characterSaveRepository.import(
        result.candidate,
        credentialsRef.current?.accountId ?? null,
      );
      await runtimeStorage.setActiveCharacterSaveId(
        imported.document.systemPackage.id,
        imported.document.documentId,
      );
      if (credentialsRef.current && imported.sync.scope === "cloud") {
        await cloudDocumentService.flush(credentialsRef.current);
      }
      await switchToPresetSystemPackage(targetSystem.preset, true);
      if (useRuntimeStore.getState().currentPackage?.manifest.ID === targetSystem.system.package.id) {
        localStorage.setItem(preferredSystemPackageKey, targetSystem.system.package.id);
      }
      setCloudNotice(`已导入人物存档：${imported.document.name}`);
    } catch (error) {
      setCloudNotice(error instanceof Error ? error.message : "人物存档导入失败");
    }
    event.target.value = "";
  }

  async function exportActiveCharacter() {
    if (!activeCharacterSaveId) return;
    try {
      await flushCurrentCharacter();
      const stored = (await cloudDocumentService.localSnapshot(credentialsRef.current?.accountId)).find((save) =>
        save.document.documentId === activeCharacterSaveId);
      if (!stored) throw new Error("没有找到当前人物存档。");
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
        <button className="player-menu-trigger" type="button" aria-haspopup="menu"><span>玩家功能</span></button>
        <div className="player-menu-panel" role="menu">
          <button className="player-menu-resource-manager" type="button" role="menuitem" onClick={() => setManagerOpen(true)}><span>资源管理器</span><strong>{library.size}</strong></button>
          {currentPackage?.characterCreationGuide ? (
            <button ref={guideButtonRef} type="button" role="menuitem" disabled={!characterData} onClick={() => setGuideSession(startGuideSession())}>创建向导</button>
          ) : null}
          {currentPackage?.questionnaireCharacterCreation ? (
            <button type="button" role="menuitem" disabled={!characterData} onClick={startQuestionnaire}>问卷创建</button>
          ) : null}
        </div>
      </div>

      <div className="player-menu">
        <button className="player-menu-trigger" type="button" aria-haspopup="menu"><span>玩家存档</span></button>
        <div className="player-menu-panel" role="menu">
          <div className="player-menu-current" title={activeCharacterSaveName}>
            <small>当前存档</small><strong>{activeCharacterSaveName}</strong>
            <span>{activeCharacterSave?.syncScope === "local-only" ? "本地" : activeCharacterSave?.syncState === "conflict" ? "冲突" : activeCharacterSave?.syncState === "pending" ? "待同步" : "已同步"}</span>
          </div>
          <label className="player-menu-field">
            <span>切换存档</span>
            <select
              aria-label="当前人物存档"
              value={activeCharacterSaveId ?? ""}
              onChange={(event) => void switchCharacterSave(event.target.value)}
              disabled={characterSaves.length === 0}
            >
              {characterSaves.map((save) => <option key={save.id} value={save.id}>{save.name}</option>)}
            </select>
          </label>
          {auth.credentials ? (
            <button type="button" role="menuitem" disabled={!activeCharacterSaveId} onClick={() => void syncActiveCharacter()}>同步到云</button>
          ) : null}
          <button type="button" role="menuitem" onClick={() => void handleCreateSave()}>新建人物</button>
          <button type="button" role="menuitem" disabled={!activeCharacterSaveId} onClick={() => void handleRenameSave()}>重命名</button>
          <button type="button" role="menuitem" disabled={!activeCharacterSaveId} onClick={() => void duplicateCharacterSave(activeCharacterSaveId!)}>复制</button>
          <button className="danger" type="button" role="menuitem" disabled={!activeCharacterSaveId} onClick={() => void handleDeleteSave()}>删除</button>
        </div>
      </div>

      <div className="player-menu">
        <button className="player-menu-trigger" type="button" aria-haspopup="menu"><span>导入导出</span></button>
        <div className="player-menu-panel" role="menu">
          <button type="button" role="menuitem" onClick={() => characterFileInputRef.current?.click()}>导入人物</button>
          <button type="button" role="menuitem" disabled={!activeCharacterSaveId} onClick={() => void exportActiveCharacter()}>导出人物</button>
          <button type="button" role="menuitem" disabled={!characterData} onClick={() => void beginOutput("print")}>打印</button>
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
  ), [activeCharacterSave, activeCharacterSaveId, activeCharacterSaveName, auth.credentials, authorPreviewActive, bootStatus, characterData, characterSaves, currentCatalogEntry, currentPackage, currentSystem, duplicateCharacterSave, exitAuthorPreview, library.size, switchCharacterSave]);
  usePlatformAppBarActions("player", appBarActions);

  const guideTargetPageId = currentPackage?.characterCreationGuide && guideSession
    ? resolveGuideTargetPageId(
        currentPackage,
        currentPackage.characterCreationGuide.步骤[guideSession.stepIndex],
      )
    : null;

  return (
    <div className={`app-shell player-sheet-runtime${printMode ? " print-mode" : ""}`} data-framework-color-scheme="light">
      <input ref={characterFileInputRef} hidden type="file" accept=".pbcha,application/zip" onChange={(event) => void handleCharacterFile(event)} />
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
      {managerOpen ? (
        <ResourceManager
          currentSystem={currentSystem}
          nativePackageIds={new Set(
            currentCatalogEntry?.preset.embeddedResourceIndex.map(({ packageId }) => packageId)
              ?? importedEmbeddedPackageIdsRef.current.get(currentSystem.package.id)
              ?? [],
          )}
          library={library}
          incomingPackage={incomingPackage}
          onIncomingPackageHandled={(id) => setIncomingPackage((current) => current?.id === id ? undefined : current)}
          onCommitInstall={commitInstall}
          onRemovePackage={removePackage}
          onClose={() => setManagerOpen(false)}
          onOpenResource={() => setManagerOpen(false)}
        />
      ) : null}
      {cloudDialog === "conflict" ? (
        <div className="character-save-dialog-backdrop">
          <section className="character-save-dialog" role="dialog" aria-modal="true">
            <h2>人物存档存在冲突</h2>
            <p>选择要保留的版本，或先把本地版本另存为副本。</p>
            <footer>
              <button onClick={() => void resolveConflict("cloud")}>使用云端版本</button>
              <button onClick={() => void resolveConflict("copy")}>另存本地副本并使用云端</button>
              <button className="primary" onClick={() => void resolveConflict("local")}>使用本地版本覆盖云端</button>
            </footer>
          </section>
        </div>
      ) : null}
      {cloudDialog === "trash" ? (
        <div className="character-save-dialog-backdrop">
          <section className="character-save-dialog wide" role="dialog" aria-modal="true">
            <h2>云端回收站</h2>
            {cloudTrash.length === 0 ? <p className="character-save-empty">云端回收站为空</p> : (
              <div className="character-save-list">
                {cloudTrash.map((remote) => (
                  <div className="character-save-row" key={remote.documentId}>
                    <span className="character-save-main"><strong>{remoteDocumentName(remote)}</strong></span>
                    <button onClick={() => void restoreTrashItem(remote)}>恢复</button>
                  </div>
                ))}
              </div>
            )}
            <footer><button onClick={() => setCloudDialog(null)}>关闭</button></footer>
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

function safeFileName(value: string): string {
  return value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "-") || "未命名角色";
}
