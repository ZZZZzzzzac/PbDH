import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { rendererHosts } from "./renderer-host-fixture.ts";
import {
  prepareCanonicalSurface,
  RendererRevisionRegistry,
  type ManagedAsset,
} from "../../packages/resource-renderer/src/core.ts";
import {
  buildCanonicalCardCoverSvg,
  CanonicalCardSurface,
} from "../../packages/resource-renderer/src/react.tsx";
import type { AdversaryData } from "../../packages/templates/src/core/index.ts";
import {
  adversaryCardDesignSource,
  adversaryRendererRevision,
  adversaryRendererStyles,
  type AdversaryRuntimeState,
} from "../../packages/templates/src/frontend/index.ts";

const root = process.cwd();
const packageFixture = JSON.parse(readFileSync(
  path.join(root, "contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json"),
  "utf8",
)) as {
  assets: Array<{ id: string }>;
  resources: Array<{
    template: { id: string; version: string };
    presentation: {
      mode: "text" | "split" | "image";
      fixedRatio: boolean;
    };
    data: AdversaryData;
    media: Record<string, string>;
  }>;
};
const resource = packageFixture.resources[0]!;
const assetId = packageFixture.assets[0]!.id;
const readyAssets = new Map<string, ManagedAsset>([
  [assetId, { status: "ready", url: "asset://minotaur" }],
]);

function prepare(input: {
  state?: unknown;
  assets?: ReadonlyMap<string, ManagedAsset>;
  renderer?: typeof adversaryRendererRevision;
  candidate?: typeof resource;
} = {}) {
  return prepareCanonicalSurface({
    resource: input.candidate ?? resource,
    expectedRendererRevision: "enemy-card-r1",
    renderer: input.renderer === undefined ? adversaryRendererRevision : input.renderer,
    assets: input.assets ?? readyAssets,
    state: input.state,
  });
}

describe("Canonical Surface Renderer Port", () => {
  test("uses default state without mutating source Resource", () => {
    const before = structuredClone(resource);
    const result = prepare();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    expect(result.designRatio).toEqual({ width: 63, height: 88 });
    expect(result.renderInput.state).toEqual({
      currentHp: "7",
      currentStress: "0",
      focused: "false",
      notes: "",
    });
    expect(resource).toEqual(before);
  });

  test("renders current state and GM-private definition through the same Revision", () => {
    const state: AdversaryRuntimeState = {
      currentHp: "3",
      currentStress: "4",
      focused: "true",
      notes: "角部受伤",
    };
    const privateResource = structuredClone(resource);
    privateResource.data.名称 = "伤痕牛头人";
    const result = prepare({ state, candidate: privateResource });
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    const markup = renderToStaticMarkup(result.renderer.render(result.renderInput));
    expect(markup).toContain("伤痕牛头人");
    expect(markup).toContain("HP 3/7");
    expect(markup).toContain("压力 4/5");
    expect(markup).toContain("is-focused");
    expect(result.renderer.revision).toBe("enemy-card-r1");
  });

  test("returns stable unsupported, invalid-state, and invalid-presentation diagnostics", () => {
    const unsupported = prepareCanonicalSurface({
      resource,
      expectedRendererRevision: "enemy-card-r2",
      renderer: undefined,
      assets: readyAssets,
    });
    expect(unsupported.status).toBe("error");
    expect(unsupported.diagnostics.map((item) => item.code)).toEqual([
      "renderer.revision.unsupported",
    ]);

    const invalidState = prepare({ state: { currentHp: 3 } });
    expect(invalidState.status).toBe("error");
    expect(invalidState.diagnostics.map((item) => item.code)).toEqual([
      "renderer.state.invalid",
    ]);

    const invalidMode = structuredClone(resource);
    invalidMode.presentation.mode = "unknown" as "text";
    const invalidPresentation = prepare({ candidate: invalidMode });
    expect(invalidPresentation.status).toBe("error");
    expect(invalidPresentation.diagnostics.map((item) => item.code)).toEqual([
      "renderer.presentation.invalid",
    ]);
  });

  test("distinguishes loading, missing, and decode-failed media", () => {
    const loading = prepare({ assets: new Map([[assetId, { status: "loading" }]]) });
    expect(loading.status).toBe("loading");
    expect(loading.diagnostics[0]?.code).toBe("renderer.media.loading");

    const missing = prepare({ assets: new Map() });
    expect(missing.status).toBe("error");
    expect(missing.diagnostics[0]?.code).toBe("renderer.media.asset-missing");

    const failed = prepare({
      assets: new Map([[assetId, { status: "error", reason: "decode failed" }]]),
    });
    expect(failed.status).toBe("error");
    expect(failed.diagnostics[0]).toMatchObject({
      code: "renderer.media.decode-failed",
      params: { reason: "decode failed" },
    });
  });

  test("renders explicit text, split and image presentation modes", () => {
    const textOnlyResource = structuredClone(resource);
    textOnlyResource.presentation.mode = "text";
    textOnlyResource.media = {};
    const result = prepare({ candidate: textOnlyResource, assets: new Map() });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    const markup = renderToStaticMarkup(result.renderer.render(result.renderInput));
    expect(markup).toContain("enemy-art is-text-only");
    expect(markup).not.toContain("<img");
    expect(markup).toContain("牛头人破坏者");

    const split = prepare();
    if (split.status !== "ready") throw new Error("Expected ready Surface");
    const splitMarkup = renderToStaticMarkup(split.renderer.render(split.renderInput));
    expect(splitMarkup).toContain("data-presentation-mode=\"split\"");
    expect(splitMarkup).toContain("<img");

    const imageResource = structuredClone(resource);
    imageResource.presentation.mode = "image";
    const image = prepare({ candidate: imageResource });
    if (image.status !== "ready") throw new Error("Expected ready Surface");
    const imageMarkup = renderToStaticMarkup(image.renderer.render(image.renderInput));
    expect(imageMarkup).toContain("is-image");
    expect(imageMarkup).toContain("<img");
    expect(imageMarkup).not.toContain("enemy-body");
  });

  test("passes the fixed-ratio policy into the canonical renderer", () => {
    const fluidResource = structuredClone(resource);
    fluidResource.presentation.fixedRatio = false;
    const result = prepare({ candidate: fluidResource });
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    const markup = renderToStaticMarkup(result.renderer.render(result.renderInput));
    expect(markup).toContain("is-fluid");
    expect(result.renderInput.presentation.fixedRatio).toBe(false);
  });

  test("uses the canonical ratio only for fixed cards", () => {
    const fluidResource = structuredClone(resource);
    fluidResource.presentation.fixedRatio = false;
    const fluid = prepare({ candidate: fluidResource });
    if (fluid.status !== "ready") throw new Error("Expected ready Surface");
    expect(fluid.designRatio).toBeNull();
    expect(fluid.renderInput.presentation).toEqual({ mode: "split", fixedRatio: false });
  });

  test("builds publication cover SVG through the same renderer with fixed ratio", async () => {
    const fluidResource = structuredClone(resource);
    fluidResource.presentation.fixedRatio = false;
    const before = structuredClone(fluidResource);

    const cover = await buildCanonicalCardCoverSvg({
      resource: fluidResource,
      expectedRendererRevision: "enemy-card-r1",
      renderer: adversaryRendererRevision,
      assets: readyAssets,
    });

    expect(cover.width).toBe(630);
    expect(cover.height).toBe(880);
    expect(cover.svg).toContain("data-renderer-revision=\"enemy-card-r1\"");
    expect(cover.svg).toContain("牛头人破坏者");
    expect(cover.svg).not.toContain("enemy-card is-fluid");
    expect(fluidResource).toEqual(before);
  });

  test("Renderer Registry resolves exact immutable Revision without fallback", () => {
    const registry = new RendererRevisionRegistry([adversaryRendererRevision]);
    expect(registry.resolve("enemy-card-r1")).toBe(adversaryRendererRevision);
    expect(registry.resolve("enemy-card-r2")).toBeUndefined();
    expect(registry.list()).toEqual(["enemy-card-r1"]);
    expect(() => new RendererRevisionRegistry([
      adversaryRendererRevision,
      adversaryRendererRevision,
    ])).toThrow("Duplicate Renderer Revision: enemy-card-r1");
  });
});

describe("enemy-card-r1 structure and visual baseline", () => {
  test("is generated from the tracked OpenPencil design source", () => {
    expect(adversaryCardDesignSource).toEqual({
      document: "docs/design/creator-app.op",
      page: "30 Components",
      surface: "#28 / Canonical Card Surface",
      component: "enemy-card-r1 / Canonical",
      presentation: { ratio: "63:88", variableHeight: false },
      featureNames: ["特性 / 蓄力", "特性 / 蛮牛冲撞", "特性 / 角撞"],
    });
  });

  test("keeps the Surface behind a Shadow DOM host sized by its App", () => {
    const markup = renderToStaticMarkup(
      <CanonicalCardSurface
        resource={resource}
        expectedRendererRevision="enemy-card-r1"
        renderer={adversaryRendererRevision}
        assets={readyAssets}
      />,
    );
    expect(markup).toContain("data-pbdh-canonical-surface");
    expect(markup).toContain("width:100%");
    expect(markup).toContain("height:auto");
    expect(markup).toContain("aspect-ratio:63 / 88");
    expect(markup).not.toContain("enemy-card");

    const fluidResource = structuredClone(resource);
    fluidResource.presentation.fixedRatio = false;
    const fluidMarkup = renderToStaticMarkup(
      <CanonicalCardSurface
        resource={fluidResource}
        expectedRendererRevision="enemy-card-r1"
        renderer={adversaryRendererRevision}
        assets={readyAssets}
      />,
    );
    expect(fluidMarkup).toContain("height:auto");
  });

  test("four host shells vary only external scale and decoration", () => {
    expect(rendererHosts.map((host) => host.id)).toEqual([
      "creator",
      "player",
      "gm",
      "market",
    ]);
    expect(new Set(rendererHosts.map((host) => host.scale)).size).toBe(4);
    expect(rendererHosts.every((host) => host.scale > 0)).toBe(true);
  });

  test("matches the reviewed Revision source baseline", () => {
    const result = prepare();
    if (result.status !== "ready") throw new Error("Expected ready Surface");
    const markup = renderToStaticMarkup(result.renderer.render(result.renderInput));
    expect(markup).toContain("data-renderer-revision=\"enemy-card-r1\"");
    expect(markup).toContain("<strong>花费 1 恐惧点</strong>");
    expect(markup).toContain("<div class=\"enemy-brief\">");
    expect(markup).toContain("<div class=\"enemy-feature-heading\">特性</div>");
    expect(markup).toContain("<small><span>Charging Bull</span><span>动作</span></small>");
    expect(markup).not.toContain("<span>生命</span>");
    expect(markup).not.toContain("<span>压力</span>");
    expect(markup).toContain("aria-label=\"将生命设为 6\"");
    expect(markup).toContain("disabled=\"\"");
    expect(adversaryRendererStyles).toContain(".enemy-card.is-fluid");
    expect(adversaryRendererStyles).toContain(".enemy-card.is-image .enemy-art{height:100%}");
    const signature = createHash("sha256")
      .update(adversaryRendererStyles)
      .update("\0")
      .update(markup)
      .digest("hex");
    expect(signature).toBe("17be9b1c03e6b082ba70dea2942e8493b4c4ded2e1781565c707464ce79525f4");
  });
});
