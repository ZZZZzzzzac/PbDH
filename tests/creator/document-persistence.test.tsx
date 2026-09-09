// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { loadTrustedAuthoring } from "@pbdh/templates/frontend/lazy";
import type { LocalDocumentSync } from "@pbdh/local-storage";
import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import { createTabletopDocument, type TabletopDocumentModel } from "@pbdh/tabletop/core";

import document from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import { CreatorCloudDocumentService } from "../../apps/creator/src/workspace-prototype/cloud-document-service.ts";
import { CreatorWorkspaceRepository } from "../../apps/creator/src/workspace-prototype/creator-workspace-repository.ts";
import { TabletopDocumentRepository } from "../../apps/creator/src/workspace-prototype/tabletop-document-repository.ts";
import { CreatorWorkbench } from "../../apps/creator/src/workspace-prototype/creator-workbench.tsx";
import { useCreatorDocumentPersistence } from "../../apps/creator/src/workspace-prototype/use-creator-document-persistence.ts";
import { createWorkspace, updateWorkspacePackageMetadata, type CreatorWorkspace } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";

const credentials = { accessToken: "test-token", accountId: "test-account", siteSessionId: "test-session", canWrite: true };
const sync: LocalDocumentSync = { scope: "cloud", state: "clean", baseRevision: "1", accountId: credentials.accountId };
const noop = () => undefined;
const tabletopAssetId = `sha256:${"a".repeat(64)}`;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = globalThis.document.createElement("div");
  globalThis.document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("隐藏的 Creator 首次不恢复文档，进入后只恢复一次并保留状态", async () => {
  const empty = { workspaces: [], tabletops: [] };
  const workspaceRead = vi.spyOn(CreatorWorkspaceRepository.prototype, "listStored").mockResolvedValue([]);
  const tabletopRead = vi.spyOn(TabletopDocumentRepository.prototype, "list").mockResolvedValue([]);
  const recover = vi.spyOn(CreatorCloudDocumentService.prototype, "recover").mockResolvedValue(empty);
  vi.spyOn(CreatorCloudDocumentService.prototype, "flush").mockResolvedValue({ workspaceSync: new Map(), tabletopSync: new Map() });
  function Probe({ surfaceKey }: { surfaceKey: "creator" | "gm" | "hidden" }) {
    const [workspaces, setWorkspaces] = useState<CreatorWorkspace[]>([]);
    const [tabletops, setTabletops] = useState<TabletopDocumentModel[]>([]);
    const persistence = useCreatorDocumentPersistence({
      credentials, surfaceKey, workspaces, setWorkspaces, tabletops, setTabletops,
      setActiveWorkspaceKey: noop, setActiveResourceId: noop, setActiveTabletopId: noop,
      setSelectedInstanceId: noop, setSelectedInstanceIds: noop, addAssetBytes: noop, retainAssetUrls: noop, notify: noop,
    });
    return <output>{String(persistence.storageReady.workspace)}:{String(persistence.storageReady.tabletop)}</output>;
  }
  await act(async () => root.render(<Probe surfaceKey="hidden" />));
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(workspaceRead).not.toHaveBeenCalled();
  expect(tabletopRead).not.toHaveBeenCalled();
  expect(recover).not.toHaveBeenCalled();
  expect(container.textContent).toBe("false:false");
  await act(async () => root.render(<Probe surfaceKey="creator" />));
  expect(workspaceRead).toHaveBeenCalledOnce();
  expect(tabletopRead).toHaveBeenCalledOnce();
  expect(recover).toHaveBeenCalledOnce();
  expect(container.textContent).toBe("true:true");
  await act(async () => root.render(<Probe surfaceKey="hidden" />));
  await act(async () => root.render(<Probe surfaceKey="gm" />));
  expect(workspaceRead).toHaveBeenCalledOnce();
  expect(tabletopRead).toHaveBeenCalledOnce();
  expect(recover).toHaveBeenCalledOnce();
  expect(container.textContent).toBe("true:true");
});

async function mountEditor(tabletopIds: string[] = []) {
  await loadTrustedAuthoring("敌人", "1.0.0");
  const workspace = createWorkspace({ document: document as ResourcePackageLogicalDocument, media: new Map() });
  const tabletopDocuments = tabletopIds.map((id) => {
    const model = createTabletopDocument(id, id);
    if (id === tabletopIds[0]) model.assets = [{ id: tabletopAssetId, mediaType: "image/webp", byteLength: "1", width: "630", height: "880" }];
    return { model, sync, media: new Map<string, Uint8Array>(model.assets.map((asset) => [asset.id, new Uint8Array([1])])), document: {
      contractVersion: "1.0.0" as const, documentId: id, name: id,
      canvas: model.canvas, instances: [], assets: model.assets,
      createdAt: "2026-09-09T00:00:00.000Z", updatedAt: "2026-09-09T00:00:00.000Z",
    } };
  });
  const recovery = { workspaces: [{ workspace, sync }], tabletops: tabletopDocuments };
  vi.spyOn(CreatorWorkspaceRepository.prototype, "listStored").mockResolvedValue(recovery.workspaces);
  vi.spyOn(TabletopDocumentRepository.prototype, "list").mockResolvedValue(tabletopDocuments);
  const tabletopSave = vi.spyOn(TabletopDocumentRepository.prototype, "saveUpdate").mockResolvedValue(undefined);
  vi.spyOn(CreatorCloudDocumentService.prototype, "recover").mockResolvedValue(recovery);
  const save = vi.spyOn(CreatorWorkspaceRepository.prototype, "save").mockResolvedValue(sync);
  const flush = vi.spyOn(CreatorCloudDocumentService.prototype, "flush").mockResolvedValue({
    workspaceSync: new Map([[workspace.key, sync]]), tabletopSync: new Map(tabletopDocuments.map((item) => [item.model.id, item.sync])),
  });
  function Editor() {
    const [surfaceVisible, setSurfaceVisible] = useState(true);
    const [workspaces, setWorkspaces] = useState<CreatorWorkspace[]>([]);
    const [tabletops, setTabletops] = useState<TabletopDocumentModel[]>([]);
    const persistence = useCreatorDocumentPersistence({
      credentials, workspaces, setWorkspaces, tabletops, setTabletops, surfaceKey: surfaceVisible ? "creator" : "hidden",
      setActiveWorkspaceKey: noop, setActiveResourceId: noop, setActiveTabletopId: noop,
      setSelectedInstanceId: noop, setSelectedInstanceIds: noop,
      addAssetBytes: noop, retainAssetUrls: noop, notify: noop,
    });
    const active = workspaces[0];
    return <>
      <button onClick={() => setWorkspaces((current) => current.map((item) => updateWorkspacePackageMetadata(item, {
        ...item.document.package, name: "修改后的名称",
      })))}>编辑资料</button>
      <button data-edit-tabletop onClick={() => setTabletops((current) => current.map((model, index) =>
        index === 0 ? { ...model, name: `${model.name} edited` } : model))}>修改第一张桌面</button>
      <button data-unused-media onClick={() => persistence.media.setTabletop((current) => new Map([
        ...current, ["unused", new Uint8Array([1])],
      ]))}>加入无关媒体</button>
      <button data-referenced-media onClick={() => persistence.media.setTabletop((current) => new Map([
        ...current, [tabletopAssetId, new Uint8Array([2])],
      ]))}>替换引用媒体</button>
      <button data-retry-tabletop onClick={() => setTabletops((current) => [...current])}>重试保存桌面</button>
      <button data-hide-surface onClick={() => setSurfaceVisible(false)}>隐藏编辑器</button>
      {surfaceVisible && <CreatorWorkbench snapshot={{ workspaces, activeWorkspace: active, activeResource: active?.document.resources[0],
        activeResourceId: active?.document.resources[0]?.id ?? "", editorColumnShare: 0.5, assetUrls: new Map() }}
        execute={(command) => { if (command.type === "request-cloud-edit") persistence.requestCloudSyncAfterEditing.workspace(); }} />}
    </>;
  }
  await act(async () => root.render(<Editor />));
  await act(async () => vi.advanceTimersByTimeAsync(400));
  flush.mockClear();
  tabletopSave.mockClear();
  return { save, flush, tabletopSave };
}

test("修改一张桌面只保存该桌面，失败记录可重试，无关媒体不触发保存", async () => {
  const { tabletopSave } = await mountEditor(["first", "second"]);
  await act(async () => container.querySelector<HTMLButtonElement>("[data-edit-tabletop]")!.click());
  await act(async () => vi.advanceTimersByTimeAsync(400));
  expect(tabletopSave.mock.calls.map(([model]) => model.id)).toEqual(["first"]);
  tabletopSave.mockClear();
  await act(async () => container.querySelector<HTMLButtonElement>("[data-unused-media]")!.click());
  await act(async () => vi.advanceTimersByTimeAsync(400));
  expect(tabletopSave).not.toHaveBeenCalled();
  await act(async () => container.querySelector<HTMLButtonElement>("[data-referenced-media]")!.click());
  await act(async () => vi.advanceTimersByTimeAsync(400));
  expect(tabletopSave.mock.calls.map(([model]) => model.id)).toEqual(["first"]);
  tabletopSave.mockClear();
  tabletopSave.mockRejectedValueOnce(new Error("storage unavailable"));
  await act(async () => container.querySelector<HTMLButtonElement>("[data-edit-tabletop]")!.click());
  await act(async () => vi.advanceTimersByTimeAsync(400));
  tabletopSave.mockClear();
  await act(async () => container.querySelector<HTMLButtonElement>("[data-retry-tabletop]")!.click());
  await act(async () => vi.advanceTimersByTimeAsync(400));
  expect(tabletopSave.mock.calls.map(([model]) => model.id)).toEqual(["first"]);
});

test("云同步等待本地写入结束，不能越过仍在保存的编辑", async () => {
  const { save, flush } = await mountEditor();
  let release!: (value: LocalDocumentSync) => void;
  const pending = new Promise<LocalDocumentSync>((resolve) => { release = resolve; });
  save.mockReturnValueOnce(pending);
  try {
    await act(async () => container.querySelector("button")!.click());
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ document: expect.objectContaining({
      package: expect.objectContaining({ name: "修改后的名称" }),
    }) }), credentials.accountId);
    expect(flush.mock.calls.filter(([kind]) => kind === "creator-workspace")).toHaveLength(0);
    await act(async () => { release(sync); await pending; });
    expect(flush.mock.calls.filter(([kind]) => kind === "creator-workspace")).toHaveLength(1);
  } finally {
    release(sync);
  }
});

test("实际编辑框聚焦时不云同步，失焦后重新等待安静窗口", async () => {
  const { flush } = await mountEditor();
  const input = container.querySelector<HTMLInputElement>("[data-template-authoring] input")!;
  expect(input).not.toBeNull();
  await act(async () => input.focus());
  await act(async () => vi.advanceTimersByTimeAsync(20_000));
  expect(flush.mock.calls.filter(([kind]) => kind === "creator-workspace")).toHaveLength(0);
  await act(async () => input.blur());
  await act(async () => vi.advanceTimersByTimeAsync(9999));
  expect(flush.mock.calls.filter(([kind]) => kind === "creator-workspace")).toHaveLength(0);
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(flush.mock.calls.filter(([kind]) => kind === "creator-workspace")).toHaveLength(1);
});

test("切换页面隐藏聚焦编辑器后仍会调度云同步", async () => {
  const { flush } = await mountEditor();
  const input = container.querySelector<HTMLInputElement>("[data-template-authoring] input")!;
  await act(async () => input.focus());
  await act(async () => vi.advanceTimersByTimeAsync(20_000));
  expect(flush.mock.calls.filter(([kind]) => kind === "creator-workspace")).toHaveLength(0);
  await act(async () => container.querySelector<HTMLButtonElement>("[data-hide-surface]")!.click());
  await act(async () => vi.advanceTimersByTimeAsync(10_000));
  expect(flush.mock.calls.filter(([kind]) => kind === "creator-workspace")).toHaveLength(1);
});
