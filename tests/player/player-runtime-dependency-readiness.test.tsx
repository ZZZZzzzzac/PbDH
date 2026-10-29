// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, test, vi } from "vitest";
import type { useAuth } from "@pbdh/platform-auth/provider";

const auth = vi.hoisted(() => ({
  value: { status: "anonymous", credentials: null, profile: null } as ReturnType<typeof useAuth>,
}));
vi.mock("@pbdh/platform-auth/provider", async (load) => ({
  ...await load<typeof import("@pbdh/platform-auth/provider")>(),
  useAuth: () => auth.value,
}));
vi.mock("@pbdh/platform-ui", async (load) => ({
  ...await load<typeof import("@pbdh/platform-ui")>(),
  usePlatformAppBarActions: vi.fn(),
  usePlatformTrashSource: vi.fn(),
  usePlatformNotifications: () => ({ notify: vi.fn() }),
}));

import { PlayerSheetSurface } from "../../apps/player/src/PlayerSheetSurface.tsx";
import { PlayerCloudDocumentService } from "../../apps/player/src/character-saves/cloud-document-service.ts";
import { DexieResourcePackageRepository } from "../../apps/player/src/resources/resource-package-repository.ts";
import { daggerheartCorePreset } from "../../apps/player/src/sheet-runtime/loaders/daggerheartCoreRuntimeLoader.ts";
import { createRuntimeEnvironment } from "../../apps/player/src/sheet-runtime/store/runtimeEnvironment.ts";
import { createRuntimeStore, useRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";

const packageRoot = path.resolve("apps/player/public/system-packages/daggerheart-core");

function serveDaggerheartFiles(): void {
  vi.stubGlobal("fetch", (async (input: RequestInfo | URL) => {
    const pathname = new URL(String(input), "https://preset.invalid").pathname;
    const marker = "/system-packages/daggerheart-core/";
    const relativePath = decodeURIComponent(pathname.slice(pathname.indexOf(marker) + marker.length));
    try {
      return new Response(await readFile(path.join(packageRoot, relativePath)), { status: 200 });
    } catch {
      return new Response(null, { status: 404 });
    }
  }) as typeof fetch);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Player Runtime 依赖配置", () => {
  it("依赖尚未配置时切换预置系统包只报告一条明确失败，不伪造 Resource Library 缺失", async () => {
    serveDaggerheartFiles();
    const runtime = createRuntimeStore(createRuntimeEnvironment());

    await runtime.getState().switchToPresetSystemPackage(daggerheartCorePreset, true);

    const issues = runtime.getState().packageIssues;
    // 未配置的默认依赖不应把「没拿到资源库」当成系统包自身的错误：
    // 否则一次切换会冒出 17 条 MISSING_RESOURCE_LIBRARY_REFERENCE，掩盖真正原因。
    expect(issues.filter((issue) => issue.code === "MISSING_RESOURCE_LIBRARY_REFERENCE")).toEqual([]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "fatal", code: "RUNTIME_DEPENDENCIES_NOT_CONFIGURED" });
  });

  it("启动副作用在第一次 await 之前配置运行时依赖", async () => {
    const source = await readFile(path.resolve("apps/player/src/PlayerSheetSurface.tsx"), "utf8");
    const guardIndex = source.indexOf("if (!startupAuthReady) return;");
    const effectStart = source.lastIndexOf("useEffect(() => {", guardIndex);
    const effectEnd = source.indexOf("}, [authorPreviewHandleStore", guardIndex);
    expect(guardIndex).toBeGreaterThan(-1);
    expect(effectStart).toBeGreaterThan(-1);
    expect(effectEnd).toBeGreaterThan(guardIndex);
    const startupEffect = source.slice(effectStart, effectEnd);
    const configureIndex = startupEffect.indexOf("configureRuntimeDependencies({");
    const firstAwaitIndex = startupEffect.indexOf("await cloudDocumentService");
    expect(configureIndex).toBeGreaterThan(-1);
    expect(firstAwaitIndex).toBeGreaterThan(-1);
    expect(configureIndex).toBeLessThan(firstAwaitIndex);
  });

  test("启动恢复人物存档尚未返回时，系统包加载已经走真实依赖", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const previous = useRuntimeStore.getState();
    let releaseRecovery!: () => void;
    const pendingRecovery = new Promise<void>((resolve) => { releaseRecovery = resolve; });
    vi.spyOn(PlayerCloudDocumentService.prototype, "localSnapshot")
      .mockReturnValue(pendingRecovery.then(() => []));
    vi.spyOn(DexieResourcePackageRepository.prototype, "list").mockResolvedValue([]);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(<PlayerSheetSurface />));
      // 启动流程仍卡在账号恢复：此时上传系统包不能落到「依赖尚未配置」的默认实现上。
      await act(async () => {
        await useRuntimeStore.getState().uploadSystemPackageFromFile(new Blob());
      });
      expect(useRuntimeStore.getState().packageIssues.map((issue) => issue.code))
        .not.toContain("RUNTIME_DEPENDENCIES_NOT_CONFIGURED");
    } finally {
      releaseRecovery();
      await act(async () => root.unmount());
      container.remove();
      useRuntimeStore.setState(previous, true);
    }
  });
});
