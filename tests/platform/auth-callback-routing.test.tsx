// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
vi.mock("@pbdh/creator/surface", () => ({ CreatorAppSurface: () => null }));
vi.mock("@pbdh/market/surface", () => ({ MarketAppSurface: () => null }));
vi.mock("@pbdh/platform-ui", () => ({ PlatformChrome: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@pbdh/player/surface", () => ({
  playerSystemPackageOptions: [],
  PlayerAppSurface: ({ onActiveSystemPackageChange }: { onActiveSystemPackageChange: (directory: string) => void }) => {
    useEffect(() => { onActiveSystemPackageChange("daggerheart-core"); }, [onActiveSystemPackageChange]);
    return null;
  },
}));
import { PlatformApp } from "../../apps/platform/src/PlatformApp.tsx";

test("首页与系统包自动路由不会在 SDK 消费前丢失恢复参数", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.history.replaceState(null, "", "/?auth=recovery#type=recovery&access_token=test-only");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<PlatformApp />));
    expect(window.location.search).toBe("?auth=recovery");
    expect(window.location.hash).toBe("#type=recovery&access_token=test-only");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    window.history.replaceState(null, "", "/");
    vi.unstubAllGlobals();
  }
});
