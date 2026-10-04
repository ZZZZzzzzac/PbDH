// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { useAuth } from "@pbdh/platform-auth/provider";

const auth = vi.hoisted(() => ({
  value: { status: "loading", credentials: null, profile: null } as ReturnType<typeof useAuth>,
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
import { PlatformRuntimeStorage } from "../../apps/player/src/sheet-runtime/storage/platformRuntimeStorage.ts";
import { useRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";

test.each(["anonymous", "authenticated"] as const)(
  "重开 Player 等账号恢复后才读取当前人物（%s），登录操作不重置缓存选择",
  async (status) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const previous = useRuntimeStore.getState();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const initialize = vi.fn(async () => {});
    const ensure = vi.fn(async () => {});
    const snapshot = vi.spyOn(PlayerCloudDocumentService.prototype, "localSnapshot").mockResolvedValue([]);
    const recover = vi.spyOn(PlayerCloudDocumentService.prototype, "recover").mockResolvedValue([]);
    vi.spyOn(DexieResourcePackageRepository.prototype, "list").mockResolvedValue([]);
    vi.spyOn(PlatformRuntimeStorage.prototype, "loadCurrentSystemPackageCacheMetadata").mockResolvedValue(null);
    useRuntimeStore.setState({ initialize, ensurePresetSystemPackage: ensure });
    try {
      await act(async () => root.render(<PlayerSheetSurface />));
      expect(snapshot).not.toHaveBeenCalled();
      expect(initialize).not.toHaveBeenCalled();
      auth.value = {
        ...auth.value, status,
        credentials: status === "authenticated"
          ? { accountId: "test-account", accessToken: "test-token", siteSessionId: "test-session", canWrite: true }
          : null,
      };
      await act(async () => root.render(<PlayerSheetSurface />));
      const selectedRecovery = status === "authenticated" ? recover : snapshot;
      const otherRecovery = status === "authenticated" ? snapshot : recover;
      expect(selectedRecovery).toHaveBeenCalledOnce();
      expect(otherRecovery).not.toHaveBeenCalled();
      expect(initialize).toHaveBeenCalledOnce();
      auth.value = { ...auth.value, status: "working" };
      await act(async () => root.render(<PlayerSheetSurface />));
      expect(initialize).toHaveBeenCalledOnce();
      expect(selectedRecovery).toHaveBeenCalledOnce();
    } finally {
      await act(async () => root.unmount());
      container.remove();
      useRuntimeStore.setState(previous, true);
      auth.value = { ...auth.value, status: "loading", credentials: null };
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  },
);
