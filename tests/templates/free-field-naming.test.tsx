// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { freeAuthoring as freeAuthoring101 } from "../../packages/templates/src/frontend/free/1.0.1/authoring-editor.tsx";
import { freeAuthoring as freeAuthoring102 } from "../../packages/templates/src/frontend/free/1.0.2/authoring-editor.tsx";
import { freeAuthoring as freeAuthoring110 } from "../../packages/templates/src/frontend/free/1.1.0/authoring-editor.tsx";
import type { TemplateAuthoringCapability } from "../../packages/templates/src/frontend/types.ts";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.restoreAllMocks();
});

const startData = () => ({
  名称: "测试资源",
  原文: "",
  类型: "自由",
  简介: "",
  内容: [],
  关键词: "旧值",
  备注: "旧备注",
});

type Editor = TemplateAuthoringCapability["Editor"];
type Data = Record<string, unknown>;

function Host({ editor: Editor, initial, sink }: { editor: Editor; initial: Data; sink: { data: Data } }) {
  const [data, setData] = useState(initial);
  return <Editor data={data} onValue={() => undefined} onData={(next) => { sink.data = next; setData(next); }} />;
}

async function mount(editor: Editor) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  const sink = { data: startData() };
  await act(async () => root.render(<Host editor={editor} initial={startData()} sink={sink} />));
  const rows = () => [...container.querySelectorAll<HTMLElement>(".free-field-row")];
  const nameInput = (row = 0) => rows()[row].querySelector<HTMLInputElement>("input")!;
  const valueInput = (row = 0) => rows()[row].querySelectorAll<HTMLInputElement>("input")[1]!;
  const rowButton = (label: string, row = 0) => [...rows()[row].querySelectorAll("button")].find((item) => item.textContent === label)!;
  const addField = () => [...container.querySelectorAll<HTMLElement>(".free-editor-section-header")]
    .find((header) => header.textContent!.includes("自由字段"))!.querySelector("button")!;
  return { container, sink, rows, nameInput, valueInput, rowButton, addField };
}

const setValue = (input: HTMLInputElement, value: string) =>
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);

const fire = (input: HTMLInputElement, type: string) => input.dispatchEvent(new Event(type, { bubbles: true }));

/** 逐字输入，并在每个字符后确认焦点仍在同一个输入框。 */
async function typeText(input: HTMLInputElement, text: string) {
  await act(async () => { input.focus(); });
  let buffer = "";
  for (const char of text) {
    buffer += char;
    await act(async () => { setValue(input, buffer); fire(input, "input"); });
    expect(document.activeElement, `输入“${char}”后失焦`).toBe(input);
  }
}

const blurInput = (input: HTMLInputElement) => act(async () => { input.blur(); });

const pressKey = (input: HTMLInputElement, key: string) =>
  act(async () => { input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); });

const keys = (data: Data) => Object.keys(data);
const freeKeys = (data: Data) => keys(data).filter((key) => !["名称", "原文", "类型", "简介", "内容"].includes(key));

describe.each([
  ["自由@1.0.1", freeAuthoring101],
  ["自由@1.0.2", freeAuthoring102],
  ["自由@1.1.0", freeAuthoring110],
] as const)("%s 自由字段名编辑", (_label, authoring) => {
  test("逐字输入保持焦点，且失焦前不写入字段名", async () => {
    const view = await mount(authoring.Editor);
    const input = view.nameInput();

    await typeText(input, "关键词改");
    expect(input.value).toBe("关键词改");

    // 输入过程中不重建行，也不把半截字段名写回文档。
    expect(view.nameInput()).toBe(input);
    expect(keys(view.sink.data)).toContain("关键词");
    expect(keys(view.sink.data)).not.toContain("关键词改");

    await blurInput(input);
    expect(view.nameInput()).toBe(input);
    expect(input.value).toBe("关键词改");
    expect(keys(view.sink.data)).toContain("关键词改");
    expect(keys(view.sink.data)).not.toContain("关键词");
  });

  test("失焦提交后可继续编辑同一个字段名", async () => {
    const view = await mount(authoring.Editor);
    const input = view.nameInput();

    await typeText(input, "关键词改");
    await blurInput(input);
    expect(input.value).toBe("关键词改");

    await typeText(input, "关键词改2");
    await blurInput(input);
    expect(keys(view.sink.data)).toContain("关键词改2");
  });

  test("回车提交，回车前不写入字段名", async () => {
    const view = await mount(authoring.Editor);
    const input = view.nameInput();

    await typeText(input, "关键词改");
    expect(keys(view.sink.data)).not.toContain("关键词改");

    await pressKey(input, "Enter");
    expect(input.value).toBe("关键词改");
    expect(keys(view.sink.data)).toContain("关键词改");
  });

  test("非法字段名在失焦时回退到原字段名", async () => {
    const view = await mount(authoring.Editor);
    const input = view.nameInput();

    for (const invalid of ["名称", "备注", "  "]) {
      await typeText(input, invalid);
      await blurInput(input);
      expect(input.value, `“${invalid}”应回退`).toBe("关键词");
      // 固定字段名不能拿来当自由字段名，也不会多出重复键。
      expect(freeKeys(view.sink.data)).toEqual(["关键词", "备注"]);
    }
  });

  test("字段值仍然逐字写入，删除上方行后字段名回显跟随", async () => {
    const view = await mount(authoring.Editor);

    await typeText(view.valueInput(0), "新值");
    expect(view.sink.data.关键词).toBe("新值");

    await act(async () => { view.rowButton("删除", 0).click(); });
    expect(view.rows()).toHaveLength(1);
    expect(view.nameInput().value).toBe("备注");
    expect(view.valueInput().value).toBe("旧备注");
  });

  test("草稿未提交时点“＋ 新增”保留改名并追加新字段", async () => {
    const view = await mount(authoring.Editor);
    const input = view.nameInput();

    await typeText(input, "关键词改");
    await blurInput(input);
    await act(async () => { view.addField().click(); });

    expect(view.rows()).toHaveLength(3);
    expect(keys(view.sink.data)).toContain("关键词改");
    expect(keys(view.sink.data)).toContain("新字段");
    expect(view.nameInput(0).value).toBe("关键词改");
  });

  test("输入法合成中失焦不写半成品拼音，合成结束后按实际值补提交", async () => {
    const view = await mount(authoring.Editor);
    const input = view.nameInput();

    await act(async () => { input.focus(); fire(input, "compositionstart"); });
    await act(async () => { setValue(input, "guan"); fire(input, "input"); });

    await blurInput(input);
    expect(keys(view.sink.data)).not.toContain("guan");
    expect(keys(view.sink.data)).toContain("关键词");

    await act(async () => {
      setValue(input, "关");
      fire(input, "compositionend");
      fire(input, "input");
    });
    expect(keys(view.sink.data)).toContain("关");
    expect(keys(view.sink.data)).not.toContain("guan");
  });

  test("合成被取消（无 compositionend）后重新聚焦仍能提交", async () => {
    const view = await mount(authoring.Editor);
    const input = view.nameInput();

    await act(async () => { input.focus(); fire(input, "compositionstart"); });
    await act(async () => { setValue(input, "guan"); fire(input, "input"); });
    await blurInput(input);
    expect(keys(view.sink.data)).not.toContain("guan");

    await typeText(input, "关");
    await blurInput(input);
    expect(keys(view.sink.data)).toContain("关");
  });

  test("合成中失焦后立刻删除该行，不会把已删行写回", async () => {
    const view = await mount(authoring.Editor);
    const input = view.nameInput();

    await act(async () => { input.focus(); fire(input, "compositionstart"); });
    await act(async () => { setValue(input, "guan"); fire(input, "input"); });
    await blurInput(input);
    await act(async () => { view.rowButton("删除", 0).click(); });

    expect(view.rows()).toHaveLength(1);
    expect(keys(view.sink.data)).not.toContain("guan");
    expect(keys(view.sink.data)).not.toContain("关键词");
  });
});
