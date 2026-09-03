import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { prepareCanonicalSurface, type SurfaceResource } from "../../packages/resource-renderer/src/core.ts";
import {
  ancestryTemplate,
  communityTemplate,
  domainTemplate,
  itemTemplate,
  professionTemplate,
  subclassTemplate,
} from "../../packages/templates/src/core/index.ts";
import { stableReferenceRendererFor } from "../../packages/templates/src/frontend/index.ts";

const templates = [ancestryTemplate, communityTemplate, professionTemplate, subclassTemplate, itemTemplate, domainTemplate];

describe("Daggerheart Core 稳定参考卡面", () => {
  test.each(templates)("%s 使用精确 Renderer 并支持三种展示模式", (template) => {
    const renderer = stableReferenceRendererFor(template.id, template.version);
    expect(renderer?.revision).toBe(template.rendererRevision);
    if (!renderer) throw new Error(`Missing Renderer for ${template.id}`);
    for (const mode of ["text", "split", "image"] as const) {
      const resource: SurfaceResource<Record<string, unknown>> = {
        template: { id: template.id, version: template.version },
        presentation: { ...template.defaultPresentation, mode },
        data: { ...(template.defaultData as Record<string, unknown>), 名称: `测试${template.id}` },
        media: mode === "text" ? {} : { portrait: "portrait" },
      };
      const result = prepareCanonicalSurface({
        resource,
        expectedRendererRevision: renderer.revision,
        renderer,
        assets: new Map([["portrait", { status: "ready", url: "blob:portrait" }]]),
      });
      expect(result.status).toBe("ready");
      if (result.status !== "ready") throw new Error("Expected ready Surface");
      const markup = renderToStaticMarkup(result.renderer.render(result.renderInput));
      expect(markup).toContain(`data-renderer-revision=\"${template.rendererRevision}\"`);
      if (mode === "text") expect(markup).toContain(`测试${template.id}`);
      else expect(markup).toContain("blob:portrait");
    }
  });

  test("物品标题区按名称类型、英文掷骰两行排列", () => {
    const renderer = stableReferenceRendererFor(itemTemplate.id, itemTemplate.version)!;
    const result = prepareCanonicalSurface({
      resource: {
        template: { id: itemTemplate.id, version: itemTemplate.version },
        presentation: { ...itemTemplate.defaultPresentation, mode: "text" },
        data: { ...itemTemplate.defaultData, 名称: "风笛哨", 原文: "Whistle", 类型: "物品", 掷骰: "04" },
        media: {},
      },
      expectedRendererRevision: renderer.revision,
      renderer,
      assets: new Map(),
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    const markup = renderToStaticMarkup(result.renderer.render(result.renderInput));

    expect(markup).toMatch(/<div class="reference-card-split-header"><div class="reference-card-header-main"><h1 class="reference-card-title"[^>]*>风笛哨<\/h1><p class="reference-card-original-title">Whistle<\/p><\/div><div class="reference-card-header-side"><div class="reference-card-kicker">物品<\/div><div class="reference-card-header-value">04<\/div><\/div><\/div>/u);
    expect(renderer.styles).toContain(".reference-card-split-header{display:grid;grid-template-columns:minmax(0,1fr) 72px");
    expect(renderer.styles).toContain(".reference-card-header-main,.reference-card-header-side{display:flex;flex-direction:column}");
    expect(renderer.styles).not.toContain(".reference-card-split-header{border");
    expect(markup).not.toContain("掷骰：");
    expect(markup).not.toContain("掷骰:");
    expect(markup).not.toContain("reference-card-stats");

    const withoutEnglish = renderer.render({
      ...result.renderInput,
      data: { ...result.renderInput.data, 原文: "   " },
    });
    const withoutEnglishMarkup = renderToStaticMarkup(withoutEnglish);
    expect(withoutEnglishMarkup).toMatch(/<div class="reference-card-header-main"><h1[^>]*>风笛哨<\/h1><\/div>/u);
    expect(withoutEnglishMarkup).not.toContain("reference-card-original-title");
  });

  test("领域卡标题只保留名称类型与英文，四项字段位于正文", () => {
    const renderer = stableReferenceRendererFor(domainTemplate.id, domainTemplate.version)!;
    const markup = renderToStaticMarkup(renderer.render({
      data: {
        ...domainTemplate.defaultData,
        名称: "破坏轰击",
        原文: "Arcane Barrage",
        类型: "领域卡",
        领域: "奥术",
        等级: "1",
        属性: "法术",
        回想: "3⚡",
        描述: "造成法术伤害。",
        风味描述: "将奥术压缩成一瞬间的耀光。",
      },
      state: {},
      assets: {},
      presentation: { mode: "text", fixedRatio: true },
      attribution: { artworkCredit: "", sourceLabel: "" },
    }));

    expect(markup).toMatch(/<div class="reference-card-title-row"><h1[^>]*>破坏轰击<\/h1><div class="reference-card-kicker">领域卡<\/div><\/div><p class="reference-card-original-title">Arcane Barrage<\/p>/u);
    expect(markup).not.toContain("reference-card-meta");
    expect(markup).toMatch(/<section class="reference-card-stats"[^>]*>.*<b>奥术<\/b><span>领域<\/span>.*<b>1级<\/b><span>等级<\/span>.*<b>法术<\/b><span>属性<\/span>.*<b>3<\/b><span>回想<\/span>/u);
    expect(markup).not.toContain("⚡");
    expect(markup).not.toContain(">能力<");
    expect(renderer.styles).toContain('[data-template-id="领域卡"] .reference-card-stats{grid-template-columns:repeat(4');
    expect(renderer.styles).toContain('[data-template-id="领域卡"] .reference-card-flavor{flex:none;margin-top:auto}');
  });

  test("子职业采用方案 A，身份值在标签上方并渲染具名特性卡", () => {
    const renderer = stableReferenceRendererFor(subclassTemplate.id, subclassTemplate.version)!;
    const markup = renderToStaticMarkup(renderer.render({
      data: {
        ...subclassTemplate.defaultData,
        名称: "言文巧匠",
        原文: "Wordsmith",
        主职: "吟游诗人",
        等级: "基础",
        施法属性: "风度",
        特性: [{ 名称: "激昂演说", 原名: "Rousing Speech", 特性描述: "为盟友清除压力。" }],
      },
      state: {},
      assets: {},
      presentation: { mode: "text", fixedRatio: true },
      attribution: { artworkCredit: "", sourceLabel: "" },
    }));

    expect(markup).not.toContain("reference-card-meta");
    expect(markup).toMatch(/<section class="reference-card-stats"[^>]*>.*<b>吟游诗人<\/b><span>主职<\/span>.*<b>基础<\/b><span>阶段<\/span>.*<b>风度<\/b><span>施法属性<\/span>/u);
    expect(markup).toMatch(/<span class="reference-card-section-title">激昂演说<\/span><small>Rousing Speech<\/small>/u);
    expect(renderer.styles).toContain('[data-template-id="子职业"] .reference-card-stat b{font-size:17px');
    expect(renderer.styles).toContain('[data-template-id="子职业"] .reference-card-flavor{flex:none;margin-top:auto}');
  });

  test("拒绝旧版和未知模板", () => {
    expect(stableReferenceRendererFor("种族", "0.9.0")).toBeUndefined();
    expect(stableReferenceRendererFor("环境", "1.0.0")).toBeUndefined();
  });
});
