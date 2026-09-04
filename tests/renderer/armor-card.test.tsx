import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { prepareCanonicalSurface, type SurfaceResource } from "../../packages/resource-renderer/src/core.ts";
import { armorTemplate, type ArmorData } from "../../packages/templates/src/core/index.ts";
import {
  armorRendererFor,
  armorRendererRevision,
  armorRendererStyles,
} from "../../packages/templates/src/frontend/index.ts";

const data: ArmorData = {
  名称: "填充布甲",
  类型: "护甲",
  护甲值: "3",
  重度伤害阈值: "5",
  严重伤害阈值: "11",
  特性名称: "灵活",
  特性原文: "Flexible",
  特性描述: "闪避值+1。",
  简介: "层叠缝制的轻便布甲。",
  位阶: "1",
};

function resource(mode: "text" | "split" | "image" = "text"): SurfaceResource<ArmorData> {
  return {
    template: { id: armorTemplate.id, version: armorTemplate.version },
    presentation: { ...armorTemplate.defaultPresentation, mode },
    data,
    media: mode === "text" ? {} : { portrait: "portrait" },
  };
}

describe("armor-card-r1 Canonical Surface", () => {
  test("renders every official armor field in text mode", () => {
    const result = prepareCanonicalSurface({
      resource: resource(),
      expectedRendererRevision: armorTemplate.rendererRevision,
      renderer: armorRendererRevision,
      assets: new Map(),
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    const markup = renderToStaticMarkup(result.renderer.render(result.renderInput));
    for (const value of ["填充布甲", "位阶 1", "3", "5", "11", "灵活", "闪避值+1。", "层叠缝制的轻便布甲。"]) {
      expect(markup).toContain(value);
    }
    expect(markup).not.toContain("<img");
    expect(markup).toContain("data-renderer-revision=\"armor-card-r1\"");
    expect(markup).toContain('<div class="armor-title-stack">');
    expect(markup).toContain('<span class="armor-title-meta"><span>位阶 1</span><span>护甲</span></span>');
    expect(markup).not.toContain("armor-tier");
  });

  test("uses the approved compact equipment layout", () => {
    expect(armorRendererStyles).toContain(".armor-title-meta{display:flex;flex-direction:column;align-items:flex-end");
    expect(armorRendererStyles).toContain(".armor-stats{flex:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-block:1px solid #bfa47d");
    expect(armorRendererStyles).not.toContain(".armor-stats{display:grid;grid-template-columns:repeat(3,1fr);border:1px");
    expect(armorRendererStyles).toContain(".armor-feature{flex:none;padding:6px;background:#f7ebd6;border:1px solid #d4b78d;border-radius:4px}");
    expect(armorRendererStyles).toContain('.armor-feature h2{display:flex;align-items:baseline;gap:8px;margin:0;color:var(--oxblood);font:800 19px/1.25 "Noto Sans SC",sans-serif}');
    expect(armorRendererStyles).toContain('.armor-feature h2 [data-restricted-markdown]{color:inherit;font:inherit}');
    expect(armorRendererStyles).toContain('.armor-feature h2 small{color:#725747;font:650 12px/1.25 "Noto Sans SC",sans-serif;letter-spacing:.025em}');
    expect(armorRendererStyles).toContain('.armor-feature p,.armor-feature [data-restricted-markdown]{margin:5px 0 0;white-space:pre-wrap;font:450 var(--armor-content-font-size,15px)/1.45 "Noto Sans SC",sans-serif}');
    expect(armorRendererStyles).toContain('.armor-flavor[data-restricted-markdown]{margin:5px 0 0;white-space:pre-wrap;font:500 var(--armor-content-font-size,15px)/1.42 "Noto Sans SC",sans-serif');
  });

  test("uses the optional portrait for split and image modes", () => {
    const assets = new Map([["portrait", { status: "ready" as const, url: "blob:armor-portrait" }]]);
    for (const mode of ["split", "image"] as const) {
      const result = prepareCanonicalSurface({
        resource: resource(mode),
        expectedRendererRevision: armorTemplate.rendererRevision,
        renderer: armorRendererRevision,
        assets,
      });
      expect(result.status).toBe("ready");
      if (result.status !== "ready") throw new Error("Expected ready Surface");
      expect(renderToStaticMarkup(result.renderer.render(result.renderInput))).toContain("blob:armor-portrait");
    }
  });

  test("resolves only the exact immutable Renderer version", () => {
    expect(armorRendererFor("1.0.0")).toBe(armorRendererRevision);
    expect(() => armorRendererFor("0.9.0")).toThrow("Unsupported armor Renderer version");
    expect(armorRendererRevision.validateState({})).toBe(true);
    expect(armorRendererRevision.validateState({ marked: "1" })).toBe(false);
    expect(armorRendererStyles).toContain(".armor-card");
    expect(armorRendererStyles).toContain(".armor-card.is-split .armor-header{position:absolute");
    expect(armorRendererStyles).toContain(".armor-card.is-split .armor-art{order:-1}");
  });

  test("long fitted titles shrink instead of falling back to an ellipsis", () => {
    expect(armorRendererStyles).not.toContain("text-overflow:ellipsis");
    for (const name of ["贝拉莫伊精致护甲", "诚实蛋白石护甲"]) {
      const result = prepareCanonicalSurface({
        resource: { ...resource(), data: { ...data, 名称: name } },
        expectedRendererRevision: armorTemplate.rendererRevision,
        renderer: armorRendererRevision,
        assets: new Map(),
      });
      expect(result.status).toBe("ready");
      if (result.status !== "ready") throw new Error("Expected ready Surface");
      expect(renderToStaticMarkup(result.renderer.render(result.renderInput))).toContain(name);
    }
  });
});
