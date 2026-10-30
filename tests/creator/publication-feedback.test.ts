import { describe, expect, test } from "vitest";

import {
  collapseCreatorDiagnostics,
  collapsePublicationFieldErrors,
  creatorDiagnosticCodes,
  creatorDiagnosticMessage,
  publicationErrorMessage,
  publicationSuccessMessage,
} from "../../apps/creator/src/workspace-prototype/publication-feedback.ts";

describe("Creator publication feedback", () => {
  test("never exposes internal auth diagnostics to users", () => {
    expect(publicationErrorMessage("AUTH_REQUIRED", "fallback")).toBe("请先登录，再发布到资源市场。")
    expect(publicationErrorMessage("publication.auth.required", "fallback")).toBe("请先登录，再发布到资源市场。")
  });

  test("explains automatic cover generation failures", () => {
    expect(publicationErrorMessage("creator.publication-cover.resource-missing", "fallback"))
      .toBe("资源包至少需要一项资源，才能生成发布封面。");
    expect(publicationErrorMessage("creator.publication-cover.render-failed", "fallback"))
      .toBe("资源包内没有可渲染为发布封面的资源卡，请检查卡面后重试。");
  });

  test("explains a changed development snapshot instead of reporting auth failure", () => {
    expect(publicationErrorMessage("PUBLICATION_VERSION_CONFLICT", "fallback")).toBe(
      "当前内容与已发布版本不同。请提高 package.version 后再发布。",
    );
    expect(creatorDiagnosticMessage(
      "PUBLICATION_VERSION_CONFLICT",
      "新增目标系统，版本号至少需要 1.1.0。请提高 package.version 后重试。",
    )).toBe("新增目标系统，版本号至少需要 1.1.0。请提高 package.version 后重试。");
  });

  test("turns Contract lifecycle diagnostics into an actionable Chinese message", () => {
    expect(publicationErrorMessage("contract.version.development-not-allowed", "fallback")).toBe(
      "当前资源包使用的文件格式尚未开放正式发布，请更新平台后重试，或联系平台管理员发布该 Contract 版本。",
    );
  });

  test("collapses repeated per-resource publication errors", () => {
    expect(collapsePublicationFieldErrors([
      { path: "/resources/0", code: "template.version.unsupported", message: "template.version.unsupported" },
      { path: "/resources/1", code: "template.version.unsupported", message: "template.version.unsupported" },
      { path: "/resources/2/data", code: "template.data.invalid", message: "template.data.invalid" },
    ])).toEqual([
      { path: "/resources/0", code: "template.version.unsupported", message: "template.version.unsupported", count: 2 },
      { path: "/resources/2/data", code: "template.data.invalid", message: "template.data.invalid", count: 1 },
    ]);
  });

  test("describes and collapses repeated import validation diagnostics without saying publication failed", () => {
    const diagnostics = Array.from({ length: 201 }, (_, index) => ({
      code: "contract.schema.additional-property",
      severity: "error" as const,
      family: "resource-package",
      version: "1.0.0",
      location: `/resources/${Math.floor(index / 3)}/presentation`,
      params: { property: ["height", "unit", "width"][index % 3] },
    }));

    const collapsed = collapseCreatorDiagnostics(diagnostics);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.params.count).toBe(201);
    expect(creatorDiagnosticMessage(collapsed[0]!.code, undefined, collapsed[0]!.params)).toBe(
      "文件包含当前格式不支持的字段：height。请检查字段名拼写，或确认文件格式版本是否受支持。",
    );
    expect(creatorDiagnosticMessage("unknown.import.error")).toBe(
      "资源包未通过校验（unknown.import.error），请检查内容后重试。",
    );
  });

  test("explains a stale snapshot digest and how to repack", () => {
    const message = creatorDiagnosticMessage("resource-package.snapshot-digest.mismatch");

    expect(message).toContain("摘要不一致");
    expect(message).toContain("npm run pbres:pack");
  });

  test("names the offending field or path instead of a generic archive failure", () => {
    expect(creatorDiagnosticMessage("resource-package.archive.path.invalid", undefined, {
      path: "resources/牛头人.json",
      reason: "backslash",
    })).toBe("资源包内有不合法的路径 resources/牛头人.json：不能使用反斜杠。");
    expect(creatorDiagnosticMessage("resource-package.archive.file.unknown", undefined, {
      path: "resources/说明.txt",
    })).toBe("资源包里有规则外的文件：resources/说明.txt。包内只允许 package.json、资源 JSON 和 assets/<sha256>.webp。");
  });

  test("keeps every diagnostic readable when the server sends no params", () => {
    for (const code of creatorDiagnosticCodes) {
      const message = creatorDiagnosticMessage(code);
      expect(message.endsWith("。"), code).toBe(true);
      expect(message, code).not.toContain("  ");
      expect(message, code).not.toContain(" 。");
      expect(message, code).not.toMatch(/：\s*。/u);
      expect(message, code).not.toMatch(/（\s*）/u);
      expect(message, code).not.toMatch(/^\s|\s$/u);
    }
  });

  test("distinguishes created, updated and idempotent publication results", () => {
    expect(publicationSuccessMessage("牛头人敌人资源包", { created: true, idempotent: false })).toBe(
      "已发布“牛头人敌人资源包”",
    );
    expect(publicationSuccessMessage("牛头人敌人资源包", { created: false, idempotent: false })).toBe(
      "已更新已有的“牛头人敌人资源包”",
    );
    expect(publicationSuccessMessage("牛头人敌人资源包", { created: false, idempotent: true })).toBe(
      "发布内容与已有“牛头人敌人资源包”完全一致，已跳过",
    );
  });
});
