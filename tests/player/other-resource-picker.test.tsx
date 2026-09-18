// @vitest-environment happy-dom
import { readFile } from "node:fs/promises";
import path from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { loadPbres } from "@pbdh/contract-runtime";
import { playerSystemPackageCatalog } from "../../apps/player/src/playerSystemPackageCatalog.ts";
import { validateResourcePackageCandidate } from "../../apps/player/src/resources/resource-package-validator.ts";
import { routeResourcePackage } from "../../apps/player/src/resources/route-resource-package.ts";
import { createEmptyCharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import { resolveResourceDefinition } from "../../apps/player/src/sheet-runtime/domain/resourceDefinition.ts";
import type { SystemPackage } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import { ResourcePickerModule } from "../../apps/player/src/sheet-runtime/rendering/ResourcePickerModule.tsx";
import { useRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";

let system: SystemPackage;
const cleanups: Array<() => Promise<void>> = [];

beforeAll(async () => {
  const catalog = playerSystemPackageCatalog.find((entry) => entry.preset.directory === "daggerheart-core")!;
  const root = path.resolve("apps/player/public/system-packages/daggerheart-core");
  const installedPackages = new Map();
  for (const file of [path.join(root, "resources/daggerheart-core.pbres")]) {
    const loaded = await loadPbres(new Uint8Array(await readFile(file)), validateResourcePackageCandidate);
    if (!loaded.candidate) throw new Error(JSON.stringify(loaded.diagnostics));
    loaded.candidate.document.resources.push({
      id: "e5f2fb72-6018-5eaf-82a3-e8ba16af4141", path: "转变/半神.json",
      template: { id: "自由", version: "1.1.0" },
      presentation: { mode: "text", fixedRatio: true }, media: {},
      attribution: { artworkCredit: "", sourceLabel: "匕首之心玩家资源" },
      data: { 名称: "半神", 原文: "DEMIGOD", 类型: "转变卡", 简介: "体内流淌着神祇之血的生物。",
        内容: [{ 名称: "神之所赐", 描述: "动作掷骰、反应掷骰和伤害掷骰获得+1加值。" }] },
    });
    installedPackages.set(loaded.candidate.document.package.id, {
      ...loaded.candidate,
      routes: routeResourcePackage({ currentSystem: catalog.system, resourcePackage: loaded.candidate.document }),
    });
  }
  const loaded = await catalog.load({
    currentSystem: catalog.system, installedPackages, baseUrl: "/",
    fetchFile: async (url) => {
      const pathname = new URL(String(url), "https://preset.invalid").pathname;
      const relative = decodeURIComponent(pathname.split("/system-packages/daggerheart-core/")[1]!);
      return new Response(await readFile(path.join(root, relative)));
    },
  });
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
  system = loaded.package;
}, 60000);

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.unstubAllGlobals();
});

test("其他资源按类型切换独立表头，筛选不串表，选中两类资源都能在桌面建卡", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const initialState = useRuntimeStore.getState();
  useRuntimeStore.setState({ currentPackage: system, characterData: createEmptyCharacterData(system) });
  const module = system.modules.find((item) => item.ID === "pick-other-resources");
  if (module?.类型 !== "resourcePicker") throw new Error("Missing other resource picker");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => {
    await act(async () => root.unmount());
    container.remove();
    useRuntimeStore.setState(initialState, true);
  });
  await act(async () => root.render(<ResourcePickerModule module={module} systemPackage={system} />));
  const open = async () => { await act(async () => container.querySelector<HTMLButtonElement>(".resource-picker-button")!.click()); };
  const chooseType = async (name: string) => {
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="选择资源库"]');
    expect(select).not.toBeNull();
    const option = [...select!.options].find((item) => item.textContent === name);
    expect(option).toBeDefined();
    await act(async () => { select!.value = option!.value; select!.dispatchEvent(new Event("change", { bubbles: true })); });
  };
  const headers = () => [...container.querySelectorAll("th .resource-column-header > span")].map((item) => item.textContent);
  await open();
  await chooseType("野兽形态");
  expect(headers()).toEqual(["名称", "原文", "类型", "简介", "位阶", "属性", "闪避", "武器", "优势", "特性"]);
  const search = container.querySelector<HTMLInputElement>('input[type="search"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, "不存在的野兽");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.querySelector('[role="status"]')?.textContent).toBe("0 条结果");
  await chooseType("转变卡");
  expect(headers()).toEqual(["名称", "原文", "类型", "简介", "特性"]);
  expect(container.querySelector('input[type="search"]')).toHaveProperty("value", "");
  const transformation = container.querySelector<HTMLTableRowElement>('tr[aria-label="选择 半神"]');
  expect(transformation).not.toBeNull();
  await act(async () => transformation!.click());
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(useRuntimeStore.getState().characterData?.cards.instances).toHaveLength(1);
  await open();
  await chooseType("野兽形态");
  const beast = container.querySelector<HTMLTableRowElement>("tbody tr[aria-label]");
  expect(beast).not.toBeNull();
  await act(async () => beast!.click());
  const data = useRuntimeStore.getState().characterData!;
  const cards = data.cards.instances;
  expect(cards).toHaveLength(2);
  expect(cards.map((card) => resolveResourceDefinition(system, data, card.definitionRef)?.resourceCopy?.data.类型))
    .toEqual(["转变卡", "野兽形态"]);
  expect(cards.every((card) => card.definitionRef.type === "resourceLibrary" && card.definitionRef.libraryId === "其他"))
    .toBe(true);
});
