// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { LocalDocumentSync } from "@pbdh/local-storage";
import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import type { TabletopDocumentModel } from "@pbdh/tabletop/core";

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

async function mountEditor() {
  const workspace = createWorkspace({ document: document as ResourcePackageLogicalDocument, media: new Map() });
  const recovery = { workspaces: [{ workspace, sync }], tabletops: [] };
  vi.spyOn(CreatorWorkspaceRepository.prototype, "listStored").mockResolvedValue(recovery.workspaces);
  vi.spyOn(TabletopDocumentRepository.prototype, "list").mockResolvedValue([]);
  vi.spyOn(CreatorCloudDocumentService.prototype, "recover").mockResolvedValue(recovery);
  const save = vi.spyOn(CreatorWorkspaceRepository.prototype, "save").mockResolvedValue(sync);
  const flush = vi.spyOn(CreatorCloudDocumentService.prototype, "flush").mockResolvedValue(recovery);
  function Editor() {
    const [workspaces, setWorkspaces] = useState<CreatorWorkspace[]>([]);
    const [tabletops, setTabletops] = useState<TabletopDocumentModel[]>([]);
    const persistence = useCreatorDocumentPersistence({
      credentials, workspaces, setWorkspaces, tabletops, setTabletops,
      setActiveWorkspaceKey: noop, setActiveResourceId: noop, setActiveTabletopId: noop,
      setSelectedInstanceId: noop, setSelectedInstanceIds: noop,
      addAssetBytes: noop, retainAssetUrls: noop, notify: noop,
    });
    const active = workspaces[0];
    return <>
      <button onClick={() => setWorkspaces((current) => current.map((item) => updateWorkspacePackageMetadata(item, {
        ...item.document.package, name: "修改后的名称",
      })))}>编辑资料</button>
      <CreatorWorkbench snapshot={{ workspaces, activeWorkspace: active, activeResource: active?.document.resources[0],
        activeResourceId: active?.document.resources[0]?.id ?? "", editorColumnShare: 0.5, assetUrls: new Map() }}
        execute={(command) => { if (command.type === "request-cloud-edit") persistence.requestCloudSyncAfterEditing.workspace(); }} />
    </>;
  }
  await act(async () => root.render(<Editor />));
  await act(async () => vi.advanceTimersByTimeAsync(400));
  flush.mockClear();
  return { save, flush };
}

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
