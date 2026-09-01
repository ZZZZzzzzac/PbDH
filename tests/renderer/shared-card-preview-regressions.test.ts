import { readFile } from "node:fs/promises";

import { adversaryTemplate, armorTemplate, weaponTemplate } from "@pbdh/templates/core";
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
    expect(adversaryTemplate.defaultPresentation).toMatchObject({ fixedRatio: false });
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
    expect(preview).toContain("const widthScale = (stage.clientWidth * 0.7) / width");
    expect(preview).toContain("const heightScale = (stage.clientHeight * 0.7) / height");
    expect(preview).toContain("Math.max(0, Math.min(widthScale, heightScale))");
    expect(gmWorkbench).toContain('displayWidth="250px"');
    expect(gmWorkbench).not.toContain('displayWidth="63mm"');
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
});
