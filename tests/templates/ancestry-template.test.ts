import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import {
  ancestryTemplate,
  templateRegistry,
} from "../../packages/templates/src/core/index.ts";
import {
  ancestryAuthoring,
  ancestryFrameHeight,
  ancestryRendererRevision,
  ancestryRendererStyles,
} from "../../packages/templates/src/frontend/index.ts";

const root = process.cwd();
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(ancestryTemplate.schema as AnySchema);

describe("种族 Template 1.0.0", () => {
  test("fixed frame height wins over a stale fluid measurement", () => {
    expect(ancestryFrameHeight(false, 568)).toBeCloseTo(99.4);
    expect(ancestryFrameHeight(true, 568)).toBe(88);
  });

  test("registers up to two structured features", () => {
    expect(templateRegistry.resolve("种族", "1.0.0")).toBe(ancestryTemplate);
    const data = {
      名称: "龙人", 原文: "Drakona", 类型: "种族", 简介: "拥有类人形态的龙类。",
      特性: [{ 特性名称: "鳞片保护", 特性原文: "Scales", 特性描述: "受到严重伤害时减少生命损失。" }, { 特性名称: "元素吐息", 特性原文: "Elemental Breath", 特性描述: "喷吐元素能量。" }],
    };
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(ancestryTemplate.project(data).searchText).toContain("元素吐息");
    expect(ancestryTemplate.project(data).searchText).toContain("Elemental Breath");
  });

  test("rejects a third feature and unstructured strings", () => {
    const feature = { 特性名称: "特性", 特性原文: "Feature", 特性描述: "效果" };
    expect(validate({ ...ancestryTemplate.defaultData, 特性: [feature, feature, feature] })).toBe(false);
    expect(validate({ ...ancestryTemplate.defaultData, 特性: ["特性：效果"] })).toBe(false);
  });

  test("treats ancestry and feature English titles as optional fields", () => {
    expect(validate({
      名称: "龙人",
      类型: "种族",
      简介: "拥有类人形态的龙类。",
      特性: [{ 特性名称: "鳞片保护", 特性描述: "受到严重伤害时减少生命损失。" }],
    }), JSON.stringify(validate.errors)).toBe(true);
  });

  test("owns an adversary-aligned authoring surface for ancestry fields", () => {
    const markup = renderToStaticMarkup(createElement(ancestryAuthoring.Editor, {
      data: {
        名称: "龙人", 原文: "Drakona", 类型: "种族", 简介: "拥有类人形态的龙类。",
        特性: [{ 特性名称: "鳞片保护", 特性原文: "Scales", 特性描述: "受到严重伤害时减少生命损失。" }, { 特性名称: "元素吐息", 特性原文: "Elemental Breath", 特性描述: "喷吐元素能量。" }],
      },
      onValue: () => undefined,
    }));
    const source = readFileSync(path.join(root, "packages/templates/src/frontend/ancestry/1.0.0/authoring-editor.tsx"), "utf8");

    expect(markup).toContain("ancestry-editor-group ancestry-identity");
    expect(markup).toContain("ancestry-editor-group ancestry-features");
    expect(markup).not.toContain("ancestry-introduction");
    expect(markup).not.toContain('data-authoring-section="introduction"');
    expect(markup.indexOf("简介")).toBeLessThan(markup.indexOf("种族特性"));
    expect(markup).toContain("ancestry-feature-action");
    expect(markup).toContain("Drakona");
    expect(markup).toContain("Elemental Breath");
    expect(markup.match(/<article class="ancestry-feature"/gu)).toHaveLength(2);
    expect(source).toContain(">清空</button>");
    expect(source).not.toContain("＋ 新增");
    expect(source).not.toContain(">删除</button>");
    expect(source).not.toContain("确认删除");
    expect(source).not.toContain("standardEditorStyles");
  });

  test("always presents two fixed ancestry feature slots even for legacy empty data", () => {
    const markup = renderToStaticMarkup(createElement(ancestryAuthoring.Editor, {
      data: structuredClone(ancestryTemplate.defaultData) as Record<string, unknown>,
      onValue: () => undefined,
    }));

    expect(markup.match(/<article class="ancestry-feature"/gu)).toHaveLength(2);
    expect(markup).toContain("特性1");
    expect(markup).toContain("特性2");
    expect(markup).not.toContain("<h4>");
  });

  test("renders text and mixed-media cards with ancestry-owned adversary-aligned DOM and colors", () => {
    const data = {
      名称: "龙人", 原文: "Drakona", 类型: "种族", 简介: "拥有类人形态的龙类。",
      特性: [{ 特性名称: "鳞片保护", 特性原文: "Scales", 特性描述: "受到严重伤害时减少生命损失。" }, { 特性名称: "元素吐息", 特性原文: "Elemental Breath", 特性描述: "喷吐元素能量。" }],
    };
    const base = {
      data,
      state: {},
      assets: { portrait: "blob:dragonborn" },
      attribution: { artworkCredit: "Anthony Jones", sourceLabel: "DH Core 061/270" },
      presentation: { mode: "text" as const, fixedRatio: true },
    };
    const textMarkup = renderToStaticMarkup(ancestryRendererRevision.render(base));
    const splitMarkup = renderToStaticMarkup(ancestryRendererRevision.render({
      ...base,
      presentation: { mode: "split", fixedRatio: true },
    }));
    const emptyEnglishMarkup = renderToStaticMarkup(ancestryRendererRevision.render({
      ...base,
      data: {
        ...data,
        原文: "   ",
        特性: data.特性.map((feature) => ({ ...feature, 特性原文: "   " })),
      },
    }));

    expect(textMarkup).toContain("ancestry-card is-text");
    expect(textMarkup).toContain("data-renderer-revision=\"ancestry-card-r1\"");
    expect(textMarkup).not.toContain("ancestry-feature-heading");
    expect(textMarkup).toContain("鳞片保护");
    expect(textMarkup).toContain("Drakona");
    expect(textMarkup).toContain("Elemental Breath");
    expect(textMarkup).toContain("ancestry-original-title");
    expect(textMarkup).toContain('data-card-footer="true"');
    expect(textMarkup).toContain("Anthony Jones");
    expect(textMarkup).toContain("DH Core 061/270");
    expect(textMarkup).toContain('<div class="ancestry-title-row"><h1 data-single-line-text-fit="true">龙人</h1><div class="ancestry-kicker">种族</div></div>');
    expect(textMarkup).not.toContain("reference-card");
    expect(splitMarkup).toContain("ancestry-card is-split");
    expect(splitMarkup).toContain("blob:dragonborn");
    expect(splitMarkup).toContain('data-card-footer="true"');
    const imageMarkup = renderToStaticMarkup(ancestryRendererRevision.render({ ...base, presentation: { mode: "image", fixedRatio: true } }));
    expect(imageMarkup).not.toContain('data-card-footer="true"');
    expect(ancestryRendererStyles).toContain("--bone: #eee4d0");
    expect(ancestryRendererStyles).toContain("--oxblood: #641f1d");
    expect(ancestryRendererStyles).toContain("border-bottom: 3px solid #b88a57");
    expect(ancestryRendererStyles).toContain("height: 100%; border-bottom: 0;");
    expect(ancestryRendererStyles).toContain(".ancestry-card.is-text .ancestry-art::after { display: none; }");
    expect(ancestryRendererStyles).toContain(".ancestry-card.is-split .ancestry-art img { height: 100%; }");
    expect(ancestryRendererStyles).toContain("#1d131052 38%, #1d1310c7 68%, #1d1310f5 100%");
    expect(ancestryRendererStyles).toContain(".ancestry-card.is-split .ancestry-heading { text-shadow:");
    expect(ancestryRendererStyles).toContain(".ancestry-card.is-text { --ancestry-media-height: 0px; }");
    expect(emptyEnglishMarkup).toContain('<header class="ancestry-heading">');
    expect(emptyEnglishMarkup).not.toContain("ancestry-original-title");
    expect(emptyEnglishMarkup).not.toContain("<small>");
    expect(ancestryRendererStyles).toContain("align-items: flex-end");
    expect(ancestryRendererStyles).toContain(".ancestry-title-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end;");
    expect(ancestryRendererStyles).not.toContain(".ancestry-feature-heading");
    expect(ancestryRendererStyles).toContain('font: 800 var(--ancestry-title-font-size, 32px)/1 "Noto Sans SC"');
    expect(ancestryRendererStyles).toContain('font: 800 19px/1.25 "Noto Sans SC"');
    expect(ancestryRendererStyles).toContain('font: 450 var(--ancestry-feature-font-size, 15px)/1.45 "Noto Sans SC"');
    expect(textMarkup).toContain('data-text-fit-scope="ancestry-features"');
    expect(ancestryRendererStyles).toContain(".ancestry-summary { margin: 8px 0 0");
    expect(ancestryRendererStyles).toContain('font: italic 500 14px/1.4 "Noto Sans SC"');
    expect(ancestryRendererStyles).toContain(".ancestry-feature { flex: none; display: flex; flex-direction: column;");
    expect(ancestryRendererStyles).toContain(".ancestry-feature h2 { margin: 0; min-width: 0; display: flex; align-items: baseline;");
    expect(ancestryRendererStyles).toContain(".ancestry-feature h2 small { display: inline; margin: 0;");
    expect(ancestryRendererStyles).not.toContain("grid-template-columns: 112px minmax(0, 1fr)");
    expect(ancestryRendererStyles).not.toContain(".ancestry-feature { min-height:");
  });

  test("lets a long introduction grow the heading and consume fixed-card body space", () => {
    expect(ancestryRendererStyles).toContain(".ancestry-art::before { content: \"\"; height: var(--ancestry-media-height); flex: none;");
    expect(ancestryRendererStyles).toContain(".ancestry-heading { position: relative;");
    expect(ancestryRendererStyles).not.toContain(".ancestry-heading { position: absolute;");
    expect(ancestryRendererStyles).not.toContain(".ancestry-summary { max-height:");
    expect(ancestryRendererStyles).not.toContain(".ancestry-summary { overflow: hidden;");
    expect(ancestryRendererStyles).toContain(".ancestry-card.is-fluid .ancestry-body { flex: none; overflow: visible; }");
    expect(ancestryRendererStyles).toContain(".ancestry-card.is-fluid .ancestry-feature { flex: none; overflow: visible; }");
  });
});
