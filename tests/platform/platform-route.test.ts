import { describe, expect, it } from "vitest";

import {
  normalizeBasePath,
  platformPageUrl,
  readPlatformLocation,
} from "../../apps/platform/src/platform-route.ts";

describe("Platform deployment routes", () => {
  it("normalizes root and nested base paths", () => {
    expect(normalizeBasePath("/")).toBe("/");
    expect(normalizeBasePath("pbdh_tools")).toBe("/pbdh_tools/");
  });

  it("reads and creates routes under the configured base path", () => {
    const url = platformPageUrl("gm", "https://daggerheart.cn", "/pbdh_tools/");

    expect(url.pathname).toBe("/pbdh_tools/gm");
    expect(readPlatformLocation(url, "/pbdh_tools/")).toEqual({
      page: "gm",
      href: "https://daggerheart.cn/pbdh_tools/gm",
    });
  });

  it("falls back to Creator at the deployment root", () => {
    expect(readPlatformLocation(
      "https://daggerheart.cn/pbdh_tools/",
      "/pbdh_tools/",
    ).page).toBe("creator");
  });
});
