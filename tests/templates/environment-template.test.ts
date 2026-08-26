import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import { temporaryEnvironmentTemplate, templateRegistry } from "../../packages/templates/src/core/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(temporaryEnvironmentTemplate.schema as AnySchema);

describe("环境临时 Template 0.0.0-dev.1", () => {
  test("registers environment features without fear metadata", () => {
    expect(templateRegistry.resolve("环境", "0.0.0-dev.1")).toBe(temporaryEnvironmentTemplate);
    const data = {
      ...temporaryEnvironmentTemplate.defaultData,
      名称: "燃烧的图书馆", 位阶: "2", 种类: "险境", 难度: "14",
      特性: [{ 名称: "坍塌", 类型: "动作", 描述: "书架轰然倒下。", 引导问题: "谁被困住了？" }],
    };
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
  });

  test("rejects discarded fear fields", () => {
    expect(validate({
      ...temporaryEnvironmentTemplate.defaultData,
      特性: [{ 名称: "坍塌", 类型: "动作", 描述: "效果", 引导问题: "问题", 恐惧: true }],
    })).toBe(false);
  });
});
