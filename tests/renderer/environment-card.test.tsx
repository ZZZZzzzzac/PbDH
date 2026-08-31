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
  原文: "ABANDONED GROVE",
  位阶: "1",
  种类: "探索",
  简介: "一片曾经的德鲁伊林地。",
  趋向: "吸引好奇者，反映过往",
  难度: "11",
  潜在敌人: "野兽，林地守卫",
  特性: [{
    名称: "蔓生战场",
    原名: "Overgrown Battlefield",
    类型: "被动",
    描述: "此地曾发生过一场战斗。",
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

describe("environment-card-r1 Canonical Surface", () => {
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
    expect(markup).toContain("data-renderer-revision=\"environment-card-r1\"");
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
  });
});
