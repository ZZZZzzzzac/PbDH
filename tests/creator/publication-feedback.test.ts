import { describe, expect, test } from "vitest";

import {
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
      "当前内容与已发布版本不同，请重新发布开发中的 1.0.0。",
    );
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
