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
  resolveTemplateFrontend,
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

describe("自由 Template 1.0.2", () => {
  const current = templateRegistry.resolve("自由", "1.0.2")!;
  const validateCurrent = ajv.compile(current.schema as AnySchema);
  const frontend = resolveTemplateFrontend("自由", "1.0.2")!;
  const beastform = {
    名称: "迅捷斥候",
    原文: "AGILE SCOUT",
    类型: "野兽形态",
    简介: "狐狸、老鼠、黄鼠狼等",
    位阶: "1",
    属性: "敏捷 +1",
    闪避: "+2",
    武器: "近战 敏捷 d4 物理",
    优势: "欺骗、定位、潜行",
    圣道骑士: "",
    内容: [{ 名称: "敏捷", 原文: "Agile", 描述: "你的移动悄无声息。" }],
  };

  test("accepts arbitrary string fields while keeping features structured", () => {
    expect(validateCurrent(beastform), JSON.stringify(validateCurrent.errors)).toBe(true);
    expect(validateCurrent({ ...beastform, 位阶: { hidden: true } })).toBe(false);
    expect(validateCurrent({ ...beastform, 内容: [{ 名称: "敏捷", 描述: "文本", extra: "invalid" }] })).toBe(false);
    expect(current.project(beastform).searchText).toContain("位阶 1");
    expect(current.project(beastform).searchText).toContain("近战 敏捷 d4 物理");
    expect(templateRegistry.upgradeData("自由", "1.0.1", "1.0.2", beastform)).toEqual(beastform);
  });

  test("keeps the published 1.0.1 renderer behavior unchanged", () => {
    const legacy = templateRegistry.resolve("自由", "1.0.1")!;
    const legacyFrontend = resolveTemplateFrontend("自由", "1.0.1")!;
    const markup = renderToStaticMarkup(legacyFrontend.rendererRevision.render({
      data: beastform,
      presentation: legacy.defaultPresentation,
      assets: {},
      state: {},
    }));
    expect(markup).not.toContain("圣道骑士");
    expect(legacyFrontend.rendererRevision.revision).toBe("free-card-r4");
  });

  test("separates free fields from free features in authoring and rendering", () => {
    const editorMarkup = renderToStaticMarkup(createElement(frontend.authoring.Editor, {
      data: beastform,
      onValue: () => undefined,
      onData: () => undefined,
    }));
    expect(editorMarkup).toContain("自由字段");
    expect(editorMarkup).toContain("自由特性");
    expect(editorMarkup).toContain("字段名");
    expect(editorMarkup).toContain("字段值");
    expect(editorMarkup).toContain("free-field-row");
    expect(editorMarkup).toContain("free-feature-row");
    expect(editorMarkup.indexOf("自由字段")).toBeLessThan(editorMarkup.indexOf("自由特性"));

    const rendererMarkup = renderToStaticMarkup(frontend.rendererRevision.render({
      data: beastform,
      presentation: current.defaultPresentation,
      assets: {},
      state: {},
    }));
    expect(rendererMarkup).toContain("free-fields");
    expect(rendererMarkup).toContain("free-field-tag");
    expect(rendererMarkup).toContain("free-field-tag is-label");
    expect(rendererMarkup).toContain("<b>圣道骑士</b></span>");
    expect(rendererMarkup).not.toContain("<dl");
    expect(rendererMarkup).toContain("位阶");
    expect(rendererMarkup).toContain("近战 敏捷 d4 物理");
    expect(rendererMarkup).toContain("敏捷");
  });
});
