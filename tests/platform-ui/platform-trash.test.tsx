// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { PlatformAppBar, type PlatformTrashSource } from "../../packages/platform-ui/src/index.tsx";

vi.mock("@pbdh/platform-auth/provider", () => ({ AccountControl: () => null }));
vi.mock("../../packages/platform-ui/src/TutorialDialog.tsx", () => ({ TutorialEntry: () => null }));
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function source(id: string, list: PlatformTrashSource["list"]): PlatformTrashSource {
  return { id, list, restore: vi.fn(), deletePermanently: vi.fn() };
}

async function openTrash(sources: PlatformTrashSource[]) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  await act(async () => root.render(<PlatformAppBar activePage="creator" trashSources={sources} />));
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="回收站"]')!.click());
  return { container, root };
}

test("一个来源读取失败不隐藏成功来源，且不能全部删除不完整列表", async () => {
  const failed = source("本机资源工作区", async () => { throw new DOMException("Internal error", "UnknownError"); });
  const cloud = source("云端资源工作区", async () => [{
    id: "cloud:one", name: "仍可恢复的云端资源包", documentType: "资源工作区", location: "cloud",
    deletedAt: "2026-09-11T00:00:00.000Z", purgeAfter: null,
  }]);
  const { container } = await openTrash([failed, cloud]);
  expect(container.textContent).toContain("仍可恢复的云端资源包");
  expect(container.textContent).toContain("本机资源工作区");
  expect(container.textContent).not.toContain("回收站为空");
  expect(container.textContent).not.toContain("Internal error");
  const deleteAll = [...container.querySelectorAll("button")].find((button) => button.textContent === "全部删除")!;
  expect(deleteAll.disabled).toBe(true);
});

test("全部来源失败时显示读取失败而不是空回收站，刷新后可恢复", async () => {
  const list = vi.fn<PlatformTrashSource["list"]>().mockRejectedValueOnce(new Error("UnknownError Internal error."))
    .mockResolvedValue([]);
  const { container } = await openTrash([source("本机人物存档", list)]);
  expect(container.textContent).not.toContain("回收站为空");
  expect(container.textContent).not.toContain("0 项");
  expect(container.textContent).not.toContain("Internal error");
  await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "刷新")!.click());
  expect(container.textContent).toContain("回收站为空");
});

test("账号来源变更后丢弃旧请求结果", async () => {
  let finish!: (items: Awaited<ReturnType<PlatformTrashSource["list"]>>) => void;
  const oldSource = source("old", () => new Promise((resolve) => { finish = resolve; }));
  const { container, root } = await openTrash([oldSource]);
  const newSources = [source("new", async () => [])];
  await act(async () => root.render(<PlatformAppBar activePage="creator" trashSources={newSources} />));
  await act(async () => finish([{
    id: "old", name: "旧账号私有内容", documentType: "资源工作区", location: "cloud",
    deletedAt: "2026-09-11T00:00:00.000Z", purgeAfter: null,
  }]));
  expect(container.textContent).not.toContain("旧账号私有内容");
  expect(container.textContent).toContain("回收站为空");
});

test("来源长时间不返回时显示超时提示并允许刷新", async () => {
  vi.useFakeTimers();
  const { container } = await openTrash([source("本机资源工作区", () => new Promise(() => {}))]);
  await act(async () => vi.advanceTimersByTimeAsync(15_000));
  expect(container.textContent).toContain("TRASH_TIMEOUT");
  expect(container.textContent).not.toContain("回收站为空");
  expect([...container.querySelectorAll("button")].find((button) => button.textContent === "刷新")!.disabled).toBe(false);
});

test.each([
  [401, "重新登录"], [403, "权限"], [409, "状态已改变"], [503, "云端服务暂时异常"],
])("云端 HTTP %i 给出相应处理建议", async (status, guidance) => {
  const cloud = { ...source("cloud", async () => { throw Object.assign(new Error("Internal error secret"), { status }); }),
    label: "云端人物存档", location: "cloud" as const };
  const { container } = await openTrash([cloud]);
  expect(container.textContent).toContain(guidance);
  expect(container.textContent).not.toContain("secret");
});

test("恢复失败保留不完整列表警告，不会意外启用全部删除", async () => {
  const local = { ...source("local", async () => { throw new Error("Internal error"); }), location: "local" as const };
  const cloud = { ...source("cloud", async () => [{ id: "one", name: "云端包", location: "cloud" as const,
    documentType: "资源工作区" as const, deletedAt: "2026-09-11T00:00:00.000Z", purgeAfter: null }]),
    location: "cloud" as const, restore: vi.fn().mockRejectedValue(Object.assign(new Error("Internal error"), { status: 409 })) };
  const { container } = await openTrash([local, cloud]);
  await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "恢复")!.click());
  expect(container.textContent).toContain("TRASH_DOCUMENT_CHANGED");
  expect(container.textContent).toContain("TRASH_LOCAL_STORAGE");
  expect([...container.querySelectorAll("button")].find((button) => button.textContent === "全部删除")!.disabled).toBe(true);
});
