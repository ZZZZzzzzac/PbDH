import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import {
  temporarySubclassTemplate,
  templateRegistry,
} from "../../packages/templates/src/core/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(temporarySubclassTemplate.schema as AnySchema);

describe("子职业临时 Template 0.0.0-dev.1", () => {
  test("registers one resource per advancement level", () => {
    expect(templateRegistry.resolve("子职业", "0.0.0-dev.1")).toBe(temporarySubclassTemplate);
    for (const level of ["基础", "进阶", "精通"] as const) {
      const data = {
        ...temporarySubclassTemplate.defaultData,
        名称: "吟游诗人之言",
        主职: "吟游诗人",
        等级: level,
        描述: `${level}能力`,
      };
      expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
      expect(temporarySubclassTemplate.proposeResourceId(data)).toBe(`吟游诗人:吟游诗人之言:${level}`);
    }
  });

  test("rejects third-party advancement names", () => {
    expect(validate({ ...temporarySubclassTemplate.defaultData, 等级: "基石" })).toBe(false);
  });
});
