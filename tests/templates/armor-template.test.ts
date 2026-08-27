import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import {
  armorTemplate,
  temporaryArmorTemplate,
  templateRegistry,
} from "../../packages/templates/src/core/index.ts";
import {
  armorAuthoringLayout,
  buildTemplateSupportManifest,
} from "../../packages/templates/src/frontend/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(temporaryArmorTemplate.schema as AnySchema);

describe("护甲临时 Template 0.0.0-dev.1", () => {
  test("registers an exact development-only schema", () => {
    expect(templateRegistry.resolve("护甲", "0.0.0-dev.1")).toBe(temporaryArmorTemplate);
    expect(temporaryArmorTemplate.state).toBe("development");
    expect(temporaryArmorTemplate.rendererRevision).toBe("temporary-armor-r0");
  });

  test("separates gameplay and flavor descriptions", () => {
    const data = {
      ...temporaryArmorTemplate.defaultData,
      名称: "填充布甲",
      护甲值: "3",
      重度伤害阈值: "5",
      严重伤害阈值: "11",
      描述: "灵活：闪避值+1。",
      风味描述: "层叠缝制的轻便布甲。",
      位阶: "1",
    };
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(temporaryArmorTemplate.project(data).searchText).toContain("层叠缝制的轻便布甲。");
  });

  test("rejects unknown and non-string fields", () => {
    expect(validate({ ...temporaryArmorTemplate.defaultData, unexpected: "x" })).toBe(false);
    expect(validate({ ...temporaryArmorTemplate.defaultData, 护甲值: 3 })).toBe(false);
  });
});

describe("护甲 Template 1.0.0", () => {
  test("registers a complete development capability without replacing the legacy reader", () => {
    expect(templateRegistry.resolve("护甲", "1.0.0")).toBe(armorTemplate);
    expect(templateRegistry.resolve("护甲", "0.0.0-dev.1")).toBe(temporaryArmorTemplate);
    expect(armorTemplate.state).toBe("development");
    expect(armorTemplate.rendererRevision).toBe("armor-card-r1");
    expect(armorTemplate.upgradeFrom?.version).toBe("0.0.0-dev.1");
  });

  test("covers every schema field in the authoring layout and upgrades by candidate copy", () => {
    const schemaFields = Object.keys((armorTemplate.schema as { properties: Record<string, unknown> }).properties).sort();
    const authoringFields = armorAuthoringLayout.sections.flatMap((section) => section.fields.map((field) => field.path)).sort();
    expect(authoringFields).toEqual(schemaFields);

    const legacy = { ...temporaryArmorTemplate.defaultData, 名称: "填充布甲", 护甲值: "3" };
    const upgraded = armorTemplate.upgradeFrom!.upgrade(legacy);
    expect(upgraded).toEqual(legacy);
    expect(upgraded).not.toBe(legacy);
  });

  test("enters the exact full-support manifest only with authoring and Renderer support", () => {
    expect(buildTemplateSupportManifest({
      templates: templateRegistry.list(),
      authoringLayouts: [armorAuthoringLayout],
      rendererRevisions: new Set(["armor-card-r1"]),
    }).templates).toEqual([{ id: "护甲", version: "1.0.0", rendererRevision: "armor-card-r1" }]);
  });
});
