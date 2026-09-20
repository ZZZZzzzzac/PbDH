// @vitest-environment happy-dom
import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  rhodesSubclassAuthoring,
  rhodesSubclassRendererRevision,
  rhodesSubclassRendererStyles,
  resolveTemplateFrontend,
} from "../../packages/templates/src/frontend/index.ts";
import { loadTrustedAuthoring, loadTrustedRenderer } from "../../packages/templates/src/frontend/lazy-renderer-registry.ts";
import {
  rhodesSubclassTemplate,
  templateRegistry,
} from "../../packages/templates/src/core/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(rhodesSubclassTemplate.schema as AnySchema);

const wildcaster = {
  名称: "荒野术师",
  原文: "Wildcaster",
  类型: "子职",
  主职: "术师",
  等级: "精英Y",
  阶段: "T4Y",
  施法属性: "意志",
  推荐次领域: "荒野",
  武器原型: "法器",
  子职提升: "提升轰炸",
  子职特性: "荒野形态只在子职生效。",
  职业特性: "职业专属特性文本。",
  希望特性: "希望专属特性文本。",
  特性: [{ 特性名称: "荒野呼唤", 特性原文: "Wild Call", 特性描述: "召唤**荒野**的造物。" }],
  简介: "荒野中的**术师**。",
};

const textPresentation = rhodesSubclassTemplate.defaultPresentation;

function renderCard(data: unknown, assets: Readonly<Partial<Record<string, string>>> = {}, presentation = textPresentation, attribution?: { artworkCredit: string; sourceLabel: string }) {
  return renderToStaticMarkup(rhodesSubclassRendererRevision.render({
    data: data as never,
    state: rhodesSubclassTemplate.tabletop.defaultState(data as never),
    assets,
    presentation,
    attribution,
  }));
}

describe("罗德岛子职 Template 1.0.0 frontend", () => {
  test("registers a tttri-owned subclass renderer and editor", () => {
    expect(templateRegistry.resolve("罗德岛子职", "1.0.0")).toBe(rhodesSubclassTemplate);
    expect(validate(wildcaster), JSON.stringify(validate.errors)).toBe(true);
    expect(rhodesSubclassTemplate.proposeResourceId(wildcaster)).toBe("子职:术师:荒野术师:T4Y");
    expect(rhodesSubclassRendererRevision.revision).toBe("rhodes-subclass-card-r1");
    expect(rhodesSubclassRendererStyles).toContain(".rhodes-subclass-card{");
    expect(rhodesSubclassRendererStyles).not.toContain(".subclass-card-");
    expect(rhodesSubclassAuthoring).toMatchObject({ templateId: "罗德岛子职", templateVersion: "1.0.0" });
  });

  test("renders every tttri subclass field on the card", () => {
    const markup = renderCard(wildcaster);

    expect(markup).toContain('data-renderer-revision="rhodes-subclass-card-r1"');
    expect(markup).toContain('data-template-id="罗德岛子职"');
    expect(markup).toContain("荒野术师");
    expect(markup).toContain("Wildcaster");
    expect(markup).toMatch(/rhodes-subclass-card-summary[^>]*data-restricted-markdown="true"/u);
    for (const stat of ["主职", "阶段", "等级", "施法属性"]) expect(markup).toContain(`<span>${stat}</span>`);
    for (const value of ["术师", "T4Y", "精英Y", "意志"]) expect(markup).toContain(`<b>${value}</b>`);
    for (const profile of ["武器原型", "推荐次领域", "子职提升"]) expect(markup).toContain(`<span>${profile}</span>`);
    expect(markup).toContain("<p>法器</p>");
    expect(markup).toContain("<p>荒野</p>");
    expect(markup).toContain("<p>提升轰炸</p>");
    expect(markup).toContain("<span>荒野呼唤</span>");
    expect(markup).toContain("<small>Wild Call</small>");
    expect(markup).toContain("<strong>荒野</strong>");
    for (const override of ["子职特性", "职业特性", "希望特性"]) expect(markup).toContain(`<h3>${override}</h3>`);
    expect(markup).toContain("荒野形态只在子职生效。");
    expect(markup).toContain("职业专属特性文本。");
    expect(markup).toContain("希望专属特性文本。");
    expect(markup).not.toContain('data-card-footer="true"');
    expect(renderCard(wildcaster, {}, textPresentation, { artworkCredit: "画师 / Artist", sourceLabel: "罗德岛旅记" }))
      .toContain('<footer class="pbdh-card-footer" data-card-footer="true">');
  });

  test("falls back to placeholder titles and hides empty optional blocks", () => {
    const bare = {
      ...rhodesSubclassTemplate.defaultData,
      名称: "",
      原文: "   ",
      类型: "",
      武器原型: "法器",
      特性: [{ 特性名称: "", 特性描述: "描述" }],
    };
    const markup = renderCard(bare);

    expect(markup).toContain("未命名子职");
    expect(markup).toContain('<span class="rhodes-subclass-card-type">子职</span>');
    expect(markup).toContain("<span>未命名特性</span>");
    expect(markup).not.toContain("rhodes-subclass-card-original");
    expect(markup).not.toContain("rhodes-subclass-card-summary");
    for (const absent of ["推荐次领域", "子职提升", "子职特性", "职业特性", "希望特性"]) expect(markup).not.toContain(absent);
    expect(markup).not.toContain("rhodes-subclass-card-override");
  });

  test("image mode renders the portrait slot only", () => {
    const empty = renderCard(wildcaster, {}, { mode: "image", fixedRatio: true });
    expect(empty).not.toContain("<img");
    expect(empty).not.toContain('data-card-footer="true"');

    const withPortrait = renderCard(wildcaster, { portrait: "blob:wildcaster" }, { mode: "image", fixedRatio: true });
    expect(withPortrait).toContain('<img src="blob:wildcaster"');
    expect(withPortrait).not.toContain("荒野呼唤");
  });

  test("resolves the tttri frontend through the manifest and lazy loaders", async () => {
    const frontend = resolveTemplateFrontend("罗德岛子职", "1.0.0");
    expect(frontend).toBeDefined();
    expect(frontend!.rendererRevision.revision).toBe(rhodesSubclassTemplate.rendererRevision);
    expect(frontend!.rendererRevision).toBe(rhodesSubclassRendererRevision);
    expect(frontend!.stableReferenceCard).toBe(false);
    await expect(frontend!.loadRenderer()).resolves.toBe(rhodesSubclassRendererRevision);
    await expect(loadTrustedRenderer("罗德岛子职", "1.0.0")).resolves.toBe(rhodesSubclassRendererRevision);
    await expect(loadTrustedAuthoring("罗德岛子职", "1.0.0")).resolves.toBe(rhodesSubclassAuthoring);
  });

  test("authoring edits report the tttri field path", async () => {
    const onValue = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    try {
      await act(async () => root.render(createElement(rhodesSubclassAuthoring.Editor, { data: wildcaster, onValue })));

      const field = (label: string) => [...container.querySelectorAll<HTMLElement>(".template-editor-field")]
        .find((candidate) => candidate.querySelector("span")?.textContent === label)!;
      const input = field("名称").querySelector<HTMLInputElement>("input")!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "重装术师");
      await act(async () => input.dispatchEvent(new Event("input", { bubbles: true })));
      expect(onValue).toHaveBeenLastCalledWith("名称", "重装术师");

      const level = field("等级");
      await act(async () => level.querySelector<HTMLButtonElement>(".template-editor-select-toggle")!.click());
      const options = [...level.querySelectorAll<HTMLButtonElement>('[role="option"]')].map((option) => option.textContent);
      expect(options).toEqual(["预备", "正式", "资深", "精英X", "精英Y"]);
      await act(async () => level.querySelectorAll<HTMLButtonElement>('[role="option"]')[0]!.click());
      expect(onValue).toHaveBeenLastCalledWith("等级", "预备");

      const stage = field("阶段");
      await act(async () => stage.querySelector<HTMLButtonElement>(".template-editor-select-toggle")!.click());
      expect([...stage.querySelectorAll<HTMLButtonElement>('[role="option"]')].map((option) => option.textContent))
        .toEqual(["T1", "T2", "T3", "T4X", "T4Y"]);

      await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent === "＋ 新增")!.click());
      expect(onValue).toHaveBeenLastCalledWith("特性", [...wildcaster.特性, { 特性名称: "新特性", 特性原文: "", 特性描述: "" }]);
    } finally {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    }
  });
});

afterEach(() => {
  document.body.innerHTML = "";
});
