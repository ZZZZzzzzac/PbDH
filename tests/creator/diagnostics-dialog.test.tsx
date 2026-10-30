// @vitest-environment happy-dom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { CreatorDialogs } from "../../apps/creator/src/workspace-prototype/creator-dialogs.tsx";

const snapshot: ComponentProps<typeof CreatorDialogs>["snapshot"] = {
  systemPackageOptions: [],
  packageInfo: { package: { name: "测试", version: "1.0.0", description: "", targets: [] } },
  publicationCover: { assetId: "", url: "" },
  publicationBusy: false,
  creatorOperation: null,
  newName: "",
  copyPackageName: "",
  tabletopName: "",
  workspaces: [],
  tabletopSync: new Map(),
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mountDiagnostics(diagnostics: ComponentProps<typeof CreatorDialogs>["dialog"]) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(
    <CreatorDialogs dialog={diagnostics} snapshot={snapshot} execute={vi.fn()} />,
  ));
  const unmount = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  return { container, unmount };
}

test("诊断条目用参数说明问题，并显示出错位置", async () => {
  const view = await mountDiagnostics({
    kind: "diagnostics",
    title: "导入失败 · 零写入",
    diagnostics: [{
      code: "resource-package.snapshot-digest.mismatch",
      severity: "error",
      family: "resource-package",
      version: "1.1.0",
      location: "/snapshotDigest",
      params: { actual: "sha256:aa", expected: "sha256:bb" },
    }],
  });
  try {
    const item = view.container.querySelector("ul.diagnostics li")!;
    expect(item.querySelector("b")!.textContent).toContain("摘要不一致");
    expect(item.querySelector("b")!.textContent).toContain("pbres:pack");
    expect(item.querySelector("small")!.textContent).toBe("/snapshotDigest");
  } finally {
    await view.unmount();
  }
});

test("缺少位置信息的诊断不显示空路径", async () => {
  const view = await mountDiagnostics({
    kind: "diagnostics",
    title: "发布失败",
    diagnostics: [{
      code: "PUBLICATION_REQUEST_FAILED",
      severity: "error",
      family: "resource-package",
      version: "1.1.0",
      location: "/",
      params: {},
    }],
  });
  try {
    expect(view.container.querySelector("ul.diagnostics li small")).toBeNull();
  } finally {
    await view.unmount();
  }
});
