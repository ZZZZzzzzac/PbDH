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

  it("把存档同步放在玩家存档菜单，而不是玩家功能菜单", async () => {
    const source = await readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8");

    const playerFunctions = source.slice(source.indexOf('<span>玩家功能</span>'), source.indexOf('<span>玩家存档</span>'));
    const characterSaves = source.slice(source.indexOf('<span>玩家存档</span>'), source.indexOf('<span>导入导出</span>'));

    expect(playerFunctions).not.toContain("同步到云");
    expect(characterSaves).toContain("同步到云");
  });

  it("用下拉菜单切换系统包，并把文件夹入口作为 Author Preview", async () => {
    const source = await readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8");

    expect(source).toContain('aria-label="当前系统包"');
    expect(source).not.toContain("切换到{entry.system.package.name}");
    expect(source).toContain("上传系统包(.pbsys)");
    expect(source).toContain("上传系统包(文件夹)");
    expect(source).not.toContain(">系统包预览</button>");
    expect(source).not.toContain(">重新选择预览目录</button>");
    expect(source).toContain('onClick={() => void handleEnterAuthorPreview()}>上传系统包(文件夹)</button>');
    expect(source).toContain('accept=".pbsys,application/zip"');
    expect(source).not.toContain('accept=".zip,application/zip,application/x-zip-compressed"');
  });

  it("恢复 Author Preview 后不再用首选预制包覆盖它", async () => {
    const source = await readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8");

    expect(source).toContain("if (!state.authorPreviewActive)");
    expect(source).toContain("loadPreviewDirectoryHandle: () => authorPreviewHandleStore.load()");
    expect(source).toContain("savePreviewDirectoryHandle: (handle) => authorPreviewHandleStore.save(handle)");
  });

  it("在菜单点击的同步调用栈中打开问卷标签页", async () => {
    const source = await readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8");

    expect(source).toContain('import { openQuestionnaireHost, type QuestionnaireHostSession } from "./sheet-runtime/rendering/questionnaireHost.ts";');
    expect(source).not.toContain('await import("./sheet-runtime/rendering/questionnaireHost.ts")');
  });
});
