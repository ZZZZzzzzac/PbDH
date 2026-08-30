import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { currentTemplates, templateRegistry } from "@pbdh/templates/core";
import { trustedAuthoringLayoutFor, trustedRendererFor } from "@pbdh/templates/frontend";

type CatalogEntry = {
  id: string;
  version: string;
  publication: { development: boolean; production: boolean };
};

const catalog = JSON.parse(readFileSync("packages/templates/catalog.json", "utf8")) as {
  templates: CatalogEntry[];
};
const key = (item: { id: string; version: string }) => `${item.id}@${item.version}`;

describe("Resource Template support matrix", () => {
  test("catalog and core registry contain the same exact versions", () => {
    expect(templateRegistry.list().map(key).sort()).toEqual(catalog.templates.map(key).sort());
  });

  test("every version accepted for new development publications is complete and non-prerelease", () => {
    const currentEntries = catalog.templates.filter((item) => item.publication.development);
    expect(currentTemplates.map(key).sort()).toEqual(currentEntries.map(key).sort());
    for (const entry of currentEntries) {
      const core = templateRegistry.resolve(entry.id, entry.version);
      const authoring = trustedAuthoringLayoutFor(entry.id, entry.version);
      const renderer = trustedRendererFor(entry.id, entry.version);

      expect(entry.version, key(entry)).not.toContain("-");
      expect(core, `${key(entry)} 缺少核心模板`).toBeDefined();
      expect(authoring, `${key(entry)} 缺少编辑器`).toBeDefined();
      expect(renderer, `${key(entry)} 缺少卡面渲染器`).toBeDefined();
      expect(authoring && key({ id: authoring.templateId, version: authoring.templateVersion })).toBe(key(entry));
      expect(renderer?.revision, `${key(entry)} 渲染器版本不一致`).toBe(core?.rendererRevision);
    }
  });
});
