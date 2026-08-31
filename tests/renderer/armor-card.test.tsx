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
  描述: "灵活：闪避值+1。",
  风味描述: "层叠缝制的轻便布甲。",
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
  });
});
