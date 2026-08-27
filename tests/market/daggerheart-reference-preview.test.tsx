import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { CanonicalPreview } from "../../apps/market/src/MarketApp.tsx";
import type { Publication } from "../../apps/market/src/market-model.ts";
import {
  ancestryTemplate, communityTemplate, domainTemplate, itemTemplate, professionTemplate, subclassTemplate,
} from "../../packages/templates/src/core/index.ts";

const templates = [ancestryTemplate, communityTemplate, professionTemplate, subclassTemplate, itemTemplate, domainTemplate];

describe("Market 六类稳定资源预览", () => {
  test.each(templates)("renders %s with the shared Canonical Surface", (template) => {
    const source = {
      template: { id: template.id, version: template.version },
      presentation: template.defaultPresentation,
      data: { ...template.defaultData, 名称: `测试${template.id}` },
      media: {},
    };
    const publication: Publication = {
      id: `publication-${template.id}`, packageId: `package-${template.id}`, packageVersion: "1.0.0",
      snapshotDigest: "sha256:test", title: `测试${template.id}`, ownerAccountId: "author", author: "作者",
      summary: "测试", kind: "mixed", templateIds: [template.id], system: "daggerheart-core", systemLabel: "Daggerheart Core",
      language: "中文", categories: [template.id], tags: [], license: "CC0", updatedAt: "2026-08-27", resourceCount: 1,
      status: "published", cover: { assetId: "", url: "", alt: "" }, archiveUrl: "test.pbres", archiveName: "test.pbres",
      resources: [{ id: "resource", name: `测试${template.id}`, templateId: template.id, path: `${template.id}/测试.json`, data: source.data, source }],
    };
    const markup = renderToStaticMarkup(<CanonicalPreview publication={publication} resourceId="resource" />);
    expect(markup).toContain(`测试${template.id}规范卡面`);
    expect(markup).not.toContain("当前版本尚不能预览此模板");
  });
});
