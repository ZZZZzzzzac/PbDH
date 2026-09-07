import { readFile } from "node:fs/promises";

import { adversaryTemplate, armorTemplate, environmentTemplate, weaponTemplate } from "@pbdh/templates/core";
import { armorRendererStyles, environmentRendererStyles, freeRendererStyles } from "@pbdh/templates/frontend";
import { describe, expect, it } from "vitest";

describe("共享卡牌详情与 GM 工作区回归", () => {
  it("Player 资源、Player 桌面与 GM 桌面使用同一个详情外壳", async () => {
    const [shared, manager, playerTable, playerFace, creatorRoot, gmWorkbench, market] = await Promise.all([
      readFile("packages/resource-renderer/src/react.tsx", "utf8"),
      readFile("apps/player/src/resource-manager/ResourceManager.tsx", "utf8"),
      readFile("apps/player/src/sheet-runtime/rendering/cardTable/CardActionSurfaces.tsx", "utf8"),
      readFile("apps/player/src/sheet-runtime/rendering/cardTable/CardFace.tsx", "utf8"),
      readFile("apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx", "utf8"),
      readFile("apps/creator/src/workspace-prototype/gm-tabletop-workbench.tsx", "utf8"),
      readFile("apps/market/src/MarketApp.tsx", "utf8"),
    ]);

    expect(shared).toContain("export function CardDisplay");
    expect(shared).toContain("export function CardPreviewDialog");
    expect(manager).toContain("<CardPreviewDialog");
    expect(playerTable).toContain("<CardPreviewDialog");
    expect(playerFace).toContain("<CardDisplay");
    expect(creatorRoot).toContain("<CardPreviewDialog");
    expect(gmWorkbench).toContain("renderInstance={(instance) => <CardDisplay");
    expect(market).toContain("<CardDisplay");
  });

  it("GM 工作区常驻且资源包、文件夹都使用可动画的独立折叠容器", async () => {
    const [creatorRoot, explorer, tree, styles] = await Promise.all([
      readFile("apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx", "utf8"),
      readFile("apps/creator/src/workspace-prototype/creator-resource-explorer.tsx", "utf8"),
      readFile("apps/creator/src/workspace-prototype/WorkspaceTree.tsx", "utf8"),
      readFile("apps/creator/src/workspace-prototype/workspace.css", "utf8"),
    ]);

    expect(creatorRoot).not.toContain("tabletop-tab-resource-toggle");
    expect(creatorRoot).toContain("expandedWorkspaceKeys");
    expect(explorer).toContain("workspace-package-contents");
    expect(tree).toContain("workspace-tree-children");
    expect(styles).toContain("grid-template-rows: 0fr");
    expect(styles).toContain("grid-template-rows: 1fr");
    expect(styles).toContain("transition: grid-template-rows");
    expect(styles).toMatch(/\.workspace-tree-children\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*0fr\)/s);
    expect(styles).toMatch(/\.workspace-tree-children\.is-open\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)/s);
    expect(styles).toMatch(/\.workspace-package-list\s*\{[^}]*flex:\s*1/s);
  });

  it("只有固定卡面使用 63:88，流式敌人卡由内容决定高度", async () => {
    for (const template of [adversaryTemplate, environmentTemplate]) {
      expect(template.defaultPresentation).toMatchObject({ fixedRatio: false });
    }
    for (const template of [weaponTemplate, armorTemplate]) {
      expect(template.defaultPresentation).toMatchObject({ fixedRatio: true });
    }
    for (const template of [adversaryTemplate, weaponTemplate, armorTemplate]) {
      expect(template.defaultPresentation).not.toHaveProperty("width");
      expect(template.defaultPresentation).not.toHaveProperty("height");
    }
    const shared = await readFile("packages/resource-renderer/src/react.tsx", "utf8");
    expect(shared).toContain('width: "100%"');
    expect(shared).toContain('aspectRatio: fixedRatio ? "63 / 88" : undefined');
    expect(shared).toContain("const displayWidth = 480");
    expect(shared).toContain('"--pbdh-preview-width": `${displayWidth}px`');
    expect(shared).toContain("displayAspectRatio={displayAspectRatio}");
    expect(shared).toContain("width: `${safeWidth}px`");
    expect(shared).toContain("height: `${safeHeight}px`");
    expect(shared).not.toContain("96 / 25.4");
    expect(shared).toContain("translate(-50%, -50%) scale(${scale})");
    const gmWorkbench = await readFile("apps/creator/src/workspace-prototype/gm-tabletop-workbench.tsx", "utf8");
    const preview = await readFile("apps/creator/src/workspace-prototype/resource-preview.tsx", "utf8");
    expect(preview).toContain("const referenceHeight = width * (88 / 63)");
    expect(preview).toContain("const widthScale = Math.min(");
    expect(preview).toContain("(stage.clientWidth * 0.7) / width");
    expect(preview).toContain("(stage.clientHeight * 0.7) / referenceHeight");
    expect(preview).not.toContain("heightScale");
    expect(preview).toContain("displayWidth: width * widthScale");
    expect(preview).toContain("displayHeight: height * widthScale");
    expect(gmWorkbench).toContain('displayWidth="250px"');
    expect(gmWorkbench).not.toContain('displayWidth="63mm"');
  });

  it("可变高度图文卡不会被旧的 568px 高优先级规则阻止收缩", async () => {
    const [adversaryRenderer, ancestryRenderer] = await Promise.all([
      readFile("packages/templates/src/frontend/adversary/1.0.1/renderer.tsx", "utf8"),
      readFile("packages/templates/src/frontend/ancestry/1.0.1/renderer.tsx", "utf8"),
    ]);

    for (const renderer of [adversaryRenderer, ancestryRenderer]) {
      expect(renderer).not.toMatch(/\.is-split\.is-fluid\s*\{[^}]*min-height:\s*568px/);
      expect(renderer).toMatch(/\.is-split\s*\{[^}]*min-height:\s*0/);
    }
  });
  it("固定比例图文卡把署名栏固定在 63:88 可视区域底部", async () => {
    const shared = await readFile("packages/resource-renderer/src/react.tsx", "utf8");
    expect(shared).toContain("--pbdh-fixed-native-height: 502.857px");
    expect(shared).toMatch(
      /\.pbdh-surface-root:not\(\.is-fluid\) \.has-fixed-base > \.pbdh-card-footer\s*\{[^}]*position:\s*absolute;[^}]*bottom:\s*calc\(100% - var\(--pbdh-fixed-native-height\)\)/s,
    );
  });

  it("规范卡面只允许宿主等比缩放或裁剪，不允许非等比压扁和固定旧预览框", async () => {
    const [adversaryRenderer, weaponRenderer, creatorStyles] = await Promise.all([
      readFile("packages/templates/src/frontend/adversary/1.0.0/renderer.tsx", "utf8"),
      readFile("packages/templates/src/frontend/weapon/1.0.0/renderer.tsx", "utf8"),
      readFile("apps/creator/src/workspace-prototype/workspace.css", "utf8"),
    ]);

    expect(adversaryRenderer).not.toMatch(/scale\([^),]+,\s*[^)]+\)/);
    expect(weaponRenderer).not.toMatch(/scale\([^),]+,\s*[^)]+\)/);
    expect(creatorStyles).not.toContain(".card-scale { position: absolute; top: 50%; left: 50%; width: 90mm; height: 142mm");
  });

  it("大画布 Renderer 自己缩放到规范宽度，不让卡图或 Creator 宿主改变横向尺度", async () => {
    const creatorStyles = await readFile("apps/creator/src/workspace-prototype/workspace.css", "utf8");
    const screenRule = creatorStyles.match(/\.card-scale\s*\{[^}]+\}/s)?.[0] ?? "";
    expect(screenRule).toContain("width: max-content");
    expect(screenRule).toContain("height: max-content");
    for (const [styles, frame, card] of [
      [armorRendererStyles, "armor-card-frame", "armor-card"],
      [environmentRendererStyles, "environment-card-frame", "environment-card"],
      [freeRendererStyles, "free-card-frame", "free-card"],
    ] as const) {
      expect(styles).toMatch(new RegExp(`\\.${frame}\\{[^}]*width:63px;[^}]*height:88px;[^}]*overflow:hidden`));
      expect(styles).toMatch(new RegExp(`\\.${card}\\{[^}]*position:absolute;[^}]*width:360px;[^}]*height:502\\.857px;[^}]*transform:scale\\(\\.175\\)`));
    }
  });

  it("Market 与共享详情对非固定比例长卡提供纵向滚动", async () => {
    const [shared, market, marketStyles] = await Promise.all([
      readFile("packages/resource-renderer/src/react.tsx", "utf8"),
      readFile("apps/market/src/MarketApp.tsx", "utf8"),
      readFile("apps/market/src/styles.css", "utf8"),
    ]);

    expect(shared).toContain('className={fixedRatio ? "" : "is-fluid"}');
    expect(shared).toMatch(/\[data-pbdh-card-preview-dialog\]\.is-fluid[\s\S]*?max-height:\s*calc\(100vh - 40px\)/);
    expect(shared).toMatch(/\[data-pbdh-card-preview-dialog\]\.is-fluid \[data-pbdh-card-preview-stage\][\s\S]*?overflow-y:\s*auto/);
    expect(market).toContain("<CardPreviewDialog");
    expect(market).not.toContain("canonical-enlarge-backdrop");
    expect(marketStyles).toMatch(/\.canonical-stage\s*\{[^}]*overflow-y:\s*auto/s);
    expect(marketStyles).toMatch(/\.canonical-scale\s*\{[^}]*overflow:\s*visible/s);
  });

  it("Creator 预览统一按宽度缩放，长卡通过舞台纵向滚动查看", async () => {
    const [preview, creatorStyles] = await Promise.all([
      readFile("apps/creator/src/workspace-prototype/resource-preview.tsx", "utf8"),
      readFile("apps/creator/src/workspace-prototype/workspace.css", "utf8"),
    ]);
    expect(preview).toContain('className="preview-stage-content"');
    expect(preview).toContain('className="card-scale-slot"');
    expect(creatorStyles).toMatch(/\.preview-stage\s*\{[^}]*overflow-y:\s*auto/s);
    expect(creatorStyles).toMatch(/\.preview-stage-content\s*\{[^}]*min-height:\s*100%/s);
    expect(creatorStyles).toMatch(/\.card-scale-slot\s*\{[^}]*position:\s*relative/s);
    expect(creatorStyles).toMatch(/\.card-scale\s*\{[^}]*inset:\s*0 auto auto 0/s);
  });
});
