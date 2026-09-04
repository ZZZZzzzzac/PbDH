import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import {
  armorTemplate,
  templateRegistry,
} from "../../packages/templates/src/core/index.ts";
import {
  armorAuthoring,
  buildTemplateSupportManifest,
} from "../../packages/templates/src/frontend/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(armorTemplate.schema as AnySchema);

describe("护甲 Template 1.0.0", () => {
  test("registers the sole supported published capability", () => {
    expect(templateRegistry.resolve("护甲", "1.0.0")).toBe(armorTemplate);
    expect(templateRegistry.resolve("护甲", "0.9.0")).toBeUndefined();
    expect(armorTemplate.state).toBe("published");
    expect(armorTemplate.rendererRevision).toBe("armor-card-r1");
  });

  test("ships a Template-owned authoring editor for valid default data", () => {
    expect(armorAuthoring.Editor).toBeTypeOf("function");
    expect(validate(armorTemplate.defaultData), JSON.stringify(validate.errors)).toBe(true);
  });

  test("enters the exact full-support manifest only with authoring and Renderer support", () => {
    expect(buildTemplateSupportManifest({
      templates: templateRegistry.list(),
      authoringCapabilities: [armorAuthoring],
      rendererRevisions: new Set(["armor-card-r1"]),
    }).templates).toEqual([{ id: "护甲", version: "1.0.0", rendererRevision: "armor-card-r1" }]);
  });
});
