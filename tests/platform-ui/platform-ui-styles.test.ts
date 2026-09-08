import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, test } from "vitest";
import { OperationStatus } from "@pbdh/platform-ui";

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

  test("keeps app-level notices in the shared notification queue", () => {
    const creator = readFileSync(fileURLToPath(new URL("../../apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx", import.meta.url)), "utf8");
    const creatorStyles = readFileSync(fileURLToPath(new URL("../../apps/creator/src/workspace-prototype/workspace.css", import.meta.url)), "utf8");
    const market = readFileSync(fileURLToPath(new URL("../../apps/market/src/MarketApp.tsx", import.meta.url)), "utf8");
    const marketStyles = readFileSync(fileURLToPath(new URL("../../apps/market/src/styles.css", import.meta.url)), "utf8");
    const playerStyles = readFileSync(fileURLToPath(new URL("../../apps/player/src/styles.css", import.meta.url)), "utf8");

    expect(creator).toContain("usePlatformNotifications");
    expect(market).toContain("usePlatformNotifications");
    expect(creator).not.toContain('className="creator-toast"');
    expect(market).not.toContain('className="market-toast"');
    expect(creatorStyles).not.toContain(".creator-toast");
    expect(marketStyles).not.toContain(".market-toast");
    expect(playerStyles).not.toContain(".character-save-toast");
  });

  test("closes the notification menu when the pointer leaves its whole menu", () => {
    const source = readFileSync(fileURLToPath(new URL("../../packages/platform-ui/src/index.tsx", import.meta.url)), "utf8");

    expect(source).toContain('className="pbdh-platform-notification-menu"');
    expect(source).toContain("onMouseLeave={() => setNotificationsOpen(false)}");
  });

  test("owns one recycle bin that aggregates registered local and cloud sources", () => {
    const source = readFileSync(fileURLToPath(new URL("../../packages/platform-ui/src/index.tsx", import.meta.url)), "utf8");
    const stylesheet = readFileSync(fileURLToPath(new URL("../../packages/platform-ui/src/styles.css", import.meta.url)), "utf8");

    expect(source).toContain("export function usePlatformTrashSource");
    expect(source).toContain('aria-label="回收站"');
    expect(source).toContain("内容保留 30 天");
    expect(source).toContain('item.location === "cloud" ? "云端" : "本机"');
    expect(stylesheet).toContain(".pbdh-platform-trash-dialog");
    expect(source).toContain("永久删除回收站中的全部 ${items.length} 项（包含本机和云端内容）？删除后不能恢复。");
    expect(source).toContain("onClick={() => void deleteAll()}");
    expect(source).toContain('if (operation || status !== "ready" || error || !items.length) return;');
    expect(stylesheet).toContain(".pbdh-platform-trash-footer");
  });

  test("provides one reusable operation status with caller-owned wording", () => {
    const markup = renderToStaticMarkup(createElement(OperationStatus, {
      label: "正在写入大型资源包…",
      size: "regular",
    }));

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("pbdh-operation-status-spinner");
    expect(markup).toContain("正在写入大型资源包…");
  });

  test("uses the shared operation status across app mutations", () => {
    const sources = [
      "../../apps/player/src/PlayerSheetSurface.tsx",
      "../../apps/player/src/resource-manager/ResourceManager.tsx",
      "../../apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx",
      "../../apps/market/src/MarketApp.tsx",
      "../../packages/publication-ui/src/index.tsx",
    ].map((path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8"));

    for (const source of sources) expect(source).toContain("OperationStatus");
  });

  test("opens license options above the field", () => {
    const css = readFileSync(fileURLToPath(new URL("../../packages/publication-ui/src/styles.css", import.meta.url)), "utf8");
    const menu = css.match(/\.pbdh-license-field > div > span \{([^}]+)\}/)?.[1];
    expect(menu).toContain("bottom: calc(100% + 4px)");
    expect(menu).not.toMatch(/(?:^|;)\s*top:/);
  });
});
