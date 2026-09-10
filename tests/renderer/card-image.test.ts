// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { renderCanonicalCardToPng } from "../../packages/resource-renderer/src/card-image.ts";

beforeEach(() => { Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

test("加载失败的卡面不能导出错误占位图", async () => {
  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = '<div class="pbdh-surface-root"><div class="pbdh-surface-status">媒体加载中</div></div>';
  await expect(renderCanonicalCardToPng(host)).rejects.toThrow("卡面尚未加载完成");
});

test("导出当前卡面状态、内嵌媒体并保留自适应高度", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = '<div class="pbdh-surface-root is-fluid" style="width:63px;height:148px"><img src="blob:portrait"/><button aria-pressed="true">当前生命 3</button></div>';
  vi.spyOn(HTMLImageElement.prototype, "decode").mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Blob(["portrait"], { type: "image/webp" }))));
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  let dimensions: number[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, callback, type) {
    dimensions = [this.width, this.height];
    callback(new Blob(["png"], { type }));
  });
  const blob = await renderCanonicalCardToPng(host);
  expect(blob.type).toBe("image/png");
  expect(dimensions).toEqual([1080, 2538]);
  const exported = decodeURIComponent((drawImage.mock.calls[0]![0] as HTMLImageElement).src);
  expect(exported).toContain("当前生命 3");
  expect(exported).toContain('aria-pressed="true"');
  expect(exported).toContain("data:image/webp;base64,");
  expect(exported).not.toContain("blob:portrait");
  expect(shadow.querySelector("img")?.getAttribute("src")).toBe("blob:portrait");
});
