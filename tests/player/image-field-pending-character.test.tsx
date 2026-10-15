// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { ImageFieldModule } from "../../apps/player/src/sheet-runtime/rendering/ImageFieldModule.tsx";
import { useRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";

test("等待人物数据升级确认时，空人物的立绘组件可稳定渲染", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const initialState = useRuntimeStore.getState();
  useRuntimeStore.setState({ characterData: null });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<ImageFieldModule module={{ ID: "portrait", 类型: "imageField", 标签: "立绘" }} />));
    expect(container.querySelector('button[aria-label="上传立绘"]')).not.toBeNull();
    await act(async () => useRuntimeStore.setState({ importNotice: "等待确认" }));
    expect(container.textContent).toContain("点击上传图片");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    useRuntimeStore.setState(initialState, true);
    vi.unstubAllGlobals();
  }
});
