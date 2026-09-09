// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { loadTrustedAuthoring, loadTrustedRenderer } from "@pbdh/templates/frontend/lazy";
import { loadTemplateCore } from "@pbdh/templates/core/lazy";
import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import fixture from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import { createWorkspace } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";
import { CreatorWorkbench } from "../../apps/creator/src/workspace-prototype/creator-workbench.tsx";

test.each([10, 1000])("%i 条资源的真实工作台只挂载当前卡面，切换后替换预览", async (count) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  await Promise.all([loadTrustedAuthoring("敌人", "1.0.0"), loadTrustedRenderer("敌人", "1.0.0"), loadTemplateCore("敌人", "1.0.0")]);
  const document = structuredClone(fixture) as ResourcePackageLogicalDocument;
  document.resources = Array.from({ length: count }, (_, index) => ({ ...structuredClone(document.resources[0]!),
    id: `resource-${index}`, path: `敌人/${index}.json`, presentation: { mode: "text", fixedRatio: true }, media: {},
    data: { ...document.resources[0]!.data as Record<string, unknown>, 名称: `卡片-${index}` } }));
  document.assets = [];
  const workspace = createWorkspace({ document, media: new Map() });
  const container = globalThis.document.createElement("div");
  globalThis.document.body.append(container);
  const root = createRoot(container);
  const render = (index: number) => root.render(<CreatorWorkbench snapshot={{ workspaces: [workspace], activeWorkspace: workspace,
    activeResource: document.resources[index], activeResourceId: document.resources[index]!.id,
    editorColumnShare: 0.5, assetUrls: new Map() }} execute={() => undefined} />);
  try {
    await act(async () => render(0));
    expect(container.querySelectorAll('[aria-label$="规范卡面"]')).toHaveLength(1);
    expect(container.querySelector('[aria-label="卡片-0规范卡面"]')).not.toBeNull();
    await act(async () => render(count - 1));
    expect(container.querySelectorAll('[aria-label$="规范卡面"]')).toHaveLength(1);
    expect(container.querySelector('[aria-label="卡片-0规范卡面"]')).toBeNull();
    expect(container.querySelector(`[aria-label="卡片-${count - 1}规范卡面"]`)).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
