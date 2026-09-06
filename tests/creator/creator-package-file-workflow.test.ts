import { readFileSync } from "node:fs";

import { loadPbres } from "@pbdh/contract-runtime";
import { currentTemplates } from "@pbdh/templates/core";
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
const fourSacredBeastsArchive = new Uint8Array(readFileSync(new URL(
  "../../docs/third/《四圣兽》通用敌人数据卡.pbres",
  import.meta.url,
)));

describe("Creator package file workflow", () => {
  test("inspects a package archive without mutating workspace state", async () => {
    const result = await runCreatorPackageFileWorkflow({ type: "inspect-import", bytes: archive });

    expect(result.type).toBe("import-ready");
    if (result.type !== "import-ready") return;
    expect(result.candidate.document.package.name).toBe("牛头人破坏者测试资源包");
    expect(result.candidate.document.resources[0]?.template).toEqual({ id: "敌人", version: "1.0.1" });
  });

  test("imports the repaired Four Sacred Beasts package without dropping resources", async () => {
    const result = await runCreatorPackageFileWorkflow({
      type: "inspect-import",
      bytes: fourSacredBeastsArchive,
    });

    expect(result.type).toBe("import-ready");
    if (result.type !== "import-ready") return;
    expect(result.candidate.document.resources).toHaveLength(67);
    expect(new Set(result.candidate.document.resources.map((resource) => (
      `${resource.template.id}@${resource.template.version}`
    )))).toEqual(new Set(["敌人@1.0.1", "自由@1.0.1"]));
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
    const created = addTemplateResource(blank, template.id, template.version);

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
    const created = addTemplateResource(blank, currentTemplates[0]!.id, currentTemplates[0]!.version);

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
