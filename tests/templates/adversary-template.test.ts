import { readFileSync } from "node:fs";
import path from "node:path";

import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  adversaryTemplate,
  type AdversaryData,
  TemplateRegistry,
  templateRegistry,
} from "../../packages/templates/src/core/index.ts";
import {
  adversaryAuthoring,
  buildTemplateSupportManifest,
  supportedTemplateFrontends,
} from "../../packages/templates/src/frontend/index.ts";

const root = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}

const resource = readJson<{ resources: Array<{
  template: { id: string; version: string };
  data: AdversaryData;
  media: Record<string, string>;
}> }>(
  "contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json",
).resources[0]!;
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateData = ajv.compile(adversaryTemplate.schema as AnySchema);

describe("敌人 Template Core", () => {
  test("resolves only the exact trusted Template version", () => {
    expect(resource.template).toEqual({ id: "敌人", version: "1.0.0" });
    expect(templateRegistry.resolve(resource.template.id, resource.template.version)).toBe(
      adversaryTemplate,
    );
    expect(templateRegistry.resolve("敌人", "0.9.0")).toBeUndefined();
    expect(templateRegistry.resolve("敌人", "2.0.0")).toBeUndefined();
  });

  test("rejects duplicate exact versions", () => {
    expect(() => new TemplateRegistry([
      adversaryTemplate,
      adversaryTemplate,
    ])).toThrow("Duplicate Template version: 敌人@1.0.0");
  });

  test("validates the shared fixture and complete defaults", () => {
    expect(validateData(resource.data), JSON.stringify(validateData.errors)).toBe(true);
    expect(validateData(adversaryTemplate.defaultData), JSON.stringify(validateData.errors)).toBe(true);
    expect(Object.keys(adversaryTemplate.defaultData)).toEqual(
      Object.keys((adversaryTemplate.schema as { properties: object }).properties),
    );
    expect(Object.isFrozen(adversaryTemplate)).toBe(true);
    expect(Object.isFrozen(adversaryTemplate.defaultData)).toBe(true);
  });

  test("rejects unknown, missing, and non-string fields while allowing variable features", () => {
    const unknown = { ...resource.data, unexpected: "invalid" };
    expect(validateData(unknown)).toBe(false);
    const missing = structuredClone(resource.data) as Partial<AdversaryData>;
    delete missing.名称;
    expect(validateData(missing)).toBe(false);
    expect(validateData({ ...resource.data, 难度: 16 })).toBe(false);
    expect(validateData({ ...resource.data, 特性: [] })).toBe(true);
    expect(validateData({
      ...resource.data,
      特性: [...resource.data.特性, structuredClone(resource.data.特性[0]!)],
    })).toBe(true);
  });

  test("produces deterministic ID, title, summary, search, and media projections", () => {
    expect(adversaryTemplate.proposeResourceId(resource.data)).toBe("牛头人破坏者");
    const projection = adversaryTemplate.project(resource.data);
    expect(projection.title).toBe("牛头人破坏者");
    expect(projection.summary).toBe("一个脾气暴躁的巨大牛头费尔博格。");
    expect(projection.searchText).toContain("MINOTAUR WRECKER");
    expect(projection.searchText).toContain("Charging Bull");
    expect(projection.searchText).toContain("2d8+5");
    expect(adversaryTemplate.mediaSlots).toEqual([
      { id: "portrait", label: "主图", required: false, accepts: ["image/webp"] },
    ]);
    expect(Object.keys(resource.media)).toEqual(["portrait"]);
    expect(adversaryTemplate.defaultPresentation).toEqual({
      mode: "split",
      fixedRatio: false,
    });
  });

  test("declares closed Runtime State and only generic tabletop commands", () => {
    const validateState = ajv.compile(adversaryTemplate.tabletop.stateSchema as AnySchema);
    const state = adversaryTemplate.tabletop.defaultState(resource.data);
    expect(state).toEqual({
      currentHp: "0",
      currentStress: "0",
      focused: "false",
      notes: "",
    });
    expect(validateState(state), JSON.stringify(validateState.errors)).toBe(true);
    expect(validateState({ ...state, hidden: "invalid" })).toBe(false);
    expect(new Set(adversaryTemplate.tabletop.commands.map((command) => command.capability))).toEqual(
      new Set(["adjust-decimal-string", "set-string"]),
    );
    expect(adversaryTemplate.tabletop.commands.find((command) => command.id === "set-focused")?.values)
      .toEqual(["true", "false"]);
    expect(adversaryTemplate.tabletop.replacements).toEqual([
      { id: "alternate-form", label: "切换形态" },
    ]);
    expect(adversaryTemplate.rendererRevision).toBe("enemy-card-r1");
  });
});

describe("敌人 Template Authoring 与支持清单", () => {
  test("由敌人 Template 自己渲染字段结构和下拉入口", () => {
    const markup = renderToStaticMarkup(createElement(adversaryAuthoring.Editor, {
      data: structuredClone(adversaryTemplate.defaultData) as Record<string, unknown>,
      onValue: () => undefined,
    }));
    const source = readFileSync(path.join(root, "packages/templates/src/frontend/adversary/1.0.0/authoring-editor.tsx"), "utf8");
    const primitives = readFileSync(path.join(root, "packages/templates/src/frontend/authoring-primitives.tsx"), "utf8");

    expect(markup).toContain("adversary-editor");
    expect(markup).toContain("adversary-identity");
    expect(markup).toContain("adversary-combat");
    expect(markup).toContain("adversary-feature");
    expect(markup.indexOf("名称")).toBeLessThan(markup.indexOf("英文"));
    expect(markup).toContain("展开位阶选项");
    expect(markup).toContain("展开种类选项");
    expect(markup).toContain("template-editor-select-arrow");
    expect(markup).not.toContain("⌄");
    expect(primitives).toContain("place-items:center");
    expect(source).toContain("adversary-feature-action");
    expect(source).toContain(">清空</button>");
    expect(source).not.toContain("清空内容");
    expect(source).toContain('["近战", "邻近", "近距离", "远距离", "极远"]');
    expect(source).toContain('["动作", "被动", "反应"]');
    expect(source).not.toContain("labelWidth");
    expect(supportedTemplateFrontends.find((candidate) => candidate.templateId === "敌人")?.authoring).toBe(adversaryAuthoring);
  });

  test("support manifest comes from exact bundled Core, Authoring, and Renderer capability", () => {
    expect(buildTemplateSupportManifest({
      templates: templateRegistry.list(),
      authoringCapabilities: [adversaryAuthoring],
      rendererRevisions: new Set(["enemy-card-r1"]),
    })).toEqual({
      templates: [
        { id: "敌人", version: "1.0.0", rendererRevision: "enemy-card-r1" },
      ],
    });
    expect(buildTemplateSupportManifest({
      templates: templateRegistry.list(),
      authoringCapabilities: [adversaryAuthoring],
      rendererRevisions: new Set(),
    })).toEqual({ templates: [] });
    expect(buildTemplateSupportManifest({
      templates: templateRegistry.list(),
      authoringCapabilities: [],
      rendererRevisions: new Set(["enemy-card-r1"]),
    })).toEqual({ templates: [] });
  });
});
