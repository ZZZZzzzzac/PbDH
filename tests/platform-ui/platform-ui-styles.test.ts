import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

describe("Platform App Bar style isolation", () => {
  test("owns button typography instead of inheriting an App global button rule", () => {
    const stylesheet = readFileSync(fileURLToPath(new URL("../../packages/platform-ui/src/styles.css", import.meta.url)), "utf8");
    expect(stylesheet).toContain(".pbdh-platform-appbar button { font: inherit; }");
    expect(stylesheet).toContain("font-family: \"Noto Sans SC\", \"Microsoft YaHei\", sans-serif;");
    expect(stylesheet).toContain(".pbdh-platform-nav button.is-current { font-weight: 750; }");
  });
});
