import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("non-Player application typography", () => {
  it("uses readable interface text without scaling canonical card content", async () => {
    const [creator, market, platform, publication, player] = await Promise.all([
      readFile("apps/creator/src/workspace-prototype/workspace.css", "utf8"),
      readFile("apps/market/src/styles.css", "utf8"),
      readFile("packages/platform-ui/src/styles.css", "utf8"),
      readFile("packages/publication-ui/src/styles.css", "utf8"),
      readFile("apps/player/src/styles.css", "utf8"),
    ]);

    expect(creator).toContain(".creator-menu-trigger");
    expect(creator).toContain("font-size: 14px");
    expect(market).toContain(".market-search input");
    expect(market).toContain("font-size: 14px");
    expect(platform).toContain(".pbdh-platform-appbar");
    expect(platform).toContain("font-size: 14px");
    expect(publication).toContain(".pbdh-publication-copy-fields label > span");
    expect(publication).toContain("font-size: 14px");
    expect(platform).toContain(".player-image-crop-header p { color: var(--framework-text-muted, #806e62); font-size: .75rem");
    expect(player).not.toContain("--non-player-font-scale");
  });
});
