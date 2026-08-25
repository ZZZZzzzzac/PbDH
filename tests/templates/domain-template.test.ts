import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import { temporaryDomainTemplate, templateRegistry } from "../../packages/templates/src/core/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(temporaryDomainTemplate.schema as AnySchema);

describe("领域卡临时 Template 0.0.0-dev.1", () => {
  test("registers semantic level and recall counts", () => {
    expect(templateRegistry.resolve("领域卡", "0.0.0-dev.1")).toBe(temporaryDomainTemplate);
    const data = {
      名称: "符文护符", 领域: "奥术", 等级: "1", 属性: "法术", 回想: "0",
      描述: "花费希望点以减少伤害。", 风味描述: "一件意义深远的小饰品。",
    };
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(temporaryDomainTemplate.project(data).summary).toBe("奥术 · 1级 · 法术 · 0⚡");
  });

  test("rejects display suffixes in semantic fields", () => {
    expect(validate({ ...temporaryDomainTemplate.defaultData, 等级: "1级" })).toBe(false);
    expect(validate({ ...temporaryDomainTemplate.defaultData, 回想: "0⚡" })).toBe(false);
  });
});
