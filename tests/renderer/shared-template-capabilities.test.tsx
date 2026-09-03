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
  CommunityAuthoringEditor,
  domainRendererRevision,
  environmentRendererRevision,
  environmentRendererStyles,
  freeRendererRevision,
  freeRendererStyles,
  itemRendererRevision,
  professionRendererRevision,
  subclassRendererRevision,
  subclassRendererStyles,
  weaponRendererRevision,
  weaponRendererStyles,
  WeaponAuthoringEditor,
} from "../../packages/templates/src/frontend/index.ts";
import { referenceCardStyles } from "../../packages/templates/src/frontend/reference-card/renderer-factory.tsx";
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

describe("other first-party templates share ancestry card capabilities", () => {
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
      environmentRendererStyles, freeRendererStyles, referenceCardStyles, weaponRendererStyles,
    ]) {
      expect(styles).not.toContain("text-overflow:ellipsis");
    }
  });

  test("all first-party card titles share ancestry header padding", () => {
    expect(ancestryRendererStyles).toContain("padding: 10px 14px");
    expect(referenceCardStyles).toContain(".reference-card-header{position:relative;z-index:2;padding:10px 14px");
    expect(armorRendererStyles).toContain(".armor-header{flex:none;padding:10px 14px");
    expect(environmentRendererStyles).toContain(".environment-header{padding:10px 14px");
    expect(freeRendererStyles).toContain(".free-header{padding:10px 14px");
    expect(weaponRendererStyles).toContain(".weapon-header{flex:none;padding:10px 14px");
    expect(adversaryRendererStyles).toContain("top: calc(var(--enemy-media-height) + 10px)");
  });

  test("all first-party split cards share the ancestry image proportion", () => {
    expect(ancestryRendererStyles).toContain("--ancestry-media-height: 96px");
    expect(adversaryRendererStyles).toContain("--enemy-media-height: 96px");
    expect(referenceCardStyles).toContain("--reference-media-height:96px");
    expect(subclassRendererStyles).not.toContain("--reference-media-height:158px");
    expect(armorRendererStyles).toContain(".armor-art{height:170px");
    expect(weaponRendererStyles).toContain(".weapon-art{position:relative;height:170px");
    expect(freeRendererStyles).toContain(".free-art{height:170px");
    expect(environmentRendererStyles).toContain(".environment-art{height:170px");
    expect(environmentRendererStyles).toContain(".environment-card.is-split .environment-header{position:absolute;z-index:2;inset:0 0 auto;height:170px");
  });

  test("all first-party feature cards use compact padding", () => {
    expect(ancestryRendererStyles).toContain("padding: 6px; overflow: hidden; background: #f7ebd6;");
    expect(adversaryRendererStyles).toContain("padding: 6px; overflow: visible; background: #f7ebd6;");
    expect(armorRendererStyles).toContain(".armor-feature{flex:none;padding:6px;");
    expect(weaponRendererStyles).toContain(".weapon-feature{flex:none;padding:6px;");
    expect(environmentRendererStyles).toContain(".environment-feature{padding:6px;");
    expect(freeRendererStyles).toContain(".free-block{padding:6px;");
    expect(referenceCardStyles).toContain(".reference-card-section{padding:6px;");
  });

  test("armor and weapon editors split the legacy merged feature into name, English, and description", () => {
    const description = "受魔法伤害时，在计算伤害阈值前按护甲值减免伤害。";
    const armor = { ...structuredClone(armorTemplate.defaultData), 特性名: "防护", 特性原名: "", 特性描述: description };
    const armorMarkup = renderToStaticMarkup(<ArmorAuthoringEditor data={armor} onValue={() => undefined} />);
    expect(armorMarkup).toContain(">特性名<");
    expect(armorMarkup).toContain('value="防护"');
    expect(armorMarkup).toContain(">英文<");
    expect(armorMarkup).toContain(">特性描述<");
    expect(armorMarkup).toContain(description);
    expect(armorMarkup).not.toContain(">特性英文<");

    const weapon = { ...structuredClone(weaponTemplate.defaultData), 特性名: "横扫", 特性原名: "Sweep", 特性描述: description };
    const weaponMarkup = renderToStaticMarkup(<WeaponAuthoringEditor data={weapon} onValue={() => undefined} />);
    expect(weaponMarkup).toContain(">特性名<");
    expect(weaponMarkup).toContain('value="横扫"');
    expect(weaponMarkup).toContain('value="Sweep"');
    expect(weaponMarkup).toContain(">特性描述<");
    expect(weaponMarkup).toContain(description);
  });

  test("armor and weapon editors follow the card authoring field layout", () => {
    const labels = (markup: string) => [...markup.matchAll(/class="template-editor-field"[^>]*><span>([^<]+)<\/span>/gu)].map((match) => match[1]);

    const armorMarkup = renderToStaticMarkup(<ArmorAuthoringEditor data={structuredClone(armorTemplate.defaultData)} onValue={() => undefined} />);
    expect(labels(armorMarkup)).toEqual([
      "名称", "英文", "位阶", "类型", "风味描述",
      "护甲值", "重度伤害阈值", "严重伤害阈值",
      "特性名", "英文", "特性描述",
    ]);
    expect(armorMarkup.match(/<textarea/gu)).toHaveLength(2);

    const weaponMarkup = renderToStaticMarkup(<WeaponAuthoringEditor data={structuredClone(weaponTemplate.defaultData)} onValue={() => undefined} />);
    expect(labels(weaponMarkup)).toEqual([
      "名称", "英文", "位阶", "类型", "风味描述",
      "属性", "距离", "负荷", "伤害", "伤害类型",
      "特性名", "英文", "特性描述",
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
    community.特性 = { 名称: "社群特性", 原名: "Community Feature", 描述: "效果" };
    const communityMarkup = renderToStaticMarkup(communityRendererRevision.render({
      data: community,
      state: {},
      assets: {},
      presentation: { mode: "text", fixedRatio: true },
      attribution: { artworkCredit: "", sourceLabel: "" },
    }));
    expect(communityMarkup).toContain("Community Feature");

    const free = structuredClone(freeTemplate.defaultData);
    free.内容 = [{ 标题: "自定义效果", 原名: "Custom Effect", 正文: "效果" }];
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
    community.特性 = { 名称: "高人一等", 原名: "Privilege", 描述: "与贵族交际时具有优势。" };

    const editorMarkup = renderToStaticMarkup(<CommunityAuthoringEditor data={community} onValue={() => undefined} />);
    expect(editorMarkup).toContain("community-basics");
    expect(editorMarkup).toContain("repeat(3,minmax(0,1fr))");
    expect(editorMarkup.match(/class="is-auto-grow"/gu)).toHaveLength(3);
    expect(editorMarkup.indexOf(">名称<")).toBeLessThan(editorMarkup.indexOf(">英文<"));
    expect(editorMarkup.indexOf(">英文<")).toBeLessThan(editorMarkup.indexOf(">类型<"));
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
    expect(personalityHeading).toBeGreaterThan(cardMarkup.indexOf("reference-card-body"));
    expect(cardMarkup).not.toContain("reference-card-meta");
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
    expect(referenceMarkup).toMatch(/reference-card-art[^>]*>.*reference-card-header/u);
    expect(referenceCardStyles).toContain(".reference-card.is-split .reference-card-art::after");
    expect(armorRendererStyles).toContain(".armor-card.is-split .armor-header{position:absolute");
    expect(environmentRendererStyles).toContain(".environment-card.is-split .environment-header{position:absolute");
    expect(freeRendererStyles).toContain(".free-card.is-split .free-header{position:absolute");
    expect(weaponMarkup).toMatch(/weapon-art[^>]*>.*weapon-header/u);
    expect(weaponRendererStyles).toContain(".weapon-card.is-split .weapon-header{position:absolute");
  });

  test("fits only effect text instead of statistics or flexible card whitespace", () => {
    expect(referenceCardStyles).toContain(".reference-card-sections{min-height:0");
    expect(armorRendererStyles).toContain(".armor-effects{min-height:0");
    expect(environmentRendererStyles).toContain(".environment-features{min-height:0;flex:1;overflow:hidden}");
    expect(weaponRendererStyles).toContain(".weapon-description{min-height:0;flex:1");
  });

  test("draws decorative feature rules except above adversary descriptions", () => {
    expect(referenceCardStyles).toContain(".reference-card-section h2::after");
    expect(ancestryRendererStyles).toContain(".ancestry-feature h2::after");
    expect(adversaryRendererStyles).not.toContain(".enemy-feature h2::after");
    expect(armorRendererStyles).toContain(".armor-feature h2::after");
    expect(environmentRendererStyles).toContain(".environment-feature h2::after");
    expect(freeRendererStyles).toContain(".free-block h2::after");
    expect(weaponRendererStyles).toContain(".weapon-feature h2::after");
  });
});
