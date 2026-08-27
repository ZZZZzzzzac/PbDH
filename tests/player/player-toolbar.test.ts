import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Player toolbar", () => {
  it("在 Platform App Bar 中保留旧 Sheet 的四组下拉菜单，不渲染左侧人物存档栏", async () => {
    const source = await readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8");

    expect(source.match(/className="player-menu"/gu)).toHaveLength(4);
    for (const label of ["玩家功能", "玩家存档", "导入导出", "系统包"]) {
      expect(source).toContain(`<span>${label}</span>`);
    }
    expect(source).not.toContain("管理资源包");
    expect(source).not.toContain('<aside className="sheet-index" aria-label="人物存档">');
  });

  it("打印时隐藏全局 Platform App Bar", async () => {
    const styles = await readFile("packages/platform-ui/src/styles.css", "utf8");

    expect(styles).toContain("body:has(.player-sheet-runtime.print-mode) .pbdh-platform-appbar { display: none; }");
    expect(styles).toContain("@media print");
    expect(styles).toContain(".pbdh-platform-appbar { display: none !important; }");
  });

  it("在移动端主菜单中纵向展开四组 Player 操作", async () => {
    const styles = await readFile("apps/player/src/styles.css", "utf8");

    expect(styles).toContain(".pbdh-platform-mobile-extra .player-toolbar");
    expect(styles).toContain(".pbdh-platform-mobile-extra .player-menu-panel");
  });

  it("把 Player 信息提示交给统一 Platform 通知，不再渲染 message-info 横幅", async () => {
    const source = await readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8");

    expect(source).toContain("usePlatformNotifications");
    expect(source).not.toContain('className="message message-info"');
  });

  it("在系统包菜单提供上传和 Author Preview 入口", async () => {
    const source = await readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8");

    expect(source).toContain("上传系统包(zip)");
    expect(source).toContain("上传系统包(文件夹)");
    expect(source).toContain("系统包预览");
    expect(source).toContain("enterAuthorPreview");
  });

  it("在菜单点击的同步调用栈中打开问卷标签页", async () => {
    const source = await readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8");

    expect(source).toContain('import { openQuestionnaireHost, type QuestionnaireHostSession } from "./sheet-runtime/rendering/questionnaireHost.ts";');
    expect(source).not.toContain('await import("./sheet-runtime/rendering/questionnaireHost.ts")');
  });
});
