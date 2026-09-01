import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { currentTemplates, templateRegistry } from "@pbdh/templates/core";
import { resolveTemplateFrontend, supportedTemplateFrontends } from "@pbdh/templates/frontend";

type CatalogEntry = {
  id: string;
  version: string;
  state: "development" | "published" | "deprecated";
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

  test("every version accepted for new development publications is complete and non-prerelease", async () => {
    const currentEntries = catalog.templates.filter((item) => item.publication.development);
    expect(currentTemplates.map(key).sort()).toEqual(currentEntries.map(key).sort());
    expect(supportedTemplateFrontends.map((frontend) => key({
      id: frontend.templateId,
      version: frontend.templateVersion,
    })).sort()).toEqual(currentEntries.map(key).sort());
    for (const entry of currentEntries) {
      const core = templateRegistry.resolve(entry.id, entry.version);
      const frontend = resolveTemplateFrontend(entry.id, entry.version);

      expect(entry.version, key(entry)).not.toContain("-");
      expect(core, `${key(entry)} 缺少核心模板`).toBeDefined();
      expect(frontend, `${key(entry)} 缺少前端 capability`).toBeDefined();
      expect(frontend && key({ id: frontend.templateId, version: frontend.templateVersion })).toBe(key(entry));
      expect(frontend?.authoring.layout.templateId).toBe(entry.id);
      expect(frontend?.rendererRevision.revision, `${key(entry)} 渲染器版本不一致`).toBe(core?.rendererRevision);
      await expect(frontend?.loadRenderer()).resolves.toBe(frontend?.rendererRevision);
    }
  });

  test("every production-publishable version is published consistently", () => {
    const productionEntries = catalog.templates.filter((item) => item.publication.production);
    expect(productionEntries).toHaveLength(11);
    for (const entry of productionEntries) {
      expect(entry.state, key(entry)).toBe("published");
      expect(templateRegistry.resolve(entry.id, entry.version)?.state, key(entry)).toBe("published");
    }
  });

  test("published projections do not crash while displaying an older local draft without 类型", () => {
    for (const template of currentTemplates) {
      const legacyDraft = structuredClone(template.defaultData) as Record<string, unknown>;
      delete legacyDraft.类型;

      expect(() => template.project(legacyDraft as never), key(template)).not.toThrow();
    }
  });
});
