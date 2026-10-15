// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { useAuth } from "@pbdh/platform-auth/provider";
import { PlatformChrome } from "@pbdh/platform-ui";
import { PlayerSheetSurface } from "../../apps/player/src/PlayerSheetSurface.tsx";
import { useRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import { defaultPlayerSystemPackage } from "../../apps/player/src/playerSystemPackageCatalog.ts";

vi.mock("@pbdh/platform-auth/provider", async (load) => ({
  ...await load<typeof import("@pbdh/platform-auth/provider")>(),
  useAuth: () => ({ status: "loading", credentials: null, profile: null } as ReturnType<typeof useAuth>),
  AccountControl: () => <button>账号</button>,
}));
vi.mock("../../apps/player/src/sheet-runtime/rendering/SheetRenderer.tsx", async () => {
  const { useEffect } = await import("react");
  return { SheetRenderer: ({ systemPackage }: { systemPackage: SystemPackage }) => {
    useEffect(() => {
      if (systemPackage.manifest.ID === "broken-effect") throw new Error("模拟人物卡 Effect 异常");
    }, [systemPackage]);
    if (systemPackage.manifest.ID === "broken-render") throw new Error("模拟人物卡渲染异常");
    return <div>可用人物卡</div>;
  } };
});

test("人物数据尚未就绪时不挂载人物卡，数据就绪后正常显示", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const previous = useRuntimeStore.getState();
  const pkg: SystemPackage = { manifest: { ID: "broken-render", 名称: "待加载包", 版本: "1.0.0", 角色数据版本: "1.0.0" }, modules: [], pages: [] };
  useRuntimeStore.setState({ currentPackage: pkg, characterData: null, bootStatus: "ready" });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<PlatformChrome activePage="player" onNavigate={() => {}}><PlayerSheetSurface /></PlatformChrome>));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain("选择或新建人物");
    expect(container.querySelector('[aria-label="玩家工具栏"]')).not.toBeNull();
    const healthy = { ...pkg, manifest: { ...pkg.manifest, ID: "ready-package" } };
    await act(async () => useRuntimeStore.setState({ currentPackage: healthy, characterData: createEmptyCharacterData(healthy) }));
    expect(container.textContent).toContain("可用人物卡");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    useRuntimeStore.setState(previous, true);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});

test.each(["broken-render", "broken-effect"])("%s 不卸载顶部栏，可重试并切换系统恢复", async (id) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(console, "error").mockImplementation(() => {});
  const previous = useRuntimeStore.getState();
  const pkg: SystemPackage = { manifest: { ID: id, 名称: "故障包", 版本: "1.0.0", 角色数据版本: "1.0.0" }, modules: [], pages: [] };
  const data = createEmptyCharacterData(pkg);
  const healthy = { ...pkg, manifest: { ...pkg.manifest, ID: defaultPlayerSystemPackage.preset.id, 名称: "可用包" } };
  const switchPackage = vi.fn(async () => {
    useRuntimeStore.setState({ currentPackage: healthy, characterData: createEmptyCharacterData(healthy) });
  });
  useRuntimeStore.setState({ currentPackage: pkg, characterData: data, bootStatus: "ready", switchToPresetSystemPackage: switchPackage });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<PlatformChrome activePage="player" onNavigate={() => {}}><PlayerSheetSurface /></PlatformChrome>));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("人物卡显示失败");
    expect(container.querySelector('[aria-label="玩家工具栏"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="当前系统包"]')).not.toBeNull();
    expect(useRuntimeStore.getState().characterData).toBe(data);
    const retry = [...container.querySelectorAll("button")].find(x => x.textContent === "重新尝试显示")!;
    await act(async () => retry.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("人物卡显示失败");
    const select = container.querySelector<HTMLSelectElement>('[aria-label="恢复用系统包"]')!;
    await act(async () => { select.value = defaultPlayerSystemPackage.preset.id; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(switchPackage).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("可用人物卡");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    useRuntimeStore.setState(previous, true);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
