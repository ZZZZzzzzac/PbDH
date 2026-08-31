import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { DexieLocalDocumentStore, type LocalDocumentSync } from "@pbdh/local-storage";
import type { PlatformCredentials } from "@pbdh/platform-auth/provider";
import type { TabletopDocumentModel } from "@pbdh/tabletop/core";

import { CreatorCloudDocumentService, type CreatorCloudRecovery } from "./cloud-document-service.ts";
import { isCreatorAuthoringInputFocused } from "./creator-controls.tsx";
import { CreatorWorkspaceRepository } from "./creator-workspace-repository.ts";
import { containGmTabletopInstances } from "./tabletop-placement.ts";
import { TabletopDocumentRepository } from "./tabletop-document-repository.ts";
import type { CreatorWorkspace } from "./workspace-model.ts";

const LOCAL_SAVE_DELAY_MS = 400;
const CLOUD_SYNC_DELAY_MS = 1600;

export function useCreatorDocumentPersistence({
  credentials,
  workspaces,
  setWorkspaces,
  tabletops,
  setTabletops,
  setActiveWorkspaceKey,
  setActiveResourceId,
  setActiveTabletopId,
  setSelectedInstanceId,
  setSelectedInstanceIds,
  addAssetBytes,
  retainAssetUrls,
  notify,
}: {
  credentials: PlatformCredentials | null;
  workspaces: readonly CreatorWorkspace[];
  setWorkspaces: Dispatch<SetStateAction<CreatorWorkspace[]>>;
  tabletops: readonly TabletopDocumentModel[];
  setTabletops: Dispatch<SetStateAction<TabletopDocumentModel[]>>;
  setActiveWorkspaceKey: Dispatch<SetStateAction<string>>;
  setActiveResourceId: Dispatch<SetStateAction<string>>;
  setActiveTabletopId: Dispatch<SetStateAction<string>>;
  setSelectedInstanceId: Dispatch<SetStateAction<string>>;
  setSelectedInstanceIds: Dispatch<SetStateAction<string[]>>;
  addAssetBytes(entries: Iterable<readonly [string, Uint8Array]>): void;
  retainAssetUrls(assetIds: Iterable<string>): void;
  notify(message: string): void;
}) {
  const localDocumentStore = useMemo(() => new DexieLocalDocumentStore(), []);
  const workspaceRepository = useMemo(() => new CreatorWorkspaceRepository(localDocumentStore), [localDocumentStore]);
  const tabletopRepository = useMemo(() => new TabletopDocumentRepository(localDocumentStore), [localDocumentStore]);
  const cloudDocumentService = useMemo(() => new CreatorCloudDocumentService(
    localDocumentStore,
    workspaceRepository,
    tabletopRepository,
  ), [localDocumentStore, tabletopRepository, workspaceRepository]);
  const [workspaceSync, setWorkspaceSync] = useState<Map<string, LocalDocumentSync>>(() => new Map());
  const [tabletopSync, setTabletopSync] = useState<Map<string, LocalDocumentSync>>(() => new Map());
  const [workspaceStorageReady, setWorkspaceStorageReady] = useState(false);
  const [tabletopStorageReady, setTabletopStorageReady] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [tabletopSaving, setTabletopSaving] = useState(false);
  const [tabletopMedia, setTabletopMedia] = useState<Map<string, Uint8Array>>(() => new Map());
  const [workspaceCloudSyncRequest, setWorkspaceCloudSyncRequest] = useState(0);
  const [tabletopCloudSyncRequest, setTabletopCloudSyncRequest] = useState(0);
  const cloudRecoveryAccountRef = useRef<string | null>(null);
  const workspaceWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const tabletopWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const workspaceSaveSequenceRef = useRef(0);
  const tabletopSaveSequenceRef = useRef(0);

  const allTabletopMedia = useMemo(() => new Map([
    ...tabletopMedia,
    ...workspaces.flatMap((workspace) => [...workspace.media]),
  ]), [tabletopMedia, workspaces]);

  const applyCloudSnapshot = useCallback((snapshot: CreatorCloudRecovery, replaceDocuments: boolean) => {
    const restoredWorkspaces = snapshot.workspaces.map((item) => item.workspace);
    const restoredTabletops = snapshot.tabletops.map((item) => containGmTabletopInstances(item.model));
    setWorkspaceSync(new Map(snapshot.workspaces.map((item) => [item.workspace.key, item.sync])));
    setTabletopSync(new Map(snapshot.tabletops.map((item) => [item.model.id, item.sync])));
    if (!replaceDocuments) return;
    setWorkspaces(restoredWorkspaces);
    setTabletops(restoredTabletops);
    setActiveWorkspaceKey((current) => restoredWorkspaces.some((item) => item.key === current) ? current : restoredWorkspaces[0]?.key ?? "");
    setActiveResourceId((current) => restoredWorkspaces.some((item) => item.document.resources.some((resource) => resource.id === current))
      ? current : restoredWorkspaces[0]?.openResourceIds[0] ?? "");
    setActiveTabletopId((current) => restoredTabletops.some((item) => item.id === current) ? current : restoredTabletops[0]?.id ?? "");
    const media = new Map(snapshot.tabletops.flatMap((item) => [...item.media]));
    setTabletopMedia(media);
    addAssetBytes(restoredWorkspaces.flatMap((workspace) => [...workspace.media]));
    addAssetBytes(media);
  }, [addAssetBytes, setActiveResourceId, setActiveTabletopId, setActiveWorkspaceKey, setTabletops, setWorkspaces]);

  useEffect(() => {
    retainAssetUrls([...workspaces.flatMap((workspace) => [...workspace.media.keys()]), ...tabletopMedia.keys()]);
  }, [retainAssetUrls, tabletopMedia, workspaces]);

  useEffect(() => {
    let cancelled = false;
    workspaceRepository.listStored().then((stored) => {
      const visible = stored.filter((item) => item.sync.scope === "local-only" || item.sync.accountId === credentials?.accountId);
      if (cancelled) return;
      const restored = visible.map((item) => item.workspace);
      setWorkspaces(restored);
      setWorkspaceSync(new Map(visible.map((item) => [item.workspace.key, item.sync])));
      setActiveWorkspaceKey(restored[0]?.key ?? "");
      setActiveResourceId(restored[0]?.openResourceIds[0] ?? "");
      addAssetBytes(restored.flatMap((workspace) => [...workspace.media]));
    }).catch((error) => notify(error instanceof Error ? error.message : "工作区恢复失败"))
      .finally(() => { if (!cancelled) setWorkspaceStorageReady(true); });
    return () => { cancelled = true; };
  }, [addAssetBytes, credentials?.accountId, notify, setActiveResourceId, setActiveWorkspaceKey, setWorkspaces, workspaceRepository]);

  useEffect(() => {
    let cancelled = false;
    tabletopRepository.list().then((stored) => {
      const visible = stored.filter((item) => item.sync.scope === "local-only" || item.sync.accountId === credentials?.accountId);
      if (cancelled) return;
      const models = visible.map((item) => item.model);
      const media = new Map(visible.flatMap((item) => [...item.media]));
      setTabletops(models);
      setTabletopSync(new Map(visible.map((item) => [item.model.id, item.sync])));
      setActiveTabletopId(models[0]?.id ?? "");
      setSelectedInstanceId("");
      setSelectedInstanceIds([]);
      setTabletopMedia(media);
      addAssetBytes(media);
    }).catch((error) => notify(error instanceof Error ? error.message : "桌面恢复失败"))
      .finally(() => { if (!cancelled) setTabletopStorageReady(true); });
    return () => { cancelled = true; };
  }, [addAssetBytes, credentials?.accountId, notify, setActiveTabletopId, setSelectedInstanceId, setSelectedInstanceIds, setTabletops, tabletopRepository]);

  useEffect(() => {
    if (!workspaceStorageReady) return;
    const timeout = window.setTimeout(() => {
      const sequence = ++workspaceSaveSequenceRef.current;
      setWorkspaceSaving(true);
      const write = workspaceWriteQueueRef.current.then(async () => {
        await Promise.all(workspaces.map((workspace) => workspaceRepository.save(workspace, credentials?.accountId ?? null)));
      });
      workspaceWriteQueueRef.current = write.catch(() => undefined);
      write.catch((error) => notify(error instanceof Error ? error.message : "工作区保存失败"));
      void write.then(
        () => { if (workspaceSaveSequenceRef.current === sequence) setWorkspaceSaving(false); },
        () => { if (workspaceSaveSequenceRef.current === sequence) setWorkspaceSaving(false); },
      );
    }, LOCAL_SAVE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [credentials?.accountId, notify, workspaceRepository, workspaceStorageReady, workspaces]);

  useEffect(() => {
    if (!tabletopStorageReady) return;
    const timeout = window.setTimeout(() => {
      const sequence = ++tabletopSaveSequenceRef.current;
      setTabletopSaving(true);
      const write = tabletopWriteQueueRef.current.then(async () => {
        await Promise.all(tabletops.map((tabletop) => tabletopRepository.save(tabletop, allTabletopMedia, credentials?.accountId ?? null)));
      });
      tabletopWriteQueueRef.current = write.catch(() => undefined);
      write.catch((error) => notify(error instanceof Error ? error.message : "桌面保存失败"));
      void write.then(
        () => { if (tabletopSaveSequenceRef.current === sequence) setTabletopSaving(false); },
        () => { if (tabletopSaveSequenceRef.current === sequence) setTabletopSaving(false); },
      );
    }, LOCAL_SAVE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [allTabletopMedia, credentials?.accountId, notify, tabletopRepository, tabletopStorageReady, tabletops]);

  useEffect(() => {
    if (!workspaceStorageReady || !credentials || isCreatorAuthoringInputFocused()) return;
    const timeout = window.setTimeout(() => {
      const pendingLocalWrites = workspaceWriteQueueRef.current;
      const write = pendingLocalWrites.then(async () => {
        const snapshot = await cloudDocumentService.flush("creator-workspace", credentials);
        applyCloudSnapshot(snapshot, false);
      });
      workspaceWriteQueueRef.current = write.catch(() => undefined);
      write.catch((error) => notify(error instanceof Error ? error.message : "工作区同步失败"));
    }, CLOUD_SYNC_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [applyCloudSnapshot, cloudDocumentService, credentials, notify, workspaceCloudSyncRequest, workspaceStorageReady, workspaces]);

  useEffect(() => {
    if (!tabletopStorageReady || !credentials || isCreatorAuthoringInputFocused()) return;
    const timeout = window.setTimeout(() => {
      const pendingLocalWrites = tabletopWriteQueueRef.current;
      const write = pendingLocalWrites.then(async () => {
        const snapshot = await cloudDocumentService.flush("gm-tabletop-document", credentials);
        applyCloudSnapshot(snapshot, false);
      });
      tabletopWriteQueueRef.current = write.catch(() => undefined);
      write.catch((error) => notify(error instanceof Error ? error.message : "桌面同步失败"));
    }, CLOUD_SYNC_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [applyCloudSnapshot, cloudDocumentService, credentials, notify, tabletopCloudSyncRequest, tabletopStorageReady, tabletops]);

  useEffect(() => {
    if (!credentials) { cloudRecoveryAccountRef.current = null; return; }
    if (!workspaceStorageReady || !tabletopStorageReady || cloudRecoveryAccountRef.current === credentials.accountId) return;
    cloudRecoveryAccountRef.current = credentials.accountId;
    let cancelled = false;
    cloudDocumentService.recover(credentials).then((snapshot) => {
      if (!cancelled) applyCloudSnapshot(snapshot, true);
    }).catch((error) => {
      cloudRecoveryAccountRef.current = null;
      if (!cancelled) notify(error instanceof Error ? error.message : "云文档恢复失败");
    });
    return () => { cancelled = true; };
  }, [applyCloudSnapshot, cloudDocumentService, credentials, notify, tabletopStorageReady, workspaceStorageReady]);

  return {
    repositories: { workspace: workspaceRepository, tabletop: tabletopRepository },
    cloudDocumentService,
    sync: { workspace: workspaceSync, tabletop: tabletopSync, setWorkspace: setWorkspaceSync, setTabletop: setTabletopSync },
    storageReady: { workspace: workspaceStorageReady, tabletop: tabletopStorageReady },
    saving: { workspace: workspaceSaving, tabletop: tabletopSaving },
    media: { tabletop: tabletopMedia, setTabletop: setTabletopMedia, allTabletop: allTabletopMedia },
    writeQueues: { workspace: workspaceWriteQueueRef, tabletop: tabletopWriteQueueRef },
    requestCloudSyncAfterEditing: {
      workspace: () => setWorkspaceCloudSyncRequest((current) => current + 1),
      tabletop: () => setTabletopCloudSyncRequest((current) => current + 1),
    },
    applyCloudSnapshot,
  };
}
