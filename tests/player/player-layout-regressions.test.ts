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

  it("图片型计数标志保持系统包声明尺寸而不走文字缩放", async () => {
    const [source, styles] = await Promise.all([
      readFile("apps/player/src/sheet-runtime/rendering/CountableResourceModule.tsx", "utf8"),
      readFile("apps/player/src/sheet-runtime/styles/countable-resource.css", "utf8"),
    ]);

    expect(source).toContain("markerPresentation && !imageMarkerPresentation");
    expect(source).toContain('data-marker-layout={imageMarkerPresentation ? "image" : "text"}');
    expect(styles).toContain('.marker-group[data-marker-layout="image"]');
    expect(styles).toContain('.marker-group[data-marker-layout="image"] .marker-cell');
    expect(styles).toContain("font-size: var(--countable-marker-size, inherit);");
  });
});
