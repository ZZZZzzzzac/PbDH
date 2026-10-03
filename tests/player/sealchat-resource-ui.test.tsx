// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SealChatResourceContext } from "../../apps/player/src/sealchat/SealChatResources.tsx";
import { emptyResources } from "../../apps/player/src/sealchat/adapter.ts";
import { readDiceData } from "../../apps/player/src/sealchat/roll.ts";
import { CountableResourceModule } from "../../apps/player/src/sheet-runtime/rendering/CountableResourceModule.tsx";
import { useRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";

test("现有资源控件读取会话覆盖，发送 ±1；不修改本地角色存档", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const original = useRuntimeStore.getState();
  const write = vi.fn(); const change = vi.fn();
  useRuntimeStore.setState({ updateModuleValue: write });
  const element = document.createElement("div"); document.body.append(element);
  const root = createRoot(element);
  const module = { ID: "hope", 类型: "countableResource" as const, 标签: "希望", 最大值: 6, 默认值: 2, 显示方式: "标记" as const, 当前值标记: { 类型: "文字" as const, 内容: "●" }, 剩余值标记: { 类型: "文字" as const, 内容: "○" } };
  try {
    await act(async () => root.render(<SealChatResourceContext.Provider value={{ state: { phase: "bound", cardName: "人物", canBind: true, busy: false, message: "", dice: readDiceData({}), resources: { ...emptyResources(), hope: { current: 4, max: 6 } } }, change }}><CountableResourceModule module={module} /></SealChatResourceContext.Provider>));
    expect(element.querySelector('[role="img"]')?.getAttribute("aria-label")).toContain("当前值 4");
    await act(async () => element.querySelector<HTMLButtonElement>('[aria-label="希望减少"]')!.click());
    expect(change).toHaveBeenCalledWith("hope", -1);
    expect(write).not.toHaveBeenCalled();
    await act(async () => root.render(<SealChatResourceContext.Provider value={{ state: { phase: "ready", cardName: "人物", canBind: true, busy: false, message: "", dice: readDiceData({}), resources: emptyResources() }, change }}><CountableResourceModule module={module} /></SealChatResourceContext.Provider>));
    expect(element.textContent).toContain("未录入");
    expect(element.querySelector<HTMLButtonElement>('[aria-label="希望增加"]')?.disabled).toBe(true);
    await act(async () => root.render(<CountableResourceModule module={module} />));
    await act(async () => element.querySelector<HTMLButtonElement>('[aria-label="希望增加"]')!.click());
    expect(write).toHaveBeenCalledWith("hope", { current: 3, max: 6 });
  } finally {
    await act(async () => root.unmount()); element.remove(); useRuntimeStore.setState(original, true); vi.unstubAllGlobals();
  }
});
