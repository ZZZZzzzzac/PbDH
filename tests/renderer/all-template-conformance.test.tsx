import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { rendererHosts } from "./renderer-host-fixture.ts";
import { prepareCanonicalSurface, type SurfaceResource } from "../../packages/resource-renderer/src/core.ts";
import {
  adversaryTemplate,
  ancestryTemplate,
  armorTemplate,
  communityTemplate,
  currentTemplates,
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
import {
  adversaryRendererStyles,
  ancestryRendererStyles,
  armorRendererStyles,
  communityRendererStyles,
  domainRendererStyles,
  environmentRendererStyles,
  freeRendererStyles,
  itemRendererStyles,
  professionRendererStyles,
  subclassRendererStyles,
  trustedRendererFor,
  weaponRendererStyles,
} from "../../packages/templates/src/frontend/index.ts";
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
  test("所有第一方卡面共享敌人模板确立的暖色视觉语言", () => {
    const styles = [
      adversaryRendererStyles,
      ancestryRendererStyles,
      armorRendererStyles,
      communityRendererStyles,
      domainRendererStyles,
      environmentRendererStyles,
      freeRendererStyles,
      itemRendererStyles,
      professionRendererStyles,
      subclassRendererStyles,
      weaponRendererStyles,
    ];

    for (const style of styles) {
      expect(style).toContain("#eee4d0");
      expect(style).toContain("#641f1d");
      expect(style).toContain("Noto Sans SC");
    }
  });

  test("所有模板只声明卡面形式和是否固定比例", () => {
    for (const template of templateRegistry.list()) {
      expect(Object.keys(template.defaultPresentation).sort(), `${template.id}@${template.version}`)
        .toEqual(["fixedRatio", "mode"]);
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
    expect(result.designRatio).toEqual(template.defaultPresentation.fixedRatio
      ? { width: 63, height: 88 }
      : null);

    const hostOutputs = rendererHosts.map(() => renderToStaticMarkup(
      result.renderer.render(result.renderInput),
    ));
    expect(new Set(hostOutputs)).toHaveLength(1);
    expect(hostOutputs[0]).toContain(`data-renderer-revision=\"${template.rendererRevision}\"`);
  });

  test("未知 Template 或不支持的精确版本不会近似回退", () => {
    expect(trustedRendererFor("未知", "1.0.0")).toBeUndefined();
    expect(trustedRendererFor(adversaryTemplate.id, "2.0.0")).toBeUndefined();
    expect(trustedRendererFor(weaponTemplate.id, "1.0.2")).toBeUndefined();
  });

  test.each(currentTemplates)("$id@$version 图文模式按图片固有比例扩展固定正文", (template) => {
    const renderer = trustedRendererFor(template.id, template.version);
    expect(renderer).toBeDefined();
    if (!renderer) throw new Error(`缺少 ${template.id}@${template.version} Renderer`);
    const assetId = "sha256:portrait";
    const resource: SurfaceResource<Record<string, unknown>> = {
      template: { id: template.id, version: template.version },
      presentation: { mode: "split", fixedRatio: true },
      data: structuredClone(template.defaultData),
      media: { portrait: assetId },
    };
    const result = prepareCanonicalSurface({
      resource,
      expectedRendererRevision: template.rendererRevision,
      renderer,
      assets: new Map([[assetId, { status: "ready", url: "asset://portrait" }]]),
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error(JSON.stringify(result.diagnostics));
    expect(result.designRatio).toBeNull();
    expect(renderer.styles).toContain(".is-split");
    expect(renderer.styles).toMatch(/object-fit:\s*contain/);
    expect(renderer.styles).toContain("linear-gradient");
    expect(renderer.styles).toContain("--split-fixed-native-height");
    const markup = renderToStaticMarkup(renderer.render(result.renderInput));
    expect(markup).toContain("asset://portrait");
    expect(markup).toContain("has-fixed-base");
  });

  test("已保留和当前 Renderer 都可以按精确 Template 版本按需加载", async () => {
    expect(listLazyRendererBindings()).not.toContain("敌人@0.9.0");
    expect(listLazyRendererBindings()).toContain("敌人@1.0.0");
    expect(listLazyRendererBindings()).toContain("敌人@1.0.1");
    await expect(loadTrustedRenderer("敌人", "0.9.0"))
      .resolves.toBeUndefined();
    await expect(loadTrustedRenderer("敌人", "2.0.0")).resolves.toBeUndefined();
  });
});
