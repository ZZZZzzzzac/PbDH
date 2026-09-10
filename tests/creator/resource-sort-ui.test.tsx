// @vitest-environment happy-dom
import { act, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import * as lazy from "@pbdh/templates/core/lazy";
import { ResourceSortMenu } from "../../apps/creator/src/workspace-prototype/resource-sort-menu.tsx";
import { readResourceSortPreferences, useResourceSort } from "../../apps/creator/src/workspace-prototype/resource-sort-view.ts";
import { CreatorResourceExplorer, type CreatorResourceExplorerSnapshot } from "../../apps/creator/src/workspace-prototype/creator-resource-explorer.tsx";
import { createWorkspace, createWorkspaceFolder, moveWorkspaceNode, type WorkspaceResource } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";
import type { ResourceSortPreferences } from "../../apps/creator/src/workspace-prototype/resource-sorting.ts";
import fixture from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";

const cleanups: Array<() => Promise<void>> = [];
test("name-only templates stay grouped but have no configurable sort menu or hidden descending preference", async () => {
  localStorage.setItem("pbdh:creator:resource-sort", JSON.stringify({ mode: "grouped", templates: { 种族: { 名称: "desc" } } }));
  const base = workspaceWithResources().document.resources[0]!;
  const resources = ["Alpha", "Bravo"].map((name) => ({ ...base, id: name, template: { id: "种族", version: "1.1.0" }, data: { 名称: name } }));
  let sorting: ReturnType<typeof useResourceSort> | undefined;
  function Harness() { sorting = useResourceSort(resources); return null; }
  await mount(<Harness />);
  expect(sorting!.preferences.mode).toBe("grouped");
  expect(sorting!.templates).toEqual([]);
  expect(sorting!.compare(resources[0]!, resources[1]!)).toBeLessThan(0);
});
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); localStorage.clear(); });
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function mount(node: ReactNode) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  await act(async () => root.render(node));
  return { container, render: async (next: ReactNode) => { await act(async () => root.render(next)); } };
}
function button(label: string, parent: ParentNode = document) {
  const found = [...parent.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.getAttribute("aria-label") === label || node.textContent === label);
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}
async function click(label: string, parent?: ParentNode) { await act(async () => button(label, parent).click()); }
async function key(target: Element, value: string) { await act(async () => target.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }))); }

test("single portal menu cycles fields without closing and supports keyboard/back/outside", async () => {
  let saved: ResourceSortPreferences | undefined;
  function Harness() {
    const [preferences, setPreferences] = useState<ResourceSortPreferences>({ mode: "name", templates: {} });
    return <ResourceSortMenu templates={[{ id: "敌人", fields: [{ key: "位阶", label: "位阶" }, { key: "类型", label: "类型" }] }]} preferences={preferences} onChange={(next) => { saved = next; setPreferences(next); }} />;
  }
  await mount(<Harness />);
  await click("排序");
  expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1);
  expect(document.querySelector('[role="menuitemradio"][aria-checked="true"]')?.textContent).toBe("按名称");
  await click("分组内排序");
  await click("敌人");
  const field = button("位阶—");
  await act(async () => field.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  await act(async () => field.click());
  expect(saved).toEqual({ mode: "grouped", templates: { 敌人: { 位阶: "asc" } } });
  await click("位阶升序"); expect(saved?.templates.敌人?.位阶).toBe("desc");
  await click("位阶降序"); expect(saved?.templates.敌人).toEqual({});
  expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1);
  await key(button("位阶—"), "End"); expect(document.activeElement).toBe(button("类型—"));
  await key(document.activeElement!, "ArrowLeft"); expect(document.querySelector('[role="menu"]')?.getAttribute("aria-label")).toBe("分组内排序");
  await key(document.activeElement!, "Escape"); expect(document.querySelector('[role="menu"]')).toBeNull(); expect(document.activeElement).toBe(button("排序"));
  await key(button("排序"), "ArrowDown");
  await act(async () => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  expect(document.querySelector('[role="menu"]')).toBeNull();
});

test("menu flips above the trigger and repositions after async content changes", async () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("resource-sort-menu")
      ? { x: 0, y: 0, left: 0, top: 0, right: 240, bottom: this.textContent?.includes("失败") ? 200 : 120, width: 240, height: this.textContent?.includes("失败") ? 200 : 120, toJSON() {} }
      : { x: 990, y: 650, left: 990, top: 650, right: 1020, bottom: 680, width: 30, height: 30, toJSON() {} };
  });
  vi.stubGlobal("innerWidth", 1024); vi.stubGlobal("innerHeight", 720);
  const props = { templates: [], preferences: { mode: "name", templates: {} } as ResourceSortPreferences, onChange: vi.fn() };
  const mounted = await mount(<ResourceSortMenu {...props} />);
  await click("排序");
  const panel = document.querySelector<HTMLElement>('[role="menu"]')!;
  expect(panel.style.top).toBe("526px"); expect(panel.style.left).toBe("776px");
  await click("分组内排序");
  await mounted.render(<ResourceSortMenu {...props} error="失败" />);
  expect(panel.style.top).toBe("446px");
  await act(async () => panel.dispatchEvent(new Event("scroll", { bubbles: true })));
  expect(document.querySelector('[role="menu"]')).not.toBeNull();
  await act(async () => document.dispatchEvent(new Event("scroll")));
  expect(document.querySelector('[role="menu"]')).toBeNull();
});

test.each([false, true])("Tab exits the portal to the adjacent toolbar control (shift=%s)", async (shiftKey) => {
  await mount(<><button type="button">前一个</button><ResourceSortMenu templates={[]} preferences={{ mode: "name", templates: {} }} onChange={vi.fn()} /><button type="button">后一个</button></>);
  await click("排序");
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true })));
  expect(document.querySelector(".resource-sort-menu")).toBeNull();
  expect(document.activeElement).toBe(button(shiftKey ? "前一个" : "后一个"));
});

function workspaceWithResources() {
  const document = structuredClone(fixture) as ResourcePackageLogicalDocument;
  const base = document.resources[0]!;
  const data = base.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Fixture data must be an object");
  document.resources = [
    { ...base, id: "b", path: "b.json", data: { ...data, 名称: "Bravo", 位阶: "2" } },
    { ...base, id: "a", path: "a.json", data: { ...data, 名称: "Alpha", 位阶: "1" } },
    { ...base, id: "c", path: "c.json", template: { id: "护甲", version: "1.1.0" }, data: { 名称: "Charlie" } },
  ];
  return createWorkspace({ document, media: new Map() });
}
function snapshot(workspaces: ReturnType<typeof createWorkspace>[]): CreatorResourceExplorerSnapshot {
  return { workspaces, activeWorkspaceKey: workspaces[0]!.key, activeResourceId: "", activeResourceCount: 3, operation: null, search: "", filteredResources: [], multiSelect: false, selectedResources: [], expandedWorkspaceKeys: new Set(workspaces.map((item) => item.key)), sync: new Map(), savingWorkspaceKey: null };
}

test("directories retain folders first; search groups across packages and scopes its template menu", async () => {
  localStorage.setItem("pbdh:creator:resource-sort", JSON.stringify({ mode: "grouped", templates: {} }));
  let workspace = createWorkspaceFolder(workspaceWithResources(), null, "子目录");
  workspace = moveWorkspaceNode(workspace, { kind: "resource", id: "b" }, workspace.currentFolderId);
  const other = { ...workspaceWithResources(), key: "other" };
  const state = snapshot([workspace, other]);
  const execute = vi.fn();
  const view = await mount(<CreatorResourceExplorer snapshot={state} execute={execute} />);
  expect(view.container.querySelectorAll(".explorer-search-row .resource-sort-trigger")).toHaveLength(1);
  expect(view.container.querySelector(".explorer-toolbar .resource-sort-trigger")).toBeNull();
  const root = view.container.querySelector(".workspace-tree-root")!;
  expect(root.firstElementChild?.querySelector(".folder-row")).not.toBeNull();
  expect(root.querySelector(".workspace-tree-children .resource-template-group-title")?.textContent).toBe("敌人1");
  const transfer = new DataTransfer();
  transfer.setData("application/x-pbdh-workspace-node", JSON.stringify({ kind: "resource", id: "a", workspaceKey: workspace.key }));
  const drop = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(drop, "dataTransfer", { value: transfer });
  await act(async () => root.querySelector(".workspace-tree-children .resource-template-group-title span")!.dispatchEvent(drop));
  expect(execute).toHaveBeenCalledExactlyOnceWith({ type: "move-node", workspaceKey: workspace.key, node: { kind: "resource", id: "a" }, parentId: workspace.currentFolderId });
  const results = [{ workspace, resource: workspace.document.resources[1]! }, { workspace: other, resource: other.document.resources[0]! }];
  await view.render(<CreatorResourceExplorer snapshot={{ ...state, search: "a", filteredResources: results }} execute={vi.fn()} />);
  const search = view.container.querySelector(".workspace-resource-results")!;
  expect([...search.querySelectorAll(".resource-template-group-title")].map((item) => item.textContent)).toEqual(["敌人2"]);
  expect([...search.querySelectorAll(".tree-node-label")].map((item) => item.textContent)).toEqual(["Alpha", "Bravo"]);
  await click("排序"); await click("分组内排序");
  expect(document.querySelector('.resource-sort-menu')?.textContent).toContain("敌人");
  expect(document.querySelector('.resource-sort-menu')?.textContent).not.toContain("护甲");
});

test("preferences sanitize values and expose read/write storage failures", async () => {
  localStorage.setItem("pbdh:creator:resource-sort", JSON.stringify({ mode: "grouped", templates: { 敌人: { 位阶: "asc", 类型: "desc", 名称: "invalid" } } }));
  expect(readResourceSortPreferences().preferences.templates).toEqual({ 敌人: { 位阶: "asc", 类型: "desc" } });
  const read = vi.fn((): string | null => { throw new Error("denied"); });
  vi.stubGlobal("localStorage", { getItem: read, setItem: () => { throw new Error("quota"); } });
  const view = await mount(<CreatorResourceExplorer snapshot={snapshot([workspaceWithResources()])} execute={vi.fn()} />);
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("无法读取");
  read.mockReturnValue(null);
  await click("排序"); await click("按类型分组");
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("保存失败");
});

test("loads unique exact versions only when grouped; mixed-version comparison is symmetric and name mode is template-independent", async () => {
  const resources = workspaceWithResources().document.resources;
  const mixed: WorkspaceResource[] = [resources[0]!, { ...resources[1]!, template: { id: "敌人", version: "1.1.0" } }, resources[2]!];
  const load = vi.spyOn(lazy, "loadTemplateCore");
  let sorting: ReturnType<typeof useResourceSort> | undefined;
  function Harness() { sorting = useResourceSort([...mixed, ...mixed]); return null; }
  await mount(<Harness />);
  expect(load).not.toHaveBeenCalled();
  expect(sorting!.compare(mixed[0]!, mixed[2]!)).toBeLessThan(0);
  const numbered = (id: string, name: string) => ({ ...mixed[0]!, id, data: { 名称: name } });
  expect(sorting!.compare(numbered("z", "卡牌2"), numbered("a", "卡牌10"))).toBeLessThan(0);
  expect(sorting!.compare(numbered("a", "same"), numbered("z", "same"))).toBeLessThan(0);
  await act(async () => sorting!.change({ mode: "grouped", templates: { 敌人: { 位阶: "asc" } } }));
  expect(load).toHaveBeenCalledTimes(3);
  expect(Math.sign(sorting!.compare(mixed[0]!, mixed[1]!))).toBe(-Math.sign(sorting!.compare(mixed[1]!, mixed[0]!)));
  expect(sorting!.compare(mixed[0]!, mixed[1]!)).toBeGreaterThan(0);
  expect(JSON.parse(localStorage.getItem("pbdh:creator:resource-sort")!).templates).toEqual({ 敌人: { 位阶: "asc" } });
  const expected = sorting!.preferences;
  await mount(<Harness />);
  expect(sorting!.preferences).toEqual(expected);
});
