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
import { weaponTemplateV2, type WeaponData } from "../../packages/templates/src/core/index.ts";
import {
  weaponCardDesignSource,
  weaponRendererRevision,
  weaponRendererStyles,
  weaponRendererRevisionV2,
} from "../../packages/templates/src/frontend/index.ts";

const root = process.cwd();
const packageFixture = JSON.parse(readFileSync(
  path.join(root, "contracts/conformance/resource-package/1.0.0-alpha.1/valid/daggerheart-core-primary-weapon.json"),
  "utf8",
)) as {
  resources: Array<{
    template: { id: string; version: string };
    presentation: {
      width: string;
      height: string;
      unit: "mm";
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
    expectedRendererRevision: "weapon-card-r1",
    renderer: weaponRendererRevision,
    assets,
  });
}

describe("weapon-card-r1 Canonical Surface", () => {
  test("binds the exact weapon Template and stateless Renderer Revision", () => {
    const result = prepare();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    expect(result.widthMm).toBe(90);
    expect(result.heightMm).toBe(142);
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
    expect(markup).toContain("data-renderer-revision=\"weapon-card-r1\"");
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
    expect(weaponRendererStyles).toContain(".weapon-card {\n");
    expect(weaponRendererStyles).toContain("overflow: hidden;");
    expect(weaponRendererStyles).toContain(".weapon-description");
    expect(weaponRendererStyles).toContain(".weapon-card.is-fluid");

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
        expectedRendererRevision="weapon-card-r1"
        renderer={weaponRendererRevision}
        assets={new Map()}
        label="武器卡预览"
      />,
    );
    expect(markup).toContain("data-pbdh-canonical-surface");
    expect(markup).toContain("width:90mm");
    expect(markup).toContain("height:142mm");
    expect(markup).not.toContain("weapon-card");
  });

  test("is generated from the single reviewed OpenPencil component", () => {
    expect(weaponCardDesignSource).toEqual({
      document: "docs/design/creator-app.op",
      page: "30 Components",
      surface: "#28 / Canonical Card Surface",
      component: "weapon-card-r1 / Canonical",
      presentation: { width: "90mm", height: "142mm" },
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
    expect(signature).toBe("7d65677973706b5a6d1c0456ddd8d1556e99b38f663c17789f298ec7c58faab6");
  });

  test("Renderer Registry resolves exact immutable Revision without fallback", () => {
    const registry = new RendererRevisionRegistry([weaponRendererRevision]);
    expect(registry.resolve("weapon-card-r1")).toBe(weaponRendererRevision);
    expect(registry.resolve("weapon-card-r2")).toBeUndefined();
    expect(registry.list()).toEqual(["weapon-card-r1"]);
  });
});

describe("weapon-card-r2 flavor surface", () => {
  test("renders flavor separately from the gameplay feature", () => {
    const candidate = {
      template: { id: weaponTemplateV2.id, version: weaponTemplateV2.version },
      presentation: weaponTemplateV2.defaultPresentation,
      data: {
        ...weaponTemplateV2.defaultData,
        名称: "月刃",
        描述: "可靠：攻击掷骰+1。",
        风味描述: "刀身映着冷白月光。",
      },
      media: {},
    };
    const result = prepareCanonicalSurface({
      resource: candidate,
      expectedRendererRevision: "weapon-card-r2",
      renderer: weaponRendererRevisionV2,
      assets: new Map(),
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    const markup = renderToStaticMarkup(result.renderer.render(result.renderInput));
    expect(markup).toContain("刀身映着冷白月光。");
    expect(markup).toContain("攻击掷骰+1。");
    expect(markup).toContain("data-renderer-revision=\"weapon-card-r2\"");
  });
});
