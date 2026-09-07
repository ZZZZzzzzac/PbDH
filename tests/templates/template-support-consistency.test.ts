import { readFileSync } from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import { computeResourcePackageSnapshotDigest } from "@pbdh/contract-runtime";
import { currentTemplates, listTemplateUpgradeRows, templateRegistry, upgradeTemplateResources } from "@pbdh/templates/core";
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
    expect(supportedTemplateFrontends.map((frontend) => key({
      id: frontend.templateId,
      version: frontend.templateVersion,
    })).sort()).toEqual(catalog.templates.map(key).sort());
  });

  test("every development-publishable version is complete and every Template has one current version", async () => {
    const developmentEntries = catalog.templates.filter((item) => item.publication.development);
    expect(currentTemplates).toHaveLength(11);
    expect(new Set(currentTemplates.map((item) => item.id)).size).toBe(11);
    expect(currentTemplates.every((template) => developmentEntries.some((entry) => key(entry) === key(template)))).toBe(true);
    expect(supportedTemplateFrontends.filter((frontend) => developmentEntries.some((entry) =>
      entry.id === frontend.templateId && entry.version === frontend.templateVersion)).map((frontend) => key({
      id: frontend.templateId,
      version: frontend.templateVersion,
    })).sort()).toEqual(developmentEntries.map(key).sort());
    for (const entry of developmentEntries) {
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
    expect(productionEntries.map(key).sort()).toEqual(
      catalog.templates.filter((item) => item.state === "published").map(key).sort(),
    );
    for (const entry of productionEntries) {
      expect(entry.state, key(entry)).toBe("published");
      expect(templateRegistry.resolve(entry.id, entry.version)?.state, key(entry)).toBe("published");
    }
  });

  test.each(currentTemplates)("$id@$version can upgrade from 1.0.0", (template) => {
    const previous = templateRegistry.resolve(template.id, "1.0.0");
    expect(previous, `${template.id}@1.0.0 缺少旧模板`).toBeDefined();
    const upgraded = templateRegistry.upgradeData(
      template.id,
      "1.0.0",
      template.version,
      previous!.defaultData,
    );
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(template.schema);
    expect(validate(upgraded), `${key(template)}: ${JSON.stringify(validate.errors)}`).toBe(true);
    expect(upgraded).not.toBe(previous!.defaultData);
  });

  test("lists every reachable manual upgrade target and upgrades only selected Template versions", () => {
    const resources = [
      { id: "enemy", template: { id: "敌人", version: "1.0.1" }, data: templateRegistry.resolve("敌人", "1.0.1")!.defaultData },
      { id: "environment", template: { id: "环境", version: "1.0.1" }, data: templateRegistry.resolve("环境", "1.0.1")!.defaultData },
    ];
    expect(listTemplateUpgradeRows(resources)).toEqual([
      { templateId: "敌人", currentVersion: "1.0.1", count: 1, targetVersions: ["1.0.2", "1.0.3", "1.0.4"] },
      { templateId: "环境", currentVersion: "1.0.1", count: 1, targetVersions: ["1.0.2", "1.0.3"] },
    ]);
    const upgraded = upgradeTemplateResources(resources, [{ templateId: "敌人", currentVersion: "1.0.1", targetVersion: "1.0.2" }]);
    expect(upgraded.map((resource) => resource.template.version)).toEqual(["1.0.2", "1.0.1"]);
    expect(resources.map((resource) => resource.template.version)).toEqual(["1.0.1", "1.0.1"]);
  });

  test("字段审阅 JSON 对 published 1.0.0 Templates 各提供一个合法资源", async () => {
    const document = JSON.parse(readFileSync(
      "docs/template-1.0.0-review-resource-package.json",
      "utf8",
    )) as {
      resources: Array<{ template: { id: string; version: string }; data: unknown }>;
      snapshotDigest: string;
    };
    const published100 = catalog.templates.filter((item) => item.version === "1.0.0" && item.state === "published");

    expect(await validateResourcePackageCandidate(document as never, new Map())).toEqual([]);
    expect(document.snapshotDigest).toBe(await computeResourcePackageSnapshotDigest(document as never, new Map()));
    expect(document.resources.map((resource) => key(resource.template)).sort()).toEqual(
      published100.map(key).sort(),
    );
    for (const resource of document.resources) {
      const template = templateRegistry.resolve(resource.template.id, resource.template.version);
      expect(template, key(resource.template)).toBeDefined();
      const validate = new Ajv2020({ allErrors: true, strict: true }).compile(template!.schema);
      expect(validate(resource.data), `${key(resource.template)}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
  });
});
