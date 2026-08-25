import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import {
  temporaryAncestryTemplate,
  templateRegistry,
} from "../../packages/templates/src/core/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(temporaryAncestryTemplate.schema as AnySchema);

describe("种族临时 Template 0.0.0-dev.1", () => {
  test("registers up to two structured features", () => {
    expect(templateRegistry.resolve("种族", "0.0.0-dev.1")).toBe(temporaryAncestryTemplate);
    const data = {
      名称: "龙人", 简介: "拥有类人形态的龙类。",
      特性: [{ 名称: "鳞片保护", 描述: "受到严重伤害时减少生命损失。" }, { 名称: "元素吐息", 描述: "喷吐元素能量。" }],
    };
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(temporaryAncestryTemplate.project(data).searchText).toContain("元素吐息");
  });

  test("rejects a third feature and unstructured strings", () => {
    const feature = { 名称: "特性", 描述: "效果" };
    expect(validate({ ...temporaryAncestryTemplate.defaultData, 特性: [feature, feature, feature] })).toBe(false);
    expect(validate({ ...temporaryAncestryTemplate.defaultData, 特性: ["特性：效果"] })).toBe(false);
  });
});
