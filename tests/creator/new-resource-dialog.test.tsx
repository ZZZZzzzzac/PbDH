// @vitest-environment happy-dom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { templateRegistry } from "@pbdh/templates/core";
import { templateCoreLoaders } from "@pbdh/templates/core/lazy";
import { CreatorDialogs } from "../../apps/creator/src/workspace-prototype/creator-dialogs.tsx";

const snapshot: ComponentProps<typeof CreatorDialogs>["snapshot"] = {
  systemPackageOptions: [], packageInfo: { package: { name: "测试", version: "1.0.0", description: "", targets: [] } },
  publicationCover: { assetId: "", url: "" }, publicationBusy: false, creatorOperation: null,
  newName: "", copyPackageName: "", tabletopName: "", workspaces: [], tabletopSync: new Map(),
};
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  const execute = vi.fn();
  const render = (callback = execute) => root.render(<CreatorDialogs dialog={{ kind: "new-resource", workspaceKey: "workspace-a" }} snapshot={snapshot} execute={callback} />);
  await act(async () => render());
  const button = (name: string) => [...container.querySelectorAll("button")].find((item) => item.textContent === name)!;
  return { root, container, execute, render, button };
}

test("菜单不加载能力；确认选项后使用最新提交回调", async () => {
  const loads = templateCoreLoaders.map((entry) => ({ entry, load: vi.spyOn(entry, "load") }));
  const template = templateRegistry.resolve("护甲", "1.1.0")!;
  let release!: (value: typeof template) => void;
  const pending = new Promise<typeof template>((resolve) => { release = resolve; });
  loads.find(({ entry }) => entry.id === "护甲" && entry.version === "1.1.0")!.load.mockReturnValue(pending);
  const view = await mount();
  expect(loads.every(({ load }) => load.mock.calls.length === 0)).toBe(true);
  try {
    await act(async () => view.button("护甲").click());
    expect(view.container.textContent).toContain("模板加载中");
    expect(view.execute).not.toHaveBeenCalled();
    const latest = vi.fn();
    await act(async () => view.render(latest));
    await act(async () => { release(template); await pending; });
    expect(view.execute).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledExactlyOnceWith({ type: "create-resource", template, workspaceKey: "workspace-a" });
    expect(loads.filter(({ load }) => load.mock.calls.length).map(({ entry }) => entry.id)).toEqual(["护甲"]);
  } finally { await act(async () => { release(template); await pending; }); }
});

test("取消菜单后，迟到的加载结果不会创建资源", async () => {
  const template = templateRegistry.resolve("武器", "1.1.0")!;
  let release!: (value: typeof template) => void;
  const pending = new Promise<typeof template>((resolve) => { release = resolve; });
  vi.spyOn(templateCoreLoaders.find((entry) => entry.id === "武器" && entry.version === "1.1.0")!, "load").mockReturnValue(pending);
  const view = await mount();
  try {
    await act(async () => view.button("武器").click());
    await act(async () => { view.button("取消").click(); view.root.render(null); });
    expect(view.execute).toHaveBeenCalledExactlyOnceWith({ type: "close" });
    await act(async () => { release(template); await pending; });
    expect(view.execute).toHaveBeenCalledOnce();
  } finally { await act(async () => { release(template); await pending; }); }
});

test("能力加载失败不创建资源，再次选择可重试", async () => {
  const template = templateRegistry.resolve("自由", "1.1.0")!;
  const load = vi.spyOn(templateCoreLoaders.find((entry) => entry.id === "自由" && entry.version === "1.1.0")!, "load")
    .mockRejectedValueOnce(new Error("网络不可用")).mockResolvedValue(template);
  const view = await mount();
  await act(async () => view.button("自由").click());
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("网络不可用");
  expect(view.execute).not.toHaveBeenCalled();
  await act(async () => view.button("自由").click());
  expect(view.execute).toHaveBeenCalledExactlyOnceWith({ type: "create-resource", template, workspaceKey: "workspace-a" });
  expect(load).toHaveBeenCalledTimes(2);
});
