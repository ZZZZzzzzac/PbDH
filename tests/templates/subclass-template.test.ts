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
        特性: [{ 特性名称: `${level}能力`, 特性描述: "帮助盟友。" }],
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

  test("stores multiple named features and exposes array authoring actions", () => {
    const data = {
      ...subclassTemplate.defaultData,
      特性: [
        { 特性名称: "激昂演说", 特性原文: "Rousing Speech", 特性描述: "为盟友清除压力。" },
        { 特性名称: "诗人之心", 特性描述: "为掷骰添加加值。" },
      ],
    };
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...data, 描述: "旧字段" }), JSON.stringify(validate.errors)).toBe(false);
    const markup = renderToStaticMarkup(createElement(subclassAuthoring.Editor, { data, onValue: () => undefined }));
    expect(markup).toContain("＋ 新增");
    expect(markup.match(/>特性名称</gu)).toHaveLength(2);
    expect(markup.match(/>特性原文</gu)).toHaveLength(2);
    expect(markup.match(/>特性描述</gu)).toHaveLength(2);
    expect(markup.match(/>清空<\/button>/gu)).toHaveLength(2);
    expect(markup.match(/>删除<\/button>/gu)).toHaveLength(2);
    expect(markup).not.toContain(">特性类型<");
    expect(markup).toMatch(/>特性名称<.*>特性原文<.*>清空<\/button>.*>删除<\/button>.*>特性描述</su);
    expect(markup).toContain("grid-template-columns:minmax(0,1.3fr) minmax(0,1.3fr) auto auto");
    expect(markup).toContain(".subclass-editor .subclass-features{container-type:inline-size;display:flex");
    expect(markup).not.toContain(".subclass-editor section{grid-template-columns");
    expect(subclassTemplate.project(data).searchText).toContain("Rousing Speech");
  });

  test("旧资源缺少特性数组时不会阻断工坊，且旧描述仍不属于模板字段", () => {
    const legacyData = { ...subclassTemplate.defaultData, 特性: undefined, 描述: "旧描述" };
    expect(() => subclassTemplate.project(legacyData as never)).not.toThrow();
    expect(validate(legacyData), JSON.stringify(validate.errors)).toBe(false);
  });
});
