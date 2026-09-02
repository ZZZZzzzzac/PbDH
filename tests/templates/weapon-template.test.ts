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
  adversaryAuthoring,
  buildTemplateSupportManifest,
  weaponAuthoring,
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
  "contracts/conformance/resource-package/1.0.0/valid/daggerheart-core-primary-weapon.json",
).resources[0]!;
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateData = ajv.compile(weaponTemplate.schema as AnySchema);

describe("武器 Template Core", () => {
  test("resolves only the exact trusted Template version", () => {
    expect(resource.template).toEqual({ id: "武器", version: "1.0.0" });
    expect(templateRegistry.resolve(resource.template.id, resource.template.version)).toBe(
      weaponTemplate,
    );
    expect(templateRegistry.resolve("武器", "0.9.0")).toBeUndefined();
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
      searchText: "阔剑 主武器 敏捷 近战 d8 单手 物理 可靠 你的攻击掷骰+1。 1",
    });
    expect(weaponTemplate.mediaSlots).toEqual([
      { id: "portrait", label: "主图", required: false, accepts: ["image/webp"] },
    ]);
    expect(resource.media).toEqual({});
    expect(weaponTemplate.defaultPresentation).toEqual({
      mode: "text",
      fixedRatio: true,
    });
    expect(weaponTemplate.rendererRevision).toBe("weapon-card-r2");
    expect(weaponTemplate.tabletop.defaultState(resource.data)).toEqual({});
    expect(weaponTemplate.tabletop.commands).toEqual([]);
    expect(weaponTemplate.tabletop.replacements).toEqual([]);
  });
});

describe("武器 Template Authoring 与支持清单", () => {
  test("ships its own authoring editor", () => {
    expect(weaponAuthoring.Editor).toBeTypeOf("function");
  });

  test("stays out of complete frontend support until weapon-card-r2 exists", () => {
    expect(buildTemplateSupportManifest({
      templates: templateRegistry.list(),
      authoringCapabilities: [adversaryAuthoring, weaponAuthoring],
      rendererRevisions: new Set(["enemy-card-r1"]),
    })).toEqual({
      templates: [
        { id: "敌人", version: "1.0.0", rendererRevision: "enemy-card-r1" },
      ],
    });
    expect(buildTemplateSupportManifest({
      templates: templateRegistry.list(),
      authoringCapabilities: [adversaryAuthoring, weaponAuthoring],
      rendererRevisions: new Set(["enemy-card-r1", "weapon-card-r2"]),
    })).toEqual({
      templates: [
        { id: "敌人", version: "1.0.0", rendererRevision: "enemy-card-r1" },
        { id: "武器", version: "1.0.0", rendererRevision: "weapon-card-r2" },
      ],
    });
  });
});
