import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
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
  内容: [
    { 标题: "简介", 正文: "你不会忘记那一天。" },
    { 标题: "触发条件", 正文: "当你对仇敌造成伤害时" },
    { 标题: "效果", 正文: "标记1点压力，伤害+2。" },
  ],
};

describe("自由 Template 1.0.0", () => {
  test("registers a strict name-and-content-block model", () => {
    expect(templateRegistry.resolve("自由", "1.0.0")).toBe(freeTemplate);
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...data, raw: { hidden: true } })).toBe(false);
    expect(validate({ ...data, 类型: "自定义类型" })).toBe(true);
    expect(validate({ ...data, 简介: "不应预设" })).toBe(false);
    expect(validate({ ...data, 内容: [{ 标题: "效果", 正文: "文本", extra: "invalid" }] })).toBe(false);
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
});
