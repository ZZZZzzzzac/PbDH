import { describe, expect, it } from "vitest";

import { marketRouteUrl, readMarketRoute } from "../../apps/market/src/market-route.ts";

describe("Market stable links", () => {
  it("round-trips publication and resource locators without putting titles in identity", () => {
    const route = {
      page: "detail" as const,
      publicationId: "publication/一",
      resourceId: "resource/二",
    };
    const url = marketRouteUrl(route, "https://pbdh.example");

    expect(url.pathname).toBe("/market/publications/publication%2F%E4%B8%80/resources/resource%2F%E4%BA%8C");
    expect(readMarketRoute(url)).toEqual(route);
  });

  it("treats unrelated and incomplete paths as the discovery page", () => {
    expect(readMarketRoute("https://pbdh.example/player")).toEqual({ page: "discovery" });
    expect(readMarketRoute("https://pbdh.example/market/publications")).toEqual({ page: "discovery" });
  });

  it("keeps author identity in a stable account route", () => {
    const url = marketRouteUrl({ page: "author", accountId: "account/作者" }, "https://pbdh.example");
    expect(readMarketRoute(url)).toEqual({ page: "author", accountId: "account/作者" });
  });
});
