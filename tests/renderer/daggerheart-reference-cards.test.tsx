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

  test("职业卡以非固定比例完整渲染资料和结构化特性组", () => {
    const renderer = stableReferenceRendererFor(professionTemplate.id, professionTemplate.version)!;
    const markup = renderToStaticMarkup(renderer.render({
      data: {
        ...professionTemplate.defaultData,
        名称: "战士",
        原文: "Warrior",
        风味描述: "投入一生磨炼武器与战斗技艺。",
        领域: ["利刃", "骸骨"],
        生命点: "6",
        闪避值: "11",
        希望特性: { 名称: "绝不手软", 原名: "No Mercy", 特性描述: "花费希望点，攻击掷骰获得加值。" },
        特性: [{ 名称: "借机攻击", 原名: "Attack of Opportunity", 特性描述: "阻止敌人离开。" }],
        推荐初始属性: { 敏捷: "+2", 力量: "+1", 灵巧: "+0", 本能: "+1", 风度: "-1", 知识: "+0" },
        推荐初始武器: "长剑",
        推荐初始护甲: "链甲",
        职业物品: "爱人的画像或一块磨刀石",
        背景问题: ["是谁教会你战斗？", "谁曾背叛你？", "你渴望造访哪里？"],
        关系问题: ["我们如何相识？", "你如何帮助我？", "我在帮你克服什么？"],
      },
      state: {},
      assets: {},
      presentation: { mode: "text", fixedRatio: false },
      attribution: { artworkCredit: "", sourceLabel: "" },
    }));

    expect(markup).toContain("绝不手软");
    expect(markup).toContain("No Mercy");
    expect(markup).toMatch(/<h3><span>借机攻击<\/span><small>Attack of Opportunity<\/small><\/h3>/u);
    expect(markup).toContain("阻止敌人离开。");
    expect(markup).not.toContain("职业特性：");
    expect(markup).toContain("reference-card-frame is-fluid");
    expect(markup).toMatch(/profession-card-header-columns[^>]*><div class="profession-card-identity">.*reference-card-title[^>]*>战士<\/h1><p class="reference-card-original-title">Warrior<\/p><\/div><div class="profession-card-taxonomy"><div class="reference-card-kicker">职业<\/div><div class="reference-card-meta"><span>利刃<\/span><span>骸骨<\/span><\/div><\/div>/u);
    expect(renderer.styles).toContain(".profession-card-header-columns{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end");
    expect(renderer.styles).toContain(".profession-card-taxonomy .reference-card-meta span{min-width:0;padding:0;border:0;background:none");
    for (const expected of [
      "投入一生磨炼武器与战斗技艺。",
      "利刃",
      "骸骨",
      ">6<",
      ">11<",
      "长剑",
      "链甲",
      "爱人的画像或一块磨刀石",
      "是谁教会你战斗？",
      "谁曾背叛你？",
      "你渴望造访哪里？",
      "我们如何相识？",
      "你如何帮助我？",
      "我在帮你克服什么？",
    ]) {
      expect(markup).toContain(expected);
    }
    expect(markup).toMatch(/profession-card-attribute-names[^>]*><span>敏捷<\/span>.*<span>知识<\/span>/u);
    expect(markup).toMatch(/profession-card-attribute-values[^>]*><b>\+2<\/b>.*<b>\+0<\/b>/u);
    expect(markup).toContain("长剑 + 链甲");
    expect(markup).not.toContain("施法属性");
    expect(markup).not.toContain("信息索引");
  });

  test("职业卡不为为空的非关键字段生成占位 DOM", () => {
    const renderer = stableReferenceRendererFor(professionTemplate.id, professionTemplate.version)!;
    const markup = renderToStaticMarkup(renderer.render({
      data: {
        ...professionTemplate.defaultData,
        名称: "极简职业",
        类型: "职业",
        领域: ["利刃"],
        生命点: "5",
        闪避值: "10",
        希望特性: { 名称: "保持希望", 原名: "", 特性描述: "保持希望。" },
        特性: [{ 名称: "专注", 特性描述: "保持阵线。" }],
        风味描述: " ",
        职业物品: "",
        背景问题: ["", "  "],
        关系问题: [],
      },
      state: {},
      assets: {},
      presentation: { mode: "text", fixedRatio: false },
      attribution: { artworkCredit: "", sourceLabel: "" },
    }));

    for (const hidden of ["风味描述", "创建配置", "职业物品", "背景问题", "关系问题"]) {
      expect(markup).not.toContain(hidden);
    }
    expect(markup).toMatch(/<div class="profession-card-identity"><h1[^>]*>极简职业<\/h1><\/div>/u);
    expect(markup).not.toContain("reference-card-original-title");
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
