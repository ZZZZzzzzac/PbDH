import { useMemo, type Dispatch, type SetStateAction } from "react";

import type { RemoteCloudDocument } from "@pbdh/cloud-documents";
import type { LocalDocumentSync } from "@pbdh/local-storage";
import type { PlatformCredentials } from "@pbdh/platform-auth/provider";
import { usePlatformTrashSource, type PlatformTrashSource } from "@pbdh/platform-ui";
import type { TabletopDocumentModel } from "@pbdh/tabletop/core";

import type { CreatorCloudDocumentService, CreatorCloudRecovery } from "./cloud-document-service.ts";
import type { CreatorWorkspaceRepository } from "./creator-workspace-repository.ts";
import type { TabletopDocumentRepository } from "./tabletop-document-repository.ts";
import type { CreatorWorkspace } from "./workspace-model.ts";

function trashDocumentName(remote: RemoteCloudDocument): string {
  return remote.documentKind === "creator-workspace"
    ? ((remote.payload as { document?: { package?: { name?: string } } }).document?.package?.name ?? "资源工作区")
    : ((remote.payload as { name?: string }).name ?? "GM 桌面");
}

function parseTrashItemId(itemId: string): {
  location: "local" | "cloud";
  documentKind: "creator-workspace" | "gm-tabletop-document";
  documentId: string;
} {
  const [location, documentKind, ...documentIdParts] = itemId.split(":");
  if ((location !== "local" && location !== "cloud")
    || (documentKind !== "creator-workspace" && documentKind !== "gm-tabletop-document")
    || documentIdParts.length === 0) {
    throw new Error("回收站项目编号无效。");
  }
  return { location, documentKind, documentId: documentIdParts.join(":") };
}

export function useCreatorTrashSource({
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
  credentials: PlatformCredentials | null;
  workspaceRepository: CreatorWorkspaceRepository;
  tabletopRepository: TabletopDocumentRepository;
  cloudDocumentService: CreatorCloudDocumentService;
  applyCloudSnapshot(snapshot: CreatorCloudRecovery, replaceDocuments: boolean): void;
  setWorkspaces: Dispatch<SetStateAction<CreatorWorkspace[]>>;
  setTabletops: Dispatch<SetStateAction<TabletopDocumentModel[]>>;
  setWorkspaceSync: Dispatch<SetStateAction<Map<string, LocalDocumentSync>>>;
  setTabletopSync: Dispatch<SetStateAction<Map<string, LocalDocumentSync>>>;
  setTabletopMedia: Dispatch<SetStateAction<Map<string, Uint8Array>>>;
  setActiveWorkspaceKey: Dispatch<SetStateAction<string>>;
  setActiveTabletopId: Dispatch<SetStateAction<string>>;
  notify(message: string): void;
}) {
  const source = useMemo<PlatformTrashSource>(() => ({
    id: "creator-and-gm-documents",
    async list() {
      const [workspaceTrash, tabletopTrash] = await Promise.all([
        workspaceRepository.listTrash(),
        tabletopRepository.listTrash(),
      ]);
      const local = [
        ...workspaceTrash.map((item) => ({
          id: `local:creator-workspace:${item.workspace.key}`,
          name: item.workspace.document.package.name || "未命名资源工作区",
          documentType: "资源工作区" as const,
          location: "local" as const,
          deletedAt: item.deletedAt,
          purgeAfter: item.purgeAfter,
        })),
        ...tabletopTrash.map((item) => ({
          id: `local:gm-tabletop-document:${item.model.id}`,
          name: item.model.name || "未命名桌面",
          documentType: "GM 桌面" as const,
          location: "local" as const,
          deletedAt: item.deletedAt,
          purgeAfter: item.purgeAfter,
        })),
      ];
      if (!credentials) return local;
      const cloud = (await cloudDocumentService.listTrash(credentials)).map((remote) => ({
        id: `cloud:${remote.documentKind}:${remote.documentId}`,
        name: trashDocumentName(remote),
        documentType: remote.documentKind === "creator-workspace" ? "资源工作区" as const : "GM 桌面" as const,
        location: "cloud" as const,
        deletedAt: remote.deletedAt!,
        purgeAfter: remote.purgeAfter,
      }));
      return [...local, ...cloud];
    },
    async restore(itemId) {
      const { location, documentKind, documentId } = parseTrashItemId(itemId);
      if (location === "cloud") {
        if (!credentials) throw new Error("请先登录再恢复云文档。");
        const remote = (await cloudDocumentService.listTrash(credentials))
          .find((item) => item.documentKind === documentKind && item.documentId === documentId);
        if (!remote) throw new Error("云端回收站里找不到这个文档。");
        applyCloudSnapshot(await cloudDocumentService.restoreFromTrash(remote, credentials), true);
        notify("云文档已恢复");
        return;
      }
      if (documentKind === "creator-workspace") {
        const restored = await workspaceRepository.restore(documentId);
        setWorkspaces((current) => [...current.filter((item) => item.key !== documentId), restored.workspace]);
        setWorkspaceSync((current) => new Map(current).set(documentId, restored.sync));
        setActiveWorkspaceKey(documentId);
        notify(`已恢复“${restored.workspace.document.package.name}”`);
        return;
      }
      const restored = await tabletopRepository.restore(documentId);
      setTabletops((current) => [...current.filter((item) => item.id !== documentId), restored.model]);
      setTabletopSync((current) => new Map(current).set(documentId, restored.sync));
      setTabletopMedia((current) => new Map([...current, ...restored.media]));
      setActiveTabletopId(documentId);
      notify(`已恢复“${restored.model.name}”`);
    },
    async deletePermanently(itemId) {
      const { location, documentKind, documentId } = parseTrashItemId(itemId);
      if (location === "local") {
        if (documentKind === "creator-workspace") await workspaceRepository.deleteFromTrash(documentId);
        else await tabletopRepository.deleteFromTrash(documentId);
        return;
      }
      if (!credentials) throw new Error("请先登录再永久删除云文档。");
      const remote = (await cloudDocumentService.listTrash(credentials))
        .find((item) => item.documentKind === documentKind && item.documentId === documentId);
      if (!remote) throw new Error("云端回收站里找不到这个文档。");
      await cloudDocumentService.deleteFromTrash(remote, credentials);
    },
  }), [applyCloudSnapshot, cloudDocumentService, credentials, notify, setActiveTabletopId, setActiveWorkspaceKey, setTabletopMedia, setTabletopSync, setTabletops, setWorkspaceSync, setWorkspaces, tabletopRepository, workspaceRepository]);

  usePlatformTrashSource(source);
}
