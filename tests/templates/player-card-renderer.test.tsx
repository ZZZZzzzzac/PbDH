// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { playerCardTemplate as template, playerCardTracks, type PlayerCardState } from "../../packages/templates/src/core/player-card/1.0.0/capability.ts";
import { playerCardRendererRevision as renderer } from "../../packages/templates/src/frontend/player-card/1.0.0/renderer.tsx";
import { playerCardAuthoring } from "../../packages/templates/src/frontend/player-card/1.0.0/authoring-editor.tsx";
import { loadTrustedRenderer, loadTrustedAuthoring } from "@pbdh/templates/frontend/lazy";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const dispose of cleanup.splice(0)) await dispose(); vi.unstubAllGlobals(); });
async function mount(node: ReactNode) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup.push(async () => { await act(async () => root.unmount()); container.remove(); });
  await act(async () => root.render(node));
  return { container, render: async (next: ReactNode) => { await act(async () => root.render(next)); } };
}
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function commit(input: HTMLInputElement) {
  await act(async () => { input.focus(); input.blur(); });
}

test("精确 lazy 返回玩家卡编辑器与同一卡面，资源预览只读且标注语义", async () => {
  expect(await loadTrustedRenderer("玩家卡", "1.0.0")).toBe(renderer);
  expect(await loadTrustedAuthoring("玩家卡", "1.0.0")).toBe(playerCardAuthoring);
  const data = { ...template.defaultData, 名称: "艾琳", 玩家名: "阿青", 备注: "初始备注" };
  const view = await mount(renderer.render({ data, state: renderer.defaultState(data), assets: {}, presentation: { mode: "text", fixedRatio: true } }));
  expect(view.container.textContent).toContain("艾琳");
  expect(view.container.textContent).toContain("阿青");
  expect(view.container.textContent).toContain("初始备注");
  expect([...view.container.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
  expect(view.container.querySelector('[aria-label="希望当前"]')?.getAttribute("role")).toBe("group");
  expect(view.container.querySelectorAll("input")).toHaveLength(0);
  for (const name of ["生命已标记", "压力已标记", "护甲槽已标记"]) expect(view.container.querySelector(`[aria-label="${name}"]`)).not.toBeNull();
  expect(renderer.validateState({ ...renderer.defaultState(data), currentHp: "-1" })).toBe(false);
});

test.each(playerCardTracks)("$label使用图标设置数量，点击最后已标记图标回退一格", async (track) => {
  const command = vi.fn();
  const data = { ...template.defaultData, [track.maximum]: "6" };
  const draw = (current: string) => renderer.render({ data, state: { ...renderer.defaultState(data), [track.field]: current }, assets: {}, presentation: { mode: "text", fixedRatio: true }, onStateCommand: command });
  const view = await mount(draw("0"));
  const markers = () => [...view.container.querySelectorAll<HTMLButtonElement>(`[aria-label="${track.label}${track.meaning}"] button`)];
  expect(markers()).toHaveLength(6);
  expect(markers().every((button) => button.getAttribute("aria-pressed") === "false")).toBe(true);
  expect(markers().every((button) => button.querySelector("svg"))).toBe(true);
  await act(async () => markers()[2]!.click());
  expect(command).toHaveBeenLastCalledWith(`set-${track.command}`, "3");
  await view.render(draw("3"));
  expect(markers().filter((button) => button.getAttribute("aria-pressed") === "true")).toHaveLength(3);
  await act(async () => markers()[2]!.click());
  expect(command).toHaveBeenLastCalledWith(`set-${track.command}`, "2");
  await view.render(draw("6"));
  await act(async () => markers()[5]!.click());
  expect(command).toHaveBeenLastCalledWith(`set-${track.command}`, "5");
  await view.render(draw("1"));
  await act(async () => markers()[0]!.click());
  expect(command).toHaveBeenLastCalledWith(`set-${track.command}`, "0");
  expect(view.container.querySelectorAll("input")).toHaveLength(0);
});

test("零上限没有可点击槽位，极大上限限制图标数并保留数值入口", async () => {
  const data = { ...template.defaultData, 生命上限: "999999999999999999999999999999" };
  const view = await mount(renderer.render({ data, state: renderer.defaultState(data), assets: {}, presentation: { mode: "text", fixedRatio: true }, onStateCommand: vi.fn() }));
  expect(view.container.querySelectorAll("button")).toHaveLength(72);
  expect(view.container.querySelectorAll(".player-card-track")).toHaveLength(4);
  expect(view.container.querySelectorAll('[aria-label="护甲槽已标记"] button')).toHaveLength(0);
  expect(view.container.querySelector('[aria-label="生命数量"]')).not.toBeNull();
});

test.each(["", "待定", "-1", "1.5"])("导入非计数上限 %s 不生成可点击槽位", async (maximum) => {
  const data = { ...template.defaultData, 生命上限: maximum };
  const view = await mount(renderer.render({ data, state: renderer.defaultState(data), assets: {}, presentation: { mode: "text", fixedRatio: true }, onStateCommand: vi.fn() }));
  expect(view.container.querySelectorAll('[aria-label="生命已标记"] button')).toHaveLength(0);
});

test("备注仅发实例命令，肖像遵循显示模式，非法状态不接受", async () => {
  const data = { ...template.defaultData, 备注: "来源备注" };
  const state: PlayerCardState = renderer.defaultState(data);
  const command = vi.fn();
  const view = await mount(renderer.render({ data, state, assets: { portrait: "blob:portrait" }, presentation: { mode: "split", fixedRatio: false }, onStateCommand: command }));
  expect(view.container.querySelector("img")?.getAttribute("src")).toBe("blob:portrait");
  const notes = view.container.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(notes, "私有备注");
    notes.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(command).toHaveBeenLastCalledWith("set-notes", "私有备注");
  expect(data.备注).toBe("来源备注");
  expect(state.notes).toBe("来源备注");
  expect(renderer.validateState({ ...state, currentHope: "NaN" })).toBe(false);
  await view.render(renderer.render({ data, state, assets: { portrait: "blob:portrait" }, presentation: { mode: "image", fixedRatio: true } }));
  expect(view.container.querySelector("img")).not.toBeNull();
  expect(view.container.querySelector(".player-card-tracks")).toBeNull();
});

test("作者编辑器使用名称作为角色名并能编辑四项上限及备注", async () => {
  const value = vi.fn();
  const Editor = playerCardAuthoring.Editor;
  const view = await mount(<Editor data={template.defaultData} onValue={value} />);
  expect(view.container.textContent).toContain("角色名");
  expect(view.container.textContent).toContain("玩家名");
  for (const track of playerCardTracks) {
    const input = view.container.querySelector<HTMLInputElement>(`[aria-label="${track.maximum}"]`)!;
    await type(input, "");
    await type(input, "0012");
    await commit(input);
    expect(value).toHaveBeenLastCalledWith(track.maximum, "12");
  }
});
