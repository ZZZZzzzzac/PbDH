import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Player layout regressions", () => {
  it("让 sheet tool 无外边距填满 Player 运行区", async () => {
    const styles = await readFile("apps/player/src/sheet-runtime/styles/app-shell.css", "utf8");
    expect(styles).toMatch(/\.sheet-tool\s*\{[^}]*padding:\s*0;/u);
  });

  it("把四个主页面 Tab 固定在 PbDH 品牌之后", async () => {
    const styles = await readFile("packages/platform-ui/src/styles.css", "utf8");

    expect(styles).toContain("grid-template-columns: auto auto minmax(0, 1fr) auto;");
    expect(styles).toContain(".pbdh-platform-nav { height: 100%; display: flex; justify-content: flex-start;");
    expect(styles).toContain(".pbdh-platform-extra { display: flex; justify-content: flex-end;");
  });

  it("让资源表在详情栏内部滚动", async () => {
    const styles = await readFile("apps/player/src/styles.css", "utf8");

    expect(styles).toContain(".package-detail { display: flex; min-width: 0; min-height: 0;");
    expect(styles).toContain("overflow: hidden; flex-direction: column;");
  });

  it("把资源包数量放在玩家功能的资源管理器入口", async () => {
    const [source, styles] = await Promise.all([
      readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8"),
      readFile("apps/player/src/styles.css", "utf8"),
    ]);

    expect(source).toContain('className="player-menu-resource-manager"');
    expect(source).toContain("<span>资源管理器</span><strong>{library.size}</strong>");
    expect(source).not.toContain('<div className="player-menu-summary"><span>资源包</span>');
    expect(styles).toContain(".player-menu-resource-manager { display: flex;");
  });

  it("为横向资源分类滚动条保留独立空间", async () => {
    const styles = await readFile("apps/player/src/styles.css", "utf8");

    expect(styles).toContain(".type-filters { display: flex; gap: 7px; height: 38px; padding-bottom: 8px; overflow-x: auto; overflow-y: hidden;");
  });

  it("按 System Package 内嵌关系分组原生与额外资源包", async () => {
    const [source, surface, styles] = await Promise.all([
      readFile("apps/player/src/resource-manager/ResourceManager.tsx", "utf8"),
      readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8"),
      readFile("apps/player/src/styles.css", "utf8"),
    ]);

    expect(source).toContain("embeddedPackageIndex.has(installed.document.package.id)");
    expect(surface).toContain("currentEmbeddedPackageIndex()");
    expect(source).toContain('<h3 className="package-group-title">原生资源包</h3>');
    expect(source).toContain('<h3 className="package-group-title">额外资源包</h3>');
    expect(styles).toContain(".package-group-title {");
  });

  it("为罗德岛暗色资源表头提供可读的背景与文字变量", async () => {
    const source = await readFile("apps/player/public/system-packages/tttri/skins/terra-portal/skin.css", "utf8");
    expect(source).toContain("--framework-disabled-surface: var(--tp-panel-soft)");
    expect(source).toContain("--framework-disabled-text: var(--tp-muted)");
  });

  it("在资源管理器顶栏直接选择第三方格式，之后查看报告并安装或导出标准资源包", async () => {
    const source = await readFile("apps/player/src/resource-manager/ResourceManager.tsx", "utf8");

    expect(source).not.toContain("转换第三方资源");
    expect(source).not.toContain("选择来源格式");
    for (const label of ["导入ZZZ格式", "导入Rink格式", "导入dhcb格式", "导入不咕鸟格式"]) {
      expect(source).toContain(label);
    }
    expect(source).toContain('aria-label="第三方资源转换报告"');
    expect(source).toContain("导出 .pbres 备份");
    expect(source).toContain("确认并安装");
    expect(source).toContain("resourceConversionRegistry.import(formatId");
    expect(source).toContain("materializePlayerResourceConversion(imported.batch, currentSystem)");
  });

  it("单击资源即可预览，移除入口位于左侧资源包卡片", async () => {
    const source = await readFile("apps/player/src/resource-manager/ResourceManager.tsx", "utf8");

    expect(source).toContain('onClick={() => openResource(selected, resource.id)}');
    expect(source).not.toContain("onDoubleClick={() => openResource");
    expect(source).not.toContain('className="detail-actions"');
    expect(source).not.toContain(">浏览资源</button>");
    expect(source).toContain('className="package-row-remove"');
  });

  it("资源预览只保留规范卡面和右上角关闭按钮", async () => {
    const [source, sharedPreview] = await Promise.all([
      readFile("apps/player/src/resource-manager/ResourceManager.tsx", "utf8"),
      readFile("packages/resource-renderer/src/react.tsx", "utf8"),
    ]);
    const preview = source.slice(source.indexOf("function PlayerResourcePreviewContent"), source.indexOf("function DialogSurface"));

    expect(preview).not.toContain('className="player-dialog player-resource-preview"');
    expect(preview).not.toContain("<header>");
    expect(preview).not.toContain("<footer>");
    expect(preview).toContain("<CardPreviewDialog");
    expect(sharedPreview).toContain('data-pbdh-card-preview-close=""');
    expect(sharedPreview).toContain('aria-label="关闭卡牌详情"');
    expect(sharedPreview).toContain("right: -44px;");
  });

  it("把 pbres 入口说清楚，并移除没有区分价值的离线状态", async () => {
    const [source, styles] = await Promise.all([
      readFile("apps/player/src/resource-manager/ResourceManager.tsx", "utf8"),
      readFile("apps/player/src/styles.css", "utf8"),
    ]);

    expect(source).toContain("导入pbres格式");
    expect(source).not.toContain("安装资源包</button>");
    expect(source).not.toContain('className="offline"');
    expect(source).not.toContain("离线状态");
    expect(styles).not.toContain("span.offline");
  });

  it("安装和移除资源包都先展示会发生什么", async () => {
    const source = await readFile("apps/player/src/resource-manager/ResourceManager.tsx", "utf8");

    expect(source).toContain("资源包目标");
    expect(source).toContain("结构与图片完整");
    expect(source).toContain("snapshotDigest");
    expect(source).toContain('aria-label="确认移除资源包"');
    expect(source).toContain("以后不能再从这个包选择新资源");
    expect(source).toContain("卡牌桌面里的独立卡牌不会改变");
  });

  it("Market 整包安装后只选中资源包，不自动打开单卡预览", async () => {
    const source = await readFile("apps/player/src/resource-manager/ResourceManager.tsx", "utf8");
    const commit = source.slice(
      source.indexOf("async function commit(plan"),
      source.indexOf("async function removeSelectedPackage"),
    );

    expect(source).not.toContain("expectedMarketHandoff?.focusResourceId");
    expect(commit).not.toContain("setPreview(");
    expect(source).toContain("查看资源包");
  });

  it("刷新后按实际恢复的预置系统重新装载对应资源库", async () => {
    const source = await readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8");
    const startup = source.slice(
      source.indexOf("const cachedMetadata = await runtimeStorage.loadCurrentSystemPackageCacheMetadata()"),
      source.indexOf("runtimeReadyRef.current = true"),
    );

    expect(startup).toContain("if (!importedWasRestored) {");
    expect(startup).toContain("await switchToPresetSystemPackage(preferred.preset, true)");
    expect(startup).not.toContain("state.currentPackage?.manifest.ID !== preferred.system.package.id");
  });

  it("只在激活预置系统包时安装它自己的内嵌资源", async () => {
    const source = await readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8");
    const presetLoader = source.slice(
      source.indexOf("loadPresetSystemPackage: async"),
      source.indexOf("const cachedMetadata = await runtimeStorage.loadCurrentSystemPackageCacheMetadata()"),
    );

    expect(source).not.toContain("for (const entry of playerSystemPackageCatalog)");
    expect(presetLoader).toContain("await installMissingEmbeddedResourcePackages({");
    expect(presetLoader.indexOf("await installMissingEmbeddedResourcePackages({"))
      .toBeLessThan(presetLoader.indexOf("await restorePlayerResourceLibrary("));
  });

  it("导入其他预置系统的人物存档前先安装目标系统内嵌资源", async () => {
    const source = await readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8");
    const preparation = source.slice(
      source.indexOf("const preparePresetCharacterSave"),
      source.indexOf("const validatePresetCharacterSave"),
    );

    expect(preparation).toContain("await installMissingEmbeddedResourcePackages({");
    expect(preparation.indexOf("await installMissingEmbeddedResourcePackages({"))
      .toBeLessThan(preparation.indexOf("await restorePlayerResourceLibrary("));
    expect(preparation.indexOf("await restorePlayerResourceLibrary("))
      .toBeLessThan(preparation.indexOf("await targetSystem.load({"));
  });

  it("按资源包身份查找共用卡面所需的图片", async () => {
    const source = await readFile("apps/player/src/sheet-runtime/rendering/cardTable/CardFace.tsx", "utf8");

    expect(source).toContain('resourceAssetUrlKey("resourceExtension", resourceCopy.source.packageId, runtimePath)');
    expect(source).toContain("const runtimeKey = resourceCopy.source && runtimePath");
  });

  it("Portal 浮层脱离主题作用域时仍使用不透明背景", async () => {
    const [cardTableStyles, platformStyles, guideStyles] = await Promise.all([
      readFile("apps/player/src/sheet-runtime/styles/card-table.css", "utf8"),
      readFile("packages/platform-ui/src/styles.css", "utf8"),
      readFile("apps/player/src/sheet-runtime/styles/guide.css", "utf8"),
    ]);
    const menu = cardTableStyles.slice(cardTableStyles.indexOf(".card-context-menu {"), cardTableStyles.indexOf(".card-context-menu button"));
    const dialog = platformStyles.slice(platformStyles.indexOf(".player-image-crop-dialog {"), platformStyles.indexOf(".player-image-crop-header {"));
    const select = platformStyles.slice(platformStyles.indexOf(".player-image-crop-actions select {"), platformStyles.indexOf("@media (max-width: 640px)"));

    expect(menu).toMatch(/background:\s*var\([^,]+,\s*#[0-9a-f]{6}\)/iu);
    expect(dialog).toMatch(/background:\s*var\(--framework-surface,\s*#[0-9a-f]{6}\)/iu);
    expect(dialog).toMatch(/color:\s*var\(--framework-text,\s*#[0-9a-f]{6}\)/iu);
    expect(select).toMatch(/background:\s*var\(--framework-surface,\s*#[0-9a-f]{6}\)/iu);
    expect(guideStyles).toContain("background: var(--framework-overlay, rgba(0, 0, 0, 0.72));");
    expect(guideStyles).toContain("background: var(--framework-surface, #fffdf8);");
  });

  it("头像裁剪的确认和取消操作始终位于可见的对话框头部", async () => {
    const source = await readFile("packages/platform-ui/src/ImageCropDialog.tsx", "utf8");
    const header = source.slice(source.indexOf("<header"), source.indexOf("</header>"));

    expect(header).toContain("onCancel");
    expect(header).toContain("onConfirm");
    expect(source).toContain("不限制比例");
  });

  it("图片型计数标志按可用宽度自动缩小", async () => {
    const [source, styles] = await Promise.all([
      readFile("apps/player/src/sheet-runtime/rendering/CountableResourceModule.tsx", "utf8"),
      readFile("apps/player/src/sheet-runtime/styles/countable-resource.css", "utf8"),
    ]);

    expect(source).toContain("useTextFit(");
    expect(source).toContain('data-marker-layout={imageMarkerPresentation ? "image" : "text"}');
    expect(styles).toContain('.marker-group[data-marker-layout="image"]');
    expect(styles).toContain("flex: 0 0 1em;");
    expect(styles).toContain('.marker-group[data-marker-layout="image"] > [data-part="current-markers"]');
    expect(styles).toContain('.marker-group[data-marker-layout="image"] > [data-part="remaining-markers"]');
    expect(styles).toContain('.marker-group[data-marker-layout="image"] .marker-cell');
    expect(styles).toContain("font-size: inherit;");
    expect(styles).not.toContain('.marker-group[data-marker-layout="image"] .marker-cell {\n  font-size: var(--countable-marker-size, inherit);');
  });

  it("图片型计数标志的减号右键减少上限并阻止浏览器菜单", async () => {
    const source = await readFile("apps/player/src/sheet-runtime/rendering/CountableResourceModule.tsx", "utf8");

    expect(source).not.toContain("markerPresentation && !imageMarkerPresentation");
    expect(source).toMatch(/const decrementPointerActions = usePointerActions\([\s\S]*?\n\s*markerPresentation,\s*\n\s*\);/u);
  });
});
