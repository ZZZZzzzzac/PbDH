// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { CreatorResourceExplorer } from "../../apps/creator/src/workspace-prototype/creator-resource-explorer.tsx";
import { createWorkspace, createWorkspaceFolder, moveWorkspaceNode } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";
import { workspaceNodeDataType } from "../../apps/creator/src/workspace-prototype/workspace-node-drag.ts";
import fixture from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); vi.unstubAllGlobals(); });
test.each([".package-root strong", ".workspace-package-list", ".resource-tree"])("moves a nested resource to its package root via %s", async (selector) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let workspace = createWorkspace({document: structuredClone(fixture) as ResourcePackageLogicalDocument, media: new Map()});
  workspace = createWorkspaceFolder(workspace, null, "子目录");
  const resourceId = workspace.document.resources[0]!.id;
  workspace = moveWorkspaceNode(workspace, {kind:"resource",id:resourceId},workspace.currentFolderId);
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  const execute = vi.fn((command) => {
    if (command.type === "move-node") workspace = moveWorkspaceNode(workspace,command.node,command.parentId);
  });
  await act(async () => root.render(<CreatorResourceExplorer snapshot={{workspaces:[workspace],activeWorkspaceKey:workspace.key,activeResourceId:resourceId,activeResourceCount:1,operation:null,search:"",filteredResources:[],multiSelect:false,selectedResources:[],expandedWorkspaceKeys:new Set([workspace.key]),sync:new Map(),savingWorkspaceKey:null}} execute={execute} />));
  const dataTransfer = new DataTransfer();
  const dragEvent = (type: string) => { const event = new Event(type,{bubbles:true,cancelable:true}); Object.defineProperty(event,"dataTransfer",{value:dataTransfer}); return event; };
  await act(async () => { container.querySelector('.file-row')!.dispatchEvent(dragEvent('dragstart')); });
  expect(JSON.parse(dataTransfer.getData(workspaceNodeDataType)).workspaceKey).toBe(workspace.key);
  await act(async () => { container.querySelector(selector)!.dispatchEvent(dragEvent('drop')); });
  expect(execute).toHaveBeenCalledExactlyOnceWith({type:"move-node",workspaceKey:workspace.key,node:{kind:"resource",id:resourceId},parentId:null});
  expect(workspace.resourceLocations.find((item)=>item.resourceId===resourceId)?.parentId).toBeNull();
  expect(workspace.document.resources[0]!.path).not.toContain('子目录/');
});
