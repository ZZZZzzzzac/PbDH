import { readFileSync } from "node:fs";
import path from "node:path";

import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import {
  templateRegistry,
  weaponTemplate,
  type WeaponData,
} from "../../packages/templates/src/core/index.ts";
import {
  adversaryAuthoringLayout,
  buildTemplateSupportManifest,
  weaponAuthoringLayout,
} from "../../packages/templates/src/frontend/index.ts";

const root = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}

const resource = readJson<{ resources: Array<{
  template: { id: string; version: string };
  data: WeaponData;
  media: Record<string, string>;
}> }>(
  "contracts/conformance/resource-package/1.0.0-alpha.1/valid/daggerheart-core-primary-weapon.json",
).resources[0]!;
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateData = ajv.compile(weaponTemplate.schema as AnySchema);

describe("武器 Template 1.0.0-alpha.1 Core", () => {
  test("resolves only the exact trusted Template version", () => {
    expect(resource.template).toEqual({ id: "武器", version: "1.0.0-alpha.1" });
    expect(templateRegistry.resolve(resource.template.id, resource.template.version)).toBe(
      weaponTemplate,
    );
    expect(templateRegistry.resolve("武器", "1.0.0-alpha.2")).toBeUndefined();
    expect(templateRegistry.resolve("主武器", "1.0.0-alpha.1")).toBeUndefined();
  });

  test("validates the shared fixture and complete defaults", () => {
    expect(validateData(resource.data), JSON.stringify(validateData.errors)).toBe(true);
    expect(validateData(weaponTemplate.defaultData), JSON.stringify(validateData.errors)).toBe(true);
    expect(Object.keys(weaponTemplate.defaultData)).toEqual(
      Object.keys((weaponTemplate.schema as { properties: object }).properties),
    );
    expect(Object.isFrozen(weaponTemplate)).toBe(true);
    expect(Object.isFrozen(weaponTemplate.defaultData)).toBe(true);
  });

  test("rejects unknown, missing, and non-string fields", () => {
    expect(validateData({ ...resource.data, unexpected: "invalid" })).toBe(false);
    const missing = structuredClone(resource.data) as Partial<WeaponData>;
    delete missing.名称;
    expect(validateData(missing)).toBe(false);
    expect(validateData({ ...resource.data, 位阶: 1 })).toBe(false);
  });

  test("produces deterministic ID, projections, presentation, and stateless tabletop capability", () => {
    expect(weaponTemplate.proposeResourceId(resource.data)).toBe("阔剑");
    expect(weaponTemplate.project(resource.data)).toEqual({
      title: "阔剑",
      summary: "主武器 · 敏捷 · 近战 · d8",
      searchText: "阔剑 主武器 敏捷 近战 d8 单手 物理 可靠：你的攻击掷骰+1。 1",
    });
    expect(weaponTemplate.mediaSlots).toEqual([]);
    expect(resource.media).toEqual({});
    expect(weaponTemplate.defaultPresentation).toEqual({
      width: "90",
      height: "142",
      unit: "mm",
      mode: "text",
      fixedRatio: true,
    });
    expect(weaponTemplate.rendererRevision).toBe("weapon-card-r1");
    expect(weaponTemplate.tabletop.defaultState(resource.data)).toEqual({});
    expect(weaponTemplate.tabletop.commands).toEqual([]);
    expect(weaponTemplate.tabletop.replacements).toEqual([]);
    expect(weaponTemplate.upgradeFrom).toBeNull();
  });
});

describe("武器 Template Authoring 与支持清单", () => {
  test("Authoring Layout covers every editable Schema field", () => {
    const fields = new Set(
      weaponAuthoringLayout.sections.flatMap((section) =>
        section.fields.map((field) => field.path)),
    );
    const schema = weaponTemplate.schema as { properties: Record<string, unknown> };
    expect(fields).toEqual(new Set(Object.keys(schema.properties)));
    expect(JSON.parse(JSON.stringify(weaponAuthoringLayout))).toEqual(weaponAuthoringLayout);
  });

  test("stays out of complete frontend support until weapon-card-r1 exists", () => {
    expect(buildTemplateSupportManifest({
      templates: templateRegistry.list(),
      authoringLayouts: [adversaryAuthoringLayout, weaponAuthoringLayout],
      rendererRevisions: new Set(["enemy-card-r1"]),
    })).toEqual({
      templates: [
        { id: "敌人", version: "1.0.0-alpha.1", rendererRevision: "enemy-card-r1" },
      ],
    });
    expect(buildTemplateSupportManifest({
      templates: templateRegistry.list(),
      authoringLayouts: [adversaryAuthoringLayout, weaponAuthoringLayout],
      rendererRevisions: new Set(["enemy-card-r1", "weapon-card-r1"]),
    })).toEqual({
      templates: [
        { id: "敌人", version: "1.0.0-alpha.1", rendererRevision: "enemy-card-r1" },
        { id: "武器", version: "1.0.0-alpha.1", rendererRevision: "weapon-card-r1" },
      ],
    });
  });
});
