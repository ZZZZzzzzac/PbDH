// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import fixture from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import { CanonicalCardSurface } from "../../packages/resource-renderer/src/react.tsx";
import { adversaryRendererRevision } from "../../packages/templates/src/frontend/adversary/1.0.0/renderer.tsx";
import type { AdversaryData } from "../../packages/templates/src/core/index.ts";
import type { SurfaceResource } from "../../packages/resource-renderer/src/core.ts";

test("渲染器同步抛错只影响当前卡，修改数据后可以恢复", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const uncaught = vi.fn();
  const root = createRoot(container, { onUncaughtError: uncaught, onCaughtError: () => undefined });
  const clicked = vi.fn();
  const renderer = {
    ...adversaryRendererRevision,
    render: ({ data }: Parameters<typeof adversaryRendererRevision.render>[0]) => {
      if (data.名称 === "broken") throw new Error("renderer failed");
      return <button onClick={clicked}>{data.名称}</button>;
    },
  };
  const resource = fixture.resources[0] as unknown as SurfaceResource<AdversaryData>;
  const card = (name: string) => <CanonicalCardSurface
    resource={{ ...resource, data: { ...resource.data, 名称: name } }}
    renderer={renderer}
    expectedRendererRevision={renderer.revision}
    assets={new Map([[fixture.assets[0]!.id, { status: "ready", url: "blob:fixture" }]])}
  />;
  const surfaces = () => [...container.querySelectorAll("[data-pbdh-canonical-surface]")];
  try {
    await act(async () => root.render(<>{card("broken")}{card("正常卡片")}</>));
    expect(uncaught).not.toHaveBeenCalled();
    expect(surfaces()).toHaveLength(2);
    expect(surfaces()[0]?.shadowRoot?.textContent).toContain("renderer.render.failed");
    await act(async () => surfaces()[1]?.shadowRoot?.querySelector("button")?.click());
    expect(clicked).toHaveBeenCalledOnce();
    await act(async () => root.render(<>{card("已修复")}{card("正常卡片")}</>));
    expect(surfaces()[0]?.shadowRoot?.querySelector("button")?.textContent).toBe("已修复");
    expect(surfaces()[0]?.shadowRoot?.textContent).not.toContain("renderer.render.failed");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
