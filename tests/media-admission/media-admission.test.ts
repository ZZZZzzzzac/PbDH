import { describe, expect, test, vi } from "vitest";

import {
  admitResourceImageBytes,
  centerCrop,
  createBrowserImageAdmission,
  cropSelectionFromLayout,
  initialCropLayout,
  moveCrop,
  resizeFreeCrop,
  resizeFixedCrop,
  zoomCrop,
  type ImageAdmissionWorkflow,
  maxAdmittedImageBytes,
  outputDimensions,
  playerAvatarPolicy,
  publicationCoverPolicy,
  resourceImagePolicy,
} from "@pbdh/media-admission";

describe("shared image admission contract", () => {
  test("allows moving and resizing beyond the source image", () => {
    const layout = initialCropLayout(400, 800);
    expect(cropSelectionFromLayout(moveCrop(layout, 0, 0)).x).toBeLessThan(0);
    const expanded = resizeFreeCrop(layout, "nw", 0, 0);
    expect(cropSelectionFromLayout(expanded).x).toBeLessThan(0);
    const fixed = resizeFixedCrop(initialCropLayout(400, 800, 1), "nw", 0, 0, 1);
    expect(fixed.cropWidth / fixed.cropHeight).toBeCloseTo(1);
    expect(cropSelectionFromLayout(fixed).x).toBeLessThan(0);
  });

  test("zooms the source down without moving the crop frame", () => {
    const layout = initialCropLayout(800, 600);
    const zoomed = zoomCrop(layout, 360, 270, 2000);
    expect(zoomed.cropWidth).toBe(layout.cropWidth);
    expect(zoomed.cropX).toBe(layout.cropX);
    expect(zoomed.imageWidth).toBeLessThan(layout.imageWidth);
    const selection = cropSelectionFromLayout(zoomed);
    expect(selection.x).toBeLessThan(0);
    expect(selection.y).toBeLessThan(0);
    expect(selection.width).toBeGreaterThan(800);
  });

  test("encodes out-of-bounds crops over a black background and rejects nonfinite coordinates", async () => {
    const close = vi.fn();
    const fillRect = vi.fn();
    const drawImage = vi.fn();
    const context = { fillStyle: "", fillRect, drawImage };
    vi.stubGlobal("createImageBitmap", async () => ({ width: 100, height: 100, close }));
    vi.stubGlobal("document", { createElement: () => ({
      getContext: () => context,
      toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["webp"], { type: "image/webp" })),
    }) });
    try {
      const file = new File(["image"], "image.png");
      const workflow = createBrowserImageAdmission();
      const crop = { x: -50, y: -50, width: 200, height: 200 };
      const result = await workflow.admit(file, resourceImagePolicy, { crop });
      expect(result.width).toBe(630);
      expect(context.fillStyle).toBe("#000");
      expect(fillRect).toHaveBeenCalledWith(0, 0, 630, 630);
      expect(fillRect.mock.invocationCallOrder[0]).toBeLessThan(drawImage.mock.invocationCallOrder[0]!);
      expect(drawImage.mock.calls[0]!.slice(1)).toEqual([-50, -50, 200, 200, 0, 0, 630, 630]);
      await expect(workflow.admit(file, resourceImagePolicy, { crop: { ...crop, x: NaN } })).rejects.toThrow("裁剪区域尺寸无效");
      expect(close).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  test("routes imported resource bytes through the same 630px WebP admission policy", async () => {
    const OriginalFile = globalThis.File;
    class TestFile extends Blob {
      readonly name: string;
      readonly lastModified = 0;
      readonly webkitRelativePath = "";

      constructor(parts: BlobPart[], name: string) {
        super(parts);
        this.name = name;
      }
    }
    Object.defineProperty(globalThis, "File", { configurable: true, value: TestFile });
    const calls: Array<{ name: string; width: number }> = [];
    const workflow: ImageAdmissionWorkflow = {
      inspect: async () => ({ width: 1200, height: 800 }),
      admit: async (file, policy) => {
        calls.push({ name: file.name, width: policy.outputWidth });
        return {
          id: `sha256:${"0".repeat(64)}`,
          mediaType: "image/webp",
          byteLength: 3,
          width: 630,
          height: 420,
          bytes: new Uint8Array([1, 2, 3]),
          blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }),
        };
      },
    };
    try {
      const admitted = await admitResourceImageBytes(new Uint8Array([9, 8, 7]), "images/card.png", workflow);
      expect(calls).toEqual([{ name: "images/card.png", width: 630 }]);
      expect(admitted).toMatchObject({ mediaType: "image/webp", width: 630 });
    } finally {
      Object.defineProperty(globalThis, "File", { configurable: true, value: OriginalFile });
    }
  });

  test("declares every product image purpose on one boundary", () => {
    expect([
      playerAvatarPolicy.purpose,
      resourceImagePolicy.purpose,
      publicationCoverPolicy.purpose,
    ]).toEqual(["player-avatar", "resource-image", "publication-cover"]);
  });

  test("centers a fixed 63:88 cover crop", () => {
    expect(publicationCoverPolicy.fixedAspectRatio).toBeCloseTo(63 / 88);
    const crop = centerCrop(1600, 900, 63 / 88);
    expect(crop.width / crop.height).toBeCloseTo(63 / 88);
    expect(crop.x).toBeGreaterThan(0);
    expect(crop.y).toBe(0);
  });

  test("player avatar defaults to free crop instead of forcing a square", () => {
    expect(playerAvatarPolicy.fixedAspectRatio).toBeUndefined();
  });

  test("keeps an adjustable crop ratio when sizing the WebP output", () => {
    expect(resourceImagePolicy.outputWidth).toBe(630);
    expect(maxAdmittedImageBytes).toBe(2 * 1024 * 1024);
    expect(outputDimensions({ width: 1200, height: 600 }, 600)).toEqual({ width: 600, height: 300 });
  });
});
