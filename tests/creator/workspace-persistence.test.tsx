// @vitest-environment happy-dom
import "fake-indexeddb/auto";

import { act, useState, type Dispatch, type SetStateAction } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { TABLETOP_DOCUMENT_VERSION, type ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import type { LocalDocumentSync } from "@pbdh/local-storage";
import type { PlatformCredentials } from "@pbdh/platform-auth/provider";
import { createTabletopDocument, type TabletopDocumentModel } from "@pbdh/tabletop/core";

import minotaurPackage from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import {
  CreatorCloudDocumentService,
  type CreatorCloudRecovery,
  type CreatorCloudSyncSnapshot,
} from "../../apps/creator/src/workspace-prototype/cloud-document-service.ts";
import {
  CreatorWorkspaceRepository,
  type StoredCreatorWorkspace,
} from "../../apps/creator/src/workspace-prototype/creator-workspace-repository.ts";
import {
  TabletopDocumentRepository,
  type StoredTabletopDocument,
} from "../../apps/creator/src/workspace-prototype/tabletop-document-repository.ts";
import { useCreatorDocumentPersistence } from "../../apps/creator/src/workspace-prototype/use-creator-document-persistence.ts";
import { createWorkspace, type CreatorWorkspace } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";

// 合法 UUID 作为工作区 key，避免契约校验对 package.id 格式的约束。
const ids = {
  a: "01989f4e-7b2c-7000-8000-0000000000a1",
  b: "01989f4e-7b2c-7000-8000-0000000000b1",
  c: "01989f4e-7b2c-7000-8000-0000000000c1",
  d: "01989f4e-7b2c-7000-8000-0000000000d1",
  x: "01989f4e-7b2c-7000-8000-0000000000e1",
} as const;

const noop = () => {};
const cleanups: Array<() => Promise<void>> = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function credentialsFor(accountId: string): PlatformCredentials {
  return { accessToken: "token", siteSessionId: "session", accountId, canWrite: true };
}

/** 用 conformance fixture 生成指定 key 与名称的工作区。 */
function workspaceFixture(id: string, name: string): CreatorWorkspace {
  const document = structuredClone(minotaurPackage) as ResourcePackageLogicalDocument;
  document.package.id = id;
  document.package.name = name;
  return createWorkspace({ document, media: new Map() });
}

function localSync(): LocalDocumentSync {
  return { scope: "local-only", state: "clean", baseRevision: null };
}

function cloudSync(accountId: string): LocalDocumentSync {
  return { scope: "cloud", state: "clean", baseRevision: "1", accountId, mutationId: null, lastError: null };
}

function storedWorkspace(workspace: CreatorWorkspace, sync: LocalDocumentSync = localSync()): StoredCreatorWorkspace {
  return { workspace, sync };
}

function storedTabletop(model: TabletopDocumentModel, sync: LocalDocumentSync = localSync()): StoredTabletopDocument {
  return {
    model, media: new Map(), sync,
    document: {
      contractVersion: TABLETOP_DOCUMENT_VERSION,
      documentId: model.id, name: model.name, canvas: model.canvas,
      createdAt: "2026-09-11T00:00:00.000Z", updatedAt: "2026-09-11T00:00:00.000Z",
      instances: [], assets: [],
    },
  };
}

function emptySyncSnapshot(): CreatorCloudSyncSnapshot {
  return { workspaceSync: new Map(), tabletopSync: new Map() };
}

/** 只用原型 spy 隔离 Repository/Service，避免任何真实 IndexedDB 或网络访问。 */
function stubRepositories() {
  const listStored = vi.spyOn(CreatorWorkspaceRepository.prototype, "listStored").mockResolvedValue([]);
  const save = vi.spyOn(CreatorWorkspaceRepository.prototype, "save").mockResolvedValue(localSync());
  vi.spyOn(TabletopDocumentRepository.prototype, "list").mockResolvedValue([]);
  vi.spyOn(TabletopDocumentRepository.prototype, "saveUpdate").mockImplementation(async () => {
    throw new Error("unexpected tabletop save");
  });
  return { listStored, save };
}

type HarnessApi = {
  result: ReturnType<typeof useCreatorDocumentPersistence>;
  workspaces: CreatorWorkspace[];
  tabletops: TabletopDocumentModel[];
  setWorkspaces: Dispatch<SetStateAction<CreatorWorkspace[]>>;
};

function PersistenceHarness({
  credentials,
  initialWorkspaces,
  initialTabletops,
  notify,
  onRender,
}: {
  credentials: PlatformCredentials | null;
  initialWorkspaces: CreatorWorkspace[];
  initialTabletops: TabletopDocumentModel[];
  notify: (message: string) => void;
  onRender: (api: HarnessApi) => void;
}) {
  const [workspaces, setWorkspaces] = useState<CreatorWorkspace[]>(initialWorkspaces);
  const [tabletops, setTabletops] = useState<TabletopDocumentModel[]>(initialTabletops);
  const [, setActiveWorkspaceKey] = useState("");
  const [, setActiveResourceId] = useState("");
  const [, setActiveTabletopId] = useState("");
  const [, setSelectedInstanceId] = useState("");
  const [, setSelectedInstanceIds] = useState<string[]>([]);
  const result = useCreatorDocumentPersistence({
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
    addAssetBytes: noop,
    retainAssetUrls: noop,
    notify,
  });
  onRender({ result, workspaces, tabletops, setWorkspaces });
  return null;
}

async function renderHarness({
  credentials = null,
  workspaces = [],
  tabletops = [],
  notify = noop,
}: {
  credentials?: PlatformCredentials | null;
  workspaces?: CreatorWorkspace[];
  tabletops?: TabletopDocumentModel[];
  notify?: (message: string) => void;
} = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const apiRef: { current: HarnessApi | null } = { current: null };
  cleanups.push(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
  });
  await act(async () => {
    root.render(
      <PersistenceHarness
        credentials={credentials}
        initialWorkspaces={workspaces}
        initialTabletops={tabletops}
        notify={notify}
        onRender={(api) => { apiRef.current = api; }}
      />,
    );
  });
  return { apiRef };
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("本地恢复未返回时的界面编辑与新建不被旧恢复列表抹掉", async () => {
  const notify = vi.fn();
  const original = workspaceFixture(ids.a, "原始 A");
  const edited = workspaceFixture(ids.a, "编辑后的 A");
  const created = workspaceFixture(ids.b, "新建 B");
  const restoredOld = workspaceFixture(ids.a, "旧快照 A");
  const legacy = workspaceFixture(ids.c, "旧列表 C");
  const { listStored, save } = stubRepositories();
  const listGate = deferred<StoredCreatorWorkspace[]>();
  listStored.mockReturnValue(listGate.promise);
  save.mockResolvedValue(localSync());
  const recoverGate = deferred<CreatorCloudRecovery>();
  vi.spyOn(CreatorCloudDocumentService.prototype, "recover").mockReturnValue(recoverGate.promise);
  vi.spyOn(CreatorCloudDocumentService.prototype, "flush").mockResolvedValue(emptySyncSnapshot());

  const { apiRef } = await renderHarness({
    credentials: credentialsFor("account-1"),
    workspaces: [original],
    notify,
  });
  await vi.waitFor(() => expect(listStored).toHaveBeenCalledTimes(1));

  // 恢复尚未返回时，界面先编辑 A 并新建 B。
  await act(async () => { apiRef.current!.setWorkspaces([edited, created]); });

  await act(async () => {
    listGate.resolve([
      storedWorkspace(restoredOld, cloudSync("account-1")),
      storedWorkspace(legacy),
    ]);
  });
  await act(async () => {});

  const byKey = new Map(apiRef.current!.workspaces.map((workspace) => [workspace.key, workspace]));
  expect(byKey.get(ids.a)?.document.package.name).toBe("编辑后的 A");
  expect(byKey.has(ids.b)).toBe(true);
  expect(byKey.get(ids.c)?.document.package.name).toBe("旧列表 C");
});

test("listStored 拒绝时工作区存储保持未就绪且不保存空状态", async () => {
  const notify = vi.fn();
  const { listStored, save } = stubRepositories();
  listStored.mockRejectedValue(new Error("读取失败"));

  const { apiRef } = await renderHarness({ notify });
  await vi.waitFor(() => expect(listStored).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(notify).toHaveBeenCalledWith("读取失败"));
  await act(async () => {});

  expect(apiRef.current!.result.storageReady.workspace).toBe(false);
  expect(save).not.toHaveBeenCalled();
});

test("云端恢复延迟期间编辑与新建保留，未修改工作区接纳对应新快照", async () => {
  const accountId = "account-1";
  const notify = vi.fn();
  const workspaceA = workspaceFixture(ids.a, "原始 A");
  const workspaceD = workspaceFixture(ids.d, "原始 D");
  const editedA = workspaceFixture(ids.a, "编辑后的 A");
  const createdB = workspaceFixture(ids.b, "新建 B");
  const cloudA = workspaceFixture(ids.a, "云端 A");
  const cloudD = workspaceFixture(ids.d, "云端 D");
  const cloudC = workspaceFixture(ids.c, "云端 C");
  const { listStored, save } = stubRepositories();
  listStored.mockResolvedValue([
    storedWorkspace(workspaceA, cloudSync(accountId)),
    storedWorkspace(workspaceD, cloudSync(accountId)),
  ]);
  save.mockResolvedValue(localSync());
  const recoverGate = deferred<CreatorCloudRecovery>();
  const recover = vi.spyOn(CreatorCloudDocumentService.prototype, "recover").mockReturnValue(recoverGate.promise);
  vi.spyOn(CreatorCloudDocumentService.prototype, "flush").mockResolvedValue(emptySyncSnapshot());

  const { apiRef } = await renderHarness({
    credentials: credentialsFor(accountId),
    workspaces: [workspaceA, workspaceD],
    notify,
  });
  await vi.waitFor(() => expect(recover).toHaveBeenCalledTimes(1));

  // 云端恢复仍在等待时编辑 A 并新建 B，D 保持不变。
  await act(async () => { apiRef.current!.setWorkspaces([editedA, workspaceD, createdB]); });

  await act(async () => {
    recoverGate.resolve({
      workspaces: [
        storedWorkspace(cloudA, cloudSync(accountId)),
        storedWorkspace(cloudD, cloudSync(accountId)),
        storedWorkspace(cloudC, cloudSync(accountId)),
      ],
      tabletops: [],
    });
  });
  await act(async () => {});

  const byKey = new Map(apiRef.current!.workspaces.map((workspace) => [workspace.key, workspace]));
  expect(byKey.get(ids.a)?.document.package.name).toBe("编辑后的 A");
  expect(byKey.has(ids.b)).toBe(true);
  expect(byKey.get(ids.d)?.document.package.name).toBe("云端 D");
  expect(byKey.get(ids.c)?.document.package.name).toBe("云端 C");
});

test("applyCloudSnapshot 不带 workspaceUpdate 时完全不改变工作区", async () => {
  const notify = vi.fn();
  const workspaceA = workspaceFixture(ids.a, "本地 A");
  const cloudOnly = workspaceFixture(ids.x, "云端 X");
  const { listStored } = stubRepositories();
  listStored.mockResolvedValue([storedWorkspace(workspaceA)]);

  const { apiRef } = await renderHarness({ workspaces: [workspaceA], notify });
  await vi.waitFor(() => expect(apiRef.current!.result.storageReady.workspace).toBe(true));

  const tabletop = createTabletopDocument("01989f4e-7b2c-7000-8000-000000000051", "桌面");
  await act(async () => {
    apiRef.current!.result.applyCloudSnapshot(
      { workspaces: [storedWorkspace(cloudOnly)], tabletops: [storedTabletop(tabletop)] },
      true,
    );
  });

  expect(apiRef.current!.workspaces).toHaveLength(1);
  expect(apiRef.current!.workspaces[0]).toBe(workspaceA);
  expect(apiRef.current!.tabletops.map((item) => item.id)).toEqual([tabletop.id]);
});

test("flushWorkspaceWrites 立即保存当前内容且等待进行中的写入，无需 400ms 防抖", async () => {
  const notify = vi.fn();
  const workspaceB = workspaceFixture(ids.b, "需要立即保存");
  const { listStored, save } = stubRepositories();
  listStored.mockResolvedValue([]);
  const saveGate = deferred<LocalDocumentSync>();
  save.mockReturnValue(saveGate.promise);

  const { apiRef } = await renderHarness({ notify });
  await vi.waitFor(() => expect(apiRef.current!.result.storageReady.workspace).toBe(true));

  // 界面改动后保存立即入队，不依赖任何计时器推进。
  await act(async () => { apiRef.current!.setWorkspaces([workspaceB]); });
  await act(async () => { await Promise.resolve(); });
  expect(save).toHaveBeenCalledWith(workspaceB, null);

  let settled = false;
  let flush: Promise<void> = Promise.resolve();
  await act(async () => {
    flush = apiRef.current!.result.flushWorkspaceWrites().then(() => { settled = true; });
    await Promise.resolve();
  });
  expect(settled).toBe(false);

  await act(async () => { saveGate.resolve(localSync()); await flush; });
  expect(settled).toBe(true);
  expect(save).toHaveBeenCalledWith(workspaceB, null);
});
