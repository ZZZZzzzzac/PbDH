import { readFileSync } from "node:fs";
import path from "node:path";

import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { domainTemplate, templateRegistry } from "../../packages/templates/src/core/index.ts";
import { domainAuthoring } from "../../packages/templates/src/frontend/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(domainTemplate.schema as AnySchema);
const root = process.cwd();

describe("领域卡 Template 1.0.0", () => {
  test("registers opaque level and recall text", () => {
    expect(templateRegistry.resolve("领域卡", "1.0.0")).toBe(domainTemplate);
    const data = {
      名称: "符文护符", 类型: "领域卡", 领域: "奥术", 等级: "1", 属性: "法术", 回想: "0",
      特性描述: "花费希望点以减少伤害。", 简介: "一件意义深远的小饰品。",
    };
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(domainTemplate.project(data).summary).toBe("奥术 · 1级 · 法术 · 0");
    expect(domainTemplate.project({ ...data, 回想: "0⚡" }).summary).toBe("奥术 · 1级 · 法术 · 0");
  });

  test("does not validate game meaning in level and recall fields", () => {
    expect(validate({ ...domainTemplate.defaultData, 等级: "1级" })).toBe(true);
    expect(validate({ ...domainTemplate.defaultData, 等级: "未知" })).toBe(true);
    expect(validate({ ...domainTemplate.defaultData, 回想: "由规则包决定" })).toBe(true);
  });

  test("lays out authoring basics in three columns and rules in four columns", () => {
    const markup = renderToStaticMarkup(createElement(domainAuthoring.Editor, { data: domainTemplate.defaultData, onValue: () => undefined }));
    const source = readFileSync(path.join(root, "packages/templates/src/frontend/domain/1.0.0/authoring-editor.tsx"), "utf8");
    expect(markup).toContain("domain-editor-basics");
    expect(markup).toContain("domain-editor-rules");
    expect(markup).toContain(".domain-editor-basics>*{grid-column:span 4}");
    expect(markup).toContain(".domain-editor-rules>*{grid-column:span 3}");
    expect(markup.indexOf(">名称<")).toBeLessThan(markup.indexOf(">原文<"));
    expect(markup.indexOf(">原文<")).toBeLessThan(markup.indexOf(">类型<"));
    expect(markup.indexOf(">领域<")).toBeLessThan(markup.indexOf(">等级<"));
    expect(markup.indexOf(">等级<")).toBeLessThan(markup.indexOf(">属性<"));
    expect(markup.indexOf(">属性<")).toBeLessThan(markup.indexOf(">回想<"));
    expect(markup).toContain("展开属性选项");
    expect(source).toContain('options={["法术", "能力", "术典"]}');
  });
});
