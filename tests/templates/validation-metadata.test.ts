import { expect, test, vi } from "vitest";
import { templateRegistry } from "@pbdh/templates/core";
import { templateCoreLoaders } from "@pbdh/templates/core/lazy";
import { templateValidationMetadata } from "@pbdh/templates/core/validation";
import { validateTabletopDocumentCandidate } from "../../apps/creator/src/workspace-prototype/tabletop-document-validator.ts";
import fixture from "../../contracts/conformance/tabletop-document/1.0.0/valid/basic.json";
import type { TabletopDocument } from "@pbdh/contract-runtime";

test("轻量校验元数据与所有历史能力完全一致", () => {
  for (const template of templateRegistry.list()) {
    const metadata = templateValidationMetadata(template.id, template.version)!;
    expect(metadata.tabletop.stateSchema).toEqual(template.tabletop.stateSchema);
    expect(metadata.tabletop.replacements).toEqual(template.tabletop.replacements);
  }
  expect(templateValidationMetadata("敌人", "9.9.9")).toBeUndefined();
});

test("恢复校验不加载 Core 实现，同时拒绝非法状态", async () => {
  const loads = templateCoreLoaders.map((entry) => vi.spyOn(entry, "load"));
  try {
    const document = structuredClone(fixture) as TabletopDocument;
    expect(await validateTabletopDocumentCandidate(document, new Map())).toEqual([]);
    document.instances[0]!.state = { currentHp: 7 };
    expect(await validateTabletopDocumentCandidate(document, new Map())).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "tabletop-document.state.invalid-for-template" }),
    ]));
    expect(loads.every((load) => load.mock.calls.length === 0)).toBe(true);
  } finally { vi.restoreAllMocks(); }
});
