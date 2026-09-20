// @vitest-environment happy-dom
import { readFile } from "node:fs/promises";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import type { CountableResourceModule as CountableResourceModuleConfig } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import { sheetModuleSchema } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import { CountableResourceModule } from "../../apps/player/src/sheet-runtime/rendering/CountableResourceModule.tsx";
import { useRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";

const printClearStrategySelector = '[data-countable-print-strategy="clear-uniform-squares"]';
const printKeepSelector = ':not([data-countable-print-keep="true"])';
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.unstubAllGlobals();
});

async function builtInCountableModule(directory: string, moduleId: string): Promise<CountableResourceModuleConfig> {
  const modules = JSON.parse(
    await readFile(`apps/player/public/system-packages/${directory}/modules.json`, "utf8"),
  ) as unknown[];
  const source = modules.find((module) => (module as { ID?: string }).ID === moduleId);
  const parsed = sheetModuleSchema.safeParse(source);
  if (!parsed.success || parsed.data.类型 !== "countableResource") {
    throw new Error(`${directory} 的 ${moduleId} 不是合法的计数资源模块`);
  }
  return parsed.data;
}

async function renderMarkerGroup(module: CountableResourceModuleConfig): Promise<HTMLElement> {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const initialState = useRuntimeStore.getState();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => {
    await act(async () => root.unmount());
    container.remove();
    useRuntimeStore.setState(initialState, true);
  });
  await act(async () => root.render(<CountableResourceModule module={module} />));
  const markerGroup = container.querySelector<HTMLElement>(".marker-group");
  if (!markerGroup) throw new Error("标记组未渲染");
  return markerGroup;
}

test("内置熟练度在标记组上带打印豁免，打印与 PDF 保留当前值", async () => {
  const markerGroup = await renderMarkerGroup(await builtInCountableModule("daggerheart-core", "proficiency"));

  expect(markerGroup.dataset.countablePrintKeep).toBe("true");
  expect(markerGroup.querySelectorAll('[data-marker-kind="current"]')).toHaveLength(1);
  expect(markerGroup.querySelectorAll('[data-marker-kind="remaining"]')).toHaveLength(5);
});

test("其余标记模块不带豁免，打印时仍清成统一方格", async () => {
  const markerGroup = await renderMarkerGroup(await builtInCountableModule("daggerheart-core", "hope"));

  expect(markerGroup.hasAttribute("data-countable-print-keep")).toBe(false);
  expect(markerGroup.querySelectorAll('[data-marker-kind="current"]')).toHaveLength(2);
});

test("打印清空标记的样式规则全部带豁免，新增规则漏写豁免会失败", async () => {
  const styles = (await readFile("apps/player/src/sheet-runtime/styles/countable-resource.css", "utf8"))
    .replace(/\/\*[\s\S]*?\*\//gu, "");
  const strategySelectors = [...styles.matchAll(/([^{}]+)\{[^{}]*\}/gu)]
    .map((match) => match[1]!.trim())
    .filter((selector) => selector.includes(printClearStrategySelector));

  expect(strategySelectors.length).toBeGreaterThan(0);
  for (const selector of strategySelectors) {
    expect(selector).toContain(printKeepSelector);
  }
});

test("两个内置系统包的熟练度都通过模块契约声明打印保留当前值", async () => {
  for (const directory of ["daggerheart-core", "tttri"]) {
    const proficiency = await builtInCountableModule(directory, "proficiency");

    expect(proficiency.显示方式).toBe("标记");
    expect(proficiency.打印保留当前值).toBe(true);
  }
});
