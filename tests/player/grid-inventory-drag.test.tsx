// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import moduleSource from "../../apps/player/public/system-packages/heart-of-hopefind/modules.json";
import { sheetModuleSchema, type SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData";
import { createCardInstance } from "../../apps/player/src/sheet-runtime/domain/cardEngine";
import { GridInventoryModule } from "../../apps/player/src/sheet-runtime/rendering/GridInventoryModule";
import { useRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore";

test("拖动在目标网格预览完整占地，取消后移除预览", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const initial = useRuntimeStore.getState();
  const system: SystemPackage = { manifest: { ID: "grid", 名称: "格子", 版本: "1.0.0", 角色数据版本: "1.0.0" }, pages: [], modules: moduleSource.map((value) => sheetModuleSchema.parse(value)) };
  const table = system.modules.find((module) => module.ID === "supply-inventory")!;
  if (table.类型 !== "cardTable") throw new Error("Missing grid table.");
  const data = createCardInstance(createEmptyCharacterData(system), { instanceId: "water", tableModuleId: table.ID, libraryId: "supplies", definitionId: "water", state: "手上" });
  data.embeddedResourceEntries.water = { libraryId: "supplies", entry: { ID: "water", fields: { 名称: "水壶", 尺寸: "1×2" } } };
  useRuntimeStore.setState({ currentPackage: system, characterData: data });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<GridInventoryModule module={table} systemPackage={system} />));
    const item = host.querySelector<HTMLButtonElement>(".gi-hand .gi-item")!;
    const grid = host.querySelector<HTMLElement>(".gi-grid")!;
    item.setPointerCapture = vi.fn();
    vi.spyOn(grid, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 500, 700));
    vi.spyOn(document, "elementFromPoint").mockReturnValue(grid);
    expect(document.querySelector(".gi-drop-preview")).toBeNull();
    await act(async () => {
      item.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1, clientX: 0, clientY: 0 }));
      item.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: 100, clientY: 100 }));
    });
    const ghost = document.querySelector<HTMLElement>(".gi-drop-preview")!;
    expect(ghost.style.width).toBe("20%");
    expect(ghost.style.left).toBe("20%");
    expect(Number.parseFloat(ghost.style.height)).toBeCloseTo(200 / 7);
    expect(Number.parseFloat(ghost.style.top)).toBeCloseTo(100 / 7);
    await act(async () => item.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 1 })));
    expect(document.querySelector(".gi-drop-preview")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    useRuntimeStore.setState(initial, true);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
