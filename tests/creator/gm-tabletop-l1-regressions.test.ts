import "fake-indexeddb/auto";
import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";
import { createTabletopDocument, executeTabletopCommand, type TabletopCapability } from "@pbdh/tabletop/core";
import { DexieLocalDocumentStore, PbDHLocalDatabase } from "@pbdh/local-storage";
import { loadPbtab, writePbtab } from "@pbdh/contract-runtime";
import { filterWorkspaceResources } from "../../apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx";
import { TabletopDocumentRepository } from "../../apps/creator/src/workspace-prototype/tabletop-document-repository.ts";
import { validateTabletopDocumentCandidate } from "../../apps/creator/src/workspace-prototype/tabletop-document-validator.ts";

describe("GM Tabletop L1 regressions", () => {
  test("prints the current cards as an A4 grid instead of canvas coordinates", async () => {
    const css = await readFile("apps/creator/src/workspace-prototype/workspace.css", "utf8");
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toContain("@page { size: A4 portrait; margin: 10mm; }");
    expect(print).toContain("grid-template-columns: repeat(2, 90mm)");
    expect(print).toContain("width: max-content");
    expect(print).toContain("break-inside: avoid");
    expect(print).toContain("left: auto !important");
    expect(print).toContain("transform: none !important");
  });

  test("provides working resource filters, batch placement, fixed zoom and fit controls", async () => {
    const rootSource = await readFile("apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx", "utf8");
    const explorer = await readFile("apps/creator/src/workspace-prototype/creator-resource-explorer.tsx", "utf8");
    const contextMenus = await readFile("apps/creator/src/workspace-prototype/creator-context-menus.tsx", "utf8");
    const workbench = await readFile("apps/creator/src/workspace-prototype/gm-tabletop-workbench.tsx", "utf8");
    const viewport = await readFile("apps/creator/src/workspace-prototype/use-gm-tabletop-viewport.ts", "utf8");
    const source = `${rootSource}\n${explorer}\n${contextMenus}\n${workbench}\n${viewport}`;
    const implementation = source;
    expect(explorer).toContain("value={snapshot.search}");
    expect(explorer).toContain('aria-label="清空搜索"');
    expect(explorer).not.toContain("TemplateMultiSelect");
    expect(source).toContain("placeWorkspaceResources(selectedWorkspaceResources)");
    expect(source).toContain("const [resourceMultiSelect, setResourceMultiSelect] = useState(false)");
    expect(explorer).toContain("aria-pressed={snapshot.multiSelect}");
    expect(contextMenus).toContain("批量放到当前桌面（{snapshot.selectedWorkspaceResources.length}）");
    expect(contextMenus).toContain("删除已选（{snapshot.selectedWorkspaceResources.length}）");
    expect(source).toContain('kind: "delete-selected-resources"');
    expect(explorer).toContain("selectionMode={snapshot.multiSelect}");
    expect(explorer).toContain("filtered-resource-row");
    expect(explorer).toContain('aria-label="跨资源包筛选结果" role="tree"');
    expect(explorer).toContain('type: "open-resource-context", workspaceKey: workspace.key, resourceId: resource.id');
    expect(source).not.toContain('className="tabletop-resource-result"');
    expect(source).toContain("fitTabletopContent");
    expect(source).toContain("pbdh:gm-tabletop-view:");
    expect(source).toContain('positionBounds={{ ...snapshot.activeTabletop.canvas, containment: "full", pixelsPerUnit: gmCardPixelsPerDesignUnit }}');
    expect(source).toContain("updateTabletopPanPreview");
    expect(rootSource).toContain("selectAndRaiseTabletopInstance(command.instanceId, command.mode)");
    expect(source).not.toContain("setCanvasPan({ x: drag.startPan.x + dx, y: drag.startPan.y + dy })");
    expect(source).not.toContain(">置于顶层</button>");
    expect(source).not.toContain(">上移一层</button>");
    expect(source).not.toContain(">下移一层</button>");
    expect(source).not.toContain(">置于底层</button>");
    expect(source).not.toContain("className=\"tabletop-tab-resource-toggle\"");
    expect(implementation).toContain('appMode === "gm" || resourcePanelOpen ? " is-resource-panel-open"');
    expect(source).not.toContain("className=\"tabletop-selection-toolbar\"");
    expect(source).toContain(">编辑卡牌</button>");
    expect(source).not.toContain("editableDataFields");
    const treeSource = await readFile("apps/creator/src/workspace-prototype/WorkspaceTree.tsx", "utf8");
    expect(treeSource).toContain("selectionMode ? onToggleResourceSelection?.(resource.id) : onActivateResource(resource.id)");
    expect(treeSource).toContain('className="filtered-resource-select"');
    const css = await readFile("apps/creator/src/workspace-prototype/workspace.css", "utf8");
    expect(css).toContain(".creator-prototype.is-resource-panel-open .resource-explorer");
    expect(css).toContain("transform: translateX(-100%)");
    expect(css).toContain(".creator-prototype.is-gm-mode .resource-explorer");
    expect(css).toContain("visibility: visible; transform: none");
    const zoomStatus = css.slice(css.indexOf(".tabletop-zoom-status"), css.indexOf(".tabletop-renderer-error"));
    expect(zoomStatus).toContain("top: 16px");
    expect(zoomStatus).toContain("right: 16px");
    expect(zoomStatus).toContain("flex-direction: row");
    expect(zoomStatus).toContain("width: auto");
    expect(zoomStatus).toContain("min-height: 48px");
    expect(zoomStatus).toContain("backdrop-filter: blur(6px)");
    expect(zoomStatus).not.toContain("button:nth-of-type(4)");
    expect(zoomStatus).not.toContain("bottom:");
  });

  test("indexes 1000 resources and saves, reopens and exports a 200-card tabletop", async () => {
    const workspaces = Array.from({ length: 10 }, (_unused, workspaceIndex) => ({
      key: `workspace-${workspaceIndex}`,
      document: {
        package: { name: `资源包 ${workspaceIndex}` },
        resources: Array.from({ length: 100 }, (_item, resourceIndex) => ({
          id: `resource-${workspaceIndex}-${resourceIndex}`,
          path: `目录/${resourceIndex}.json`,
          template: { id: resourceIndex % 2 ? "pbdh.adversary" : "pbdh.item", version: "1.0.0" },
          data: { 名称: `压力资源 ${resourceIndex}`, 标签: resourceIndex % 3 ? "普通" : "首领" },
          presentation: { mode: "text", fixedRatio: true },
          media: {},
        })),
      },
    })) as never;
    expect(filterWorkspaceResources(workspaces, "首领").length).toBeGreaterThan(0);
    expect(filterWorkspaceResources(workspaces, "")).toHaveLength(1000);
    expect(filterWorkspaceResources(workspaces, "[模板:pbdh.adversary] [标签:首领]").length).toBeGreaterThan(0);
    expect(filterWorkspaceResources(workspaces, "[模板:pbdh.adversary] [模板:pbdh.item]")).toHaveLength(1000);

    const capabilities = new Set<TabletopCapability>(["place", "arrange"]);
    let tabletop = createTabletopDocument("00000000-0000-7000-8000-000000000001", "压力桌面");
    tabletop.canvas.height = 8000;
    for (let index = 0; index < 200; index += 1) {
      tabletop = executeTabletopCommand(tabletop, {
        type: "place",
        instanceId: `00000000-0000-7000-8000-${String(index + 2).padStart(12, "0")}`,
        resource: {
          source: null,
          template: { id: "物品", version: "1.0.0" },
          presentation: { mode: "text", fixedRatio: true },
          data: { 名称: `卡牌 ${index}` }, labels: [], replacements: [], media: {},
        },
        state: {}, position: { x: 0, y: 0 },
      }, { capabilities }).document;
    }
    tabletop = executeTabletopCommand(tabletop, {
      type: "arrange",
      placements: tabletop.instances.map((instance, index) => ({
        instanceId: instance.id,
        position: { x: (index % 10) * 260, y: Math.floor(index / 10) * 360 },
        layer: index,
        rotation: 0,
      })),
    }, { capabilities }).document;
    expect(tabletop.instances).toHaveLength(200);
    expect(new Set(tabletop.instances.map((instance) => instance.id)).size).toBe(200);

    const database = new PbDHLocalDatabase(`pbdh-gm-pressure-${crypto.randomUUID()}`);
    try {
      const repository = new TabletopDocumentRepository(new DexieLocalDocumentStore(database));
      const candidate = await repository.save(tabletop, new Map());
      expect((await repository.list())[0]?.model.instances).toHaveLength(200);
      const archive = writePbtab(candidate.document, candidate.media);
      const reopened = await loadPbtab(archive, validateTabletopDocumentCandidate);
      expect(reopened.diagnostics).toEqual([]);
      expect(reopened.candidate?.document.instances).toHaveLength(200);
    } finally {
      database.close();
      await database.delete();
    }
  });

  test("indexes workspace tree lookups instead of rescanning the package for every row", async () => {
    const source = await readFile("apps/creator/src/workspace-prototype/WorkspaceTree.tsx", "utf8");

    expect(source).toContain("const folderById = useMemo");
    expect(source).toContain("const resourceById = useMemo");
    expect(source).toContain("const treeItemsByParent = useMemo");
    expect(source).toContain("resourceById.get(item.id)");
    expect(source).not.toContain("workspace.document.resources.find((candidate) => candidate.id === item.id)");
  });
});
