import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";

import { loadPbres } from "@pbdh/contract-runtime";
import { createPbresCandidateValidator, upgradePbresTemplateVersions } from "@pbdh/resource-conversion";
import { currentTemplates, listTemplateUpgradeRows, upgradeTemplateResources } from "@pbdh/templates/core";
import { loadTemplateCore } from "@pbdh/templates/core/lazy";
import { describe, expect, test } from "vitest";

import { runCreatorPackageFileWorkflow } from "../../apps/creator/src/workspace-prototype/creator-package-file-workflow.ts";
import { validateResourcePackageCandidate } from "../../apps/creator/src/workspace-prototype/resource-package-validator.ts";
import {
  addTemplateResource,
  createBlankWorkspace,
  createWorkspace,
} from "../../apps/creator/src/workspace-prototype/workspace-model.ts";

const archive = new Uint8Array(readFileSync(new URL(
  "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.pbres",
  import.meta.url,
)));

describe("Creator package file workflow", () => {
  test.each([1, 2])("exports %i unsigned cards to Kid through the real workspace workflow", async (count) => {
    const inspected = await runCreatorPackageFileWorkflow({ type: "inspect-import", bytes: archive });
    if (inspected.type !== "import-ready") throw new Error("fixture should be importable");
    const candidate = inspected.candidate;
    const original = candidate.document.resources[0]!;
    candidate.document.resources = Array.from({ length: count }, (_, index) => ({
      ...structuredClone(original), id: `enemy-${index}`, path: `enemy-${index}.json`,
    }));
    const result = await runCreatorPackageFileWorkflow({
      type: "export-third-party", formatId: "kid", workspace: createWorkspace(candidate, true),
    });
    expect(result.type).toBe("third-party-export");
    if (result.type !== "third-party-export") throw new Error(JSON.stringify(result));
    expect(result.fileName.endsWith(count === 1 ? ".json" : ".zip")).toBe(true);
    const files = count === 1 ? [result.bytes] : Object.values(unzipSync(result.bytes));
    expect(files).toHaveLength(count);
    expect(files.map(bytes => JSON.parse(strFromU8(bytes)))).toEqual(
      Array.from({ length: count }, (_, index) => expect.objectContaining({
        id: `enemy-${index}`, type: "npc", name: "牛头人破坏者", creator: "未署名", owner: "未署名",
        features: expect.any(Array),
      })),
    );
  });

  test("inspects a package archive without mutating workspace state", async () => {
    const result = await runCreatorPackageFileWorkflow({ type: "inspect-import", bytes: archive });

    expect(result.type).toBe("import-ready");
    if (result.type !== "import-ready") return;
    expect(result.candidate.document.package.name).toBe("牛头人破坏者测试资源包");
    expect(result.candidate.document.resources[0]?.template).toEqual({ id: "敌人", version: "1.0.0" });
  });

  test("keeps imported Template versions until the user chooses a reachable upgrade target", async () => {
    const inspected = await runCreatorPackageFileWorkflow({ type: "inspect-import", bytes: archive });
    if (inspected.type !== "import-ready") throw new Error("fixture should be importable");

    expect(listTemplateUpgradeRows(inspected.candidate.document.resources)).toEqual([
      { templateId: "敌人", currentVersion: "1.0.0", count: 1, targetVersions: ["1.0.1", "1.0.2", "1.0.3", "1.0.4", "1.0.5", "1.1.0", "1.1.1"] },
    ]);
    const upgraded = await upgradePbresTemplateVersions(inspected.candidate, [
      { templateId: "敌人", currentVersion: "1.0.0", targetVersion: "1.0.2" },
    ], { upgradeResources: upgradeTemplateResources, validate: createPbresCandidateValidator(loadTemplateCore) });

    expect(upgraded.candidate?.document.resources[0]?.template).toEqual({ id: "敌人", version: "1.0.2" });
    expect(upgraded.candidate?.document.package.version).toBe("1.0.1");
    expect(inspected.candidate.document.resources[0]?.template.version).toBe("1.0.0");

    if (!upgraded.candidate) throw new Error("upgrade should succeed");
    const exported = await runCreatorPackageFileWorkflow({
      type: "export-workspace",
      workspace: createWorkspace(upgraded.candidate, true),
    });
    if (exported.type !== "workspace-export") throw new Error("export should succeed");
    const reopened = await loadPbres(exported.bytes, validateResourcePackageCandidate);
    expect(reopened.diagnostics).toEqual([]);
    expect(reopened.candidate?.document.resources).toMatchObject(upgraded.candidate.document.resources);
    expect(reopened.candidate?.document.package.version).toBe("1.0.1");
    expect(reopened.candidate?.document.snapshotDigest).toBe(exported.workspace.document.snapshotDigest);
    expect(reopened.candidate?.media).toEqual(upgraded.candidate.media);
  });

  test("prepares, validates and writes one export result", async () => {
    const inspected = await runCreatorPackageFileWorkflow({ type: "inspect-import", bytes: archive });
    if (inspected.type !== "import-ready") throw new Error("fixture should be importable");

    const result = await runCreatorPackageFileWorkflow({
      type: "export-workspace",
      workspace: createWorkspace(inspected.candidate),
    });

    expect(result.type).toBe("workspace-export");
    if (result.type !== "workspace-export") return;
    expect(result.fileName).toBe("牛头人破坏者测试资源包.pbres");
    const reopened = await loadPbres(result.bytes, validateResourcePackageCandidate);
    expect(reopened.diagnostics).toEqual([]);
    expect(reopened.candidate?.document.snapshotDigest).toBe(result.workspace.document.snapshotDigest);
  });

  test("exports a PBRES workspace through a third-party adapter", async () => {
    const inspected = await runCreatorPackageFileWorkflow({ type: "inspect-import", bytes: archive });
    if (inspected.type !== "import-ready") throw new Error("fixture should be importable");

    const result = await runCreatorPackageFileWorkflow({
      type: "export-third-party",
      formatId: "zzz",
      workspace: createWorkspace(inspected.candidate),
    });

    expect(result.type).toBe("third-party-export");
    if (result.type !== "third-party-export") return;
    expect(result.fileName).toMatch(/_zzz\.json$/u);
    expect(JSON.parse(new TextDecoder().decode(result.bytes))).toEqual([
      expect.objectContaining({ 名称: "牛头人破坏者", 类型: "敌人" }),
    ]);
  });

  test.each(currentTemplates)("exports a default $id resource created inside a new anonymous workspace", async (template) => {
    const blank = await createBlankWorkspace("匿名资源包");
    const created = addTemplateResource(blank, template);

    const result = await runCreatorPackageFileWorkflow({
      type: "export-workspace",
      workspace: created.workspace,
    });

    expect(result.type).toBe("workspace-export");
    if (result.type !== "workspace-export") return;
    const reopened = await loadPbres(result.bytes, validateResourcePackageCandidate);
    expect(reopened.diagnostics).toEqual([]);
    expect(reopened.candidate?.document.resources).toHaveLength(1);
  });

  test("repairs an existing local workspace whose license fields were left blank", async () => {
    const blank = await createBlankWorkspace("旧匿名资源包");
    blank.document.license = { label: "", declaration: "" };
    const created = addTemplateResource(blank, currentTemplates[0]!);

    const result = await runCreatorPackageFileWorkflow({
      type: "export-workspace",
      workspace: created.workspace,
    });

    expect(result.type).toBe("workspace-export");
    if (result.type !== "workspace-export") return;
    expect(result.workspace.document.license).toEqual({
      label: "保留所有权利",
      declaration: "All rights reserved.",
    });
  });

  test("returns conversion diagnostics instead of leaking adapter failures", async () => {
    const result = await runCreatorPackageFileWorkflow({
      type: "convert",
      formatId: "zzz",
      bytes: new Uint8Array([0xff]),
      fileName: "broken.json",
    });

    expect(result.type).toBe("conversion-review");
    if (result.type !== "conversion-review") return;
    expect(result.review).toMatchObject({ candidate: null, converted: 0 });
    expect(result.review.failed).toBeGreaterThan(0);
    expect(result.review.diagnostics.some((item) => item.severity === "error")).toBe(true);
  });
});
