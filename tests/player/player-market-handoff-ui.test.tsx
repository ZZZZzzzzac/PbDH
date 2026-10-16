// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { act, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { useAuth } from "@pbdh/platform-auth/provider";

vi.mock("@pbdh/platform-auth/provider", async (load) => ({
  ...await load<typeof import("@pbdh/platform-auth/provider")>(),
  useAuth: () => ({ status: "anonymous", credentials: null, profile: null } as ReturnType<typeof useAuth>),
}));
vi.mock("@pbdh/platform-ui", async (load) => ({
  ...await load<typeof import("@pbdh/platform-ui")>(),
  usePlatformAppBarActions: vi.fn(),
  usePlatformTrashSource: vi.fn(),
  usePlatformNotifications: () => ({ notify: vi.fn() }),
}));
import { PlayerSheetSurface } from "../../apps/player/src/PlayerSheetSurface.tsx";
import { PlayerCloudDocumentService } from "../../apps/player/src/character-saves/cloud-document-service.ts";
import { DexieResourcePackageRepository, PbDHLocalDatabase } from "../../apps/player/src/resources/resource-package-repository.ts";
import { PlatformRuntimeStorage } from "../../apps/player/src/sheet-runtime/storage/platformRuntimeStorage.ts";
import { useRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";

const fixtureRoot = "contracts/conformance/resource-package/1.0.0/valid/";
const document = JSON.parse(readFileSync(`${fixtureRoot}minotaur-wrecker.json`, "utf8"));
const archive = readFileSync(`${fixtureRoot}minotaur-wrecker.pbres`);
const handoffUrl = new URL("https://pbdh.test/player");
handoffUrl.search = new URLSearchParams({
  pbdhHandoff: "publication", target: "player", publicationId: "publication-repeat",
  packageId: document.package.id, packageVersion: document.package.version,
  snapshotDigest: document.snapshotDigest,
}).toString();

// 和 Shell 一样保持 Player 挂载，只改变路由，并在消费后清除交接参数。
function HandoffHost() {
  const [url, setUrl] = useState("https://pbdh.test/market");
  return <>
    <button onClick={() => setUrl("https://pbdh.test/market")}>返回市场</button>
    <button onClick={() => setUrl(handoffUrl.href)}>从市场安装</button>
    <PlayerSheetSurface handoffUrl={url} onHandoffConsumed={(cleaned) => setUrl(cleaned.href)} />
  </>;
}

test.each(["manager-open", "manager-closed", "download-failed", "remove-reinstall"])(
  "同一发布快照按当前安装状态处理再次交接（%s）",
  async (scenario) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const previous = useRuntimeStore.getState();
    const container = window.document.createElement("div");
    window.document.body.append(container);
    const root = createRoot(container);
    vi.spyOn(PlayerCloudDocumentService.prototype, "localSnapshot").mockResolvedValue([]);
    const database = new PbDHLocalDatabase(`pbdh-market-handoff-test-${crypto.randomUUID()}`);
    const repository = new DexieResourcePackageRepository(database);
    const list = repository.list.bind(repository);
    const replace = repository.replace.bind(repository);
    const remove = repository.remove.bind(repository);
    vi.spyOn(DexieResourcePackageRepository.prototype, "list").mockImplementation(list);
    const writes = vi.spyOn(DexieResourcePackageRepository.prototype, "replace").mockImplementation(replace);
    vi.spyOn(DexieResourcePackageRepository.prototype, "remove").mockImplementation(remove);
    vi.spyOn(PlatformRuntimeStorage.prototype, "loadCurrentSystemPackageCacheMetadata").mockResolvedValue(null);
    vi.spyOn(PlatformRuntimeStorage.prototype, "loadCurrentPackageAssets").mockResolvedValue([]);
    useRuntimeStore.setState({
      initialize: vi.fn(async () => {}), ensurePresetSystemPackage: vi.fn(async () => {}),
      currentPackage: null, characterData: null,
      basePackage: { manifest: { ID: "handoff-test", 名称: "交接测试", 版本: "1.0.0", 角色数据版本: "1.0.0" }, pages: [], modules: [] },
      refreshPlatformResources: vi.fn(async () => {}),
    });
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(new Uint8Array(archive)));
    if (scenario === "download-failed") fetcher.mockRejectedValueOnce(new Error("下载中断"));
    vi.stubGlobal("fetch", fetcher);
    const click = async (label: string) => {
      const button = [...container.querySelectorAll("button")].find((item) =>
        item.textContent === label || item.getAttribute("aria-label") === label);
      expect(button, label).toBeDefined();
      await act(async () => button!.click());
    };
    const waitForHeading = async (title: string) => {
      await vi.waitFor(async () => {
        await act(async () => {});
        expect([...container.querySelectorAll("h2")].map((heading) => heading.textContent), `fetches: ${fetcher.mock.calls.length}`).toContain(title);
      });
    };
    try {
      await act(async () => root.render(<StrictMode><HandoffHost /></StrictMode>));
      await click("从市场安装");
      await waitForHeading(scenario === "download-failed" ? "无法安装资源包" : "安装资源包");
      expect(fetcher).toHaveBeenCalledTimes(1);
      if (scenario === "remove-reinstall") {
        await click("安装");
        await waitForHeading(document.package.name);
        expect(writes).toHaveBeenCalledTimes(1);
        expect(await database.installedSystemResourcePackages.count()).toBe(1);

        // 仍在库中：重复入口应提示已安装，不重复写入。
        await click("返回市场");
        await click("从市场安装");
        await waitForHeading("此资源包已经安装");
        expect(writes).toHaveBeenCalledTimes(1);
        expect(await database.installedSystemResourcePackages.count()).toBe(1);
        await click("关闭");

        // 从资源管理器真正移除后，同版本同快照应允许重新安装。
        await click(`移除 ${document.package.name}`);
        await click("确认移除");
        await waitForHeading("没有已安装的资源包");
        expect(await database.installedSystemResourcePackages.count()).toBe(0);
        await click("返回市场");
        await click("从市场安装");
        await waitForHeading("安装资源包");
        await click("安装");
        await waitForHeading(document.package.name);
        expect(writes).toHaveBeenCalledTimes(2);
        expect(await database.installedSystemResourcePackages.count()).toBe(1);
        expect((await database.installedSystemResourcePackages.toArray())[0]?.snapshotDigest).toBe(document.snapshotDigest);
        expect(fetcher).toHaveBeenCalledTimes(3);
        return;
      }
      await click(scenario === "download-failed" ? "关闭" : "取消");
      if (scenario === "manager-closed") await click("关闭资源管理器");
      await click("返回市场");
      await click("从市场安装");
      await waitForHeading("安装资源包");
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      await act(async () => root.unmount());
      container.remove();
      useRuntimeStore.setState(previous, true);
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      database.close();
      await database.delete();
    }
  },
);
