// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import modules from "../../apps/player/public/system-packages/heart-of-hopefind/modules.json";
import { sheetModuleSchema, type SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData";
import { createCardInstance, tidyCardTable } from "../../apps/player/src/sheet-runtime/domain/cardEngine";
import { useRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore";
import { useSheetOutput } from "../../apps/player/src/sheet-runtime/rendering/app/useSheetOutput";

test("PDF准备与结束都保留背包位置、旋转，仅整理普通桌面", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const initial = useRuntimeStore.getState();
  const system: SystemPackage = {
    manifest: { ID: "grid", 名称: "格子", 版本: "1.0.0", 角色数据版本: "1.0.0" },
    pages: [{ ID: "inventory", 名称: "背包", layout: { 类型: "htmlTemplate", htmlContent: "<main></main>" } }],
    modules: [...modules.map((module) => sheetModuleSchema.parse(module)), { ID: "ordinary", 类型: "cardTable", 标签: "普通桌面", 资源来源: [{ 类型: "resourceLibrary", ID: "supplies" }] }],
  };
  let data = createEmptyCharacterData(system);
  for (const [id, table] of [["water", "supply-inventory"], ["ration", "supply-inventory"], ["card", "ordinary"]]) {
    data = createCardInstance(data, { instanceId: id, tableModuleId: table, libraryId: "supplies", definitionId: id, state: "主背包" });
  }
  data.cards.instances[0] = { ...data.cards.instances[0], xPct: 60, yPct: 0, rotation: 90 };
  data.cards.instances[1] = { ...data.cards.instances[1], xPct: 0, yPct: 0, rotation: 90 };
  const before = structuredClone(data.cards.instances.filter((item) => item.tableModuleId === "supply-inventory"));
  const tidy = vi.fn((id, layout) => useRuntimeStore.setState((state) => ({ characterData: tidyCardTable(state.characterData!, id, layout) })));
  const restore = vi.fn();
  useRuntimeStore.setState({ currentPackage: system, characterData: data, restoreCardTableLayout: restore });
  let output: ReturnType<typeof useSheetOutput>;
  function Harness() {
    output = useSheetOutput({ currentPackage: system, characterData: data, activeCharacterSaveName: "打印测试", cardTableCardWidths: {}, tidyCardTable: tidy,
      runValidationChecks: async () => {}, runPreOutputValidation: async () => [] });
    return <main className="sheet-tool" />;
  }
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const print = vi.fn(() => {
    expect(useRuntimeStore.getState().characterData!.cards.instances.filter((item) => item.tableModuleId === "supply-inventory")).toEqual(before);
  });
  vi.stubGlobal("print", print);
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  try {
    await act(async () => root.render(<Harness />));
    await act(async () => output!.beginOutput("print"));
    expect(print).toHaveBeenCalledOnce();
    expect(tidy.mock.calls.map(([id]) => id)).toEqual(["ordinary"]);
    await act(async () => window.dispatchEvent(new Event("afterprint")));
    expect(restore.mock.calls.map(([id]) => id)).toEqual(["ordinary"]);
    expect(useRuntimeStore.getState().characterData!.cards.instances.filter((item) => item.tableModuleId === "supply-inventory")).toEqual(before);
  } finally {
    await act(async () => root.unmount()); host.remove();
    useRuntimeStore.setState(initial, true); vi.restoreAllMocks(); vi.unstubAllGlobals();
  }
});
