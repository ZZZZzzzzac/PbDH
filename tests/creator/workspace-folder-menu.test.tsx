// @vitest-environment happy-dom
import { act } from "react";
import { readFileSync } from "node:fs";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { WorkspaceTree } from "../../apps/creator/src/workspace-prototype/WorkspaceTree.tsx";
import { createWorkspace, createWorkspaceFolder } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";
import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import fixture from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import { creatorWorkspaceDesign } from "../../apps/creator/src/workspace-prototype/design.ts";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("keeps design menu widths when portalled outside Creator CSS variables", () => {
  const css = readFileSync("apps/creator/src/workspace-prototype/workspace.css", "utf8");
  const { instanceWidth, canvasWidth } = creatorWorkspaceDesign.gmTabletop.menus;
  expect(css).toContain(`width: var(--gm-instance-menu-width, ${instanceWidth}px)`);
  expect(css).toContain(`width: var(--gm-canvas-menu-width, ${canvasWidth}px)`);
});

test("uses the shared portal for folder actions and dismisses on tree scrolling", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("innerWidth", 800);
  vi.stubGlobal("innerHeight", 600);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ width: 160, height: 120 }));
  const workspace = createWorkspaceFolder(createWorkspace({ document: structuredClone(fixture) as ResourcePackageLogicalDocument, media: new Map() }), null, "Folder");
  const folderId = workspace.currentFolderId!;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  const onCopyFolder = vi.fn();
  const onDeleteNode = vi.fn();
  const onRenameFolder = vi.fn(() => null);
  await act(async () => root.render(<WorkspaceTree
    workspace={workspace} activeResourceId="" onActivateResource={vi.fn()} onPinResource={vi.fn()}
    onSelectFolder={vi.fn()} onToggleFolder={vi.fn()} onRenameFolder={onRenameFolder}
    onMoveNode={() => null} onDeleteNode={onDeleteNode} onResourceContextMenu={vi.fn()}
    onRootContextMenu={vi.fn()} onCopyFolder={onCopyFolder} resourceTitle={(resource) => resource.id}
    renderResourceIcon={() => null}
  />));
  const open = async () => {
    const folder = [...container.querySelectorAll(".folder-row")].find((row) => row.querySelector(".tree-node-label")?.textContent === "Folder" || row.querySelector<HTMLInputElement>(".tree-rename")?.value === "Folder")!;
    await act(async () => folder.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 790, clientY: 590 })));
    return document.querySelector<HTMLDivElement>("[data-pbdh-tabletop-context-menu]")!;
  };
  let menu = await open();
  expect(menu.parentElement).toBe(document.body);
  expect(menu.style.left).toBe("630px");
  expect(menu.style.top).toBe("470px");
  expect(menu.querySelectorAll("[role=menuitem]")).toHaveLength(3);
  await act(async () => menu.querySelectorAll<HTMLButtonElement>("button")[1]!.click());
  expect(onCopyFolder).toHaveBeenCalledExactlyOnceWith(folderId);
  expect(document.querySelector("[role=menu]")).toBeNull();
  menu = await open();
  await act(async () => menu.querySelector<HTMLButtonElement>(".delete")!.click());
  expect(onDeleteNode).toHaveBeenCalledExactlyOnceWith({ kind: "folder", id: folderId });
  menu = await open();
  await act(async () => menu.querySelector<HTMLButtonElement>("button")!.click());
  expect(container.querySelector(".tree-rename")).not.toBeNull();
  expect(document.querySelector("[role=menu]")).toBeNull();
  await open();
  await act(async () => container.dispatchEvent(new Event("scroll")));
  expect(document.querySelector("[role=menu]")).toBeNull();
});
