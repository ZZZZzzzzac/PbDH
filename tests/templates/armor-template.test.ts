import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import {
  armorTemplate,
  templateRegistry,
} from "../../packages/templates/src/core/index.ts";
import {
  armorAuthoringLayout,
  buildTemplateSupportManifest,
} from "../../packages/templates/src/frontend/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(armorTemplate.schema as AnySchema);

describe("护甲 Template 1.0.0", () => {
  test("registers the sole supported development capability", () => {
    expect(templateRegistry.resolve("护甲", "1.0.0")).toBe(armorTemplate);
    expect(templateRegistry.resolve("护甲", "0.0.0-dev.1")).toBeUndefined();
    expect(armorTemplate.state).toBe("development");
    expect(armorTemplate.rendererRevision).toBe("armor-card-r1");
  });

  test("covers every schema field in the authoring layout", () => {
    const schemaFields = Object.keys((armorTemplate.schema as { properties: Record<string, unknown> }).properties).sort();
    const authoringFields = armorAuthoringLayout.sections.flatMap((section) => section.fields.map((field) => field.path)).sort();
    expect(authoringFields).toEqual(schemaFields);
    expect(validate(armorTemplate.defaultData), JSON.stringify(validate.errors)).toBe(true);
  });

  test("enters the exact full-support manifest only with authoring and Renderer support", () => {
    expect(buildTemplateSupportManifest({
      templates: templateRegistry.list(),
      authoringLayouts: [armorAuthoringLayout],
      rendererRevisions: new Set(["armor-card-r1"]),
    }).templates).toEqual([{ id: "护甲", version: "1.0.0", rendererRevision: "armor-card-r1" }]);
  });
});
