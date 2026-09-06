import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { formatCharacterSaveOptionLabel } from "../../apps/player/src/PlayerSheetSurface.tsx";

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

  it("玩家存档只保留一个包含全部系统人物的下拉框", async () => {
    const source = await readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8");

    const characterSaves = source.slice(source.indexOf('<span>玩家存档</span>'), source.indexOf('<span>导入导出</span>'));

    expect(characterSaves).not.toContain("当前存档");
    expect(characterSaves).not.toContain("全部人物");
    expect(characterSaves).not.toContain("player-menu-character-group");
    expect(characterSaves).toContain('aria-label="切换人物"');
    expect(characterSaves).toContain("allCharacterSaves.map");
    expect(characterSaves).toContain("openCharacterSave(save)");
    expect(characterSaves).toContain("同步到云");
  });

  it("桌面端四组 Player 菜单在鼠标离开后关闭，不因内部焦点保持展开", async () => {
    const styles = await readFile("apps/player/src/styles.css", "utf8");
    const desktopMenus = styles.slice(styles.indexOf(".player-menu {"), styles.indexOf(".player-runtime-layout"));

    expect(desktopMenus).toContain(".player-menu:hover .player-menu-panel");
    expect(desktopMenus).not.toContain(".player-menu:focus-within .player-menu-panel");
  });

  it("缺少系统包的人物文件可先保存在本机，并可导出或删除", async () => {
    const source = await readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8");

    expect(source).toContain("已保存待匹配人物存档");
    expect(source).toContain("不会运行人物数据或上传云端");
    expect(source).toContain("待匹配");
    expect(source).toContain("exportCharacterSave(selectedCharacterSave.id)");
    expect(source).toContain("deletePendingCharacterSave(selectedCharacterSave.id)");
  });

  it("人物下拉框只组合存档名和规则名", () => {
    expect(formatCharacterSaveOptionLabel("阿岚", "匕首之心")).toBe("阿岚・匕首之心");
    expect(formatCharacterSaveOptionLabel("待匹配人物", "缺少系统包")).toBe("待匹配人物・缺少系统包");
  });

  it("清楚标明本机存档不是云备份，并提供云端永久删除", async () => {
    const source = await readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8");
    expect(source).toContain("cloudDocumentService.deleteFromTrash(remote, credentials)");
    expect(source).toContain("永久删除");
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

  it("把车卡审核放在玩家功能，并使用明确的导出名称", async () => {
    const source = await readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8");
    const playerFunctions = source.slice(source.indexOf('<span>玩家功能</span>'), source.indexOf('<span>玩家存档</span>'));
    const importExport = source.slice(source.indexOf('<span>导入导出</span>'), source.indexOf('<span>系统包</span>'));

    expect(playerFunctions).toContain("车卡审核");
    expect(playerFunctions).toContain("handleValidation()");
    expect(importExport).not.toContain("运行检查");
    expect(importExport).toContain("characterAdapterExportLabel(adapter)");
    expect(importExport).toContain("characterTextExportLabel(definition)");
    for (const label of ["导出PDF", "导出HTML", "导出为ZZZ格式", "导出为dhsheet格式", "导出为海豹骰"]) {
      expect(source).toContain(label);
    }
  });
});
