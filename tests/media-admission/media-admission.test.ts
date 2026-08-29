import { describe, expect, test } from "vitest";

import {
  centerCrop,
  outputDimensions,
  playerAvatarPolicy,
  publicationCoverPolicy,
  resourceImagePolicy,
} from "@pbdh/media-admission";

describe("shared image admission contract", () => {
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
    expect(outputDimensions({ width: 1200, height: 600 }, 600)).toEqual({ width: 600, height: 300 });
  });
});
