import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  loadPbres,
  RESOURCE_PACKAGE_VERSION,
  type ResourcePackageCandidate,
  type ResourcePackageLogicalDocument,
  type TabletopDocumentCandidate,
} from "@pbdh/contract-runtime";
import {
  publicationCoverPolicy,
  resourceImagePolicy,
  type ImageCropSelection,
} from "@pbdh/media-admission";
import { platformRequestHeaders, reportPlatformSessionFailure, useAuth } from "@pbdh/platform-auth/provider";
import {
  ImageCropDialog,
  OperationStatus,
  usePlatformAppBarActions,
  usePlatformNotifications,
} from "@pbdh/platform-ui";
import type { SystemPackageOption } from "@pbdh/publication-ui";
import {
  upgradePbresTemplateVersions,
  createPbresCandidateValidator,
  type ResourceFormatId,
} from "@pbdh/resource-conversion";
import { CardPreviewDialog } from "@pbdh/resource-renderer/react";
import { canonicalCardDesignSize, usesFixedSurfaceRatio } from "@pbdh/resource-renderer/core";
import {
  createTabletopDocument,
  type TabletopCommand,
  type TabletopDocumentModel,
} from "@pbdh/tabletop/core";
import { resolveTemplateFrontend } from "@pbdh/templates/frontend/lazy";
import { loadTemplateCore, upgradeTemplateResources } from "@pbdh/templates/core/lazy";

import { creatorWorkspaceDesign } from "./design.ts";
import {
  imageAsset,
  type PublicationCoverDraft,
} from "./creator-publication.ts";
export { publicationRenderer } from "./creator-publication.ts";
import {
  prepareCreatorPackageInformation,
  prepareCreatorPublication,
  publishCreatorWorkspace,
  saveCreatorPackageInformation,
  type CreatorPublicationDraft,
} from "./creator-publication-workflow.ts";
import {
  downloadBytes,
  isSemanticVersion,
} from "./creator-file-actions.ts";
import { runCreatorPackageFileWorkflow } from "./creator-package-file-workflow.ts";
import {
  CreatorColumnResizeHandle,
  creatorColumnPreferences,
  storedColumnShare,
  type CreatorAppMode,
} from "./creator-layout.tsx";
export { storedColumnShare, type CreatorAppMode } from "./creator-layout.tsx";
import { resourceTitle } from "./resource-preview.tsx";
import { matchesResourceSearchQuery, parseResourceSearchQuery } from "./resource-search-query.ts";
import {
  creatorMarketHandoffMismatch,
  parseCreatorMarketHandoff,
  withoutCreatorMarketHandoff,
  type CreatorMarketHandoff,
} from "./market-handoff.ts";
import { validateResourcePackageCandidate } from "./resource-package-validator.ts";
import { runGmTabletopFileWorkflow } from "./gm-tabletop-file-workflow.ts";
import {
  arrangeGmTabletop,
  executeGmTabletopCommand,
  placeWorkspaceResourcesOnTabletop,
  replaceTabletopInstanceFromWorkspace,
  selectTabletopInstances,
  type WorkspaceResourceSelection,
} from "./gm-tabletop-session.ts";
import { useGmTabletopViewport } from "./use-gm-tabletop-viewport.ts";
import { GmTabletopCard } from "./gm-tabletop-card.tsx";
import {
  GmTabletopWorkbench,
  type GmTabletopWorkbenchCommand,
} from "./gm-tabletop-workbench.tsx";
import {
  CreatorResourceExplorer,
  type CreatorResourceExplorerCommand,
} from "./creator-resource-explorer.tsx";
import {
  CreatorWorkbench,
  type CreatorWorkbenchCommand,
} from "./creator-workbench.tsx";
import {
  creatorActiveResourceTabKey,
  creatorResourceTabOrderKey,
  gmActiveTabletopTabKey,
  gmTabletopTabOrderKey,
  moveTab,
  readStoredTabOrder,
  reconcileTabOrder,
  resourceTabKey,
  sameTabOrder,
  writeStoredActiveTab,
  writeStoredTabOrder,
} from "./tab-order.ts";
import {
  CreatorContextMenus,
  type CreatorContextMenuCommand,
  type CreatorContextMenuState,
} from "./creator-context-menus.tsx";
import {
  CreatorDialogs,
  type CloudDocumentKind,
  type CreatorConversionReview,
  type CreatorDialogCommand,
  type CreatorDialogState,
  type CreatorOperation,
} from "./creator-dialogs.tsx";
import {
  addTemplateResource,
  closeWorkspaceResourceTab,
  copyWorkspaceResourceToPackage,
  createBlankWorkspace,
  createWorkspace,
  createWorkspaceFolder,
  deleteWorkspaceNode,
  duplicateWorkspaceResource,
  forkCurrentWorkspace,
  moveWorkspaceNode,
  pinWorkspaceResource,
  planImport,
  previewWorkspaceResource,
  removePortrait,
  renameWorkspaceFolder,
  replacePortrait,
  selectWorkspaceFolder,
  toggleWorkspaceFolder,
  updateResourcePresentation,
  updateResourceAttribution,
  updateResourceReplacement,
  updateWorkspaceResourceData,
  type CreatorWorkspace,
  type WorkspaceNodeRef,
  type WorkspaceResource,
} from "./workspace-model.ts";
import { useManagedBlobUrl, useManagedObjectUrls } from "./use-managed-object-urls.ts";
import { useCreatorDocumentPersistence } from "./use-creator-document-persistence.ts";
import { creatorWorkspaceStyle } from "./creator-style.ts";
import { useCreatorTrashSource } from "./use-creator-trash-source.ts";

const creatorOperationLabels: Record<CreatorOperation, string> = {
  "cloud-sync": "正在同步云端…",
  "cloud-conflict": "正在处理云端版本…",
  "trash-workspace": "正在移动资源包…",
  "trash-tabletop": "正在移动桌面…",
  "duplicate-tabletop": "正在复制桌面…",
  "read-tabletop": "正在检查桌面文件…",
  "import-tabletop": "正在写入桌面…",
  "export-tabletop": "正在导出桌面…",
  "read-package": "正在检查资源包…",
  "convert-package": "正在转换第三方资源…",
  "export-package": "正在导出资源包…",
  "publication-cover": "正在生成发布封面…",
  "upgrade-templates": "正在升级模板…",
};

type PendingCreatorImage =
  | { purpose: "resource-image"; file: File; workspaceKey: string; resourceId: string }
  | { purpose: "publication-cover"; file: File };

export function filterWorkspaceResources(
  workspaces: readonly CreatorWorkspace[],
  search: string,
) {
  const query = parseResourceSearchQuery(search);
  return workspaces.flatMap((workspace) => workspace.document.resources.flatMap((item) => {
    const searchable = [workspace.document.package.name, item.path, item.template.id,
      JSON.stringify(item.data)].join("\n");
    return matchesResourceSearchQuery(item, searchable, query) ? [{ workspace, resource: item }] : [];
  }));
}


function replacementFailureMessage(code: string): string {
  switch (code) {
    case "tabletop.replacement.source-not-found":
    case "tabletop.replacement.workspace-not-found":
      return "找不到原卡所属的资源包，原卡没有变化。";
    case "tabletop.replacement.unsupported":
      return "这张卡没有这个切换选项，原卡没有变化。";
    case "tabletop.replacement.target-not-found":
      return "目标卡已不存在，原卡没有变化。";
    case "tabletop.replacement.template-unsupported":
      return "目标卡的类型暂不支持，原卡没有变化。";
    case "tabletop.replacement.source-media-missing":
      return "目标卡所需的图片不完整，原卡没有变化。";
    case "tabletop.replacement.target-mismatch":
      return "目标卡与切换设置不一致，原卡没有变化。";
    default:
      return "换卡失败，原卡没有变化。";
  }
}









export function CreatorWorkspacePrototype({
  surfaceVisible = true,
  mode,
  onModeChange,
  handoffUrl = window.location.href,
  onHandoffConsumed,
  systemPackageOptions = [],
}: {
  surfaceVisible?: boolean;
  mode?: CreatorAppMode;
  onModeChange?(mode: CreatorAppMode): void;
  handoffUrl?: string;
  onHandoffConsumed?(cleanedUrl: URL): void;
  systemPackageOptions?: readonly SystemPackageOption[];
} = {}) {
  const auth = useAuth();
  const [workspaces, setWorkspaces] = useState<CreatorWorkspace[]>([]);
  const [activeKey, setActiveKey] = useState("");
  const [activeResourceId, setActiveResourceId] = useState("");
  const [resourceTabOrder, setResourceTabOrder] = useState(() => readStoredTabOrder(creatorResourceTabOrderKey));
  const {
    urls: assetUrls,
    addBytes: addAssetBytes,
    addBlob: addAssetBlob,
    retain: retainAssetUrls,
  } = useManagedObjectUrls();
  const [dialog, setDialog] = useState<CreatorDialogState>(null);
  const [newName, setNewName] = useState("新资源包");
  const [packageNameDraft, setPackageNameDraft] = useState("");
  const [packageVersionDraft, setPackageVersionDraft] = useState("");
  const [publicationVersionSuggestion, setPublicationVersionSuggestion] = useState<CreatorPublicationDraft["versionSuggestion"]>();
  const [packageDescriptionDraft, setPackageDescriptionDraft] = useState("");
  const [packageTargetsDraft, setPackageTargetsDraft] = useState<ResourcePackageLogicalDocument["targets"]>([]);
  const [copyPackageName, setCopyPackageName] = useState("新资源包");
  const [publicationTitle, setPublicationTitle] = useState("");
  const [publicationSummary, setPublicationSummary] = useState("");
  const [publicationLanguage, setPublicationLanguage] = useState("中文");
  const [publicationTags, setPublicationTags] = useState<string[]>([]);
  const [publicationLicense, setPublicationLicense] = useState("公有领域");
  const [publicationCover, setPublicationCover] = useState<PublicationCoverDraft>({ assetId: "", url: "" });
  useManagedBlobUrl(publicationCover.url);
  const [publicationBusy, setPublicationBusy] = useState(false);
  const [pendingCreatorImage, setPendingCreatorImage] = useState<PendingCreatorImage | null>(null);
  const [imageCropWorking, setImageCropWorking] = useState(false);
  const [imageCropError, setImageCropError] = useState<string | null>(null);
  const [creatorOperation, setCreatorOperation] = useState<CreatorOperation | null>(null);
  const [localAppMode, setLocalAppMode] = useState<CreatorAppMode>("creator");
  const appMode = mode ?? localAppMode;
  const changeAppMode = useCallback((nextMode: CreatorAppMode) => {
    setLocalAppMode(nextMode);
    if (nextMode === "creator") setResourcePanelOpen(true);
    if (mode !== nextMode) onModeChange?.(nextMode);
  }, [mode, onModeChange]);
  const [tabletops, setTabletops] = useState<TabletopDocumentModel[]>([]);
  const [activeTabletopId, setActiveTabletopId] = useState("");
  const [tabletopTabOrder, setTabletopTabOrder] = useState(() => readStoredTabOrder(gmTabletopTabOrderKey));
  const [tabletopNameDraft, setTabletopNameDraft] = useState("");
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [resourceSearch, setResourceSearch] = useState("");
  const [selectedWorkspaceResources, setSelectedWorkspaceResources] = useState<WorkspaceResourceSelection[]>([]);
  const [resourceMultiSelect, setResourceMultiSelect] = useState(false);
  const [detailTabletopInstanceId, setDetailTabletopInstanceId] = useState("");
  const [resourcePanelOpen, setResourcePanelOpen] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 781px)").matches);
  const [workspaceColumnShare, setWorkspaceColumnShare] = useState(() => storedColumnShare(
    creatorColumnPreferences.workspace.key,
    creatorColumnPreferences.workspace.initial,
    creatorColumnPreferences.workspace.min,
    creatorColumnPreferences.workspace.max,
  ));
  const [editorColumnShare, setEditorColumnShare] = useState(() => storedColumnShare(
    creatorColumnPreferences.editor.key,
    creatorColumnPreferences.editor.initial,
    creatorColumnPreferences.editor.min,
    creatorColumnPreferences.editor.max,
  ));
  const [expandedWorkspaceKeys, setExpandedWorkspaceKeys] = useState<Set<string>>(() => new Set());
  const knownWorkspaceKeysRef = useRef<Set<string>>(new Set());
  const [tabletopView, setTabletopView] = useState<"canvas" | "instance-editor">("canvas");
  const [tabletopContextMenu, setTabletopContextMenu] = useState<CreatorContextMenuState>(null);
  const marketHandoffStartedRef = useRef<string | null>(null);
  const { notify } = usePlatformNotifications();
  const importRef = useRef<HTMLInputElement>(null);
  const conversionImportRef = useRef<HTMLInputElement>(null);
  const conversionFormatRef = useRef<Exclude<ResourceFormatId, "pbres">>("zzz");
  const tabletopImportRef = useRef<HTMLInputElement>(null);
  const portraitRef = useRef<HTMLInputElement>(null);
  const publicationCoverRef = useRef<HTMLInputElement>(null);
  const gmAppBarActions = useMemo(() => (
    <nav className="creator-toolbar" aria-label="GM 工具栏">
      <div className="creator-menu">
        <button className="creator-menu-trigger" type="button" aria-haspopup="menu"><span>GM 功能</span>{creatorOperation === "read-tabletop" || creatorOperation === "import-tabletop" ? <OperationStatus label={creatorOperationLabels[creatorOperation]} /> : null}</button>
        <div className="creator-menu-panel is-right" role="menu">
          <button type="button" role="menuitem" disabled={Boolean(creatorOperation)} onClick={() => tabletopImportRef.current?.click()}>导入 .pbtab</button>
        </div>
      </div>
    </nav>
  ), [creatorOperation]);
  usePlatformAppBarActions("gm", gmAppBarActions);
  const persistence = useCreatorDocumentPersistence({
    credentials: auth.credentials,
    surfaceKey: surfaceVisible ? appMode : "hidden",
    workspaces,
    setWorkspaces,
    tabletops,
    setTabletops,
    setActiveWorkspaceKey: setActiveKey,
    setActiveResourceId,
    setActiveTabletopId,
    setSelectedInstanceId,
    setSelectedInstanceIds,
    addAssetBytes,
    retainAssetUrls,
    notify,
  });
  const creatorWorkspaceRepository = persistence.repositories.workspace;
  const tabletopRepository = persistence.repositories.tabletop;
  const cloudDocumentService = persistence.cloudDocumentService;
  const workspaceSync = persistence.sync.workspace;
  const tabletopSync = persistence.sync.tabletop;
  const setWorkspaceSync = persistence.sync.setWorkspace;
  const setTabletopSync = persistence.sync.setTabletop;
  const workspaceStorageReady = persistence.storageReady.workspace;
  const tabletopStorageReady = persistence.storageReady.tabletop;
  const workspaceSaving = persistence.saving.workspace;
  const tabletopSaving = persistence.saving.tabletop;
  const tabletopMedia = persistence.media.tabletop;
  const setTabletopMedia = persistence.media.setTabletop;
  const workspaceWriteQueueRef = persistence.writeQueues.workspace;
  const tabletopWriteQueueRef = persistence.writeQueues.tabletop;
  const requestWorkspaceCloudSyncAfterEditing = persistence.requestCloudSyncAfterEditing.workspace;
  const requestTabletopCloudSyncAfterEditing = persistence.requestCloudSyncAfterEditing.tabletop;
  const applyCloudSnapshot = persistence.applyCloudSnapshot;
  useCreatorTrashSource({
    credentials: auth.credentials,
    workspaceRepository: creatorWorkspaceRepository,
    tabletopRepository,
    cloudDocumentService,
    applyCloudSnapshot,
    setWorkspaces,
    setTabletops,
    setWorkspaceSync,
    setTabletopSync,
    setTabletopMedia,
    setActiveWorkspaceKey: setActiveKey,
    setActiveTabletopId,
    notify,
  });
  const active = workspaces.find((workspace) => workspace.key === activeKey) ?? workspaces[0];
  const activeTabletop = tabletops.find((tabletop) => tabletop.id === activeTabletopId);
  const tabletopViewport = useGmTabletopViewport(
    activeTabletop,
    appMode === "gm" && tabletopView === "canvas",
  );
  const canvasZoom = tabletopViewport.snapshot.zoom;
  const canvasPan = tabletopViewport.snapshot.pan;
  const setCanvasPan = tabletopViewport.execute.setPan;
  const setTabletopZoom = tabletopViewport.execute.setZoom;
  const updateTabletopPanPreview = tabletopViewport.execute.previewPan;
  const fitTabletopContent = tabletopViewport.execute.fit;
  const tabletopSurfaceRef = tabletopViewport.refs.surface;
  const tabletopViewportRef = tabletopViewport.refs.viewport;
  const selectedInstance = activeTabletop?.instances.find((instance) => instance.id === selectedInstanceId);
  const detailTabletopInstance = activeTabletop?.instances.find((instance) => instance.id === detailTabletopInstanceId);
  const selectedInstanceFrontend = selectedInstance
    ? resolveTemplateFrontend(selectedInstance.resource.template.id, selectedInstance.resource.template.version)
    : undefined;
  const availableResourceTabKeys = useMemo(() => workspaces.flatMap((workspace) =>
    workspace.openResourceIds.map((resourceId) => resourceTabKey(workspace.key, resourceId))), [workspaces]);
  const availableTabletopTabKeys = useMemo(() => tabletops.map((tabletop) => tabletop.id), [tabletops]);
  const filteredWorkspaceResources = useMemo(() => {
    return filterWorkspaceResources(workspaces, resourceSearch);
  }, [resourceSearch, workspaces]);

  useEffect(() => {
    if (!workspaceStorageReady) return;
    setResourceTabOrder((current) => {
      const next = reconcileTabOrder(current, availableResourceTabKeys);
      writeStoredTabOrder(creatorResourceTabOrderKey, next);
      return sameTabOrder(current, next) ? current : next;
    });
  }, [availableResourceTabKeys, workspaceStorageReady]);

  useEffect(() => {
    if (!tabletopStorageReady) return;
    setTabletopTabOrder((current) => {
      const next = reconcileTabOrder(current, availableTabletopTabKeys);
      writeStoredTabOrder(gmTabletopTabOrderKey, next);
      return sameTabOrder(current, next) ? current : next;
    });
  }, [availableTabletopTabKeys, tabletopStorageReady]);

  useEffect(() => {
    if (!workspaceStorageReady || !activeKey || !activeResourceId) return;
    const activeTabKey = resourceTabKey(activeKey, activeResourceId);
    if (availableResourceTabKeys.includes(activeTabKey)) {
      writeStoredActiveTab(creatorActiveResourceTabKey, activeTabKey);
    }
  }, [activeKey, activeResourceId, availableResourceTabKeys, workspaceStorageReady]);

  useEffect(() => {
    if (!tabletopStorageReady || !availableTabletopTabKeys.includes(activeTabletopId)) return;
    writeStoredActiveTab(gmActiveTabletopTabKey, activeTabletopId);
  }, [activeTabletopId, availableTabletopTabKeys, tabletopStorageReady]);

  useEffect(() => {
    const currentKeys = new Set(workspaces.map((workspace) => workspace.key));
    const addedKeys = [...currentKeys].filter((key) => !knownWorkspaceKeysRef.current.has(key));
    setExpandedWorkspaceKeys((expanded) => new Set([
      ...[...expanded].filter((key) => currentKeys.has(key)),
      ...addedKeys,
    ]));
    knownWorkspaceKeysRef.current = currentKeys;
  }, [workspaces]);
  useEffect(() => {
    if (!workspaceStorageReady || !tabletopStorageReady || marketHandoffStartedRef.current === handoffUrl) return;
    const handoff = parseCreatorMarketHandoff(handoffUrl);
    if (!handoff) return;
    marketHandoffStartedRef.current = handoffUrl;
    const cleanedUrl = withoutCreatorMarketHandoff(handoffUrl);
    if (onHandoffConsumed) onHandoffConsumed(cleanedUrl);
    else window.history.replaceState(null, "", `${cleanedUrl.pathname}${cleanedUrl.search}${cleanedUrl.hash}`);
    fetch(`/api/publications/${encodeURIComponent(handoff.publicationId)}/download`, auth.credentials
      ? { headers: platformRequestHeaders(auth.credentials) }
      : undefined)
      .then(async (response) => {
        await reportPlatformSessionFailure(response, auth.credentials);
        if (!response.ok) throw new Error("无法取得市场资源包");
        return new Uint8Array(await response.arrayBuffer());
      })
      .then((bytes) => loadPbres(bytes, validateResourcePackageCandidate))
      .then(async (result) => {
        if (!result.candidate) {
          setDialog({ kind: "diagnostics", title: "市场导入失败 · 零写入", diagnostics: result.diagnostics });
          return;
        }
        const mismatch = creatorMarketHandoffMismatch(handoff, result.candidate);
        if (mismatch) {
          setDialog({
            kind: "diagnostics",
            title: "市场导入失败 · 零写入",
            diagnostics: [{
              code: mismatch,
              severity: "error",
              family: "creator-prototype",
              version: "1",
              location: "/snapshotDigest",
              params: {},
            }],
          });
          return;
        }
        if (handoff.creatorMode === "fork") {
          const source = createWorkspace(result.candidate);
          return forkCurrentWorkspace(source, {
            publicationId: handoff.publicationId,
            packageId: handoff.packageId,
            version: handoff.packageVersion,
            snapshotDigest: handoff.snapshotDigest,
          }).then((fork) => acceptIncoming({ document: fork.document, media: fork.media }, handoff));
        }
        acceptIncoming(result.candidate, handoff);
      })
      .catch((error) => setDialog({
        kind: "diagnostics",
        title: "市场导入失败 · 零写入",
        diagnostics: [{
          code: "creator.market-handoff.request-failed",
          severity: "error",
          family: "creator-prototype",
          version: "1",
          location: "/publication",
          params: { message: error instanceof Error ? error.message : "unknown" },
        }],
      }));
  }, [auth.credentials, handoffUrl, onHandoffConsumed, tabletopStorageReady, workspaceStorageReady]);

  const resource = active?.document.resources.find((candidate) => candidate.id === activeResourceId);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 781px)");
    const update = (event: MediaQueryListEvent) => setResourcePanelOpen(event.matches);
    desktop.addEventListener("change", update);
    return () => desktop.removeEventListener("change", update);
  }, []);

  const designStyle = creatorWorkspaceStyle(appMode, workspaceColumnShare, editorColumnShare);

  function replaceActive(next: CreatorWorkspace) {
    if (!active) return;
    setWorkspaces((current) => current.map((workspace) => workspace.key === active.key ? next : workspace));
    setActiveKey(next.key);
  }

  function replaceWorkspace(workspaceKey: string, next: CreatorWorkspace) {
    setWorkspaces((current) => current.map((workspace) => workspace.key === workspaceKey ? next : workspace));
  }

  function switchWorkspace(workspaceKey: string) {
    const next = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!next) return;
    setActiveKey(next.key);
    setActiveResourceId(next.openResourceIds[0] ?? "");
    setTabletopContextMenu(null);
  }

  function requestWorkspacePackageClose(workspaceKey: string) {
    const workspace = workspaces.find((candidate) => candidate.key === workspaceKey);
    if (!workspace) return;
    setTabletopContextMenu(null);
    setDialog({ kind: "close-workspace", workspaceKey, name: workspace.document.package.name });
  }

  function requestCloudSync(documentKind: CloudDocumentKind, documentId: string, name: string) {
    if (!auth.credentials) {
      notify("请先登录再启用云同步");
      return;
    }
    setTabletopContextMenu(null);
    setDialog({ kind: "sync-document", documentKind, documentId, name });
  }

  async function confirmCloudSync(documentKind: CloudDocumentKind, documentId: string) {
    const credentials = auth.credentials;
    if (!credentials) return notify("请先登录再启用云同步");
    if (creatorOperation) return;
    setCreatorOperation("cloud-sync");
    try {
      const snapshot = await cloudDocumentService.enable(documentKind, documentId, credentials);
      applyCloudSnapshot(snapshot, false);
      setDialog(null);
      notify("已同步到云端");
    } catch (error) {
      notify(error instanceof Error ? error.message : "云同步失败");
    } finally {
      setCreatorOperation(null);
    }
  }

  async function resolveCloudConflict(
    documentKind: CloudDocumentKind,
    documentId: string,
    action: "cloud" | "local" | "aside",
  ) {
    const credentials = auth.credentials;
    if (!credentials) return notify("请先登录再处理云冲突");
    if (creatorOperation) return;
    setCreatorOperation("cloud-conflict");
    try {
      if (documentKind === "creator-workspace") await workspaceWriteQueueRef.current;
      else await tabletopWriteQueueRef.current;
      if (action === "aside") {
        if (documentKind === "creator-workspace") {
          const source = workspaces.find((item) => item.key === documentId);
          if (!source) throw new Error("没有找到冲突的本地工作区。");
          const fork = await forkCurrentWorkspace(source);
          await creatorWorkspaceRepository.save(fork, null);
        } else {
          const source = tabletops.find((item) => item.id === documentId);
          if (!source) throw new Error("没有找到冲突的本地桌面。");
          await tabletopRepository.save({
            ...structuredClone(source),
            id: crypto.randomUUID(),
            name: `${source.name} - 本地副本`,
          }, tabletopMedia, null);
        }
      }
      const snapshot = action === "local"
        ? await cloudDocumentService.overwriteWithLocal(documentKind, documentId, credentials)
        : await cloudDocumentService.keepCloud(documentKind, documentId, credentials);
      applyCloudSnapshot(snapshot, true);
      setDialog(null);
      notify(action === "local" ? "已用本地版本覆盖云端" : action === "aside" ? "本地版本已另存" : "已保留云端版本");
    } catch (error) {
      notify(error instanceof Error ? error.message : "云冲突处理失败");
    } finally {
      setCreatorOperation(null);
    }
  }

  async function closeWorkspacePackage(workspaceKey: string) {
    const closing = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!closing || creatorOperation) return;
    setCreatorOperation("trash-workspace");
    setTabletopContextMenu(null);
    try {
      await workspaceWriteQueueRef.current;
      const sync = workspaceSync.get(workspaceKey);
      if (sync?.scope === "cloud") {
        if (!auth.credentials) throw new Error("请先登录当前账号再删除云端工作区。");
        if (!auth.credentials.canWrite && sync.baseRevision !== null) {
          throw new Error("当前会话不能删除已经上传的云端工作区。");
        }
        applyCloudSnapshot(await cloudDocumentService.trash(
          "creator-workspace",
          workspaceKey,
          auth.credentials,
        ), true);
      } else {
        await creatorWorkspaceRepository.trash(workspaceKey);
        const remaining = workspaces.filter((workspace) => workspace.key !== workspaceKey);
        setWorkspaces(remaining);
        if (active?.key === workspaceKey) {
          const next = remaining[0];
          setActiveKey(next?.key ?? "");
          setActiveResourceId(next?.openResourceIds[0] ?? "");
        }
      }
      setDialog(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : "资源包关闭失败");
      return;
    } finally {
      setCreatorOperation(null);
    }
    notify("资源包已移到回收站");
  }

  function activateWorkspaceResource(resourceId: string, workspaceKey = active?.key) {
    const sourceWorkspace = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!sourceWorkspace) return;
    const next = previewWorkspaceResource(sourceWorkspace, resourceId);
    const createdPreview = next.previewResourceId === resourceId && sourceWorkspace.previewResourceId !== resourceId;
    setWorkspaces((current) => current.map((workspace) => {
      if (workspace.key === sourceWorkspace.key) return next;
      if (createdPreview && workspace.previewResourceId) {
        return closeWorkspaceResourceTab(workspace, workspace.previewResourceId).workspace;
      }
      return workspace;
    }));
    setActiveKey(sourceWorkspace.key);
    setActiveResourceId(resourceId);
  }

  function pinWorkspaceTab(resourceId: string, workspaceKey = active?.key) {
    const owner = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!owner) return;
    replaceWorkspace(owner.key, pinWorkspaceResource(owner, resourceId));
    setActiveKey(owner.key);
    setActiveResourceId(resourceId);
  }

  function closeWorkspaceTab(workspaceKey: string, resourceId: string) {
    const owner = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!owner) return;
    const result = closeWorkspaceResourceTab(owner, resourceId);
    setWorkspaces((current) => current.map((workspace) => workspace.key === workspaceKey ? result.workspace : workspace));
    if (workspaceKey === active?.key && resourceId === activeResourceId) {
      if (result.nextResourceId) setActiveResourceId(result.nextResourceId);
      else {
        const fallback = workspaces
          .filter((workspace) => workspace.key !== workspaceKey)
          .flatMap((workspace) => workspace.openResourceIds.map((id) => ({ workspace, id })))[0];
        setActiveKey(fallback?.workspace.key ?? workspaceKey);
        setActiveResourceId(fallback?.id ?? "");
      }
    }
  }

  function moveWorkspaceTreeNode(workspaceKey: string, node: WorkspaceNodeRef, parentId: string | null): string | null {
    const owner = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!owner) return "没有打开的工作区";
    try {
      replaceWorkspace(owner.key, moveWorkspaceNode(owner, node, parentId));
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "无法移动节点";
    }
  }

  function renameWorkspaceTreeFolder(workspaceKey: string, folderId: string, name: string): string | null {
    const owner = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!owner) return "没有打开的工作区";
    try {
      replaceWorkspace(owner.key, renameWorkspaceFolder(owner, folderId, name));
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "无法重命名文件夹";
    }
  }

  function requestWorkspaceNodeDeletion(node: WorkspaceNodeRef, workspaceKey = active?.key) {
    const owner = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!owner) return;
    const name = node.kind === "folder"
      ? owner.folders.find((folder) => folder.id === node.id)?.name ?? "文件夹"
      : resourceTitle(owner.document.resources.find((candidate) => candidate.id === node.id)!);
    setDialog({ kind: "delete-workspace-node", workspaceKey: owner.key, node, name });
  }

  function duplicateResource(resourceId: string, workspaceKey = active?.key) {
    const owner = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!owner) return;
    const result = duplicateWorkspaceResource(owner, resourceId);
    replaceWorkspace(owner.key, result.workspace);
    setActiveKey(owner.key);
    setActiveResourceId(result.resourceId);
    setTabletopContextMenu(null);
  }

  function confirmWorkspaceNodeDeletion(workspaceKey: string, node: WorkspaceNodeRef) {
    const owner = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!owner) return;
    const next = deleteWorkspaceNode(owner, node);
    replaceWorkspace(owner.key, next);
    if (owner.key === active?.key && !next.document.resources.some((candidate) => candidate.id === activeResourceId)) {
      setActiveResourceId(next.openResourceIds[0] ?? "");
    }
    setTabletopContextMenu(null);
    setDialog(null);
  }

  function requestSelectedResourceDeletion() {
    if (selectedWorkspaceResources.length === 0) return;
    setTabletopContextMenu(null);
    setDialog({ kind: "delete-selected-resources", selections: [...selectedWorkspaceResources] });
  }

  function confirmSelectedResourceDeletion(selections: WorkspaceResourceSelection[]) {
    const selectedByWorkspace = new Map<string, Set<string>>();
    selections.forEach(({ workspaceKey, resourceId }) => {
      const resourceIds = selectedByWorkspace.get(workspaceKey) ?? new Set<string>();
      resourceIds.add(resourceId);
      selectedByWorkspace.set(workspaceKey, resourceIds);
    });
    const nextWorkspaces = workspaces.map((workspace) => {
      const resourceIds = selectedByWorkspace.get(workspace.key);
      if (!resourceIds) return workspace;
      return [...resourceIds].reduce((next, resourceId) => (
        next.document.resources.some((candidate) => candidate.id === resourceId)
          ? deleteWorkspaceNode(next, { kind: "resource", id: resourceId })
          : next
      ), workspace);
    });
    setWorkspaces(nextWorkspaces);
    const nextActive = nextWorkspaces.find((workspace) => workspace.key === active?.key);
    if (activeResourceId && selectedByWorkspace.get(active?.key ?? "")?.has(activeResourceId)) {
      setActiveResourceId(nextActive?.openResourceIds[0] ?? "");
    }
    setSelectedWorkspaceResources([]);
    setResourceMultiSelect(false);
    setTabletopContextMenu(null);
    setDialog(null);
    notify(`已删除 ${selections.length} 个资源`);
  }

  function updateReferenceValue(path: string, value: unknown) {
    if (!active || !resource) return;
    replaceActive(updateWorkspaceResourceData(active, (draft) => {
      const parts = path.split(".");
      let target = draft;
      for (const part of parts.slice(0, -1)) {
        const current = target[part];
        if (!current || typeof current !== "object" || Array.isArray(current)) target[part] = {};
        target = target[part] as Record<string, unknown>;
      }
      target[parts.at(-1)!] = value;
    }, resource.id));
  }

  function updatePresentation(
    update: (presentation: CreatorWorkspace["document"]["resources"][number]["presentation"]) => void,
  ) {
    if (active && resource) replaceActive(updateResourcePresentation(active, update, resource.id));
  }

  function applyTabletopCommand(command: TabletopCommand) {
    if (!activeTabletop) return;
    const result = executeGmTabletopCommand(activeTabletop, command);
    if (!result.ok) {
      notify(result.error);
      return;
    }
    setTabletops((current) => current.map((tabletop) =>
      tabletop.id === activeTabletop.id ? result.tabletop : tabletop));
  }

  function editInstanceData(path: string[], value: unknown) {
    if (!selectedInstance) return;
    applyTabletopCommand({
      type: "edit-instance-data",
      instanceId: selectedInstance.id,
      path,
      value,
    });
  }

  function selectTabletopInstance(instanceId: string, mode: "replace" | "add" | "toggle" = "replace") {
    const next = selectTabletopInstances(selectedInstanceIds, instanceId, mode);
    setSelectedInstanceIds(next);
    setSelectedInstanceId(next.at(-1) ?? "");
  }

  function selectAndRaiseTabletopInstance(instanceId: string, mode: "replace" | "add" | "toggle" = "replace") {
    selectTabletopInstance(instanceId, mode);
    const instance = activeTabletop?.instances.find((candidate) => candidate.id === instanceId);
    const topLayer = activeTabletop?.instances.reduce(
      (highest, candidate) => Math.max(highest, candidate.layer),
      Number.NEGATIVE_INFINITY,
    );
    if (instance && topLayer !== undefined && instance.layer < topLayer) {
      applyTabletopCommand({ type: "layer", instanceId, action: "front" });
    }
    setTabletopContextMenu(null);
  }

  function clearTabletopSelection() {
    setSelectedInstanceIds([]);
    setSelectedInstanceId("");
  }

  function placeWorkspaceResources(
    selections: WorkspaceResourceSelection[],
    firstPosition?: { x: number; y: number },
  ) {
    if (!activeTabletop || selections.length === 0) return;
    const result = placeWorkspaceResourcesOnTabletop(activeTabletop, workspaces, selections, firstPosition);
    if (!result.ok) {
      notify(result.error);
      return;
    }
    setTabletopMedia((current) => new Map([...current, ...(result.media ?? [])]));
    setTabletops((current) => current.map((tabletop) => tabletop.id === activeTabletop.id ? result.tabletop : tabletop));
    const placedIds = result.selectedInstanceIds ?? [];
    setSelectedInstanceIds(placedIds);
    setSelectedInstanceId(placedIds.at(-1) ?? "");
    setTabletopView("canvas");
    setTabletopContextMenu(null);
    if (window.matchMedia("(max-width: 780px)").matches) setResourcePanelOpen(false);
  }

  function placeResource(resourceId: string, position?: { x: number; y: number }) {
    if (active) placeWorkspaceResources([{ workspaceKey: active.key, resourceId }], position);
  }

  function toggleWorkspaceResourceSelection(workspaceKey: string, resourceId: string) {
    setSelectedWorkspaceResources((current) => current.some((item) => item.workspaceKey === workspaceKey && item.resourceId === resourceId)
      ? current.filter((item) => item.workspaceKey !== workspaceKey || item.resourceId !== resourceId)
      : [...current, { workspaceKey, resourceId }]);
  }

  function toggleResourceMultiSelect() {
    setResourceMultiSelect((current) => {
      if (current) setSelectedWorkspaceResources([]);
      return !current;
    });
    setTabletopContextMenu(null);
  }

  function placeSelectedTabletopResources() {
    if (selectedWorkspaceResources.length === 0) return;
    placeWorkspaceResources(selectedWorkspaceResources);
    setSelectedWorkspaceResources([]);
    setResourceMultiSelect(false);
  }

  function replaceSelectedInstanceForm(replacementId: string) {
    if (!activeTabletop || !selectedInstance) return;
    const result = replaceTabletopInstanceFromWorkspace(
      activeTabletop,
      workspaces,
      selectedInstance.id,
      replacementId,
    );
    if (!result.ok) {
      notify(replacementFailureMessage(result.error));
      setTabletopContextMenu(null);
      return;
    }
    setTabletopMedia((current) => new Map([...current, ...(result.media ?? [])]));
    setTabletops((current) => current.map((tabletop) =>
      tabletop.id === activeTabletop.id ? result.tabletop : tabletop));
    const nextSelected = result.selectedInstanceIds?.at(-1);
    if (nextSelected) selectTabletopInstance(nextSelected);
    setTabletopContextMenu(null);
  }

  function toggleWorkspacePackage(workspaceKey: string) {
    const opening = !expandedWorkspaceKeys.has(workspaceKey);
    setExpandedWorkspaceKeys((current) => {
      const next = new Set(current);
      if (next.has(workspaceKey)) next.delete(workspaceKey);
      else next.add(workspaceKey);
      return next;
    });
    if (opening) switchWorkspace(workspaceKey);
  }

  function requestResourcePackageCopy(resourceId: string, workspaceKey = active?.key) {
    const owner = workspaces.find((workspace) => workspace.key === workspaceKey);
    if (!owner) return;
    const source = owner.document.resources.find((candidate) => candidate.id === resourceId);
    if (!source) return;
    setCopyPackageName(`${resourceTitle(source)}资源包`);
    setTabletopContextMenu(null);
    setDialog({
      kind: "copy-resource-to-package",
      sourceWorkspaceKey: owner.key,
      resourceId,
      name: resourceTitle(source),
    });
  }

  function copyResourceIntoWorkspace(sourceWorkspaceKey: string, resourceId: string, targetWorkspaceKey: string) {
    const source = workspaces.find((workspace) => workspace.key === sourceWorkspaceKey);
    const target = workspaces.find((workspace) => workspace.key === targetWorkspaceKey);
    if (!source || !target) return;
    const result = copyWorkspaceResourceToPackage(source, target, resourceId);
    setWorkspaces((current) => current.map((workspace) => workspace.key === target.key ? result.workspace : workspace));
    setActiveKey(target.key);
    setActiveResourceId(result.resourceId);
    setDialog(null);
    notify(result.copiedResourceIds.length > 1
      ? `已复制到“${target.document.package.name}”，并带上 ${result.copiedResourceIds.length - 1} 个切换形态`
      : `已复制到“${target.document.package.name}”`);
  }

  async function copyResourceIntoNewWorkspace(sourceWorkspaceKey: string, resourceId: string) {
    const source = workspaces.find((workspace) => workspace.key === sourceWorkspaceKey);
    if (!source) return;
    const target = await createBlankWorkspace(copyPackageName);
    const result = copyWorkspaceResourceToPackage(source, target, resourceId);
    setWorkspaces((current) => [...current, result.workspace]);
    setActiveKey(result.workspace.key);
    setActiveResourceId(result.resourceId);
    setDialog(null);
    notify(`已新建“${result.workspace.document.package.name}”并复制资源`);
  }

  function requestTabletopCreation() {
    setTabletopNameDraft(`新桌面 ${tabletops.length + 1}`);
    setDialog({ kind: "new-tabletop" });
  }

  function openTabletopContextMenu(tabletopId: string, x: number, y: number) {
    setActiveTabletopId(tabletopId);
    clearTabletopSelection();
    setTabletopView("canvas");
    setTabletopContextMenu({ kind: "canvas", x, y });
  }

  function createTabletopFromDialog() {
    const name = tabletopNameDraft.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    setTabletops((current) => [...current, createTabletopDocument(id, name)]);
    setActiveTabletopId(id);
    clearTabletopSelection();
    setTabletopView("canvas");
    setTabletopContextMenu(null);
    setDialog(null);
  }

  function requestTabletopRename() {
    if (!activeTabletop) return;
    setTabletopNameDraft(activeTabletop.name);
    setTabletopContextMenu(null);
    setDialog({ kind: "rename-tabletop", tabletopId: activeTabletop.id });
  }

  function renameTabletopFromDialog(tabletopId: string) {
    const name = tabletopNameDraft.trim();
    if (!name) return;
    setTabletops((current) => current.map((tabletop) =>
      tabletop.id === tabletopId ? { ...tabletop, name } : tabletop));
    setDialog(null);
    notify(`桌面已重命名为“${name}”`);
  }

  async function duplicateTabletop() {
    if (!activeTabletop || creatorOperation) return;
    setCreatorOperation("duplicate-tabletop");
    setTabletopContextMenu(null);
    try {
      await tabletopWriteQueueRef.current;
      const result = await runGmTabletopFileWorkflow({
        type: "duplicate",
        tabletop: activeTabletop,
        media: tabletopMedia,
        accountId: auth.credentials?.accountId ?? null,
      }, { repository: tabletopRepository, cloudDocuments: cloudDocumentService });
      if (result.type !== "duplicated") return;
      setTabletops((current) => [...current, result.tabletop]);
      const copySync = result.sync;
      if (copySync) {
        setTabletopSync((current) => new Map(current).set(result.tabletop.id, copySync));
      }
      setActiveTabletopId(result.tabletop.id);
      clearTabletopSelection();
      setTabletopView("canvas");
      notify(`已创建“${result.tabletop.name}”`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "复制桌面失败");
    } finally {
      setCreatorOperation(null);
    }
  }

  async function deleteTabletop(tabletopId: string) {
    if (creatorOperation) return;
    setCreatorOperation("trash-tabletop");
    setTabletopContextMenu(null);
    try {
      await tabletopWriteQueueRef.current;
      const result = await runGmTabletopFileWorkflow({
        type: "trash",
        tabletopId,
        sync: tabletopSync.get(tabletopId),
        credentials: auth.credentials,
      }, { repository: tabletopRepository, cloudDocuments: cloudDocumentService });
      if (result.type === "trashed-cloud") {
        applyCloudSnapshot(result.snapshot, true);
      } else if (result.type === "trashed-local") {
        const remaining = tabletops.filter((tabletop) => tabletop.id !== tabletopId);
        setTabletops(remaining);
        setActiveTabletopId(activeTabletopId === tabletopId ? remaining[0]?.id ?? "" : activeTabletopId);
      }
      clearTabletopSelection();
      setTabletopView("canvas");
      setDialog(null);
      notify("桌面已移到回收站");
    } catch (error) {
      notify(error instanceof Error ? error.message : "桌面删除失败");
    } finally {
      setCreatorOperation(null);
    }
  }

  function duplicateSelectedInstance() {
    if (!selectedInstance) return;
    const id = crypto.randomUUID();
    applyTabletopCommand({ type: "duplicate", instanceId: selectedInstance.id, newInstanceId: id });
    selectTabletopInstance(id);
    setTabletopContextMenu(null);
  }

  function deleteSelectedInstance() {
    if (!selectedInstance) return;
    applyTabletopCommand({ type: "delete", instanceId: selectedInstance.id });
    clearTabletopSelection();
    setTabletopContextMenu(null);
  }

  async function exportTabletop() {
    if (!activeTabletop || creatorOperation) return;
    setCreatorOperation("export-tabletop");
    try {
      const result = await runGmTabletopFileWorkflow({
        type: "export",
        tabletop: activeTabletop,
        media: tabletopMedia,
        accountId: auth.credentials?.accountId ?? null,
      }, { repository: tabletopRepository, cloudDocuments: cloudDocumentService });
      if (result.type !== "tabletop-export") return;
      downloadBytes(result.bytes, result.fileName);
      setTabletopContextMenu(null);
    } finally {
      setCreatorOperation(null);
    }
  }

  async function importTabletop(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || creatorOperation) return;
    setCreatorOperation("read-tabletop");
    try {
      const result = await runGmTabletopFileWorkflow({
        type: "inspect-import",
        bytes: new Uint8Array(await file.arrayBuffer()),
      }, { repository: tabletopRepository, cloudDocuments: cloudDocumentService });
      if (result.type === "invalid") {
        setDialog({ kind: "diagnostics", title: result.title, diagnostics: result.diagnostics });
        return;
      }
      if (result.type === "import-same") {
        setActiveTabletopId(result.candidate.document.documentId);
        clearTabletopSelection();
        setTabletopView("canvas");
        notify("这个桌面已经打开，内容完全相同，不需要重复导入");
        return;
      }
      if (result.type === "import-conflict") {
        setDialog({ kind: "tabletop-import-conflict", incoming: result.candidate });
        return;
      }
      if (result.type !== "import-ready") return;
      await commitTabletopImport(result.candidate, "reject");
    } finally {
      setCreatorOperation(null);
    }
  }

  function deleteSelectedInstances() {
    if (selectedInstanceIds.length < 2) return deleteSelectedInstance();
    applyTabletopCommand({ type: "delete-many", instanceIds: selectedInstanceIds });
    clearTabletopSelection();
    setTabletopContextMenu(null);
  }

  function arrangeTabletopInstances() {
    if (!activeTabletop || activeTabletop.instances.length === 0) return;
    const viewportWidth = tabletopViewport.contentWidth();
    const result = arrangeGmTabletop(activeTabletop, viewportWidth);
    if (!result.ok) {
      notify(result.error);
      return;
    }
    setTabletops((current) => current.map((tabletop) => tabletop.id === activeTabletop.id ? result.tabletop : tabletop));
    clearTabletopSelection();
    setTabletopContextMenu(null);
  }

  function expandActiveTabletop() {
    if (!activeTabletop) return;
    setTabletops((current) => current.map((tabletop) => tabletop.id === activeTabletop.id
      ? { ...tabletop, canvas: { width: tabletop.canvas.width + 800, height: tabletop.canvas.height + 600 } }
      : tabletop));
    setTabletopContextMenu(null);
    notify("桌面已扩大");
  }

  async function commitTabletopImport(
    candidate: TabletopDocumentCandidate,
    resolution: "reject" | "replace" | "copy",
  ) {
    if (creatorOperation) return;
    setCreatorOperation("import-tabletop");
    try {
      const result = await runGmTabletopFileWorkflow({
        type: "commit-import",
        candidate,
        accountId: auth.credentials?.accountId ?? null,
        resolution,
      }, { repository: tabletopRepository, cloudDocuments: cloudDocumentService });
      if (result.type !== "imported") return;
      setTabletopMedia((current) => new Map([...current, ...result.media]));
      addAssetBytes(result.media);
      setTabletops((current) => current.some((item) => item.id === result.tabletop.id)
        ? current.map((item) => item.id === result.tabletop.id ? result.tabletop : item)
        : [...current, result.tabletop]);
      setActiveTabletopId(result.tabletop.id);
      clearTabletopSelection();
      setTabletopView("canvas");
      setTabletopContextMenu(null);
      setDialog(null);
      notify(result.resolution === "copy"
        ? `已导入副本“${result.tabletop.name}”`
        : `已导入“${result.tabletop.name}”`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "导入桌面失败");
    } finally {
      setCreatorOperation(null);
    }
  }

  function finishMarketHandoff(workspace: CreatorWorkspace, handoff: CreatorMarketHandoff) {
    const focusedResourceId = workspace.document.resources.some((item) => item.id === handoff.focusResourceId)
      ? handoff.focusResourceId
      : workspace.document.resources[0]?.id;
    setActiveKey(workspace.key);
    setActiveResourceId(focusedResourceId ?? "");
    if (handoff.target === "gm") {
      changeAppMode("gm");
      setDialog(null);
      notify(`已从资源市场导入 ${workspace.document.package.name}`);
    } else {
      changeAppMode("creator");
      setDialog(null);
      notify(`已从资源市场导入 ${workspace.document.package.name}`);
    }
  }

  function commitIncoming(candidate: ResourcePackageCandidate, handoff?: CreatorMarketHandoff) {
    const next = createWorkspace(candidate);
    addAssetBytes(candidate.media);
    setWorkspaces((current) => {
      const existing = current.findIndex((workspace) => workspace.document.package.id === next.document.package.id);
      if (existing < 0) return [...current, next];
      return current.map((workspace, index) => index === existing ? next : workspace);
    });
    setActiveKey(next.key);
    setActiveResourceId(next.document.resources[0]?.id ?? "");
    setDialog(null);
    const write = workspaceWriteQueueRef.current.then(async () => {
      await creatorWorkspaceRepository.save(next, auth.credentials?.accountId ?? null, true);
    });
    workspaceWriteQueueRef.current = write.catch(() => undefined);
    write.then(() => {
      if (handoff) finishMarketHandoff(next, handoff);
      else notify(`已载入 ${next.document.package.name}`);
    }).catch((error) => notify(error instanceof Error ? error.message : "工作区保存失败"));
  }

  function acceptIncoming(candidate: ResourcePackageCandidate, handoff?: CreatorMarketHandoff) {
    const existing = workspaces.find((workspace) =>
      workspace.document.package.id === candidate.document.package.id);
    const plan = planImport(existing, candidate);
    if (plan === "insert") commitIncoming(candidate, handoff);
    if (plan === "no-op") {
      setActiveKey(existing!.key);
      if (handoff) finishMarketHandoff(existing!, handoff);
      else setDialog({ kind: "no-op", name: candidate.document.package.name });
    }
    if (plan === "update") setDialog({ kind: "update", incoming: candidate, ...(handoff ? { handoff } : {}) });
    if (plan === "conflict") setDialog({ kind: "conflict", incoming: candidate, ...(handoff ? { handoff } : {}) });
  }

  async function importPackage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || creatorOperation) return;
    setCreatorOperation("read-package");
    try {
      const result = await runCreatorPackageFileWorkflow({
        type: "inspect-import",
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
      if (result.type === "invalid") {
        setDialog({ kind: "diagnostics", title: result.title, diagnostics: result.diagnostics });
        return;
      }
      if (result.type === "import-ready") acceptIncoming(result.candidate);
    } finally {
      setCreatorOperation(null);
    }
  }

  async function exportPackage(formatId: ResourceFormatId = "pbres") {
    if (!active || creatorOperation) return;
    setCreatorOperation("export-package");
    try {
      const result = formatId === "pbres"
        ? await runCreatorPackageFileWorkflow({ type: "export-workspace", workspace: active })
        : await runCreatorPackageFileWorkflow({ type: "export-third-party", formatId, workspace: active });
      if (result.type === "invalid") {
        setDialog({ kind: "diagnostics", title: result.title, diagnostics: result.diagnostics });
        return;
      }
      if (result.type === "conversion-review") {
        setDialog({ kind: "conversion", review: result.review });
        return;
      }
      if (result.type !== "workspace-export" && result.type !== "third-party-export") return;
      downloadBytes(result.bytes, result.fileName);
      replaceActive(result.workspace);
      notify(result.message);
    } finally {
      setCreatorOperation(null);
    }
  }

  function applyPackageInformationDraft(draft: CreatorPublicationDraft) {
    setPublicationVersionSuggestion(draft.versionSuggestion);
    setPackageNameDraft(draft.package.name);
    setPackageVersionDraft(draft.package.version);
    setPackageDescriptionDraft(draft.package.description);
    setPackageTargetsDraft(draft.package.targets);
    setPublicationTitle(draft.publication.title);
    setPublicationSummary(draft.publication.summary);
    setPublicationLanguage(draft.publication.language);
    setPublicationTags(draft.publication.tags);
    setPublicationLicense(draft.publication.licenseId);
    const coverBuffer = draft.cover.bytes?.buffer.slice(
      draft.cover.bytes.byteOffset,
      draft.cover.bytes.byteOffset + draft.cover.bytes.byteLength,
    ) as ArrayBuffer | undefined;
    setPublicationCover({
      ...draft.cover,
      url: draft.cover.url || (coverBuffer
        ? URL.createObjectURL(new Blob([coverBuffer], { type: draft.cover.asset?.mediaType ?? "image/webp" }))
        : ""),
    });
  }

  function currentPackageInformationDraft(): CreatorPublicationDraft {
    return {
      versionSuggestion: publicationVersionSuggestion,
      package: {
        name: packageNameDraft,
        version: packageVersionDraft,
        description: packageDescriptionDraft,
        targets: packageTargetsDraft,
      },
      publication: {
        title: publicationTitle,
        summary: publicationSummary,
        language: publicationLanguage,
        tags: publicationTags,
        licenseId: publicationLicense,
      },
      cover: publicationCover,
    };
  }

  async function openPublicationDialog() {
    if (!active || creatorOperation) return;
    setCreatorOperation("publication-cover");
    try {
      const result = await prepareCreatorPublication(active, auth.credentials);
      if (!result.ok) {
        setDialog({ kind: "diagnostics", title: result.title, diagnostics: result.diagnostics });
        return;
      }
      applyPackageInformationDraft(result.draft);
      setDialog({ kind: "publish" });
    } finally {
      setCreatorOperation(null);
    }
  }

  function selectConversionFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void convertThirdPartyPackage(conversionFormatRef.current, file);
  }

  async function convertThirdPartyPackage(
    formatId: Exclude<ResourceFormatId, "pbres">,
    file: File,
  ) {
    if (creatorOperation) return;
    setCreatorOperation("convert-package");
    try {
      const result = await runCreatorPackageFileWorkflow({
        type: "convert",
        formatId,
        bytes: new Uint8Array(await file.arrayBuffer()),
        fileName: file.name,
      });
      if (result.type === "conversion-review") {
        setDialog({ kind: "conversion", review: result.review });
      }
    } catch (error) {
      setDialog({
        kind: "conversion",
        review: {
          formatId,
          sourceFileName: file.name,
          candidate: null,
          converted: 0,
          failed: 1,
          diagnostics: [{
            code: "creator.resource-conversion.failed",
            severity: "error",
            message: error instanceof Error ? error.message : "第三方资源转换失败。",
          }],
        },
      });
    } finally {
      setCreatorOperation(null);
    }
  }

  function acceptConvertedPackage(review: CreatorConversionReview) {
    if (!review.candidate) return;
    setDialog(null);
    acceptIncoming(review.candidate);
  }

  async function exportConvertedPackage(review: CreatorConversionReview) {
    const result = await runCreatorPackageFileWorkflow({ type: "export-conversion", review });
    if (result.type === "conversion-export") downloadBytes(result.bytes, result.fileName);
  }

  function replacePublicationCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || creatorOperation) return;
    setImageCropError(null);
    setPendingCreatorImage({ purpose: "publication-cover", file });
  }

  async function applyCreatorImageCrop(selection: ImageCropSelection) {
    const pending = pendingCreatorImage;
    if (!pending) return;
    setImageCropWorking(true);
    setImageCropError(null);
    try {
      const policy = pending.purpose === "publication-cover" ? publicationCoverPolicy : resourceImagePolicy;
      const { asset, bytes, blob } = await imageAsset(pending.file, policy, selection);
      if (pending.purpose === "publication-cover") {
        setPublicationCover({ assetId: asset.id, asset, bytes, url: URL.createObjectURL(blob) });
      } else {
        const workspace = workspaces.find((candidate) => candidate.key === pending.workspaceKey);
        if (!workspace) throw new Error("找不到要修改的资源包。");
        const next = replacePortrait(workspace, asset, bytes, pending.resourceId);
        addAssetBlob(asset.id, blob);
        setWorkspaces((current) => current.map((candidate) => candidate.key === pending.workspaceKey ? next : candidate));
        notify("卡牌图片已替换；规范卡面同步更新");
      }
      setPendingCreatorImage(null);
    } catch (error) {
      setImageCropError(error instanceof Error ? error.message : "图片处理失败，请重试。");
    } finally {
      setImageCropWorking(false);
    }
  }

  async function publishWorkspace() {
    if (!active || publicationBusy) return;
    setPublicationBusy(true);
    try {
      const result = await publishCreatorWorkspace(
        active,
        currentPackageInformationDraft(),
        auth.credentials,
      );
      if (!result.ok) {
        setDialog({ kind: "diagnostics", title: result.title, diagnostics: result.diagnostics });
        return;
      }
      notify(result.message);
      replaceActive(result.workspace);
      setDialog(null);
    } finally {
      setPublicationBusy(false);
    }
  }

  async function createWorkspaceFromDialog() {
    const next = await createBlankWorkspace(newName);
    setWorkspaces((current) => [...current, next]);
    setActiveKey(next.key);
    setActiveResourceId(next.document.resources[0]?.id ?? "");
    setDialog(null);
    notify("已显式创建空白 Workspace");
  }

  async function upgradeWorkspaceTemplates(workspaceKey: string, selections: Parameters<typeof upgradePbresTemplateVersions>[1]) {
    const workspace = workspaces.find((candidate) => candidate.key === workspaceKey);
    if (!workspace || creatorOperation) return;
    setCreatorOperation("upgrade-templates");
    try {
      const result = await upgradePbresTemplateVersions(workspace, selections, {
        upgradeResources: upgradeTemplateResources, validate: createPbresCandidateValidator(loadTemplateCore),
      });
      if (!result.candidate) {
        setDialog({ kind: "diagnostics", title: "模板升级失败 · 零写入", diagnostics: result.diagnostics });
        return;
      }
      const upgradedResourceIds = new Set(selections.flatMap((selection) => workspace.document.resources
        .filter((resource) => resource.template.id === selection.templateId && resource.template.version === selection.currentVersion)
        .map((resource) => resource.id)));
      const upgradedWorkspace = createWorkspace({
        ...workspace,
        document: result.candidate.document,
        media: result.candidate.media,
      }, true);
      upgradedWorkspace.dirtyResourceIds = [...new Set([...workspace.dirtyResourceIds, ...upgradedResourceIds])];
      replaceWorkspace(workspaceKey, upgradedWorkspace);
      setDialog(null);
      notify(`模板已升级，资源包版本更新为 ${result.candidate.document.package.version}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "模板升级失败");
    } finally {
      setCreatorOperation(null);
    }
  }

  async function openPackageMetadataDialog(workspaceKey: string) {
    const workspace = workspaces.find((candidate) => candidate.key === workspaceKey);
    if (!workspace || creatorOperation) return;
    setCreatorOperation("publication-cover");
    try {
      const result = await prepareCreatorPackageInformation(workspace);
      if (!result.ok) {
        setDialog({ kind: "diagnostics", title: result.title, diagnostics: result.diagnostics });
        return;
      }
      applyPackageInformationDraft(result.draft);
      setTabletopContextMenu(null);
      setDialog({ kind: "package-metadata", workspaceKey });
    } finally {
      setCreatorOperation(null);
    }
  }

  async function savePackageMetadata(workspaceKey: string) {
    if (!packageNameDraft.trim() || !isSemanticVersion(packageVersionDraft) || publicationBusy) return;
    const workspace = workspaces.find((candidate) => candidate.key === workspaceKey);
    if (!workspace) return;
    setPublicationBusy(true);
    try {
      const result = await saveCreatorPackageInformation(workspace, currentPackageInformationDraft());
      if (!result.ok) {
        setDialog({ kind: "diagnostics", title: result.title, diagnostics: result.diagnostics });
        return;
      }
      addAssetBytes(result.workspace.media);
      setWorkspaces((current) => current.map((candidate) => candidate.key === workspaceKey
        ? result.workspace
        : candidate));
      setDialog(null);
      notify(result.message);
    } finally {
      setPublicationBusy(false);
    }
  }

  function replacePortraitFromFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !active || !resource) return;
    setImageCropError(null);
    setPendingCreatorImage({ purpose: "resource-image", file, workspaceKey: active.key, resourceId: resource.id });
  }

  function recropPortrait() {
    if (!active || !resource?.media.portrait || creatorOperation) return;
    const assetId = resource.media.portrait;
    const bytes = active.media.get(assetId);
    if (!bytes) {
      notify("当前卡图数据不可用，请重新添加图片。");
      return;
    }
    const asset = active.document.assets.find((candidate) => candidate.id === assetId);
    const file = new File([bytes.slice()], "current-portrait.webp", { type: asset?.mediaType ?? "image/webp" });
    setImageCropError(null);
    setPendingCreatorImage({ purpose: "resource-image", file, workspaceKey: active.key, resourceId: resource.id });
  }

  function createResource(template: Parameters<typeof addTemplateResource>[1], workspaceKey: string) {
    if (!active || active.key !== workspaceKey) return;
    const result = addTemplateResource(active, template);
    replaceActive(result.workspace);
    setActiveResourceId(result.resourceId);
    setDialog(null);
  }

  async function saveAsideThenImport(incoming: ResourcePackageCandidate, handoff?: CreatorMarketHandoff) {
    const existing = workspaces.find((workspace) =>
      workspace.document.package.id === incoming.document.package.id);
    if (!existing) return commitIncoming(incoming, handoff);
    const fork = await forkCurrentWorkspace(existing);
    setWorkspaces((current) => [...current.filter((workspace) => workspace.key !== existing.key), fork]);
    commitIncoming(incoming, handoff);
    notify("本地修改已另存为新 Package ID；导入版本已载入");
  }

  function executeResourceExplorerCommand(command: CreatorResourceExplorerCommand) {
    switch (command.type) {
      case "new-package": setDialog({ kind: "new" }); return;
      case "import-pbres": importRef.current?.click(); return;
      case "import-third-party":
        conversionFormatRef.current = command.formatId;
        if (conversionImportRef.current) {
          conversionImportRef.current.accept = command.formatId === "dhsheet"
            ? ".json,.dhcb"
            : ".json,.dhcb,.png,application/json,image/png";
          conversionImportRef.current.click();
        }
        return;
      case "export-third-party": void exportPackage(command.formatId); return;
      case "export-package": void exportPackage(); return;
      case "publish-package": void openPublicationDialog(); return;
      case "new-resource": if (active) setDialog({ kind: "new-resource", workspaceKey: active.key }); return;
      case "new-folder": if (active) replaceActive(createWorkspaceFolder(active)); return;
      case "set-search": setResourceSearch(command.value); return;
      case "toggle-multi-select": toggleResourceMultiSelect(); return;
      case "activate-resource": activateWorkspaceResource(command.resourceId, command.workspaceKey); return;
      case "pin-resource": pinWorkspaceTab(command.resourceId, command.workspaceKey); return;
      case "toggle-resource-selection": toggleWorkspaceResourceSelection(command.workspaceKey, command.resourceId); return;
      case "open-resource-context":
        if (resourceMultiSelect) {
          setSelectedWorkspaceResources((current) => current.some((selection) =>
            selection.workspaceKey === command.workspaceKey && selection.resourceId === command.resourceId)
            ? current
            : [...current, { workspaceKey: command.workspaceKey, resourceId: command.resourceId }]);
        } else activateWorkspaceResource(command.resourceId, command.workspaceKey);
        setTabletopContextMenu({ kind: "resource", ...command });
        return;
      case "toggle-package": toggleWorkspacePackage(command.workspaceKey); return;
      case "open-workspace-context":
        switchWorkspace(command.workspaceKey);
        setTabletopContextMenu({ kind: "workspace", workspaceKey: command.workspaceKey, x: command.x, y: command.y });
        return;
      case "select-folder": {
        const workspace = workspaces.find((candidate) => candidate.key === command.workspaceKey);
        if (workspace) {
          setActiveKey(workspace.key);
          replaceWorkspace(workspace.key, selectWorkspaceFolder(workspace, command.folderId));
        }
        return;
      }
      case "toggle-folder": {
        const workspace = workspaces.find((candidate) => candidate.key === command.workspaceKey);
        if (workspace) replaceWorkspace(workspace.key, toggleWorkspaceFolder(workspace, command.folderId));
        return;
      }
      case "rename-folder": return renameWorkspaceTreeFolder(command.workspaceKey, command.folderId, command.name);
      case "move-node": return moveWorkspaceTreeNode(command.workspaceKey, command.node, command.parentId);
      case "delete-node": requestWorkspaceNodeDeletion(command.node, command.workspaceKey); return;
    }
  }

  function executeGmWorkbenchCommand(command: GmTabletopWorkbenchCommand) {
    switch (command.type) {
      case "new-tabletop": requestTabletopCreation(); return;
      case "activate-tabletop":
        setActiveTabletopId(command.tabletopId);
        clearTabletopSelection();
        setTabletopView("canvas");
        return;
      case "request-delete-tabletop": {
        const tabletop = tabletops.find((candidate) => candidate.id === command.tabletopId);
        if (tabletop) setDialog({ kind: "delete-tabletop", tabletopId: tabletop.id, name: tabletop.name });
        return;
      }
      case "open-tabletop-context": openTabletopContextMenu(command.tabletopId, command.x, command.y); return;
      case "set-view": setTabletopView(command.view); return;
      case "clear-selection": setTabletopContextMenu(null); clearTabletopSelection(); return;
      case "close-context": setTabletopContextMenu(null); return;
      case "set-pan": setCanvasPan(command.pan); return;
      case "preview-pan": updateTabletopPanPreview(command.pan); return;
      case "set-zoom": setTabletopZoom(command.zoom); return;
      case "fit": fitTabletopContent(); return;
      case "open-canvas-context": setTabletopContextMenu({ kind: "canvas", x: command.x, y: command.y }); return;
      case "place-resource": placeResource(command.resourceId, command.position); return;
      case "select-instance": selectAndRaiseTabletopInstance(command.instanceId, command.mode); return;
      case "open-instance-context":
        selectTabletopInstance(command.instanceId);
        setTabletopContextMenu({ kind: "instance", instanceId: command.instanceId, x: command.x, y: command.y });
        return;
      case "tabletop-command": applyTabletopCommand(command.command); return;
      case "edit-instance-data": editInstanceData(command.path, command.value); return;
      case "replace-instance-data":
        if (selectedInstance) applyTabletopCommand({ type: "replace-instance-data", instanceId: selectedInstance.id, data: command.data });
        return;
      case "request-cloud-edit": requestTabletopCloudSyncAfterEditing(); return;
      case "reorder-tabletop-tab":
        setTabletopTabOrder((current) => {
          const next = moveTab(
            reconcileTabOrder(current, availableTabletopTabKeys),
            command.sourceKey,
            command.targetKey,
            command.placement,
          );
          writeStoredTabOrder(gmTabletopTabOrderKey, next);
          return next;
        });
        return;
    }
  }

  function executeCreatorWorkbenchCommand(command: CreatorWorkbenchCommand) {
    switch (command.type) {
      case "activate-resource": activateWorkspaceResource(command.resourceId, command.workspaceKey); return;
      case "pin-resource": pinWorkspaceTab(command.resourceId, command.workspaceKey); return;
      case "close-resource": closeWorkspaceTab(command.workspaceKey, command.resourceId); return;
      case "request-cloud-edit": requestWorkspaceCloudSyncAfterEditing(); return;
      case "choose-portrait": portraitRef.current?.click(); return;
      case "recrop-portrait": recropPortrait(); return;
      case "remove-portrait": if (active && resource) replaceActive(removePortrait(active, resource.id)); return;
      case "set-editor-share": setEditorColumnShare(command.value); return;
      case "authoring-value": updateReferenceValue(command.path, command.value); return;
      case "replace-authoring-data":
        if (active && resource) replaceActive(updateWorkspaceResourceData(active, (draft) => {
          for (const key of Object.keys(draft)) delete draft[key];
          Object.assign(draft, structuredClone(command.data));
        }, resource.id));
        return;
      case "attribution-value":
        if (active) replaceActive(updateResourceAttribution(active, (attribution) => { attribution[command.field] = command.value; }, resource?.id));
        return;
      case "replacement":
        if (active) replaceActive(updateResourceReplacement(active, command.resourceId, command.replacementId, command.targetResourceId));
        return;
      case "presentation-mode": updatePresentation((presentation) => { presentation.mode = command.mode; }); return;
      case "toggle-fixed-ratio": updatePresentation((presentation) => { presentation.fixedRatio = !presentation.fixedRatio; }); return;
      case "reorder-resource-tab":
        setResourceTabOrder((current) => {
          const next = moveTab(
            reconcileTabOrder(current, availableResourceTabKeys),
            command.sourceKey,
            command.targetKey,
            command.placement,
          );
          writeStoredTabOrder(creatorResourceTabOrderKey, next);
          return next;
        });
        return;
    }
  }

  function executeContextMenuCommand(command: CreatorContextMenuCommand) {
    switch (command.type) {
      case "close": setTabletopContextMenu(null); return;
      case "new-package": setTabletopContextMenu(null); setDialog({ kind: "new" }); return;
      case "import-package": setTabletopContextMenu(null); importRef.current?.click(); return;
      case "export-package": setTabletopContextMenu(null); void exportPackage(); return;
      case "publish-package": setTabletopContextMenu(null); void openPublicationDialog(); return;
      case "new-resource": setTabletopContextMenu(null); if (active) setDialog({ kind: "new-resource", workspaceKey: active.key }); return;
      case "new-folder": if (active) replaceActive(createWorkspaceFolder(active)); setTabletopContextMenu(null); return;
      case "sync-workspace": {
        const workspace = workspaces.find((item) => item.key === command.workspaceKey);
        if (workspace) requestCloudSync("creator-workspace", workspace.key, workspace.document.package.name);
        return;
      }
      case "resolve-workspace-conflict": {
        const workspace = workspaces.find((item) => item.key === command.workspaceKey);
        if (workspace) setDialog({ kind: "cloud-conflict", documentKind: "creator-workspace", documentId: workspace.key, name: workspace.document.package.name });
        setTabletopContextMenu(null);
        return;
      }
      case "edit-package": void openPackageMetadataDialog(command.workspaceKey); return;
      case "upgrade-templates": setTabletopContextMenu(null); setDialog({ kind: "template-upgrade", workspaceKey: command.workspaceKey }); return;
      case "close-package": requestWorkspacePackageClose(command.workspaceKey); return;
      case "place-selected": placeSelectedTabletopResources(); return;
      case "delete-selected-resources": requestSelectedResourceDeletion(); return;
      case "place-resource": placeWorkspaceResources([{ workspaceKey: command.workspaceKey, resourceId: command.resourceId }]); setTabletopContextMenu(null); return;
      case "open-resource": activateWorkspaceResource(command.resourceId, command.workspaceKey); changeAppMode("creator"); setTabletopContextMenu(null); return;
      case "open-resource-tab": pinWorkspaceTab(command.resourceId, command.workspaceKey); changeAppMode("creator"); setTabletopContextMenu(null); return;
      case "duplicate-resource": duplicateResource(command.resourceId, command.workspaceKey); return;
      case "copy-resource": requestResourcePackageCopy(command.resourceId, command.workspaceKey); return;
      case "delete-resource": requestWorkspaceNodeDeletion({ kind: "resource", id: command.resourceId }, command.workspaceKey); return;
      case "view-instance": if (selectedInstance) setDetailTabletopInstanceId(selectedInstance.id); setTabletopContextMenu(null); return;
      case "edit-instance": setTabletopView("instance-editor"); setTabletopContextMenu(null); return;
      case "replace-instance": replaceSelectedInstanceForm(command.replacementId); return;
      case "rotate-instance": if (selectedInstance) applyTabletopCommand({ type: "rotate-quarter", instanceId: selectedInstance.id, quarterTurns: 1 }); setTabletopContextMenu(null); return;
      case "flip-instance": if (selectedInstance) applyTabletopCommand({ type: "flip", instanceId: selectedInstance.id }); setTabletopContextMenu(null); return;
      case "duplicate-instance": duplicateSelectedInstance(); return;
      case "delete-instances": deleteSelectedInstances(); return;
      case "sync-tabletop": if (activeTabletop) requestCloudSync("gm-tabletop-document", activeTabletop.id, activeTabletop.name); return;
      case "resolve-tabletop-conflict": if (activeTabletop) setDialog({ kind: "cloud-conflict", documentKind: "gm-tabletop-document", documentId: activeTabletop.id, name: activeTabletop.name }); setTabletopContextMenu(null); return;
      case "rename-tabletop": requestTabletopRename(); return;
      case "duplicate-tabletop": void duplicateTabletop(); return;
      case "import-tabletop": tabletopImportRef.current?.click(); return;
      case "export-tabletop": exportTabletop(); return;
      case "print-tabletop": setTabletopContextMenu(null); window.print(); return;
      case "arrange-tabletop": arrangeTabletopInstances(); return;
      case "expand-tabletop": expandActiveTabletop(); return;
      case "clear-tabletop": applyTabletopCommand({ type: "clear" }); clearTabletopSelection(); setTabletopContextMenu(null); return;
      case "delete-tabletop": if (activeTabletop) setDialog({ kind: "delete-tabletop", tabletopId: activeTabletop.id, name: activeTabletop.name }); setTabletopContextMenu(null); return;
    }
  }

  function executeDialogCommand(command: CreatorDialogCommand) {
    switch (command.type) {
      case "close": setDialog(null); return;
      case "set-new-name": setNewName(command.value); return;
      case "set-copy-package-name": setCopyPackageName(command.value); return;
      case "set-tabletop-name": setTabletopNameDraft(command.value); return;
      case "set-package-info":
        setPublicationVersionSuggestion(command.value.versionSuggestion);
        setPackageNameDraft(command.value.package.name);
        setPackageVersionDraft(command.value.package.version);
        setPackageDescriptionDraft(command.value.package.description);
        setPackageTargetsDraft(command.value.package.targets);
        if (command.value.publication) {
          setPublicationTitle(command.value.publication.title);
          setPublicationSummary(command.value.publication.summary);
          setPublicationLanguage(command.value.publication.language);
          setPublicationTags(command.value.publication.tags);
          setPublicationLicense(command.value.publication.licenseId);
        }
        return;
      case "create-workspace": void createWorkspaceFromDialog(); return;
      case "create-resource": createResource(command.template, command.workspaceKey); return;
      case "choose-publication-cover": publicationCoverRef.current?.click(); return;
      case "publish": void publishWorkspace(); return;
      case "save-package": void savePackageMetadata(command.workspaceKey); return;
      case "upgrade-templates": void upgradeWorkspaceTemplates(command.workspaceKey, command.selections); return;
      case "export-conversion": void exportConvertedPackage(command.review); return;
      case "accept-conversion": acceptConvertedPackage(command.review); return;
      case "commit-incoming": commitIncoming(command.incoming, command.handoff); return;
      case "save-aside": void saveAsideThenImport(command.incoming, command.handoff); return;
      case "delete-workspace-node": confirmWorkspaceNodeDeletion(command.workspaceKey, command.node); return;
      case "delete-selected-resources": confirmSelectedResourceDeletion(command.selections); return;
      case "copy-resource": copyResourceIntoWorkspace(command.sourceWorkspaceKey, command.resourceId, command.targetWorkspaceKey); return;
      case "copy-resource-to-new-package": void copyResourceIntoNewWorkspace(command.sourceWorkspaceKey, command.resourceId); return;
      case "close-workspace": void closeWorkspacePackage(command.workspaceKey); return;
      case "create-tabletop": createTabletopFromDialog(); return;
      case "rename-tabletop": renameTabletopFromDialog(command.tabletopId); return;
      case "delete-tabletop": void deleteTabletop(command.tabletopId); return;
      case "commit-tabletop-import": void commitTabletopImport(command.incoming, command.resolution); return;
      case "confirm-cloud-sync": void confirmCloudSync(command.documentKind, command.documentId); return;
      case "resolve-cloud-conflict": void resolveCloudConflict(command.documentKind, command.documentId, command.resolution); return;
    }
  }

  if (!surfaceVisible) return null;
  return (
    <main className={`creator-prototype${appMode === "gm" ? " is-gm-mode" : ""}${appMode === "gm" || resourcePanelOpen ? " is-resource-panel-open" : ""}`} style={designStyle}>
      <div className="creator-workspace">
        <CreatorResourceExplorer
          snapshot={{
            workspaces,
            activeWorkspaceKey: active?.key ?? "",
            activeResourceId,
            activeResourceCount: active?.document.resources.length ?? 0,
            operation: creatorOperation,
            operationLabel: creatorOperation ? creatorOperationLabels[creatorOperation] : undefined,
            search: resourceSearch,
            filteredResources: filteredWorkspaceResources,
            multiSelect: resourceMultiSelect,
            selectedResources: selectedWorkspaceResources,
            expandedWorkspaceKeys,
            sync: workspaceSync,
            savingWorkspaceKey: workspaceSaving ? activeKey : null,
          }}
          execute={executeResourceExplorerCommand}
        />

        {resourcePanelOpen && <CreatorColumnResizeHandle
          label="调整工作区宽度"
          value={workspaceColumnShare}
          preference={creatorColumnPreferences.workspace}
          cssVariable="--creator-workspace-share"
          onChange={setWorkspaceColumnShare}
        />}

        {appMode === "creator" && <CreatorWorkbench
          snapshot={{
            workspaces,
            activeWorkspace: active,
            activeResource: resource,
            activeResourceId,
            tabOrder: resourceTabOrder,
            editorColumnShare,
            assetUrls,
          }}
          execute={executeCreatorWorkbenchCommand}
        />}

        {appMode === "gm" && <GmTabletopWorkbench
          snapshot={{
            tabletops,
            activeTabletop,
            activeTabletopId,
            tabOrder: tabletopTabOrder,
            sync: tabletopSync,
            savingTabletopId: tabletopSaving ? activeTabletopId : null,
            view: tabletopView,
            selectedInstanceId,
            selectedInstanceIds,
            zoom: canvasZoom,
            pan: canvasPan,
            assetUrls,
          }}
          viewportRef={tabletopViewportRef}
          surfaceRef={tabletopSurfaceRef}
          execute={executeGmWorkbenchCommand}
        />}
      </div>

      <CreatorContextMenus
        state={tabletopContextMenu}
        snapshot={{
          appMode,
          workspaces,
          workspaceSync,
          tabletopSync,
          activeTabletop,
          tabletopView,
          resourceMultiSelect,
          selectedWorkspaceResources,
          selectedInstance,
          selectedInstanceEditable: Boolean(selectedInstanceFrontend),
          selectedInstanceCount: selectedInstanceIds.length,
        }}
        execute={executeContextMenuCommand}
      />

      <input ref={tabletopImportRef} hidden type="file" accept=".pbtab" onChange={importTabletop} />

      {detailTabletopInstance && <CardPreviewDialog
        designWidth={canonicalCardDesignSize.width}
        designHeight={canonicalCardDesignSize.height}
        fixedRatio={usesFixedSurfaceRatio(detailTabletopInstance.resource.presentation)}
        label="卡牌详情"
        onClose={() => setDetailTabletopInstanceId("")}
      ><GmTabletopCard instance={detailTabletopInstance} assetUrls={assetUrls} onCommand={applyTabletopCommand} /></CardPreviewDialog>}

      <input ref={importRef} hidden type="file" accept=".pbres" onChange={importPackage} />
      <input ref={conversionImportRef} hidden type="file" accept=".json,.dhcb,.png,application/json,image/png" onChange={selectConversionFile} />
      <input ref={portraitRef} hidden type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={replacePortraitFromFile} />
      <input ref={publicationCoverRef} hidden type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={replacePublicationCover} />

      {pendingCreatorImage && <ImageCropDialog
        file={pendingCreatorImage.file}
        label={pendingCreatorImage.purpose === "publication-cover" ? "发布封面" : "卡牌图片"}
        fixedAspectRatio={pendingCreatorImage.purpose === "publication-cover" ? publicationCoverPolicy.fixedAspectRatio : undefined}
        working={imageCropWorking}
        processingError={imageCropError}
        onCancel={() => { setPendingCreatorImage(null); setImageCropError(null); }}
        onConfirm={(selection) => void applyCreatorImageCrop(selection)}
      />}

      <CreatorDialogs
        dialog={dialog}
        snapshot={{
          systemPackageOptions,
          packageInfo: {
            versionSuggestion: publicationVersionSuggestion,
            package: {
              name: packageNameDraft,
              version: packageVersionDraft,
              description: packageDescriptionDraft,
              targets: packageTargetsDraft,
            },
            publication: {
              title: publicationTitle,
              summary: publicationSummary,
              language: publicationLanguage,
              tags: publicationTags,
              licenseId: publicationLicense,
            },
          },
          publicationCover,
          publicationBusy,
          creatorOperation,
          newName,
          copyPackageName,
          tabletopName: tabletopNameDraft,
          workspaces,
          tabletopSync,
        }}
        execute={executeDialogCommand}
      />
    </main>
  );
}
