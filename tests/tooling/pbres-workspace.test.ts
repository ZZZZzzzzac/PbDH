import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { loadPbres } from "../../packages/contract-runtime/src/index.ts";
import { validateResourcePackageCandidate } from "../../apps/creator/src/workspace-prototype/resource-package-validator.ts";
import {
  bumpVersion,
  packPbresWorkspace,
  unpackPbresToWorkspace,
} from "../../scripts/pbres-workspace.ts";

describe("PBRES 批量编辑工作目录", () => {
  test("解包 JSON，修改文本后自动升 patch、重算摘要并可靠封包", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "pbdh-pbres-workspace-"));
    const source = path.resolve("contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.pbres");
    const workspace = path.join(temp, "resource.unpacked");
    const output = path.join(temp, "resource.pbres");

    await unpackPbresToWorkspace(source, workspace);
    const resourcePath = path.join(workspace, "敌人", "牛头人破坏者.json");
    const resource = JSON.parse(await readFile(resourcePath, "utf8")) as { data: { 名称: string } };
    resource.data.名称 = "批量修改后的牛头人";
    await writeFile(resourcePath, `${JSON.stringify(resource, null, 2)}\n`, "utf8");

    const packed = await packPbresWorkspace({ workspacePath: workspace, outputPath: output });
    expect(packed.document.package.version).toBe("1.0.1");
    const reopened = await loadPbres(new Uint8Array(await readFile(output)), validateResourcePackageCandidate);
    expect(reopened.diagnostics).toEqual([]);
    expect(reopened.candidate?.document.resources[0]?.data).toMatchObject({ 名称: "批量修改后的牛头人" });

    const workspaceRoot = JSON.parse(await readFile(path.join(workspace, "package.json"), "utf8")) as {
      package: { version: string };
      snapshotDigest: string;
    };
    expect(workspaceRoot.package.version).toBe("1.0.1");
    expect(workspaceRoot.snapshotDigest).toBe(packed.document.snapshotDigest);
  });

  test("支持显式版本升级策略", () => {
    expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(bumpVersion("1.2.3-beta.1", "minor")).toBe("1.3.0");
    expect(bumpVersion("1.2.3+build.4", "major")).toBe("2.0.0");
    expect(bumpVersion("1.2.3", "none")).toBe("1.2.3");
  });
});
