import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { freeTemplate, templateRegistry } from "../../packages/templates/src/core/index.ts";
import {
  buildTemplateSupportManifest,
  freeAuthoring,
  freeRendererRevision,
} from "../../packages/templates/src/frontend/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(freeTemplate.schema as AnySchema);
const data = {
  名称: "复仇誓言",
  类型: "专属",
  简介: "你不会忘记那一天。",
  内容: [
    { 名称: "触发条件", 描述: "当你对仇敌造成伤害时" },
    { 名称: "效果", 描述: "标记1点压力，伤害+2。" },
  ],
};

describe("自由 Template 1.0.0", () => {
  test("registers a strict name-and-content-block model", () => {
    expect(templateRegistry.resolve("自由", "1.0.0")).toBe(freeTemplate);
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...data, raw: { hidden: true } })).toBe(false);
    expect(validate({ ...data, 类型: "自定义类型" })).toBe(true);
    expect(validate({ ...data, 简介: undefined })).toBe(false);
    expect(validate({ ...data, 内容: [{ 名称: "效果", 描述: "文本", extra: "invalid" }] })).toBe(false);
    expect(freeTemplate.project(data).searchText).toContain("标记1点压力");
  });

  test("has complete authoring and renderer support", () => {
    expect(freeAuthoring.Editor).toBeTypeOf("function");
    expect(buildTemplateSupportManifest({
      templates: templateRegistry.list(),
      authoringCapabilities: [freeAuthoring],
      rendererRevisions: new Set(["free-card-r1"]),
    }).templates).toEqual([{ id: "自由", version: "1.0.0", rendererRevision: "free-card-r1" }]);
    expect(renderToStaticMarkup(freeRendererRevision.render({
      data,
      presentation: freeTemplate.defaultPresentation,
      assets: {},
      state: {},
    }))).toContain("复仇誓言");
  });

  test("lays out basics and content blocks like other structured feature editors", () => {
    const markup = renderToStaticMarkup(createElement(freeAuthoring.Editor, {
      data: { ...data, 原文: "Vow of Vengeance", 内容: [{ 名称: "效果", 原文: "Effect", 描述: "标记1点压力。" }] },
      onValue: () => undefined,
    }));
    expect(markup).toContain("free-basics");
    expect(markup).toContain("free-blocks");
    expect(markup).toContain("free-editor-block");
    expect(markup).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
    expect(markup).toContain("grid-template-columns:minmax(0,1.3fr) minmax(0,1.3fr) auto auto");
    expect(markup).toContain("@container(max-width:360px)");
    expect(markup).toContain("free-block-description");
    expect(markup.indexOf(">名称<")).toBeLessThan(markup.indexOf(">原文<"));
    expect(markup.indexOf(">原文<")).toBeLessThan(markup.indexOf(">类型<"));
    expect(markup.indexOf(">清空<")).toBeLessThan(markup.indexOf(">删除<"));
    expect(markup.indexOf(">删除<")).toBeLessThan(markup.lastIndexOf(">描述<"));
    expect(markup).not.toContain(">标题<");
    expect(markup).not.toContain(">正文<");
  });
});
