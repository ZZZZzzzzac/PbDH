import { useMemo, useRef, type Dispatch, type SetStateAction } from "react";

import type { RemoteCloudDocument } from "@pbdh/cloud-documents";
import type { LocalDocumentSync } from "@pbdh/local-storage";
import type { PlatformCredentials } from "@pbdh/platform-auth/provider";
import { usePlatformTrashSource, type PlatformTrashSource } from "@pbdh/platform-ui";
import type { TabletopDocumentModel } from "@pbdh/tabletop/core";

import type { CreatorCloudDocumentService, CreatorCloudRecovery } from "./cloud-document-service.ts";
import type { CreatorWorkspaceRepository } from "./creator-workspace-repository.ts";
import type { TabletopDocumentRepository } from "./tabletop-document-repository.ts";
import type { CreatorWorkspace } from "./workspace-model.ts";
import type { WorkspaceSnapshotUpdate } from "./workspace-snapshot.ts";

type CreatorTrashDocumentKind = "creator-workspace" | "gm-tabletop-document";

function trashDocumentName(remote: RemoteCloudDocument): string {
  return remote.documentKind === "creator-workspace"
    ? ((remote.payload as { document?: { package?: { name?: string } } }).document?.package?.name ?? "资源工作区")
    : ((remote.payload as { name?: string }).name ?? "GM 桌面");
}

export function useCreatorTrashSource({
  workspaces,
  flushWorkspaceWrites,
  credentials,
  workspaceRepository,
  tabletopRepository,
  cloudDocumentService,
  applyCloudSnapshot,
  setWorkspaces,
  setTabletops,
  setWorkspaceSync,
  setTabletopSync,
  setTabletopMedia,
  setActiveWorkspaceKey,
  setActiveTabletopId,
  notify,
}: {
  workspaces: readonly CreatorWorkspace[];
  flushWorkspaceWrites(): Promise<void>;
  credentials: PlatformCredentials | null;
  workspaceRepository: CreatorWorkspaceRepository;
  tabletopRepository: TabletopDocumentRepository;
  cloudDocumentService: CreatorCloudDocumentService;
  applyCloudSnapshot(snapshot: CreatorCloudRecovery, replaceDocuments: boolean, update?: WorkspaceSnapshotUpdate): void;
  setWorkspaces: Dispatch<SetStateAction<CreatorWorkspace[]>>;
  setTabletops: Dispatch<SetStateAction<TabletopDocumentModel[]>>;
  setWorkspaceSync: Dispatch<SetStateAction<Map<string, LocalDocumentSync>>>;
  setTabletopSync: Dispatch<SetStateAction<Map<string, LocalDocumentSync>>>;
  setTabletopMedia: Dispatch<SetStateAction<Map<string, Uint8Array>>>;
  setActiveWorkspaceKey: Dispatch<SetStateAction<string>>;
  setActiveTabletopId: Dispatch<SetStateAction<string>>;
  notify(message: string): void;
}) {
  const currentWorkspaces = useRef(workspaces);
  currentWorkspaces.current = workspaces;
  // 云端恢复/永久删除的操作体按文档种类复用，避免在两个云端来源里重复实现。
  const cloudTrashActions = useMemo(() => ({
    async restore(documentKind: CreatorTrashDocumentKind, documentId: string): Promise<void> {
      if (!credentials) throw new Error("请先登录再恢复云文档。");
      if (documentKind === "creator-workspace") {
        if (currentWorkspaces.current.some((workspace) => workspace.key === documentId)) {
          throw new Error("工作区已有同 ID 资源包，已保留工作区内容，不能用回收站版本覆盖。");
        }
        await flushWorkspaceWrites();
      }
      const baseline = currentWorkspaces.current;
      const remote = (await cloudDocumentService.listTrash(credentials, documentKind))
        .find((item) => item.documentId === documentId);
      if (!remote) throw new Error("云端回收站里找不到这个文档。");
      applyCloudSnapshot(await cloudDocumentService.restoreFromTrash(remote, credentials), true,
        documentKind === "creator-workspace" ? { baseline } : undefined);
      notify("云文档已恢复");
    },
    async deletePermanently(documentKind: CreatorTrashDocumentKind, documentId: string): Promise<void> {
      if (!credentials) throw new Error("请先登录再永久删除云文档。");
      const remote = (await cloudDocumentService.listTrash(credentials, documentKind))
        .find((item) => item.documentId === documentId);
      if (!remote) throw new Error("云端回收站里找不到这个文档。");
      await cloudDocumentService.deleteFromTrash(remote, credentials);
    },
  }), [applyCloudSnapshot, cloudDocumentService, credentials, flushWorkspaceWrites, notify]);

  const source = useMemo<PlatformTrashSource>(() => ({
    id: "creator-trash-local-workspace",
    label: "本机资源工作区",
    location: "local",
    async list() {
      return (await workspaceRepository.listTrash()).map((item) => ({
        id: item.workspace.key,
        name: item.workspace.document.package.name || "未命名资源工作区",
        documentType: "资源工作区" as const,
        location: "local" as const,
        deletedAt: item.deletedAt,
        purgeAfter: item.purgeAfter,
      }));
    },
    async restore(documentId) {
      if (currentWorkspaces.current.some((workspace) => workspace.key === documentId)) {
        throw new Error("工作区已有同 ID 资源包，已保留工作区内容，不能用回收站版本覆盖。");
      }
      await flushWorkspaceWrites();
      const restored = await workspaceRepository.restore(documentId);
      setWorkspaces((current) => current.some((item) => item.key === documentId) ? current : [...current, restored.workspace]);
      setWorkspaceSync((current) => new Map(current).set(documentId, restored.sync));
      setActiveWorkspaceKey(documentId);
      notify(`已恢复“${restored.workspace.document.package.name}”`);
    },
    async deletePermanently(documentId) {
      await workspaceRepository.deleteFromTrash(documentId);
    },
  }), [flushWorkspaceWrites, notify, setActiveWorkspaceKey, setWorkspaceSync, setWorkspaces, workspaceRepository]);

  const localTabletopTrashSource = useMemo<PlatformTrashSource>(() => ({
    id: "creator-trash-local-tabletop",
    label: "本机GM桌面",
    location: "local",
    async list() {
      return (await tabletopRepository.listTrash()).map((item) => ({
        id: item.model.id,
        name: item.model.name || "未命名桌面",
        documentType: "GM 桌面" as const,
        location: "local" as const,
        deletedAt: item.deletedAt,
        purgeAfter: item.purgeAfter,
      }));
    },
    async restore(documentId) {
      const restored = await tabletopRepository.restore(documentId);
      setTabletops((current) => [...current.filter((item) => item.id !== documentId), restored.model]);
      setTabletopSync((current) => new Map(current).set(documentId, restored.sync));
      setTabletopMedia((current) => new Map([...current, ...restored.media]));
      setActiveTabletopId(documentId);
      notify(`已恢复“${restored.model.name}”`);
    },
    async deletePermanently(documentId) {
      await tabletopRepository.deleteFromTrash(documentId);
    },
  }), [notify, setActiveTabletopId, setTabletopMedia, setTabletopSync, setTabletops, tabletopRepository]);

  const cloudWorkspaceTrashSource = useMemo<PlatformTrashSource>(() => ({
    id: "creator-trash-cloud-workspace",
    label: "云端资源工作区",
    location: "cloud",
    async list() {
      if (!credentials) return [];
      return (await cloudDocumentService.listTrash(credentials, "creator-workspace")).map((remote) => ({
        id: remote.documentId,
        name: trashDocumentName(remote),
        documentType: "资源工作区" as const,
        location: "cloud" as const,
        deletedAt: remote.deletedAt!,
        purgeAfter: remote.purgeAfter,
      }));
    },
    restore: (documentId) => cloudTrashActions.restore("creator-workspace", documentId),
    deletePermanently: (documentId) => cloudTrashActions.deletePermanently("creator-workspace", documentId),
  }), [cloudDocumentService, cloudTrashActions, credentials]);

  const cloudTabletopTrashSource = useMemo<PlatformTrashSource>(() => ({
    id: "creator-trash-cloud-tabletop",
    label: "云端GM桌面",
    location: "cloud",
    async list() {
      if (!credentials) return [];
      return (await cloudDocumentService.listTrash(credentials, "gm-tabletop-document")).map((remote) => ({
        id: remote.documentId,
        name: trashDocumentName(remote),
        documentType: "GM 桌面" as const,
        location: "cloud" as const,
        deletedAt: remote.deletedAt!,
        purgeAfter: remote.purgeAfter,
      }));
    },
    restore: (documentId) => cloudTrashActions.restore("gm-tabletop-document", documentId),
    deletePermanently: (documentId) => cloudTrashActions.deletePermanently("gm-tabletop-document", documentId),
  }), [cloudDocumentService, cloudTrashActions, credentials]);

  usePlatformTrashSource(source);
  usePlatformTrashSource(localTabletopTrashSource);
  usePlatformTrashSource(cloudWorkspaceTrashSource);
  usePlatformTrashSource(cloudTabletopTrashSource);
}
