import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Player layout regressions", () => {
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

  it("隔离资源管理器外壳、标题和资源表的全局类名", async () => {
    const [source, styles] = await Promise.all([
      readFile("apps/player/src/resource-manager/ResourceManager.tsx", "utf8"),
      readFile("apps/player/src/styles.css", "utf8"),
    ]);

    expect(source).toContain('className="player-package-manager"');
    expect(source).toContain('className="package-detail-heading"');
    expect(source).toContain('className="manager-resource-table"');
    expect(source).not.toContain('className="resource-manager"');
    expect(source).not.toContain('className="detail-heading"');
    expect(source).not.toContain('className="resource-table"');
    expect(styles).toContain(".player-package-manager { width: min(1160px");
    expect(styles).toContain(".package-detail-heading { height: 48px;");
    expect(styles).toContain(".manager-resource-table { min-height: 0;");
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
    for (const label of ["导入ZZZ格式", "导入Rink格式", "导入dhsheet格式", "导入不咕鸟格式"]) {
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

  it("安装和移除资源包只刷新资源，不重新读取当前系统包", async () => {
    const source = await readFile("apps/player/src/PlayerSheetSurface.tsx", "utf8");
    const resourceChanges = source.slice(
      source.indexOf("async function commitInstall"),
      source.indexOf("async function handleCreateSave"),
    );

    expect(resourceChanges).not.toContain("reloadResourceCatalog");
    expect(resourceChanges.match(/await refreshInstalledResources\(next\)/gu)).toHaveLength(2);
  });

  it("Player 卡牌桌面使用与 Creator、Market、GM 相同的规范卡面渲染器", async () => {
    const source = await Promise.all([
      readFile("apps/player/src/sheet-runtime/rendering/cardTable/CardView.tsx", "utf8"),
      readFile("apps/player/src/sheet-runtime/rendering/cardTable/CardFace.tsx", "utf8"),
    ]).then((files) => files.join("\n"));

    expect(source).toContain("CanonicalCardSurface");
    expect(source).toContain("trustedRendererFor");
    expect(source).toContain("resourceCopy");
    expect(source).toContain("assets");
  });

  it("由整个卡牌桌面持续接管卡牌拖动，卡面只负责开始拖动", async () => {
    const [table, card] = await Promise.all([
      readFile("apps/player/src/sheet-runtime/rendering/CardTableModule.tsx", "utf8"),
      readFile("apps/player/src/sheet-runtime/rendering/cardTable/CardView.tsx", "utf8"),
    ]);
    const surface = table.slice(table.indexOf('className="card-table-surface"'), table.indexOf('className="card-table-actions'));

    expect(surface).toContain("onPointerMove={continueDrag}");
    expect(surface).toContain("onPointerUp={endDrag}");
    expect(surface).toContain("onPointerCancel={endDrag}");
    expect(card).not.toContain("onPointerMove={onPointerMove}");
    expect(card).not.toContain("onPointerUp={onPointerUp}");
  });

  it("按资源包身份查找共用卡面所需的图片", async () => {
    const source = await readFile("apps/player/src/sheet-runtime/rendering/cardTable/CardFace.tsx", "utf8");

    expect(source).toContain('resourceAssetUrlKey("resourceExtension", resourceCopy.source.packageId, runtimePath)');
    expect(source).toContain("const runtimeKey = resourceCopy.source && runtimePath");
  });

  it("右键菜单在页面外层仍有不透明背景", async () => {
    const styles = await readFile("apps/player/src/sheet-runtime/styles/card-table.css", "utf8");
    const menu = styles.slice(styles.indexOf(".card-context-menu {"), styles.indexOf(".card-context-menu button"));

    expect(menu).toMatch(/background:\s*var\([^,]+,\s*#[0-9a-f]{6}\)/iu);
  });

  it("头像裁剪的确认和取消操作始终位于可见的对话框头部", async () => {
    const source = await readFile("apps/player/src/sheet-runtime/rendering/PlayerImageCropDialog.tsx", "utf8");
    const header = source.slice(source.indexOf("<header"), source.indexOf("</header>"));

    expect(header).toContain("onCancel");
    expect(header).toContain("onConfirm");
    expect(source).toContain("不限制比例");
  });

  it("隔离资源管理器表格行与系统包的 resource-row", async () => {
    const [source, styles] = await Promise.all([
      readFile("apps/player/src/resource-manager/ResourceManager.tsx", "utf8"),
      readFile("apps/player/src/styles.css", "utf8"),
    ]);

    expect(source).toContain('className="manager-resource-row"');
    expect(source).not.toContain('className="resource-row"');
    expect(styles).toContain(".resource-table-head, .manager-resource-row {");
    expect(styles).not.toMatch(/^\.resource-row\s*\{/m);
  });

  it("创建向导在 Portal 脱离主题作用域时仍使用实色遮罩和面板", async () => {
    const styles = await readFile("apps/player/src/sheet-runtime/styles/guide.css", "utf8");

    expect(styles).toContain("background: var(--framework-overlay, rgba(0, 0, 0, 0.72));");
    expect(styles).toContain("background: var(--framework-surface, #fffdf8);");
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
