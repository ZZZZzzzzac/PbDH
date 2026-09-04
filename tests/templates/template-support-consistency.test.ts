import { readFileSync } from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import { computeResourcePackageSnapshotDigest } from "@pbdh/contract-runtime";
import { currentTemplates, templateRegistry } from "@pbdh/templates/core";
import { resolveTemplateFrontend, supportedTemplateFrontends } from "@pbdh/templates/frontend";

import { validateResourcePackageCandidate } from "../../apps/player/src/resources/resource-package-validator.ts";

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
      expect(frontend?.authoring.templateId).toBe(entry.id);
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

  test("字段审阅 JSON 对 published 1.0.0 Templates 各提供一个合法资源", async () => {
    const document = JSON.parse(readFileSync(
      "docs/template-1.0.0-review-resource-package.json",
      "utf8",
    )) as {
      resources: Array<{ template: { id: string; version: string }; data: unknown }>;
      snapshotDigest: string;
    };
    const published = catalog.templates.filter((item) => item.publication.production);

    expect(await validateResourcePackageCandidate(document as never, new Map())).toEqual([]);
    expect(document.snapshotDigest).toBe(await computeResourcePackageSnapshotDigest(document as never, new Map()));
    expect(document.resources.map((resource) => key(resource.template)).sort()).toEqual(
      published.map(key).sort(),
    );
    for (const resource of document.resources) {
      const template = templateRegistry.resolve(resource.template.id, resource.template.version);
      expect(template, key(resource.template)).toBeDefined();
      const validate = new Ajv2020({ allErrors: true, strict: true }).compile(template!.schema);
      expect(validate(resource.data), `${key(resource.template)}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
  });
});
