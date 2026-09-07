import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  prepareCanonicalSurface,
  RendererRevisionRegistry,
} from "../../packages/resource-renderer/src/core.ts";
import { CanonicalCardSurface } from "../../packages/resource-renderer/src/react.tsx";
import { weaponTemplate, type WeaponData } from "../../packages/templates/src/core/index.ts";
import {
  weaponCardRenderSource,
  weaponRendererRevision,
  weaponRendererStyles,
} from "../../packages/templates/src/frontend/index.ts";

const root = process.cwd();
const packageFixture = JSON.parse(readFileSync(
  path.join(root, "contracts/conformance/resource-package/1.0.0/valid/daggerheart-core-primary-weapon.json"),
  "utf8",
)) as {
  resources: Array<{
    template: { id: string; version: string };
    presentation: {
      mode: "text";
      fixedRatio: boolean;
    };
    data: WeaponData;
    media: Record<string, string>;
  }>;
};
const resource = packageFixture.resources[0]!;

function prepare(candidate = resource, assets = new Map()) {
  return prepareCanonicalSurface({
    resource: candidate,
    expectedRendererRevision: "weapon-card-r2",
    renderer: weaponRendererRevision,
    assets,
  });
}

describe("weapon-card-r2 Canonical Surface", () => {
  test("binds the exact weapon Template and stateless Renderer Revision", () => {
    const result = prepare();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    expect(result.designRatio).toEqual({ width: 63, height: 88 });
    expect(result.renderInput.state).toEqual({});
    expect(result.renderer).toBe(weaponRendererRevision);
    expect(weaponRendererRevision.requiredMediaSlots).toEqual([]);
    expect(weaponRendererRevision.optionalMediaSlots).toEqual(["portrait"]);
    expect(weaponRendererRevision.validateState({})).toBe(true);
    expect(weaponRendererRevision.validateState({ selected: "true" })).toBe(false);
  });

  test("renders every weapon field without reserving an image region in text mode", () => {
    const result = prepare();
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    const markup = renderToStaticMarkup(result.renderer.render(result.renderInput));
    for (const value of ["阔剑", "主武器", "位阶 1", "敏捷", "近战", "d8", "单手", "物理", "可靠", "你的攻击掷骰+1。"]) {
      expect(markup).toContain(value);
    }
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("weapon-art");
    expect(markup).toContain('<div class="weapon-title-stack">');
    expect(markup).toContain('<span class="weapon-title-meta"><span>位阶 1</span><span>主武器</span></span>');
    expect(markup).toContain('<div class="weapon-detail"><span>伤害类型</span><b>物理</b></div>');
    expect(markup).toContain('<div class="weapon-detail"><span>负荷</span><b>单手</b></div>');
    expect(markup).toContain("data-renderer-revision=\"weapon-card-r2\"");
  });

  test("uses the approved compact equipment layout", () => {
    expect(weaponRendererStyles).toContain(".weapon-card-frame{position:relative;width:63px;height:88px");
    expect(weaponRendererStyles).toContain(".weapon-title-meta{display:flex;flex-direction:column;align-items:flex-end");
    expect(weaponRendererStyles).toContain(".weapon-card.is-split .weapon-header{position:absolute;z-index:2;inset:0;height:auto");
    expect(weaponRendererStyles).toContain(".weapon-stats{flex:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-block:1px solid #bfa47d");
    expect(weaponRendererStyles).toContain(".weapon-detail{display:flex;align-items:baseline;gap:8px");
    expect(weaponRendererStyles).not.toContain(".weapon-detail{display:flex;align-items:center;justify-content:space-between;padding:");
    expect(weaponRendererStyles).not.toContain(".weapon-detail{display:flex;align-items:baseline;gap:8px;background:");
    expect(weaponRendererStyles).toContain(".weapon-feature{flex:none;padding:6px;background:#f7ebd6;border:1px solid #d4b78d;border-radius:4px}");
    expect(weaponRendererRevision.styles).toContain(".weapon-feature h2>[data-restricted-markdown]{min-height:0;overflow:visible;color:inherit;font:inherit}");
    expect(weaponRendererRevision.styles).not.toContain("font:500 2.1px/1.3");
  });

  test("renders split and image presentation modes from the optional portrait", () => {
    const candidate = structuredClone(resource);
    const presentation = candidate.presentation as { mode: "text" | "split" | "image" };
    candidate.media.portrait = "portrait";
    const assets = new Map([["portrait", { status: "ready" as const, url: "blob:weapon-portrait" }]]);
    presentation.mode = "split";
    const split = prepare(candidate, assets);
    if (split.status !== "ready") throw new Error("Expected ready Surface");
    expect(renderToStaticMarkup(split.renderer.render(split.renderInput))).toContain("weapon-art");

    presentation.mode = "image";
    const image = prepare(candidate, assets);
    if (image.status !== "ready") throw new Error("Expected ready Surface");
    const markup = renderToStaticMarkup(image.renderer.render(image.renderInput));
    expect(markup).toContain("is-image-only");
    expect(markup).toContain("blob:weapon-portrait");
    expect(markup).not.toContain("weapon-body");
  });

  test("keeps fixed-ratio overflow clipped and allows explicit fluid growth", () => {
    expect(weaponRendererStyles).toContain(".weapon-card{");
    expect(weaponRendererStyles).toContain("overflow:hidden");
    expect(weaponRendererStyles).toContain(".weapon-description");
    expect(weaponRendererStyles).toContain(".weapon-card.is-fluid");
    expect(weaponRendererStyles).toContain(".weapon-card>.pbdh-card-footer{color:#725747;background:var(--bone);border-top:1px solid #d4b78d");

    const fluidResource = structuredClone(resource);
    fluidResource.presentation.fixedRatio = false;
    const fluid = prepare(fluidResource);
    if (fluid.status !== "ready") throw new Error("Expected ready Surface");
    expect(renderToStaticMarkup(fluid.renderer.render(fluid.renderInput))).toContain("is-fluid");
  });

  test("uses one shared Renderer Port across Creator, Market, and Player", () => {
    const hostRenderers = {
      creator: weaponRendererRevision,
      market: weaponRendererRevision,
      player: weaponRendererRevision,
    };
    expect(new Set(Object.values(hostRenderers))).toEqual(new Set([weaponRendererRevision]));

    const markup = renderToStaticMarkup(
      <CanonicalCardSurface
        resource={resource}
        expectedRendererRevision="weapon-card-r2"
        renderer={weaponRendererRevision}
        assets={new Map()}
        label="武器卡预览"
      />,
    );
    expect(markup).toContain("data-pbdh-canonical-surface");
    expect(markup).toContain("width:100%");
    expect(markup).toContain("height:auto");
    expect(markup).toContain("aspect-ratio:63 / 88");
    expect(markup).not.toContain("weapon-card");
  });

  test("uses the Template HTML/CSS implementation as its only visual source", () => {
    expect(weaponCardRenderSource).toEqual({
      source: "template-html-css",
      implementation: "packages/templates/src/frontend/weapon/1.0.0/renderer.tsx",
      fixedRatio: { width: 63, height: 88 },
      statNames: ["核心数据 / 属性", "核心数据 / 距离", "核心数据 / 伤害"],
      detailNames: ["规则 / 伤害类型", "规则 / 负荷"],
    });
    const result = prepare();
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    const markup = renderToStaticMarkup(result.renderer.render(result.renderInput));
    const signature = createHash("sha256")
      .update(weaponRendererStyles)
      .update("\0")
      .update(markup)
      .digest("hex");
    expect(signature).toBe("15442f9df27656f2dc084ab51d45d0a0f0b78cc170507e9e9f7ff36d08b215e7");
  });

  test("Renderer Registry resolves exact immutable Revision without fallback", () => {
    const registry = new RendererRevisionRegistry([weaponRendererRevision]);
    expect(registry.resolve("weapon-card-r2")).toBe(weaponRendererRevision);
    expect(registry.resolve("weapon-card-r1")).toBeUndefined();
    expect(registry.list()).toEqual(["weapon-card-r2"]);
  });
});

describe("weapon-card-r2 flavor surface", () => {
  test("renders flavor separately from the gameplay feature", () => {
    const candidate = {
      template: { id: weaponTemplate.id, version: weaponTemplate.version },
      presentation: weaponTemplate.defaultPresentation,
      data: {
        ...weaponTemplate.defaultData,
        名称: "月刃",
        特性名: "可靠",
        特性原名: "Reliable",
        特性描述: "攻击掷骰+1。",
        简介: "刀身映着冷白月光。",
      },
      media: {},
    };
    const result = prepareCanonicalSurface({
      resource: candidate,
      expectedRendererRevision: "weapon-card-r2",
      renderer: weaponRendererRevision,
      assets: new Map(),
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    const markup = renderToStaticMarkup(result.renderer.render(result.renderInput));
    expect(markup).toContain("刀身映着冷白月光。");
    expect(markup).toContain("攻击掷骰+1。");
    expect(markup).toMatch(/<section class="weapon-feature">.*攻击掷骰\+1。.*<\/section><div class="weapon-flavor"/u);
    expect(markup).toContain("data-renderer-revision=\"weapon-card-r2\"");
  });
});
