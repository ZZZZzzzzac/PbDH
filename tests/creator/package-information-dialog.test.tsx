// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { CreatorDialogs } from "../../apps/creator/src/workspace-prototype/creator-dialogs.tsx";
import { createBlankWorkspace } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";

test("空草稿无封面可提交保存，正式发布仍禁用且拒绝表单提交", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const execute = vi.fn();
  const workspace = await createBlankWorkspace("空草稿");
  const snapshot = {
    systemPackageOptions: [],
    packageInfo: {
      package: { name: "空草稿", version: "1.0.0", description: "未完成的资料", targets: [] },
      publication: { title: "空草稿", summary: "未完成的资料", language: "中文", tags: [], licenseId: "public-domain" },
    },
    publicationCover: { assetId: "", url: "" },
    publicationBusy: false,
    creatorOperation: null,
    newName: "", copyPackageName: "", tabletopName: "",
    workspaces: [workspace], tabletopSync: new Map(),
  };
  try {
    await act(async () => root.render(<CreatorDialogs dialog={{ kind: "package-metadata", workspaceKey: workspace.key }} snapshot={snapshot} execute={execute} />));
    const save = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(save.textContent).toBe("保存资源包信息");
    expect(save.disabled).toBe(false);
    await act(async () => save.click());
    expect(execute).toHaveBeenCalledExactlyOnceWith({ type: "save-package", workspaceKey: workspace.key });
    execute.mockClear();
    await act(async () => root.render(<CreatorDialogs dialog={{ kind: "publish" }} snapshot={snapshot} execute={execute} />));
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(execute).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
