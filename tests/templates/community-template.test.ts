import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import { temporaryCommunityTemplate, templateRegistry } from "../../packages/templates/src/core/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(temporaryCommunityTemplate.schema as AnySchema);

describe("社群临时 Template 0.0.0-dev.1", () => {
  test("registers a named gameplay feature separately from flavor fields", () => {
    expect(templateRegistry.resolve("社群", "0.0.0-dev.1")).toBe(temporaryCommunityTemplate);
    const data = {
      名称: "高城之民", 简介: "来自上流社会。", 性格: "亲切、坦率、沉着。",
      特性: { 名称: "高人一等", 描述: "与贵族交际时具有优势。" },
    };
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(temporaryCommunityTemplate.project(data).searchText).toContain("高人一等");
  });

  test("rejects a flattened feature string", () => {
    expect(validate({ ...temporaryCommunityTemplate.defaultData, 特性: "高人一等：具有优势。" })).toBe(false);
  });
});
