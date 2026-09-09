import { describe, expect, test } from "vitest";

import { computeResourcePackageSnapshotDigest, loadPbres, writePbres, type ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import { createTabletopDocument, executeTabletopCommand, type TabletopCapability } from "@pbdh/tabletop/core";
import { currentTemplates, templateRegistry } from "@pbdh/templates/core";
import { resolveTemplateFrontend } from "@pbdh/templates/frontend";
import { sharedTabletopReplacements } from "../../packages/templates/src/core/shared-replacements.ts";
import templateCatalog from "../../packages/templates/catalog.json";
import { createBlankWorkspace } from "../../apps/creator/src/workspace-prototype/workspace-lifecycle.ts";
import { validateResourcePackageCandidate } from "../../apps/creator/src/workspace-prototype/resource-package-validator.ts";
import { prepareWorkspaceReplacement as prepareWithTemplates, snapshotWorkspaceResourceForTabletop } from "../../apps/creator/src/workspace-prototype/tabletop-placement.ts";

const capabilities = new Set<TabletopCapability>(["place", "replace", "uniform-scale"]);
const prepareWorkspaceReplacement = prepareWithTemplates.bind(undefined, templateRegistry.resolve.bind(templateRegistry));

describe("all current Templates share explicit one-step replacements", () => {
  test.each(currentTemplates)("$id supports reciprocal replacement without recursion", async (template) => {
    const runtimeTemplate = templateRegistry.resolve(template.id, template.version)!;
    const workspace = await createBlankWorkspace("双面测试");
    workspace.document.resources = ["sealed", "released"].map((id) => ({
      id, path: `${id}.json`, template: { id: template.id, version: template.version },
      presentation: structuredClone(template.defaultPresentation),
      attribution: { artworkCredit: "", sourceLabel: "测试" },
      data: { ...structuredClone(template.defaultData), 名称: id } as ResourcePackageLogicalDocument["resources"][number]["data"],
      replacements: [{ replacementId: "alternate-form", targetResourceId: id === "sealed" ? "released" : "sealed" }],
      media: {},
    }));
    workspace.document.snapshotDigest = await computeResourcePackageSnapshotDigest(workspace.document, workspace.media);
    expect(template.version).toBe("1.1.0");
    expect(template.tabletop.replacements).toBe(sharedTabletopReplacements);
    expect(templateCatalog.templates.find(entry => entry.id === template.id && entry.version === template.version)?.tabletopReplacements)
      .toEqual(sharedTabletopReplacements);
    expect(resolveTemplateFrontend(template.id, template.version)?.authoring.replacements).toBe("after");
    expect(await validateResourcePackageCandidate(workspace.document, workspace.media)).toEqual([]);
    const roundTrip = await loadPbres(writePbres(workspace.document, workspace.media), validateResourcePackageCandidate);
    expect(roundTrip.diagnostics).toEqual([]);
    expect(roundTrip.candidate?.document.resources).toHaveLength(2);

    const snapshot = snapshotWorkspaceResourceForTabletop(workspace, "sealed");
    let board = executeTabletopCommand(createTabletopDocument("board", "双面"), {
      type: "place", instanceId: "instance-0", resource: snapshot.resource,
      state: runtimeTemplate.tabletop.defaultState(runtimeTemplate.defaultData), position: { x: 120, y: 80 },
    }, { capabilities }).document;
    board = executeTabletopCommand(board, { type: "uniform-scale", instanceId: "instance-0", scale: 1.5 }, { capabilities }).document;
    const before = board.instances[0]!;
    for (let step = 1; step <= 20; step += 1) {
      const prepared = prepareWorkspaceReplacement([workspace], board.instances[0]!, "alternate-form", `instance-${step}`);
      const result = executeTabletopCommand(board, prepared.command, { capabilities });
      expect(result.diagnostics).toEqual([]);
      expect(result.document.instances).toHaveLength(1);
      const current = result.document.instances[0]!;
      expect(current.resource.source?.resourceId).toBe(step % 2 === 1 ? "released" : "sealed");
      expect(current.resource.replacements[0]?.targetResourceId).toBe(step % 2 === 1 ? "sealed" : "released");
      expect(current.position).toEqual(before.position);
      expect(current.scale).toBe(before.scale);
      expect(current.layer).toBe(before.layer);
      expect(current.rotation).toBe(before.rotation);
      expect(current.state).toEqual(runtimeTemplate.tabletop.defaultState(current.resource.data));
      board = result.document;
    }

    workspace.document.resources[0]!.replacements![0]!.targetResourceId = "missing";
    workspace.document.snapshotDigest = await computeResourcePackageSnapshotDigest(workspace.document, workspace.media);
    expect(await validateResourcePackageCandidate(workspace.document, workspace.media)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "resource-package.replacement-target.missing" }),
    ]));
    expect(() => prepareWorkspaceReplacement([workspace], board.instances[0]!, "unknown", "rejected"))
      .toThrow("tabletop.replacement.unsupported");
  });

  test("historical domain cards still reject unsupported replacement IDs", async () => {
    const workspace = await createBlankWorkspace("旧领域卡");
    const previous = templateRegistry.resolve("领域卡", "1.0.1")!;
    expect(previous.tabletop.replacements).toEqual([]);
    workspace.document.resources = [{
      id: "old", path: "old.json", template: { id: previous.id, version: previous.version },
      presentation: { mode: "text", fixedRatio: true }, data: structuredClone(previous.defaultData),
      attribution: { artworkCredit: "", sourceLabel: "测试" }, media: {},
      replacements: [{ replacementId: "alternate-form", targetResourceId: "old" }],
    }];
    workspace.document.snapshotDigest = await computeResourcePackageSnapshotDigest(workspace.document, workspace.media);
    expect(await validateResourcePackageCandidate(workspace.document, workspace.media)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "template.replacement.unsupported" }),
    ]));
    expect(templateRegistry.resolve("敌人", "1.0.5")?.tabletop.replacements).toEqual(sharedTabletopReplacements);
  });
});
