// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import type { CharacterData } from "../../apps/player/src/sheet-runtime/domain/characterData.ts";
import { buildReadonlyHtmlSnapshot } from "../../apps/player/src/sheet-runtime/export/output.ts";
import { ImageFieldModule } from "../../apps/player/src/sheet-runtime/rendering/ImageFieldModule.tsx";
import { useRuntimeStore } from "../../apps/player/src/sheet-runtime/store/runtimeStore.ts";

const characterData: CharacterData = {
  kind: "pbdh-character-data", schemaVersion: "0.1.0",
  systemPackage: { id: "test", version: "1.0.0" },
  character: { id: "avatar-character", values: { portrait: { kind: "player-image", imageId: "avatar" } } },
  cards: { instances: [] }, compositeResources: {}, embeddedResourceEntries: {},
  playerImages: { avatar: { id: "avatar", mimeType: "image/png", dataUrl: "data:image/png;base64,AQID" } },
  updatedAt: "2026-09-08T00:00:00Z",
};

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

test("导出 HTML 保留真实头像组件的图片，去掉上传与移除按钮", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const initialState = useRuntimeStore.getState();
  useRuntimeStore.setState({ characterData });
  const container = document.createElement("div");
  container.className = "sheet-tool";
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<ImageFieldModule module={{ ID: "portrait", 类型: "imageField", 标签: "头像" }} />));
    expect(container.querySelector('button[aria-label="更换头像"] img')).not.toBeNull();

    const html = await buildReadonlyHtmlSnapshot(characterData, container);

    expect(html).toContain('src="data:image/png;base64,AQID"');
    expect(html).not.toContain("<button");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    useRuntimeStore.setState(initialState, true);
  }
});
