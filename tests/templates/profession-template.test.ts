import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import {
  temporaryProfessionTemplate,
  templateRegistry,
} from "../../packages/templates/src/core/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(temporaryProfessionTemplate.schema as AnySchema);

describe("职业临时 Template 0.0.0-dev.1", () => {
  test("registers structured domains, attributes, and questions", () => {
    expect(templateRegistry.resolve("职业", "0.0.0-dev.1")).toBe(temporaryProfessionTemplate);
    const data = {
      ...temporaryProfessionTemplate.defaultData,
      名称: "吟游诗人",
      领域: ["优雅", "典籍"],
      推荐初始属性: { 敏捷: "+0", 风度: "+2" },
      背景问题: ["谁教会了你自信？"],
      关系问题: ["我们为何成为朋友？"],
    };
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(temporaryProfessionTemplate.project(data).searchText).toContain("风度 +2");
  });

  test("rejects delimiter strings in structured fields", () => {
    expect(validate({ ...temporaryProfessionTemplate.defaultData, 领域: "优雅+典籍" })).toBe(false);
    expect(validate({ ...temporaryProfessionTemplate.defaultData, 背景问题: "问题一" })).toBe(false);
  });
});
