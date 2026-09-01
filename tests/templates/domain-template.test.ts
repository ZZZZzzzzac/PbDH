import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import { domainTemplate, templateRegistry } from "../../packages/templates/src/core/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(domainTemplate.schema as AnySchema);

describe("领域卡 Template 1.0.0", () => {
  test("registers opaque level and recall text", () => {
    expect(templateRegistry.resolve("领域卡", "1.0.0")).toBe(domainTemplate);
    const data = {
      名称: "符文护符", 类型: "领域卡", 领域: "奥术", 等级: "1", 属性: "法术", 回想: "0",
      描述: "花费希望点以减少伤害。", 风味描述: "一件意义深远的小饰品。",
    };
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(domainTemplate.project(data).summary).toBe("奥术 · 1级 · 法术 · 0⚡");
  });

  test("does not validate game meaning in level and recall fields", () => {
    expect(validate({ ...domainTemplate.defaultData, 等级: "1级" })).toBe(true);
    expect(validate({ ...domainTemplate.defaultData, 等级: "未知" })).toBe(true);
    expect(validate({ ...domainTemplate.defaultData, 回想: "由规则包决定" })).toBe(true);
  });
});
