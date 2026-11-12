import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  professionTemplate,
  templateRegistry,
} from "../../packages/templates/src/core/index.ts";
import { professionTemplate as professionTemplate101 } from "../../packages/templates/src/core/profession/1.0.1/capability.ts";
import { ProfessionAuthoringEditor } from "../../packages/templates/src/frontend/profession/1.0.0/authoring-editor.tsx";
import { professionRendererRevision as professionRendererRevision100, professionRendererStyles as professionRendererStyles100 } from "../../packages/templates/src/frontend/profession/1.0.0/renderer.tsx";
import { professionRendererRevision as professionRendererRevision101, professionRendererStyles as professionRendererStyles101 } from "../../packages/templates/src/frontend/profession/1.0.1/renderer.tsx";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(professionTemplate.schema as AnySchema);

describe("职业 Template 1.0.0", () => {
  test("registers structured domains, attributes, and questions", () => {
    expect(templateRegistry.resolve("职业", "1.0.0")).toBe(professionTemplate);
    expect(professionTemplate.defaultPresentation.fixedRatio).toBe(false);
    const data: typeof professionTemplate.defaultData = {
      ...professionTemplate.defaultData,
      名称: "吟游诗人",
      领域: ["优雅", "典籍"],
      推荐初始属性: { 敏捷: "+0", 力量: "-1", 灵巧: "+1", 本能: "+0", 风度: "+2", 知识: "+1" },
      推荐初始武器: "刺剑 + 匕首",
      希望特性: { 特性名称: "大闹一场", 特性原文: "Make a Scene", 特性描述: "干扰一个目标。" },
      特性: [{ 特性名称: "鼓舞人心", 特性原文: "Rally", 特性描述: "获得一枚鼓舞骰。" }],
      背景问题: ["谁教会了你自信？"],
      关系问题: ["我们为何成为朋友？"],
    };
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(Object.hasOwn(professionTemplate.defaultData, "施法属性")).toBe(false);
    expect(professionTemplate.project(data).searchText).toContain("风度 +2");
    expect(professionTemplate.project(data).searchText).toContain("Rally");
  });

  test("rejects delimiter strings in structured fields", () => {
    expect(validate({ ...professionTemplate.defaultData, 领域: "优雅+典籍" })).toBe(false);
    expect(validate({ ...professionTemplate.defaultData, 推荐初始属性: [{ 敏捷: "+1", 力量: "-1" }] })).toBe(false);
    expect(validate({ ...professionTemplate.defaultData, 推荐初始武器: ["刺剑", "匕首"] })).toBe(false);
    expect(validate({ ...professionTemplate.defaultData, 背景问题: "问题一" })).toBe(false);
    expect(validate({ ...professionTemplate.defaultData, 特性: "鼓舞人心" })).toBe(false);
  });

  test("rejects locally persisted legacy profession fields", () => {
    const legacy = {
      名称: "战士", 英文: "Warrior", 类型: "职业", 描述: "久经沙场。", 领域: "利刃+骸骨", 生命点: 6, 闪避值: 11,
      希望特性: "绝不手软：攻击掷骰 +1。", 职业特性: "借机攻击：阻止敌人离开。",
      推荐初始属性: [{ 敏捷: "+2" }, { 力量: "+1" }], 推荐初始武器: ["长剑", "匕首"], 推荐初始护甲: "链甲",
      背景问题1: "谁教会你战斗？", 关系问题1: "我们如何相识？",
    };
    expect(validate(legacy), JSON.stringify(validate.errors)).toBe(false);
  });

  test("职业特性编辑器使用可增删的名称、英文、描述特性组", () => {
    const markup = renderToStaticMarkup(createElement(ProfessionAuthoringEditor, {
      data: { ...professionTemplate.defaultData, 特性: [{ 特性名称: "鼓舞人心", 特性原文: "Rally", 特性描述: "获得鼓舞骰。" }] },
      onValue: () => undefined,
    }));
    for (const label of ["领域1", "领域2", "生命", "闪避", "特性名称", "希望特性描述", "职业特性", "职业特性描述", "推荐初始属性", "敏捷", "力量", "灵巧", "本能", "风度", "知识", "背景问题1", "背景问题2", "背景问题3", "关系问题1", "关系问题2", "关系问题3", "新增", "清空", "删除"]) {
      expect(markup).toContain(label);
    }
  });
});

describe("职业 Template 1.0.0 纯卡图", () => {
  const base = {
    data: { ...professionTemplate.defaultData, 名称: "吟游诗人" },
    state: {},
    assets: { portrait: "blob:profession-art" },
    attribution: { artworkCredit: "", sourceLabel: "" },
  };

  test("pins the art-only card to the canonical 63:88 surface", () => {
    for (const fixedRatio of [true, false]) {
      const markup = renderToStaticMarkup(professionRendererRevision100.render({ ...base, presentation: { mode: "image", fixedRatio } }));
      expect(Number(/style="height:([\d.]+)px/u.exec(markup)?.[1])).toBeCloseTo(88, 1);
      expect(markup).toContain('data-renderer-revision="profession-card-r2"');
      expect(markup).toContain('class="reference-card profession-card is-image');
      expect(markup).not.toContain("is-fluid");
      expect(markup).toContain('class="profession-card-image"');
      expect(markup).not.toContain("reference-card-art");
      expect(markup).not.toContain('data-card-footer="true"');
    }
  });

  test("keeps text cards fluid and the art-only container opaque", () => {
    const textMarkup = renderToStaticMarkup(professionRendererRevision100.render({ ...base, presentation: { mode: "text", fixedRatio: true } }));
    expect(textMarkup).toContain("reference-card-frame is-fluid profession-card-frame");
    expect(textMarkup).toContain("reference-card-art");
    expect(professionRendererStyles100).toContain('[data-template-id="职业"].profession-card.is-image{height:502.857px;min-height:502.857px}');
    expect(professionRendererStyles100).toContain('[data-template-id="职业"] .profession-card-image img{display:block;width:100%;height:100%;object-fit:cover}');
    expect(professionRendererStyles100).not.toContain("is-image-only");
  });
});

describe("职业 Template 1.0.1 纯卡图", () => {
  const base = {
    data: { ...professionTemplate101.defaultData, 名称: "吟游诗人" },
    state: {},
    assets: { portrait: "blob:profession-art" },
    attribution: { artworkCredit: "", sourceLabel: "" },
  };

  test("pins the art-only card to the canonical 63:88 surface", () => {
    for (const fixedRatio of [true, false]) {
      const markup = renderToStaticMarkup(professionRendererRevision101.render({ ...base, presentation: { mode: "image", fixedRatio } }));
      expect(Number(/style="height:([\d.]+)px/u.exec(markup)?.[1])).toBeCloseTo(88, 1);
      expect(markup).toContain('data-renderer-revision="profession-card-r4"');
      expect(markup).toContain('class="reference-card profession-card is-image');
      expect(markup).not.toContain("is-fluid");
      expect(markup).toContain('class="profession-card-image"');
      expect(markup).not.toContain("reference-card-art");
      expect(markup).not.toContain('data-card-footer="true"');
    }
  });

  test("keeps text cards fluid and the art-only container opaque", () => {
    const textMarkup = renderToStaticMarkup(professionRendererRevision101.render({ ...base, presentation: { mode: "text", fixedRatio: true } }));
    expect(textMarkup).toContain("reference-card-frame is-fluid profession-card-frame");
    expect(textMarkup).toContain("reference-card-art");
    expect(professionRendererStyles101).toContain('[data-template-id="职业"].profession-card.is-image{height:502.857px;min-height:502.857px}');
    expect(professionRendererStyles101).toContain('[data-template-id="职业"] .profession-card-image img{display:block;width:100%;height:100%;object-fit:cover}');
    expect(professionRendererStyles101).not.toContain("is-image-only");
  });
});
