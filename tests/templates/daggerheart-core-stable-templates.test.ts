import { readFileSync } from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import {
  ancestryTemplate,
  communityTemplate,
  domainTemplate,
  itemTemplate,
  professionTemplate,
  subclassTemplate,
  templateRegistry,
} from "../../packages/templates/src/core/index.ts";
import {
  ancestryAuthoringLayout,
  ancestryRendererFor,
  communityAuthoringLayout,
  communityRendererFor,
  domainAuthoringLayout,
  domainRendererFor,
  itemAuthoringLayout,
  itemRendererFor,
  professionAuthoringLayout,
  professionRendererFor,
  subclassAuthoringLayout,
  subclassRendererFor,
} from "../../packages/templates/src/frontend/index.ts";

const cases = [
  [ancestryTemplate, ancestryAuthoringLayout, ancestryRendererFor],
  [communityTemplate, communityAuthoringLayout, communityRendererFor],
  [professionTemplate, professionAuthoringLayout, professionRendererFor],
  [subclassTemplate, subclassAuthoringLayout, subclassRendererFor],
  [itemTemplate, itemAuthoringLayout, itemRendererFor],
  [domainTemplate, domainAuthoringLayout, domainRendererFor],
] as const;

describe("Daggerheart Core 剩余稳定 Templates", () => {
  test.each(cases)("%s@1.0.0 保留旧版本读取并提供完整作者与渲染能力", (template, layout, rendererFor) => {
    expect(templateRegistry.resolve(template.id, "1.0.0")).toBe(template);
    expect(templateRegistry.resolve(template.id, "0.0.0-dev.1")).toBeDefined();
    expect(template.upgradeFrom?.version).toBe("0.0.0-dev.1");
    expect(layout.templateId).toBe(template.id);
    expect(layout.templateVersion).toBe(template.version);

    const schemaFields = Object.keys((template.schema as { properties: Record<string, unknown> }).properties).sort();
    const authoringFields = [...new Set(layout.sections.flatMap((section) => [
      ...section.fields.map((field) => field.path),
      ...(section.repeats ?? []).map((repeat) => repeat.path),
    ]).map((path) => path.split(".")[0]!))].sort();
    expect(authoringFields).toEqual(schemaFields);

    const upgraded = template.upgradeFrom!.upgrade(template.defaultData);
    expect(upgraded).toEqual(template.defaultData);
    expect(upgraded).not.toBe(template.defaultData);
    expect(rendererFor("1.0.0").revision).toBe(template.rendererRevision);
    expect(() => rendererFor("0.0.0-dev.1")).toThrow();
  });

  test("共享 conformance fixture 覆盖六类稳定 Schema", () => {
    const fixture = JSON.parse(readFileSync(path.resolve(
      "contracts/conformance/resource-package/1.0.0/valid/daggerheart-core-reference-types.json",
    ), "utf8")) as { resources: Array<{ template: { id: string; version: string }; data: unknown }> };
    expect(fixture.resources).toHaveLength(cases.length);
    for (const resource of fixture.resources) {
      const template = templateRegistry.resolve(resource.template.id, resource.template.version);
      expect(template).toBeDefined();
      const validate = new Ajv2020({ allErrors: true, strict: true }).compile(template!.schema);
      expect(validate(resource.data), JSON.stringify(validate.errors)).toBe(true);
      expect(validate({ ...(resource.data as Record<string, unknown>), unexpected: "x" })).toBe(false);
    }
  });
});
