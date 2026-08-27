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

  test("keeps current app actions reachable from the mobile menu", () => {
    const source = readFileSync(fileURLToPath(new URL("../../packages/platform-ui/src/index.tsx", import.meta.url)), "utf8");
    const stylesheet = readFileSync(fileURLToPath(new URL("../../packages/platform-ui/src/styles.css", import.meta.url)), "utf8");

    expect(source).toContain('className="pbdh-platform-mobile-extra"');
    expect(source).toContain("{extraActions}");
    expect(stylesheet).toContain(".pbdh-platform-mobile-extra");
  });

  test("owns the shared PbDH notification surface", () => {
    const source = readFileSync(fileURLToPath(new URL("../../packages/platform-ui/src/index.tsx", import.meta.url)), "utf8");
    const stylesheet = readFileSync(fileURLToPath(new URL("../../packages/platform-ui/src/styles.css", import.meta.url)), "utf8");

    expect(source).toContain("export function usePlatformNotifications");
    expect(source).toContain('aria-label="PbDH 通知"');
    expect(stylesheet).toContain(".pbdh-platform-notification-panel");
  });
});
