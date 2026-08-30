import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { rendererLabHosts } from "../../apps/creator/src/renderer-lab/lab-model.ts";
import { prepareCanonicalSurface, type SurfaceResource } from "../../packages/resource-renderer/src/core.ts";
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
  templateRegistry,
  weaponTemplate,
  type TemplateCoreCapability,
} from "../../packages/templates/src/core/index.ts";
import { trustedRendererFor } from "../../packages/templates/src/frontend/index.ts";
import {
  listLazyRendererBindings,
  loadTrustedRenderer,
} from "../../packages/templates/src/frontend/lazy-renderer-registry.ts";

const firstVersionTemplates: readonly TemplateCoreCapability<any>[] = [
  adversaryTemplate,
  weaponTemplate,
  armorTemplate,
  ancestryTemplate,
  communityTemplate,
  professionTemplate,
  subclassTemplate,
  itemTemplate,
  domainTemplate,
  environmentTemplate,
  freeTemplate,
];

describe("首版可信 Template 的 Canonical Surface conformance", () => {
  test("所有仍可解析的模板都不会再产出 90×142 卡面", () => {
    for (const template of templateRegistry.list()) {
      expect(template.defaultPresentation.width, `${template.id}@${template.version}`).toBe("63");
      if (template.defaultPresentation.fixedRatio) {
        expect(template.defaultPresentation.height, `${template.id}@${template.version}`).toBe("88");
      }
    }
  });

  test.each(firstVersionTemplates)("$id@$version 在四个宿主解析同一精确 Renderer", (template) => {
    const renderer = trustedRendererFor(template.id, template.version);
    expect(renderer).toBeDefined();
    if (!renderer) throw new Error(`缺少 ${template.id}@${template.version} Renderer`);

    const resource: SurfaceResource<Record<string, unknown>> = {
      template: { id: template.id, version: template.version },
      presentation: template.defaultPresentation,
      data: structuredClone(template.defaultData),
      media: {},
    };
    const result = prepareCanonicalSurface({
      resource,
      expectedRendererRevision: template.rendererRevision,
      renderer,
      assets: new Map(),
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error(JSON.stringify(result.diagnostics));
    expect(result.renderer.revision).toBe(template.rendererRevision);
    expect(result.widthMm).toBe(Number(template.defaultPresentation.width));
    expect(result.heightMm).toBe(Number(template.defaultPresentation.height));

    const hostOutputs = rendererLabHosts.map(() => renderToStaticMarkup(
      result.renderer.render(result.renderInput),
    ));
    expect(new Set(hostOutputs)).toHaveLength(1);
    expect(hostOutputs[0]).toContain(`data-renderer-revision=\"${template.rendererRevision}\"`);
  });

  test("未知 Template 或不支持的精确版本不会近似回退", () => {
    expect(trustedRendererFor("未知", "1.0.0")).toBeUndefined();
    expect(trustedRendererFor(adversaryTemplate.id, "2.0.0")).toBeUndefined();
    expect(trustedRendererFor(weaponTemplate.id, "1.0.1")).toBeUndefined();
  });

  test("只有当前 Renderer 可以按精确 Template 版本按需加载", async () => {
    expect(listLazyRendererBindings()).not.toContain("敌人@1.0.0-alpha.1");
    expect(listLazyRendererBindings()).toContain("敌人@1.0.0");
    await expect(loadTrustedRenderer("敌人", "1.0.0-alpha.1"))
      .resolves.toBeUndefined();
    await expect(loadTrustedRenderer("敌人", "2.0.0")).resolves.toBeUndefined();
  });
});
