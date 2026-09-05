import { describe, expect, test } from "vitest";

import {
  admitResourceImageBytes,
  centerCrop,
  type ImageAdmissionWorkflow,
  maxAdmittedImageBytes,
  outputDimensions,
  playerAvatarPolicy,
  publicationCoverPolicy,
  resourceImagePolicy,
} from "@pbdh/media-admission";

describe("shared image admission contract", () => {
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
