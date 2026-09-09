// @vitest-environment happy-dom
import { act, useState } from "react";
import { ResourcePackageInfoDialog, type ResourcePackageEditorValue } from "@pbdh/publication-ui";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { CreatorDialogs } from "../../apps/creator/src/workspace-prototype/creator-dialogs.tsx";
import { createBlankWorkspace } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";

test("版本默认自动，可手动指定并恢复自动建议", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const submitted = vi.fn();
  function Form() {
    const [value, setValue] = useState<ResourcePackageEditorValue>({
      package: { name: "待发布资源", version: "1.2.0", description: "", targets: [] },
      versionSuggestion: { version: "1.2.0", summary: "新增资源或关联", automatic: true },
    });
    return <ResourcePackageInfoDialog heading="发布" submitLabel="发布" value={value} systemPackageOptions={[]}
      onChange={setValue} onClose={() => undefined} onSubmit={() => submitted(value)} />;
  }
  const button = (label: string) => [...container.querySelectorAll("button")].find((item) => item.textContent === label)!;
  try {
    await act(async () => root.render(<Form />));
    const input = [...container.querySelectorAll("label")].find((label) => label.querySelector("span")?.textContent === "版本")!.querySelector("input")!;
    expect(input.readOnly).toBe(true);
    expect(container.textContent).toContain("新增资源或关联");
    const name = [...container.querySelectorAll("label")].find((label) => label.querySelector("span")?.textContent === "名称")!.querySelector("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(name, "修改后的名字");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input.readOnly).toBe(true);
    expect(container.textContent).toContain("新增资源或关联");
    await act(async () => button("手动指定").click());
    expect(input.readOnly).toBe(false);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "9.0.0");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button("发布").click());
    expect(submitted).toHaveBeenLastCalledWith(expect.objectContaining({ package: expect.objectContaining({ version: "9.0.0" }) }));
    await act(async () => button("恢复自动").click());
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe("1.2.0");
    await act(async () => button("发布").click());
    expect(submitted).toHaveBeenLastCalledWith(expect.objectContaining({ versionSuggestion: expect.objectContaining({ automatic: true }), package: expect.objectContaining({ version: "1.2.0" }) }));
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

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
