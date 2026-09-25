// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { templateRegistry } from "@pbdh/templates/core";
import { supportedTemplateFrontends } from "@pbdh/templates/frontend";
import { prepareCanonicalSurface } from "@pbdh/resource-renderer/core";

const kinds = new Set(["敌人", "环境", "职业", "子职业", "罗德岛子职", "自由"]);
const bindings = supportedTemplateFrontends.filter((binding) => kinds.has(binding.templateId));

test.each(bindings.map((binding) => [`${binding.templateId}@${binding.templateVersion}`, binding] as const))(
  "%s 的自由特性可排序，边界不越界，后续编辑和删除仍指向正确条目",
  async (_name, binding) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const field = binding.templateId === "自由" ? "内容" : "特性";
    const nameField = field === "内容" ? "名称" : "特性名称";
    const core = templateRegistry.resolve(binding.templateId, binding.templateVersion)!;
    const entries = ["甲", "乙", "丙"].map((name) => field === "内容"
      ? { 名称: `特性${name}`, 原文: `Name${name}`, 描述: `完整描述${name}` }
      : { 特性名称: `特性${name}`, 特性原文: `Name${name}`, 特性描述: `完整描述${name}`, 特性类型: "动作", 引导问题: `问题${name}` });
    const before = structuredClone(entries);
    let latest: Record<string, unknown> = { ...structuredClone(core.defaultData), [field]: entries };
    const onValue = vi.fn();
    function Harness() {
      const [data, setData] = useState(latest);
      return createElement(binding.authoring.Editor, {
        data,
        onValue(path, value) { onValue(path, value); latest = { ...data, [path]: value }; setData(latest); },
        onData(next) { latest = next; setData(next); },
      });
    }
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const rows = () => [...container.querySelectorAll('[aria-label$="项特性操作"]')].map((control) => control.parentElement!);
    const control = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    const itemButton = (index: number, text: string) => [...rows()[index]!.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === text)!;
    try {
      await act(async () => root.render(<Harness />));
      expect(rows()).toHaveLength(3);
      expect([...rows()[0]!.querySelectorAll('.template-editor-array-actions button')].map((button) => button.textContent))
        .toEqual(["清空", "删除", "↑", "↓"]);
      expect(control("上移第 1 项特性").disabled).toBe(true);
      expect(control("下移第 3 项特性").disabled).toBe(true);
      await act(async () => { control("上移第 1 项特性").click(); control("下移第 3 项特性").click(); });
      expect(onValue).not.toHaveBeenCalled();

      await act(async () => control("下移第 1 项特性").click());
      expect(latest[field]).toEqual([before[1], before[0], before[2]]);
      expect(rows()[0]!.querySelector<HTMLInputElement>("input")!.value).toBe("特性乙");
      const surface = prepareCanonicalSurface({
        resource: { template: { id: binding.templateId, version: binding.templateVersion }, data: latest, media: {}, presentation: { mode: "text", fixedRatio: false } },
        renderer: binding.rendererRevision, expectedRendererRevision: core.rendererRevision, assets: new Map(),
      });
      if (surface.status !== "ready") throw new Error("Renderer not ready");
      const markup = renderToStaticMarkup(surface.renderer.render(surface.renderInput));
      expect(markup.indexOf("完整描述乙")).toBeGreaterThan(-1);
      expect(markup.indexOf("完整描述乙")).toBeLessThan(markup.indexOf("完整描述甲"));
      expect(markup.indexOf("完整描述甲")).toBeLessThan(markup.indexOf("完整描述丙"));

      await act(async () => control("上移第 2 项特性").click());
      expect(latest[field]).toEqual(before);
      const deleteButton = itemButton(0, "删除");
      await act(async () => deleteButton.click());
      expect(itemButton(0, "确认")).toBe(deleteButton);
      expect(itemButton(0, "确认").style.background).not.toBe("");
      expect(container.textContent).not.toContain("确认删除");
      expect(latest[field]).toEqual(before);
      await act(async () => container.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      expect(itemButton(0, "删除")).toBeDefined();
      expect(latest[field]).toEqual(before);
      await act(async () => itemButton(0, "删除").click());
      await act(async () => rows()[0]!.querySelector<HTMLInputElement>("input")!.focus());
      expect(itemButton(0, "删除")).toBeDefined();
      await act(async () => itemButton(0, "删除").click());
      await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
      expect(itemButton(0, "删除")).toBeDefined();
      await act(async () => itemButton(0, "删除").click());
      await act(async () => container.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })));
      expect(itemButton(0, "删除")).toBeDefined();
      await act(async () => itemButton(0, "删除").click());
      await act(async () => control("下移第 2 项特性").click());
      expect(itemButton(0, "删除")).toBeDefined();
      expect(latest[field]).toEqual([before[0], before[2], before[1]]);

      const nameInput = rows()[1]!.querySelector<HTMLInputElement>("input")!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(nameInput, "改名丙");
      await act(async () => nameInput.dispatchEvent(new Event("input", { bubbles: true })));
      expect(latest[field]).toEqual([before[0], { ...before[2], [nameField]: "改名丙" }, before[1]]);
      await act(async () => itemButton(1, "删除").click());
      expect(rows()[1]!.querySelector<HTMLInputElement>("input")!.value).toBe("改名丙");
      expect(latest[field]).toHaveLength(3);
      await act(async () => itemButton(1, "确认").click());
      expect(latest[field]).toEqual([before[0], before[1]]);
      expect(entries).toEqual(before);

      await act(async () => itemButton(1, "删除").click());
      await act(async () => itemButton(1, "确认").click());
      expect(control("上移第 1 项特性").disabled).toBe(true);
      expect(control("下移第 1 项特性").disabled).toBe(true);
    } finally {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    }
  },
);
