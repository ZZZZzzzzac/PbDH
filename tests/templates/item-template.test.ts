import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import {
  temporaryItemTemplate,
  templateRegistry,
} from "../../packages/templates/src/core/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(temporaryItemTemplate.schema as AnySchema);

describe("物品临时 Template 0.0.0-dev.1", () => {
  test("registers only ordinary and consumable item discriminators", () => {
    expect(templateRegistry.resolve("物品", "0.0.0-dev.1")).toBe(temporaryItemTemplate);
    expect(validate({ ...temporaryItemTemplate.defaultData, 类型: "物品" })).toBe(true);
    expect(validate({ ...temporaryItemTemplate.defaultData, 类型: "消耗品" })).toBe(true);
    expect(validate({ ...temporaryItemTemplate.defaultData, 类型: "战利品" })).toBe(false);
  });

  test("keeps gameplay and flavor descriptions separate", () => {
    const data = {
      ...temporaryItemTemplate.defaultData,
      名称: "风笛哨",
      掷骰: "02",
      描述: "声音在一英里外都能听到。",
      风味描述: "手工制作的独特哨子。",
    };
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(temporaryItemTemplate.project(data).searchText).toContain("手工制作的独特哨子。");
  });
});
