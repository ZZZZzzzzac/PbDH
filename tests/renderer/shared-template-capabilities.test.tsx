import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  adversaryTemplate,
  ancestryTemplate,
  armorTemplate,
  communityTemplate,
  domainTemplate,
  environmentTemplate,
  freeTemplate,
  itemTemplate,
  professionTemplate,
  subclassTemplate,
  weaponTemplate,
} from "../../packages/templates/src/core/index.ts";
import {
  adversaryRendererRevision,
  adversaryRendererStyles,
  ancestryRendererRevision,
  ancestryRendererStyles,
  ArmorAuthoringEditor,
  armorRendererRevision,
  armorRendererStyles,
  communityRendererRevision,
  communityRendererStyles,
  CommunityAuthoringEditor,
  domainRendererRevision,
  domainRendererStyles,
  environmentRendererRevision,
  environmentRendererStyles,
  freeRendererRevision,
  freeRendererStyles,
  itemRendererRevision,
  itemRendererStyles,
  professionRendererRevision,
  professionRendererStyles,
  subclassRendererRevision,
  subclassRendererStyles,
  weaponRendererRevision,
  weaponRendererStyles,
  WeaponAuthoringEditor,
} from "../../packages/templates/src/frontend/index.ts";
import { adversaryRendererRevision as adversaryRendererRevisionV101, adversaryRendererStyles as adversaryRendererStylesV101 } from "../../packages/templates/src/frontend/adversary/1.0.1/renderer.tsx";
import { adversaryRendererRevision as adversaryRendererRevisionV102, adversaryRendererStyles as adversaryRendererStylesV102 } from "../../packages/templates/src/frontend/adversary/1.0.2/renderer.tsx";
import { ancestryRendererRevision as ancestryRendererRevisionV101, ancestryRendererStyles as ancestryRendererStylesV101 } from "../../packages/templates/src/frontend/ancestry/1.0.1/renderer.tsx";
import { armorRendererRevision as armorRendererRevisionV101, armorRendererStyles as armorRendererStylesV101 } from "../../packages/templates/src/frontend/armor/1.0.1/renderer.tsx";
import { communityRendererRevision as communityRendererRevisionV101, communityRendererStyles as communityRendererStylesV101 } from "../../packages/templates/src/frontend/community/1.0.1/renderer.tsx";
import { domainRendererRevision as domainRendererRevisionV101, domainRendererStyles as domainRendererStylesV101 } from "../../packages/templates/src/frontend/domain/1.0.1/renderer.tsx";
import { environmentRendererRevision as environmentRendererRevisionV101, environmentRendererStyles as environmentRendererStylesV101 } from "../../packages/templates/src/frontend/environment/1.0.1/renderer.tsx";
import { freeRendererRevision as freeRendererRevisionV101, freeRendererStyles as freeRendererStylesV101 } from "../../packages/templates/src/frontend/free/1.0.1/renderer.tsx";
import { itemRendererRevision as itemRendererRevisionV101, itemRendererStyles as itemRendererStylesV101 } from "../../packages/templates/src/frontend/item/1.0.1/renderer.tsx";
import { professionRendererStyles as professionRendererStylesV101 } from "../../packages/templates/src/frontend/profession/1.0.1/renderer.tsx";
import { subclassRendererRevision as subclassRendererRevisionV101, subclassRendererStyles as subclassRendererStylesV101 } from "../../packages/templates/src/frontend/subclass/1.0.1/renderer.tsx";
import { weaponRendererRevision as weaponRendererRevisionV101, weaponRendererStyles as weaponRendererStylesV101 } from "../../packages/templates/src/frontend/weapon/1.0.1/renderer.tsx";
import { weaponBurdenOptions, weaponDamageTypeOptions, weaponRangeOptions, weaponTraitOptions, weaponTypeOptions } from "../../packages/templates/src/frontend/weapon/1.0.0/authoring-editor.tsx";

type GenericRenderer = RendererRevisionCapability<Record<string, unknown>, unknown, ReactNode>;

const cases = [
  [adversaryTemplate, adversaryRendererRevision],
  [armorTemplate, armorRendererRevision],
  [communityTemplate, communityRendererRevision],
  [domainTemplate, domainRendererRevision],
  [environmentTemplate, environmentRendererRevision],
  [freeTemplate, freeRendererRevision],
  [itemTemplate, itemRendererRevision],
  [professionTemplate, professionRendererRevision],
  [subclassTemplate, subclassRendererRevision],
  [weaponTemplate, weaponRendererRevision],
] as const;

const headerSummaryCases = [
  ["敌人", adversaryTemplate, adversaryRendererRevisionV101],
  ["种族", ancestryTemplate, ancestryRendererRevisionV101],
  ["护甲", armorTemplate, armorRendererRevisionV101],
  ["社群", communityTemplate, communityRendererRevisionV101],
  ["领域卡", domainTemplate, domainRendererRevisionV101],
  ["环境", environmentTemplate, environmentRendererRevisionV101],
  ["自由", freeTemplate, freeRendererRevisionV101],
  ["物品", itemTemplate, itemRendererRevisionV101],
  ["子职业", subclassTemplate, subclassRendererRevisionV101],
  ["武器", weaponTemplate, weaponRendererRevisionV101],
] as const;

function renderCard(template: (typeof cases)[number][0], renderer: (typeof cases)[number][1], mode: "text" | "split" | "image" = "text") {
  const data = structuredClone(template.defaultData) as Record<string, unknown>;
  data.名称 = "中文名称";
  data.原文 = "English Name";
  const genericRenderer = renderer as unknown as GenericRenderer;
  return renderToStaticMarkup(genericRenderer.render({
    data,
    state: genericRenderer.defaultState(data),
    assets: {},
    presentation: { mode, fixedRatio: true },
    attribution: { artworkCredit: "Artist", sourceLabel: "Source" },
  }));
}

describe("first-party template capabilities", () => {
  test.each(cases)("%s renders optional English title and shared footer", (template, renderer) => {
    const markup = renderCard(template, renderer);
    expect(markup).toContain("English Name");
    expect(markup).toContain('data-card-footer="true"');
    expect(markup).toContain("Artist");
    expect(markup).toContain("Source");
  });

  test("all first-party card titles use measured single-line font fitting", () => {
    for (const [template, renderer] of [[ancestryTemplate, ancestryRendererRevision], ...cases] as const) {
      const data = structuredClone(template.defaultData) as Record<string, unknown>;
      data.名称 = "这是一段明显超过卡牌标题可用宽度的测试名称";
      const genericRenderer = renderer as unknown as GenericRenderer;
      const markup = renderToStaticMarkup(genericRenderer.render({
        data,
        state: genericRenderer.defaultState(data),
        assets: {},
        presentation: { mode: "text", fixedRatio: true },
        attribution: { artworkCredit: "", sourceLabel: "" },
      }));
      expect(markup).toContain('data-single-line-text-fit="true"');
    }
    for (const styles of [
      adversaryRendererStyles, ancestryRendererStyles, armorRendererStyles,
      communityRendererStyles, domainRendererStyles, environmentRendererStyles, freeRendererStyles,
      itemRendererStyles, professionRendererStyles, subclassRendererStyles, weaponRendererStyles,
    ]) {
      expect(styles).not.toContain("text-overflow:ellipsis");
    }
  });

  test("all first-party card titles share ancestry header padding", () => {
    expect(ancestryRendererStyles).toContain("padding: 10px 14px");
    expect(communityRendererStyles).toContain("community-card-header");
    expect(domainRendererStyles).toContain("domain-card-header");
    expect(itemRendererStyles).toContain("item-card-header");
    expect(armorRendererStyles).toContain(".armor-header{flex:none;padding:10px 14px");
    expect(environmentRendererStyles).toContain(".environment-header{padding:10px 14px");
    expect(freeRendererStyles).toContain(".free-header{padding:10px 14px");
    expect(weaponRendererStyles).toContain(".weapon-header{flex:none;padding:10px 14px");
    expect(adversaryRendererStyles).toContain("top: calc(var(--enemy-media-height) + 10px)");
  });

  test("all first-party card titles reserve vertical space for Latin descenders", () => {
    const titleRules = [
      [adversaryRendererStylesV101, /\.enemy-heading h1\s*\{[^}]*font:[^;}]+\/1\.2\b/],
      [ancestryRendererStylesV101, /\.ancestry-heading h1\s*\{[^}]*font:[^;}]+\/1\.2\b/],
      [armorRendererStylesV101, /\.armor-title\s*\{[^}]*font:[^;}]+\/1\.2\b/],
      [communityRendererStylesV101, /\.community-card-title\s*\{[^}]*font:[^;}]+\/1\.2\b/],
      [domainRendererStylesV101, /\.domain-card-title\s*\{[^}]*font:[^;}]+\/1\.2\b/],
      [environmentRendererStylesV101, /\.environment-title\s*\{[^}]*font:[^;}]+\/1\.2\b/],
      [freeRendererStylesV101, /\.free-title\s*\{[^}]*font:[^;}]+\/1\.2\b/],
      [itemRendererStylesV101, /\.item-card-title\s*\{[^}]*font:[^;}]+\/1\.2\b/],
      [professionRendererStylesV101, /\.reference-card-title\s*\{[^}]*font:[^;}]+\/1\.2\b/],
      [subclassRendererStylesV101, /\.subclass-card-title\s*\{[^}]*font:[^;}]+\/1\.2\b/],
      [weaponRendererStylesV101, /\.weapon-title\s*\{[^}]*font:[^;}]+\/1\.2\b/],
    ] as const;

    for (const [styles, titleRule] of titleRules) {
      expect(styles).toMatch(titleRule);
    }
  });

  test.each(headerSummaryCases)("%s 1.0.1 renders its summary inside the title header", (_name, template, renderer) => {
    const data = structuredClone(template.defaultData) as Record<string, unknown>;
    data.简介 = "简介位置标记";
    const genericRenderer = renderer as unknown as GenericRenderer;
    const markup = renderToStaticMarkup(genericRenderer.render({
      data,
      state: genericRenderer.defaultState(data),
      assets: {},
      presentation: { mode: "text", fixedRatio: true },
      attribution: { artworkCredit: "", sourceLabel: "" },
    }));
    const summaryIndex = markup.indexOf("简介位置标记");
    const headerStart = markup.lastIndexOf("<header", summaryIndex);
    const headerEnd = markup.indexOf("</header>", summaryIndex);
    expect(summaryIndex).toBeGreaterThan(headerStart);
    expect(headerStart).toBeGreaterThanOrEqual(0);
    expect(headerEnd).toBeGreaterThan(summaryIndex);
  });

  test("adversary 1.0.1 wraps long headings, attack text, and state markers", () => {
    const data = {
      ...structuredClone(adversaryTemplate.defaultData),
      名称: "机械领主-“操作大师”",
      简介: "一个巨大威严的机械领主，操控周围的一切作为自我意志的延伸",
      位阶: "3",
      种类: "独狼",
      生命点: "11",
      压力点: "8",
      攻击命中: "+4",
      攻击武器: "机械重刃",
      攻击范围: "近距离",
      攻击伤害: "3d12+4",
      攻击属性: "物理",
    };
    const markup = renderToStaticMarkup(adversaryRendererRevisionV101.render({
      data,
      state: adversaryRendererRevisionV101.defaultState(data),
      assets: {},
      presentation: { mode: "split", fixedRatio: false },
      attribution: { artworkCredit: "", sourceLabel: "jf" },
    }));

    expect(markup).toContain('<div class="enemy-heading-copy"><h1>机械领主-“操作大师”</h1>');
    expect(markup).toContain('<div class="enemy-kicker">位阶3 独狼</div>');
    expect(markup).toContain("攻击+4 | 机械重刃 | 近距离 | 3d12+4 | 物理");
    expect(markup).not.toContain(" · ");
    expect(markup.match(/class="enemy-state-marker"/gu)).toHaveLength(19);
    expect(adversaryRendererStylesV101).toContain("grid-template-columns: minmax(0, 1fr) minmax(58px, 82px)");
    expect(adversaryRendererStylesV101).toContain("white-space: normal; overflow-wrap: anywhere");
    expect(adversaryRendererStylesV101).toContain("flex-wrap: wrap");
  });
  test("adversary 1.0.1 features are expanded and independently collapsible", () => {
    const data = {
      ...structuredClone(adversaryTemplate.defaultData),
      特性: [{ 特性名称: "伟大进化", 特性原文: "Great Evolution", 特性类型: "被动", 特性描述: "展开后的完整描述。" }],
    };
    const markup = renderToStaticMarkup(adversaryRendererRevisionV101.render({
      data,
      state: adversaryRendererRevisionV101.defaultState(data),
      assets: {},
      presentation: { mode: "split", fixedRatio: false },
      attribution: { artworkCredit: "", sourceLabel: "jf" },
    }));

    expect(markup).toContain('<article class="enemy-feature is-expanded"><button type="button" class="enemy-feature-toggle" aria-expanded="true">');
    expect(markup).toContain("伟大进化");
    expect(markup).toContain("被动");
    expect(markup).toContain("Great Evolution");
    expect(markup).toContain("展开后的完整描述。");
    expect(adversaryRendererStylesV101).toContain(".enemy-feature:not(.is-expanded) { min-height: 0; display: block; }");
    expect(adversaryRendererStylesV101).toContain(".enemy-feature:not(.is-expanded) .enemy-feature-toggle { height: 24px;");
    expect(adversaryRendererStylesV101).toContain(".enemy-feature:not(.is-expanded) .enemy-feature-primary { min-width: 0; display: flex;");
    expect(adversaryRendererStylesV101).toContain("white-space: nowrap; overflow: hidden;");
    expect(adversaryRendererStylesV101).toContain("text-overflow: ellipsis");
    expect(adversaryRendererStylesV101).toContain('.enemy-feature-toggle::after { content: "+";');
    expect(adversaryRendererStylesV101).toContain('.enemy-feature.is-expanded .enemy-feature-toggle::after { content: "−";');
  });
  test("adversary 1.0.2 wraps uninterrupted Latin feature names inside their column", () => {
    const data = {
      ...structuredClone(adversaryTemplate.defaultData),
      特性: [{
        特性名称: "call.dataLog{X}",
        特性原文: "",
        特性类型: "动作",
        特性描述: "标记1压力点，调取邻近范围内一个目标的数据日志。",
      }],
    };
    const markup = renderToStaticMarkup(adversaryRendererRevisionV102.render({
      data,
      state: adversaryRendererRevisionV102.defaultState(data),
      assets: {},
      presentation: { mode: "split", fixedRatio: false },
      attribution: { artworkCredit: "", sourceLabel: "" },
    }));

    expect(markup).toContain('<span class="enemy-feature-name">call.dataLog{X}</span><span class="enemy-feature-type">动作</span>');
    expect(adversaryRendererStylesV101).not.toMatch(/\.enemy-feature-name\s*\{[^}]*overflow-wrap:\s*anywhere;/u);
    expect(adversaryRendererStylesV102).toMatch(/\.enemy-feature-name\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/u);
  });
  test("environment 1.0.1 features collapse to one line and omit the English difficulty label", () => {
    const data = {
      ...structuredClone(environmentTemplate.defaultData),
      难度: "17",
      特性: [{
        特性名称: "崩塌边缘",
        特性原文: "Crumbling Edge",
        特性类型: "被动",
        特性描述: "展开后的环境特性描述。",
        引导问题: "谁会最先发现危险？",
      }],
    };
    const markup = renderToStaticMarkup(environmentRendererRevisionV101.render({
      data,
      state: environmentRendererRevisionV101.defaultState(data),
      assets: {},
      presentation: { mode: "split", fixedRatio: false },
      attribution: { artworkCredit: "", sourceLabel: "测试" },
    }));

    expect(markup).toContain('<section class="environment-feature is-expanded"><button type="button" class="environment-feature-toggle" aria-expanded="true">');
    expect(markup).toContain("崩塌边缘");
    expect(markup).toContain("被动");
    expect(markup).toContain("Crumbling Edge");
    expect(markup).toContain("展开后的环境特性描述。");
    expect(markup).toContain("谁会最先发现危险？");
    expect(markup).not.toContain("DIFFICULTY");
    expect(environmentRendererStylesV101).toContain(".environment-feature:not(.is-expanded) .environment-feature-toggle{height:24px;");
    expect(environmentRendererStylesV101).toContain(".environment-feature:not(.is-expanded) .environment-feature-primary{display:flex;");
    expect(environmentRendererStylesV101).toContain("text-overflow:ellipsis;white-space:nowrap");
    expect(environmentRendererStylesV101).not.toContain(".environment-difficulty small");
  });
  test("item feature box follows its content height", () => {
    expect(itemRendererStylesV101).toContain(".item-card-feature{min-height:0;flex:none;");
    expect(itemRendererStylesV101).not.toContain(".item-card-feature{min-height:0;flex:1;");
  });

  test("all first-party split cards share the ancestry image proportion", () => {
    expect(ancestryRendererStyles).toContain("--ancestry-media-height: 96px");
    expect(adversaryRendererStyles).toContain("--enemy-media-height: 96px");
    expect(communityRendererStyles).toContain("min-height:96px");
    expect(subclassRendererStyles).not.toContain("--reference-media-height:158px");
    expect(armorRendererStyles).toContain(".armor-art{height:170px");
    expect(weaponRendererStyles).toContain(".weapon-art{position:relative;height:170px");
    expect(freeRendererStyles).toContain(".free-art{height:170px");
    expect(environmentRendererStyles).toContain(".environment-art{height:170px");
    expect(environmentRendererStyles).toContain(".environment-card.is-split .environment-header{position:absolute;inset:0 0 auto;height:170px");
  });

  test("all first-party feature cards use compact padding", () => {
    expect(ancestryRendererStyles).toContain("padding: 6px; overflow: hidden; background: #f7ebd6;");
    expect(adversaryRendererStyles).toContain("padding: 6px; overflow: visible; background: #f7ebd6;");
    expect(armorRendererStyles).toContain(".armor-feature{flex:none;padding:6px;");
    expect(weaponRendererStyles).toContain(".weapon-feature{flex:none;padding:6px;");
    expect(environmentRendererStyles).toContain(".environment-feature{padding:6px;");
    expect(freeRendererStyles).toContain(".free-block{padding:6px;");
    expect(communityRendererStyles).toContain(".community-card-section");
  });

  test("armor and weapon editors expose the published feature fields", () => {
    const description = "受魔法伤害时，在计算伤害阈值前按护甲值减免伤害。";
    const armor = { ...structuredClone(armorTemplate.defaultData), 特性名称: "防护", 特性原文: "", 特性描述: description };
    const armorMarkup = renderToStaticMarkup(<ArmorAuthoringEditor data={armor} onValue={() => undefined} />);
    expect(armorMarkup).toContain(">特性名称<");
    expect(armorMarkup).toContain('value="防护"');
    expect(armorMarkup).toContain(">特性原文<");
    expect(armorMarkup).toContain(">特性描述<");
    expect(armorMarkup).toContain(description);
    expect(armorMarkup).not.toContain(">特性英文<");

    const weapon = { ...structuredClone(weaponTemplate.defaultData), 特性名称: "横扫", 特性原文: "Sweep", 特性描述: description };
    const weaponMarkup = renderToStaticMarkup(<WeaponAuthoringEditor data={weapon} onValue={() => undefined} />);
    expect(weaponMarkup).toContain(">特性名称<");
    expect(weaponMarkup).toContain('value="横扫"');
    expect(weaponMarkup).toContain('value="Sweep"');
    expect(weaponMarkup).toContain(">特性描述<");
    expect(weaponMarkup).toContain(description);
  });

  test("armor and weapon editors follow the card authoring field layout", () => {
    const labels = (markup: string) => [...markup.matchAll(/class="template-editor-field"[^>]*><span>([^<]+)<\/span>/gu)].map((match) => match[1]);

    const armorMarkup = renderToStaticMarkup(<ArmorAuthoringEditor data={structuredClone(armorTemplate.defaultData)} onValue={() => undefined} />);
    expect(labels(armorMarkup)).toEqual([
      "名称", "原文", "位阶", "类型", "简介",
      "护甲值", "重度伤害阈值", "严重伤害阈值",
      "特性名称", "特性原文", "特性描述",
    ]);
    expect(armorMarkup.match(/<textarea/gu)).toHaveLength(2);

    const weaponMarkup = renderToStaticMarkup(<WeaponAuthoringEditor data={structuredClone(weaponTemplate.defaultData)} onValue={() => undefined} />);
    expect(labels(weaponMarkup)).toEqual([
      "名称", "原文", "位阶", "类型", "简介",
      "属性", "距离", "负荷", "伤害", "伤害类型",
      "特性名称", "特性原文", "特性描述",
    ]);
    expect(weaponMarkup.match(/<textarea/gu)).toHaveLength(2);
    for (const label of ["类型", "属性", "距离", "负荷", "伤害类型"]) {
      expect(weaponMarkup).toContain(`展开${label}选项`);
    }
    expect(weaponMarkup).not.toContain("展开伤害选项");
    expect(weaponTraitOptions).toEqual(["敏捷", "力量", "灵巧", "本能", "风度", "知识"]);
    expect(weaponRangeOptions).toEqual(["近战", "邻近", "近距离", "远距离", "极远"]);
    expect(weaponBurdenOptions).toEqual(["单手", "双手"]);
    expect(weaponDamageTypeOptions).toEqual(["物理", "魔法"]);
    expect(weaponTypeOptions).toEqual(["主武器", "副武器"]);
  });

  test.each(cases)("%s omits the shared footer in image-only mode", (template, renderer) => {
    expect(renderCard(template, renderer, "image")).not.toContain('data-card-footer="true"');
  });

  test("renders English labels for named effect blocks without reserving empty rows", () => {
    const community = structuredClone(communityTemplate.defaultData);
    community.特性 = { 特性名称: "社群特性", 特性原文: "Community Feature", 特性描述: "效果" };
    const communityMarkup = renderToStaticMarkup(communityRendererRevision.render({
      data: community,
      state: {},
      assets: {},
      presentation: { mode: "text", fixedRatio: true },
      attribution: { artworkCredit: "", sourceLabel: "" },
    }));
    expect(communityMarkup).toContain("Community Feature");

    const free = structuredClone(freeTemplate.defaultData);
    free.内容 = [{ 名称: "自定义效果", 原文: "Custom Effect", 描述: "效果" }];
    const freeMarkup = renderToStaticMarkup(freeRendererRevision.render({
      data: free,
      state: {},
      assets: {},
      presentation: { mode: "text", fixedRatio: true },
      attribution: { artworkCredit: "", sourceLabel: "" },
    }));
    expect(freeMarkup).toContain("Custom Effect");
    expect(freeMarkup).toContain("free-block");
  });

  test("lays out Community basics in three rows and renders personality as a feature", () => {
    const community = structuredClone(communityTemplate.defaultData);
    community.名称 = "高城之民";
    community.原文 = "Highborne";
    community.类型 = "社群";
    community.性格 = "亲切、坦率、沉着。";
    community.简介 = "来自上流社会。";
    community.特性 = { 特性名称: "高人一等", 特性原文: "Privilege", 特性描述: "与贵族交际时具有优势。" };

    const editorMarkup = renderToStaticMarkup(<CommunityAuthoringEditor data={community} onValue={() => undefined} />);
    expect(editorMarkup).toContain("community-basics");
    expect(editorMarkup).toContain("repeat(3,minmax(0,1fr))");
    expect(editorMarkup.match(/class="is-auto-grow"/gu)).toHaveLength(3);
    expect(editorMarkup.indexOf(">名称<")).toBeLessThan(editorMarkup.indexOf(">原文<"));
    expect(editorMarkup.indexOf(">原文<")).toBeLessThan(editorMarkup.indexOf(">类型<"));
    expect(editorMarkup.indexOf(">类型<")).toBeLessThan(editorMarkup.indexOf(">性格<"));
    expect(editorMarkup.indexOf(">性格<")).toBeLessThan(editorMarkup.indexOf(">简介<"));

    const cardMarkup = renderToStaticMarkup(communityRendererRevision.render({
      data: community,
      state: {},
      assets: {},
      presentation: { mode: "text", fixedRatio: true },
      attribution: { artworkCredit: "", sourceLabel: "" },
    }));
    const personalityHeading = cardMarkup.indexOf(">性格<");
    expect(personalityHeading).toBeGreaterThan(cardMarkup.indexOf("community-card-body"));
    expect(cardMarkup).not.toContain("reference-card");
  });

  test("fixed cards declare measured text fitting while fluid cards keep natural growth", () => {
    for (const styles of [adversaryRendererStyles, armorRendererStyles, environmentRendererStyles, freeRendererStyles, weaponRendererStyles]) {
      expect(styles).toMatch(/content-font-size|feature-font-size/u);
      expect(styles).toContain("is-fluid");
    }
  });

  test("mixed-media cards place their title treatment on the image edge", () => {
    const adversaryMarkup = renderCard(adversaryTemplate, adversaryRendererRevision, "split");
    const referenceMarkup = renderCard(communityTemplate, communityRendererRevision, "split");
    const weaponMarkup = renderCard(weaponTemplate, weaponRendererRevision, "split");
    expect(adversaryMarkup).toMatch(/enemy-art[^>]*>.*enemy-heading/u);
    expect(adversaryRendererStyles).toContain(".enemy-art::after");
    expect(ancestryRendererStyles).toContain(".ancestry-card.is-split .ancestry-art::after");
    expect(referenceMarkup).toMatch(/community-card-art[^>]*>.*community-card-header/u);
    expect(communityRendererStyles).toContain(".community-card-art:after");
    expect(armorRendererStyles).toContain(".armor-card.is-split .armor-header{position:absolute");
    expect(environmentRendererStyles).toContain(".environment-card.is-split .environment-header{position:absolute");
    expect(freeRendererStyles).toContain(".free-card.is-split .free-header{position:absolute");
    expect(weaponMarkup).toMatch(/weapon-art[^>]*>.*weapon-header/u);
    expect(weaponRendererStyles).toContain(".weapon-card.is-split .weapon-header{position:absolute");
  });

  test("fits only effect text instead of statistics or flexible card whitespace", () => {
    expect(communityRendererStyles).toContain(".community-card-sections{min-height:0");
    expect(armorRendererStyles).toContain(".armor-effects{min-height:0");
    expect(environmentRendererStyles).toContain(".environment-features{min-height:0;flex:1;overflow:hidden;");
    expect(weaponRendererStyles).toContain(".weapon-description{min-height:0;flex:1");
  });

  test("draws decorative feature rules except above adversary descriptions", () => {
    expect(communityRendererStyles).toContain(".community-card-section h2");
    expect(ancestryRendererStyles).toContain(".ancestry-feature h2::after");
    expect(adversaryRendererStyles).not.toContain(".enemy-feature h2::after");
    expect(armorRendererStyles).toContain(".armor-feature h2::after");
    expect(environmentRendererStyles).toContain(".environment-feature-heading::after");
    expect(environmentRendererStyles).not.toContain(".environment-feature h2::after");
    expect(freeRendererStyles).toContain(".free-block h2::after");
    expect(weaponRendererStyles).toContain(".weapon-feature h2::after");
  });
});
