import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  subclassAuthoring,
} from "../../packages/templates/src/frontend/index.ts";
import {
  subclassTemplate,
  templateRegistry,
} from "../../packages/templates/src/core/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(subclassTemplate.schema as AnySchema);

describe("子职业 Template 1.0.0", () => {
  test("registers one resource per advancement level", () => {
    expect(templateRegistry.resolve("子职业", "1.0.0")).toBe(subclassTemplate);
    for (const level of ["基础", "进阶", "精通"] as const) {
      const data = {
        ...subclassTemplate.defaultData,
        名称: "吟游诗人之言",
        主职: "吟游诗人",
        等级: level,
        描述: `${level}能力`,
      };
      expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
      expect(subclassTemplate.proposeResourceId(data)).toBe(`吟游诗人:吟游诗人之言:${level}`);
    }
  });

  test("does not validate game meaning in advancement names", () => {
    expect(validate({ ...subclassTemplate.defaultData, 等级: "基石" })).toBe(true);
    expect(validate({ ...subclassTemplate.defaultData, 等级: "任意阶段" })).toBe(true);
    expect(subclassTemplate.defaultData.等级).toBe("");
    expect(renderToStaticMarkup(createElement(subclassAuthoring.Editor, { data: subclassTemplate.defaultData, onValue: () => undefined })))
      .toContain("展开等级选项");
  });
});
