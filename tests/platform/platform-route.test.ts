import { describe, expect, it } from "vitest";

import {
  normalizeBasePath,
  platformPageUrl,
  playerSystemPackageUrl,
  readPlatformLocation,
} from "../../apps/platform/src/platform-route.ts";
import { playerSystemPackageCatalog } from "../../apps/player/src/playerSystemPackageCatalog.ts";

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

  it("部署根路径进入 Player 页，但不指定系统包", () => {
    // 根路径不再硬编码匕首之心：由 Player 的「直达链接 → 上次使用的系统包 → 默认包」链决定，
    // 否则每次从根路径进入都会先加载一遍匕首之心。
    expect(readPlatformLocation(
      "https://daggerheart.cn/pbdh_tools/",
      "/pbdh_tools/",
    )).toEqual({
      page: "player",
      href: "https://daggerheart.cn/pbdh_tools/",
    });
  });

  it("写回的系统包地址能被同一个解析链重新读到", () => {
    for (const base of ["/", "/pbdh_tools/"]) {
      const url = playerSystemPackageUrl("daggerheart-core", "https://daggerheart.cn", base);

      expect(url.pathname).toBe(`${base === "/" ? "" : "/pbdh_tools"}/player/daggerheart-core`);
      expect(readPlatformLocation(url, base)).toEqual({
        page: "player",
        href: `https://daggerheart.cn${url.pathname}`,
        playerSystemPackage: "daggerheart-core",
      });
    }
  });

  it("每个预置系统包的地址段都能解析回同一个包", () => {
    // Player 按 preset.directory 匹配直达段：写进地址栏的段必须与它一致，
    // 否则「/player 重定向到 /player/<系统包>」会把刷新后的页面换到别的包。
    for (const entry of playerSystemPackageCatalog) {
      for (const base of ["/", "/pbdh_tools/"]) {
        const segment = readPlatformLocation(
          playerSystemPackageUrl(entry.preset.directory, "https://daggerheart.cn", base),
          base,
        ).playerSystemPackage;

        expect(segment).toBe(entry.preset.directory);
        expect(playerSystemPackageCatalog.find((candidate) => candidate.preset.directory === segment)?.system.package.id)
          .toBe(entry.system.package.id);
      }
    }
  });
});
