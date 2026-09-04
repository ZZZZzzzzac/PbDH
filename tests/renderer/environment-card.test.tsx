import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { prepareCanonicalSurface, type SurfaceResource } from "../../packages/resource-renderer/src/core.ts";
import { environmentTemplate, type EnvironmentData } from "../../packages/templates/src/core/index.ts";
import {
  environmentRendererFor,
  environmentRendererRevision,
  environmentRendererStyles,
} from "../../packages/templates/src/frontend/index.ts";

const data: EnvironmentData = {
  名称: "荒废林地",
  类型: "环境",
  原文: "ABANDONED GROVE",
  位阶: "1",
  种类: "探索",
  简介: "一片曾经的德鲁伊林地。",
  趋向: "吸引好奇者，反映过往",
  难度: "11",
  潜在敌人: "野兽，林地守卫",
  特性: [{
    特性名称: "蔓生战场",
    特性原文: "Overgrown Battlefield",
    特性类型: "被动",
    特性描述: "此地曾发生过一场战斗。",
    引导问题: "曾在此地的那些团体为何发生冲突？",
  }],
};

function resource(mode: "text" | "split" | "image" = "text"): SurfaceResource<EnvironmentData> {
  return {
    template: { id: environmentTemplate.id, version: environmentTemplate.version },
    presentation: { ...environmentTemplate.defaultPresentation, mode },
    data,
    media: mode === "text" ? {} : { portrait: "portrait" },
  };
}

describe("environment-card-r2 Canonical Surface", () => {
  test("defaults to fluid height", () => {
    expect(environmentTemplate.defaultPresentation).toEqual({ mode: "text", fixedRatio: false });
  });

  test("renders every environment field in text mode", () => {
    const result = prepareCanonicalSurface({
      resource: resource(),
      expectedRendererRevision: environmentTemplate.rendererRevision,
      renderer: environmentRendererRevision,
      assets: new Map(),
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    const markup = renderToStaticMarkup(result.renderer.render(result.renderInput));
    for (const value of [
      "荒废林地", "ABANDONED GROVE", "位阶 1", "探索", "11", "吸引好奇者",
      "野兽，林地守卫", "蔓生战场", "Overgrown Battlefield", "被动", "曾在此地", "为何发生冲突",
    ]) expect(markup).toContain(value);
    expect(markup).not.toContain("<img");
    expect(markup).toContain("data-renderer-revision=\"environment-card-r2\"");
    expect(markup).toContain("environment-header-columns");
    expect(markup).toContain("environment-difficulty-label");
    expect(markup).toContain("environment-record");
    expect(markup).toContain("environment-feature-identity");
    expect(markup).toContain("environment-feature-copy");
    expect(markup).toMatch(/environment-feature-copy[^]*?<\/div><p class="environment-question"/u);
    expect(markup.indexOf("environment-difficulty")).toBeLessThan(markup.indexOf("environment-feature-heading"));
  });

  test("uses optional portrait and resolves only the exact stable version", () => {
    const result = prepareCanonicalSurface({
      resource: resource("split"),
      expectedRendererRevision: environmentTemplate.rendererRevision,
      renderer: environmentRendererRevision,
      assets: new Map([["portrait", { status: "ready", url: "blob:environment-portrait" }]]),
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    expect(renderToStaticMarkup(result.renderer.render(result.renderInput))).toContain("blob:environment-portrait");
    expect(environmentRendererFor("1.0.0")).toBe(environmentRendererRevision);
    expect(() => environmentRendererFor("0.9.0")).toThrow("Unsupported environment Renderer version");
    expect(environmentRendererStyles).toContain(".environment-card");
    expect(environmentRendererStyles).toContain(".environment-record{margin:0;padding:6px 18px}");
    expect(environmentRendererStyles).toContain(".environment-record>div+div{margin-top:0;padding-top:6px;");
    expect(environmentRendererStyles).toContain(".environment-feature-identity{min-width:0;padding-right:7px}");
    expect(environmentRendererStyles).toContain(".environment-question{grid-column:1/-1;");
    expect(environmentRendererStyles).toContain(".environment-header-columns{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;");
  });

  test("does not render empty English title nodes", () => {
    const emptyEnglishResource = resource();
    emptyEnglishResource.data = {
      ...data,
      原文: "   ",
      特性: data.特性.map((feature) => ({ ...feature, 特性原文: "   " })),
    };
    const result = prepareCanonicalSurface({
      resource: emptyEnglishResource,
      expectedRendererRevision: environmentTemplate.rendererRevision,
      renderer: environmentRendererRevision,
      assets: new Map(),
    });
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    const markup = renderToStaticMarkup(result.renderer.render(result.renderInput));

    expect(markup).not.toContain("environment-original");
    expect(markup).not.toMatch(/environment-feature-identity[^]*?<small>/u);
  });

  test("omits empty optional scene rows without weakening the difficulty marker", () => {
    const sparseResource = resource();
    sparseResource.data = { ...data, 简介: " ", 趋向: "", 潜在敌人: "  " };
    const result = prepareCanonicalSurface({
      resource: sparseResource,
      expectedRendererRevision: environmentTemplate.rendererRevision,
      renderer: environmentRendererRevision,
      assets: new Map(),
    });
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    const markup = renderToStaticMarkup(result.renderer.render(result.renderInput));

    expect(markup).toContain("environment-difficulty-label");
    expect(markup).not.toContain(">简介<");
    expect(markup).not.toContain(">趋向<");
    expect(markup).not.toContain(">潜在敌人<");
  });
});
