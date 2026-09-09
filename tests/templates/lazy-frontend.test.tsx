// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { CanonicalCardSurface, loadTrustedRenderer, loadTrustedAuthoring } from "@pbdh/templates/frontend/lazy";
import { templateRegistry } from "@pbdh/templates/core";
import { manifestEntryFor } from "../../packages/templates/src/frontend/template-frontend-manifest.ts";

test("同版本并发请求只加载一次，查看卡面不加载编辑器或其他版本", async () => {
  const entry = manifestEntryFor("敌人", "1.0.4")!;
  const expected = await entry.loadRenderer();
  let release!: (value: typeof expected) => void;
  const pending = new Promise<typeof expected>((resolve) => { release = resolve; });
  const render = vi.spyOn(entry, "loadRenderer").mockReturnValue(pending);
  const edit = vi.spyOn(entry, "loadAuthoring");
  const other = vi.spyOn(manifestEntryFor("敌人", "1.0.5")!, "loadRenderer");
  try {
    const first = loadTrustedRenderer("敌人", "1.0.4");
    const second = loadTrustedRenderer("敌人", "1.0.4");
    await Promise.resolve();
    expect(render).toHaveBeenCalledOnce();
    release(expected);
    expect(await first).toBe(expected);
    expect(await second).toBe(expected);
    expect(await loadTrustedRenderer("敌人", "1.0.4")).toBe(expected);
    expect(render).toHaveBeenCalledOnce();
    expect(edit).not.toHaveBeenCalled();
    expect(other).not.toHaveBeenCalled();
    const authoring = await loadTrustedAuthoring("敌人", "1.0.4");
    expect(authoring?.templateVersion).toBe("1.0.4");
    await loadTrustedAuthoring("敌人", "1.0.4");
    expect(edit).toHaveBeenCalledOnce();
    expect(await loadTrustedRenderer("不存在", "9.0.0")).toBeUndefined();
  } finally {
    release(expected);
    vi.restoreAllMocks();
  }
});

test("一次重试恢复同版本的所有卡面，切换版本时不显示旧实现", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const firstEntry = manifestEntryFor("自由", "1.0.1")!;
  const nextEntry = manifestEntryFor("自由", "1.0.2")!;
  const original = await firstEntry.loadRenderer();
  const newer = await nextEntry.loadRenderer();
  const firstRenderer = { ...original, render: () => <span>old-version</span> };
  const nextRenderer = { ...newer, render: () => <span>new-version</span> };
  const firstLoad = vi.spyOn(firstEntry, "loadRenderer").mockRejectedValueOnce(new Error("network unavailable")).mockResolvedValue(firstRenderer);
  const editorLoad = vi.spyOn(firstEntry, "loadAuthoring");
  let release!: (value: typeof nextRenderer) => void;
  const pending = new Promise<typeof nextRenderer>((resolve) => { release = resolve; });
  vi.spyOn(nextEntry, "loadRenderer").mockReturnValue(pending);
  const card = (version: string) => {
    const template = templateRegistry.resolve("自由", version)!;
    return <CanonicalCardSurface resource={{ template: { id: "自由", version }, data: template.defaultData,
      presentation: template.defaultPresentation, media: {} }} assets={new Map()} />;
  };
  try {
    await act(async () => root.render(<>{card("1.0.1")}{card("1.0.1")}</>));
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(2);
    expect(firstLoad).toHaveBeenCalledOnce();
    await act(async () => container.querySelector("button")!.click());
    const surfaces = () => [...container.querySelectorAll("[data-pbdh-canonical-surface]")];
    expect(surfaces()).toHaveLength(2);
    expect(surfaces().every((surface) => surface.shadowRoot?.textContent?.includes("old-version"))).toBe(true);
    expect(firstLoad).toHaveBeenCalledTimes(2);
    expect(editorLoad).not.toHaveBeenCalled();
    await act(async () => root.render(card("1.0.2")));
    expect(surfaces()).toHaveLength(0);
    expect(container.textContent).toContain("模板加载中");
    await act(async () => { release(nextRenderer); await pending; });
    expect(surfaces()).toHaveLength(1);
    expect(surfaces()[0]?.shadowRoot?.textContent).toContain("new-version");
    expect(surfaces()[0]?.shadowRoot?.textContent).not.toContain("old-version");
  } finally {
    release(nextRenderer);
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
