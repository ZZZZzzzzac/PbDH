// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from "vitest";
import { renderCanonicalCardToPng } from "@pbdh/resource-renderer/react";
import { exportCreatorPackagePdf } from "../../apps/creator/src/workspace-prototype/creator-package-pdf.tsx";
import { createBlankWorkspace } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";
import { freeTemplate } from "@pbdh/templates/core";

vi.mock("@pbdh/resource-renderer/react", async (original) => ({
  ...await original<typeof import("@pbdh/resource-renderer/react")>(),
  renderCanonicalCardToPng: vi.fn(),
}));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test("在规范设计宽度捕获卡牌，不把宽容器的空白写入 PDF；失败也释放临时 DOM", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  const source = await createBlankWorkspace("卡面捕获验收");
  source.document.resources = [{
    id: "card", path: "card.json", template: { id: freeTemplate.id, version: freeTemplate.version },
    data: structuredClone(freeTemplate.defaultData), presentation: freeTemplate.defaultPresentation, media: {},
  }];
  vi.mocked(renderCanonicalCardToPng).mockImplementation(async (host) => {
    expect(host.parentElement!.style.width).toBe("63px");
    expect(host.shadowRoot!.querySelector(".pbdh-surface-status")).toBeNull();
    expect(host.shadowRoot!.querySelector(".free-card")).not.toBeNull();
    throw new Error("模拟图片编码失败");
  });
  await expect(exportCreatorPackagePdf(source)).rejects.toThrow("模拟图片编码失败");
  expect(renderCanonicalCardToPng).toHaveBeenCalledOnce();
  expect(document.querySelector("[data-pbdh-canonical-surface]")).toBeNull();
});
