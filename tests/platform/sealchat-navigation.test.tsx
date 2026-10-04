// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

vi.mock("@pbdh/platform-ui", () => ({
  PlatformChrome: ({ onNavigate, children }: { onNavigate(page: "player" | "market"): void; children: ReactNode }) => <>
    <button onClick={() => onNavigate("market")}>资源市场</button>
    <button onClick={() => onNavigate("player")}>玩家车卡器</button>
    {children}
  </>,
}));
vi.mock("@pbdh/creator/surface", () => ({ CreatorAppSurface: () => null }));
vi.mock("@pbdh/player/surface", async () => {
  const { readEmbedConfig } = await import("../../apps/player/src/sealchat/adapter.ts");
  return {
    playerSystemPackageOptions: [],
    PlayerAppSurface: ({ surfaceVisible }: { surfaceVisible: boolean }) => surfaceVisible && readEmbedConfig(window.location.href, true)
      ? <section aria-label="SealChat 资源同步">实验同步面板</section>
      : null,
  };
});
vi.mock("@pbdh/market/surface", () => ({
  MarketAppSurface: ({ surfaceVisible, onHandoffNavigate }: { surfaceVisible: boolean; onHandoffNavigate(target: "player", url: URL): void }) => surfaceVisible
    ? <button onClick={() => onHandoffNavigate("player", new URL("/player?market-publication=selected#installed", window.location.origin))}>模拟资源安装交接</button>
    : null,
}));
import { PlatformApp } from "../../apps/platform/src/PlatformApp.tsx";
import { preserveSealChatEntry } from "../../apps/platform/src/platform-route.ts";

test.each(["navigation", "handoff"] as const)("iframe 资源市场往返（%s）保留同步参数而不沿用旧交接数据", async (path) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const previousHref = window.location.href;
  const url = new URL("/player/daggerheart-core", window.location.origin);
  url.searchParams.set("sealchat", "1");
  url.searchParams.set("hostOrigin", "https://chat.test");
  url.searchParams.set("sdkUrl", "https://chat.test/api/v1/channel-embed-sdk.js");
  url.searchParams.set("market-publication", "expired");
  window.history.replaceState(null, "", url);
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const click = async (text: string) => {
    const button = [...container.querySelectorAll("button")].find(item => item.textContent === text);
    if (!button) throw Error("未找到按钮：" + text);
    await act(async () => button.click());
  };
  try {
    await act(async () => root.render(<PlatformApp />));
    expect(container.querySelector('[aria-label="SealChat 资源同步"]')).not.toBeNull();
    await click("资源市场");
    expect(new URL(window.location.href).searchParams.get("market-publication")).toBeNull();
    await click(path === "navigation" ? "玩家车卡器" : "模拟资源安装交接");
    expect(container.querySelector('[aria-label="SealChat 资源同步"]')).not.toBeNull();
    const restored = new URL(window.location.href);
    expect(restored.searchParams.get("sealchat")).toBe("1");
    expect(restored.searchParams.get("hostOrigin")).toBe("https://chat.test");
    expect(restored.searchParams.get("sdkUrl")).toBe("https://chat.test/api/v1/channel-embed-sdk.js");
    expect(restored.searchParams.get("market-publication")).toBe(path === "handoff" ? "selected" : null);
    expect(restored.hash).toBe(path === "handoff" ? "#installed" : "");
  } finally {
    await act(async () => root.unmount()); container.remove();
    window.history.replaceState(null, "", previousHref); vi.unstubAllGlobals();
  }
});

test("只有同源显式 iframe 入口保留接入设置，不把旧查询数据带给其他页面或站点", () => {
  const entry = "https://pbdh.test/player?sealchat=1&hostOrigin=https%3A%2F%2Fchat.test&sdkUrl=https%3A%2F%2Fchat.test%2Fapi%2Fv1%2Fchannel-embed-sdk.js&market-publication=old";
  const target = new URL("https://pbdh.test/pbdh/market?view=new#item");
  const kept = preserveSealChatEntry(target, entry);
  expect(target.href).toBe("https://pbdh.test/pbdh/market?view=new#item");
  expect(kept.searchParams.get("sealchat")).toBe("1");
  expect(kept.searchParams.get("view")).toBe("new");
  expect(kept.searchParams.get("market-publication")).toBeNull();
  expect(kept.hash).toBe("#item");
  const external = new URL("https://other.test/market?view=new");
  expect(preserveSealChatEntry(external, entry).href).toBe(external.href);
  expect(preserveSealChatEntry(target, "https://pbdh.test/player?hostOrigin=ignored").href).toBe(target.href);
});
