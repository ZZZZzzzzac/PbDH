import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import {
  environmentTemplate,
  temporaryEnvironmentTemplate,
  templateRegistry,
} from "../../packages/templates/src/core/index.ts";
import {
  buildTemplateSupportManifest,
  environmentAuthoringLayout,
} from "../../packages/templates/src/frontend/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(temporaryEnvironmentTemplate.schema as AnySchema);
const validateStable = ajv.compile(environmentTemplate.schema as AnySchema);

describe("环境临时 Template 0.0.0-dev.1", () => {
  test("registers environment features without fear metadata", () => {
    expect(templateRegistry.resolve("环境", "0.0.0-dev.1")).toBe(temporaryEnvironmentTemplate);
    const data = {
      ...temporaryEnvironmentTemplate.defaultData,
      名称: "燃烧的图书馆", 位阶: "2", 种类: "险境", 难度: "14",
      特性: [{ 名称: "坍塌", 类型: "动作", 描述: "书架轰然倒下。", 引导问题: "谁被困住了？" }],
    };
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
  });

  test("rejects discarded fear fields", () => {
    expect(validate({
      ...temporaryEnvironmentTemplate.defaultData,
      特性: [{ 名称: "坍塌", 类型: "动作", 描述: "效果", 引导问题: "问题", 恐惧: true }],
    })).toBe(false);
  });
});

describe("环境 Template 1.0.0", () => {
  const abandonedGrove = {
    名称: "荒废林地",
    原文: "ABANDONED GROVE",
    位阶: "1",
    种类: "探索",
    简介: "一片曾经的德鲁伊林地，如今休耕荒废，重回自然原貌。",
    趋向: "吸引好奇者，反映过往",
    难度: "11",
    潜在敌人: "野兽，林地守卫",
    特性: [{
      名称: "蔓生战场",
      原名: "Overgrown Battlefield",
      类型: "被动",
      描述: "此地曾发生过一场战斗。",
      引导问题: "曾在此地的那些团体为何发生冲突？",
    }],
  };

  test("registers complete stable data from the fixed PbDH_Cards fixture", () => {
    expect(templateRegistry.resolve("环境", "1.0.0")).toBe(environmentTemplate);
    expect(templateRegistry.resolve("环境", "0.0.0-dev.1")).toBe(temporaryEnvironmentTemplate);
    expect(validateStable(abandonedGrove), JSON.stringify(validateStable.errors)).toBe(true);
    expect(validateStable(environmentTemplate.defaultData), JSON.stringify(validateStable.errors)).toBe(true);
    expect(environmentTemplate.project(abandonedGrove).searchText).toContain("Overgrown Battlefield");
    expect(environmentTemplate.rendererRevision).toBe("environment-card-r1");
  });

  test("upgrades the legacy shape by candidate copy without changing the source", () => {
    const legacy = {
      ...temporaryEnvironmentTemplate.defaultData,
      名称: "荒废林地",
      特性: [{ 名称: "蔓生战场", 类型: "被动", 描述: "描述", 引导问题: "问题" }],
    };
    const upgraded = environmentTemplate.upgradeFrom!.upgrade(legacy);
    expect(upgraded).toEqual({
      ...legacy,
      原文: "",
      特性: [{ ...legacy.特性[0], 原名: "" }],
    });
    expect(upgraded).not.toBe(legacy);
    expect(legacy).not.toHaveProperty("原文");
  });

  test("covers every schema field and enters full-support manifest only with its Renderer", () => {
    const schema = environmentTemplate.schema as {
      properties: Record<string, { items?: { properties: Record<string, unknown> } }>;
    };
    const topLevel = new Set<string>();
    const featureFields = new Set<string>();
    for (const section of environmentAuthoringLayout.sections) {
      for (const field of section.fields) topLevel.add(field.path);
      for (const repeat of section.repeats ?? []) {
        topLevel.add(repeat.path);
        for (const field of repeat.itemFields) featureFields.add(field.path);
      }
    }
    expect(topLevel).toEqual(new Set(Object.keys(schema.properties)));
    expect(featureFields).toEqual(new Set(Object.keys(schema.properties.特性!.items!.properties)));
    expect(buildTemplateSupportManifest({
      templates: templateRegistry.list(),
      authoringLayouts: [environmentAuthoringLayout],
      rendererRevisions: new Set(["environment-card-r1"]),
    }).templates).toEqual([{ id: "环境", version: "1.0.0", rendererRevision: "environment-card-r1" }]);
  });
});
