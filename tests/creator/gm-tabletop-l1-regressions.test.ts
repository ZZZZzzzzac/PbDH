import "fake-indexeddb/auto";
import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";
import { createTabletopDocument, executeTabletopCommand, type TabletopCapability } from "@pbdh/tabletop/core";
import { DexieLocalDocumentStore, PbDHLocalDatabase } from "@pbdh/local-storage";
import { loadPbtab, writePbtab } from "@pbdh/contract-runtime";
import { filterTabletopWorkspaceResources } from "../../apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx";
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
    const source = await readFile("apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx", "utf8");
    expect(source).toContain("value={resourceSearch}");
    expect(source).toContain("value={resourceTemplateFilter}");
    expect(source).toContain("placeWorkspaceResources(selectedTabletopResources)");
    expect(source).toContain("tabletopZoomSteps");
    expect(source).toContain("fitTabletopContent");
    expect(source).toContain("pbdh:gm-tabletop-view:");
    expect(source).toContain("positionBounds={{ ...activeTabletop.canvas, minimumVisible: 48 }}");
    expect(source).not.toContain("className=\"tabletop-tab-resource-toggle\"");
    expect(source).toContain('appMode === "gm" || resourcePanelOpen ? " is-resource-panel-open"');
    expect(source).toContain("className=\"tabletop-selection-toolbar\"");
    const css = await readFile("apps/creator/src/workspace-prototype/workspace.css", "utf8");
    expect(css).toContain(".creator-prototype.is-resource-panel-open .resource-explorer");
    expect(css).toContain("transform: translateX(-100%)");
    expect(css).toContain(".creator-prototype.is-gm-mode .resource-explorer");
    expect(css).toContain("visibility: visible; transform: none");
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
          presentation: { width: "63", height: "88", unit: "mm", mode: "text", fixedRatio: true },
          media: {},
        })),
      },
    })) as never;
    expect(filterTabletopWorkspaceResources(workspaces, "首领", "pbdh.adversary").length).toBeGreaterThan(0);
    expect(filterTabletopWorkspaceResources(workspaces, "", "")).toHaveLength(1000);

    const capabilities = new Set<TabletopCapability>(["place", "arrange"]);
    let tabletop = createTabletopDocument("00000000-0000-7000-8000-000000000001", "压力桌面");
    tabletop.canvas.height = 8000;
    for (let index = 0; index < 200; index += 1) {
      tabletop = executeTabletopCommand(tabletop, {
        type: "place",
        instanceId: `00000000-0000-7000-8000-${String(index + 2).padStart(12, "0")}`,
        resource: {
          source: null,
          template: { id: "pbdh.item", version: "1.0.0" },
          presentation: { width: "63", height: "88", unit: "mm", mode: "text", fixedRatio: true },
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
});
