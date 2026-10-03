// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const player = vi.hoisted(() => ({
  report: undefined as ((directory?: string) => void) | undefined,
  requested: undefined as string | undefined,
}));
vi.mock("@pbdh/creator/surface", () => ({ CreatorAppSurface: () => null }));
vi.mock("@pbdh/market/surface", () => ({ MarketAppSurface: () => null }));
vi.mock("@pbdh/platform-ui", () => ({ PlatformChrome: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@pbdh/player/surface", () => ({
  playerSystemPackageOptions: [],
  PlayerAppSurface: ({ requestedSystemPackage, onActiveSystemPackageChange }: {
    requestedSystemPackage?: string;
    onActiveSystemPackageChange(directory?: string): void;
  }) => {
    player.requested = requestedSystemPackage;
    player.report = onActiveSystemPackageChange;
    useEffect(() => {
      onActiveSystemPackageChange(requestedSystemPackage ?? "daggerheart-core");
    }, []);
    return null;
  },
}));
import { PlatformApp } from "../../apps/platform/src/PlatformApp.tsx";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

it("共用入口启动和切换预设后都保持无后缀地址", async () => {
  window.history.replaceState(null, "", "/player?keep=1#character");
  await act(async () => root.render(<PlatformApp />));
  expect(window.location.pathname).toBe("/player");
  await act(async () => player.report?.("tttri"));
  expect(window.location.pathname).toBe("/player");
  expect(player.requested).toBeUndefined();
  expect(window.location.search).toBe("?keep=1");
  expect(window.location.hash).toBe("#character");
});

it("后缀入口继续指定预设，并跟随页内预设切换", async () => {
  window.history.replaceState(null, "", "/player/tttri");
  await act(async () => root.render(<PlatformApp />));
  expect(player.requested).toBe("tttri");
  await act(async () => player.report?.("daggerheart-core"));
  expect(window.location.pathname).toBe("/player/daggerheart-core");
  expect(player.requested).toBe("daggerheart-core");
});

it("本地包激活后清除旧预设后缀，重新挂载也不再指定默认包", async () => {
  window.history.replaceState(null, "", "/player/daggerheart-core?keep=1#character");
  await act(async () => root.render(<PlatformApp />));
  await act(async () => player.report?.());
  expect(window.location.pathname).toBe("/player");
  expect(player.requested).toBeUndefined();
  expect(window.location.search).toBe("?keep=1");
  expect(window.location.hash).toBe("#character");
  await act(async () => root.unmount());
  root = createRoot(container);
  await act(async () => root.render(<PlatformApp />));
  expect(window.location.pathname).toBe("/player");
  expect(player.requested).toBeUndefined();
});
