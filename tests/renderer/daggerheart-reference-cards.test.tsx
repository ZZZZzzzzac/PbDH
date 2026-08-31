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

  test("拒绝旧版和未知模板", () => {
    expect(stableReferenceRendererFor("种族", "0.9.0")).toBeUndefined();
    expect(stableReferenceRendererFor("环境", "1.0.0")).toBeUndefined();
  });
});
