import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { CanonicalPreview } from "../../apps/market/src/MarketApp.tsx";
import { createHandoffIntent, type Publication } from "../../apps/market/src/market-model.ts";
import { environmentTemplate } from "../../packages/templates/src/core/index.ts";

const environment = {
  id: "environment-abandoned-grove",
  path: "环境/荒废林地.json",
  template: { id: environmentTemplate.id, version: environmentTemplate.version },
  presentation: environmentTemplate.defaultPresentation,
  data: { ...environmentTemplate.defaultData, 名称: "荒废林地", 难度: "11" },
  media: {},
};

const publication: Publication = {
  id: "publication-environment",
  packageId: "environment-package",
  packageVersion: "1.0.0",
  snapshotDigest: `sha256:${"1".repeat(64)}`,
  title: "环境测试包",
  ownerAccountId: "environment-author",
  author: "环境工坊",
  summary: "环境测试",
  kind: "mixed",
  templateIds: ["环境"],
  systems: ["daggerheart-core"],
  systemLabels: ["匕首之心"],
  language: "中文",
  categories: ["环境"],
  tags: ["场景"],
  license: "测试",
  updatedAt: "2026-08-28",
  resourceCount: 1,
  status: "published",
  cover: { assetId: "", url: "", alt: "" },
  archiveUrl: "environment.pbres",
  archiveName: "environment.pbres",
  resources: [{ id: environment.id, name: environment.data.名称, templateId: "环境", path: environment.path, data: environment.data, source: environment }],
};

describe("Market environment Canonical Resource preview", () => {
  test("renders the shared environment surface and hands it to Player as Other Resources", () => {
    expect(createHandoffIntent(publication, "player", environment.id).targetRoute).toBe("other-resources");
    const markup = renderToStaticMarkup(<CanonicalPreview publication={publication} resourceId={environment.id} />);
    expect(markup).toContain("荒废林地规范卡面");
    expect(markup).toContain("data-pbdh-canonical-surface");
    expect(markup).not.toContain("当前版本尚不能预览此模板");
  });
});
