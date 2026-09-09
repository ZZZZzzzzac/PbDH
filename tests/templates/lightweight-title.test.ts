import { expect, test, vi } from "vitest";
import { templateRegistry } from "@pbdh/templates/core";
import { templateCoreLoaders, templateResourceTitle } from "@pbdh/templates/core/lazy";

test("全部历史版本的轻量标题与原投影一致，不请求能力模块", () => {
  const loads = templateCoreLoaders.map((entry) => vi.spyOn(entry, "load"));
  try {
    const cases = [
      {}, { 名称: "" }, { 名称: "", 原文: " Original  Name " },
      { 名称: " \t\n " }, { 名称: "  名称\n\t副标题  " },
      { 名称: "**标题**" }, { 名称: "e\u0301 名称" },
      { 名称: null }, { 名称: 0 }, { 名称: 123 }, { 名称: {} },
    ];
    for (const template of templateRegistry.list()) {
      for (const fields of cases) {
        const data = { ...structuredClone(template.defaultData), ...fields };
        expect(templateResourceTitle(template.id, template.version, data), `${template.id}@${template.version}`)
          .toBe(template.project(data).title);
      }
    }
    expect(loads.every((load) => load.mock.calls.length === 0)).toBe(true);
  } finally { vi.restoreAllMocks(); }
});

test("未知版本不套用其他版本的标题规则", () => {
  expect(templateResourceTitle("敌人", "9.9.9", { 名称: "测试" })).toBeUndefined();
  expect(templateResourceTitle("未知类型", "1.0.0", { 名称: "测试" })).toBeUndefined();
});
