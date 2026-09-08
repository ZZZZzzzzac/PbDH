import { describe, expect, it } from "vitest";

import {
  normalizeBasePath,
  platformPageUrl,
  readPlatformLocation,
} from "../../apps/platform/src/platform-route.ts";

describe("Platform deployment routes", () => {
  it("extracts Player system shortcuts under root and nested deployment paths", () => {
    for (const base of ["/", "/pbdh_tools/"]) {
      for (const slug of ["tttri", "daggerheart-core", "heart-of-hopefind", "witchy", "hows-my-driving"]) {
        expect(readPlatformLocation(`https://daggerheart.cn${base}player/${slug}/?x=1#top`, base)).toMatchObject({ page: "player", playerSystemPackage: slug });
      }
      expect(readPlatformLocation(`https://daggerheart.cn${base}player`, base).playerSystemPackage).toBeUndefined();
      expect(readPlatformLocation(`https://daggerheart.cn${base}creator/tttri`, base).playerSystemPackage).toBeUndefined();
      expect(readPlatformLocation(`https://daggerheart.cn${base}player/tttri/extra`, base).playerSystemPackage).toBeUndefined();
    }
  });
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

  it("opens the Daggerheart Player at the deployment root", () => {
    expect(readPlatformLocation(
      "https://daggerheart.cn/pbdh_tools/",
      "/pbdh_tools/",
    )).toMatchObject({ page: "player", playerSystemPackage: "daggerheart-core" });
  });
});
