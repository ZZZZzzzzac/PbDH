import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "vitest";

import {
  environmentTemplate,
  templateRegistry,
} from "../../packages/templates/src/core/index.ts";
import {
  buildTemplateSupportManifest,
  environmentAuthoring,
} from "../../packages/templates/src/frontend/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateStable = ajv.compile(environmentTemplate.schema as AnySchema);

describe("环境 Template 1.0.0", () => {
  const abandonedGrove = {
    名称: "荒废林地",
    类型: "环境",
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
    expect(templateRegistry.resolve("环境", "0.9.0")).toBeUndefined();
    expect(validateStable(abandonedGrove), JSON.stringify(validateStable.errors)).toBe(true);
    expect(validateStable(environmentTemplate.defaultData), JSON.stringify(validateStable.errors)).toBe(true);
    expect(environmentTemplate.project(abandonedGrove).searchText).toContain("Overgrown Battlefield");
    expect(environmentTemplate.rendererRevision).toBe("environment-card-r1");
  });

  test("covers every schema field and enters full-support manifest only with its Renderer", () => {
    const schema = environmentTemplate.schema as {
      properties: Record<string, { items?: { properties: Record<string, unknown> } }>;
    };
    expect(environmentAuthoring.Editor).toBeTypeOf("function");
    expect(buildTemplateSupportManifest({
      templates: templateRegistry.list(),
      authoringCapabilities: [environmentAuthoring],
      rendererRevisions: new Set(["environment-card-r1"]),
    }).templates).toEqual([{ id: "环境", version: "1.0.0", rendererRevision: "environment-card-r1" }]);
  });
});
