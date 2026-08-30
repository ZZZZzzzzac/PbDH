import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import { communityTemplate, templateRegistry } from "../../packages/templates/src/core/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(communityTemplate.schema as AnySchema);

describe("社群 Template 1.0.0", () => {
  test("registers a named gameplay feature separately from flavor fields", () => {
    expect(templateRegistry.resolve("社群", "1.0.0")).toBe(communityTemplate);
    const data = {
      名称: "高城之民", 简介: "来自上流社会。", 性格: "亲切、坦率、沉着。",
      特性: { 名称: "高人一等", 描述: "与贵族交际时具有优势。" },
    };
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(communityTemplate.project(data).searchText).toContain("高人一等");
  });

  test("rejects a flattened feature string", () => {
    expect(validate({ ...communityTemplate.defaultData, 特性: "高人一等：具有优势。" })).toBe(false);
  });
});
