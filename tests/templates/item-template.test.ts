import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  itemAuthoring,
} from "../../packages/templates/src/frontend/index.ts";
import {
  itemTemplate,
  templateRegistry,
} from "../../packages/templates/src/core/index.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(itemTemplate.schema as AnySchema);

describe("物品 Template 1.0.0", () => {
  test("keeps item type opaque to the template", () => {
    expect(templateRegistry.resolve("物品", "1.0.0")).toBe(itemTemplate);
    expect(validate({ ...itemTemplate.defaultData, 类型: "物品" })).toBe(true);
    expect(validate({ ...itemTemplate.defaultData, 类型: "消耗品" })).toBe(true);
    expect(validate({ ...itemTemplate.defaultData, 类型: "战利品" })).toBe(true);
    expect(itemTemplate.defaultData.类型).toBe("物品");
    expect(renderToStaticMarkup(createElement(itemAuthoring.Editor, { data: itemTemplate.defaultData, onValue: () => undefined })))
      .toContain("展开类型选项");
  });

  test("keeps gameplay and flavor descriptions separate", () => {
    const data = {
      ...itemTemplate.defaultData,
      名称: "风笛哨",
      掷骰: "02",
      描述: "声音在一英里外都能听到。",
      风味描述: "手工制作的独特哨子。",
    };
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(itemTemplate.project(data).searchText).toContain("手工制作的独特哨子。");
  });
});
