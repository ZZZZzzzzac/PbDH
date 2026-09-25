import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { prepareCanonicalSurface } from "@pbdh/resource-renderer/core";
import { adversaryTemplate } from "../../packages/templates/src/core/adversary/1.1.1/capability.ts";
import { adversaryRendererRevision } from "../../packages/templates/src/frontend/adversary/1.1.1/renderer.tsx";
import { templateRegistry } from "@pbdh/templates/core";
import { loadTrustedRenderer } from "@pbdh/templates/frontend/lazy";
import { environmentTemplate } from "../../packages/templates/src/core/environment/1.1.1/capability.ts";
import { environmentRendererRevision } from "../../packages/templates/src/frontend/environment/1.1.1/renderer.tsx";

function card(value: string) {
  const prepared = prepareCanonicalSurface({
    resource: {
      template: { id: "敌人", version: adversaryRendererRevision.templateVersion },
      presentation: { mode: "text", fixedRatio: false },
      data: { ...adversaryTemplate.defaultData, 特性: [{ 特性名称: "新特性", 特性类型: "动作", 特性描述: value }] },
      media: {},
    },
    renderer: adversaryRendererRevision,
    expectedRendererRevision: adversaryRendererRevision.revision,
    assets: new Map(),
  });
  expect(prepared.status).toBe("ready");
  if (prepared.status !== "ready") throw new Error("Renderer not ready");
  return renderToStaticMarkup(prepared.renderer.render(prepared.renderInput));
}

test("敌人特性保留段落后的无序列表，而不是合并为一行", () => {
  const markup = card("123\n- 123\n- 123");
  expect(markup).toContain("<p>123</p><ul><li>123</li><li>123</li></ul>");
});

test("敌人特性支持有序、嵌套列表及列表内强调和换行", () => {
  const markup = card("1. **第一项**\n   - 子项甲\n   - 子项乙\n2. 第二项\n   后续行");
  expect(markup).toContain("<ol>");
  expect(markup).toContain("<strong>第一项</strong><ul><li>子项甲</li><li>子项乙</li></ul>");
  expect(markup).toContain("第二项<br/>后续行");
});

test("环境特性描述和引导问题保留列表", () => {
  const prepared = prepareCanonicalSurface({
    resource: {
      template: { id: "环境", version: environmentRendererRevision.templateVersion },
      presentation: { mode: "text", fixedRatio: false }, media: {},
      data: { ...environmentTemplate.defaultData, 特性: [{ 特性名称: "列表", 特性类型: "被动", 特性描述: "123\n- 甲\n- 乙", 引导问题: "1. 谁？\n2. 何时？" }] },
    },
    renderer: environmentRendererRevision, expectedRendererRevision: environmentRendererRevision.revision, assets: new Map(),
  });
  if (prepared.status !== "ready") throw new Error("Renderer not ready");
  const markup = renderToStaticMarkup(prepared.renderer.render(prepared.renderInput));
  expect(markup).toContain("<p>123</p><ul><li>甲</li><li>乙</li></ul>");
  expect(markup).toContain("<ol><li>谁？</li><li>何时？</li></ol>");
});

test("精确版本保留旧渲染器，显式升级只换版本而不修改列表原文", async () => {
  const data = { ...adversaryTemplate.defaultData, 特性: [{ 特性名称: "新特性", 特性类型: "动作", 特性描述: "123\n- 123\n- 123" }] };
  const upgraded = templateRegistry.upgradeData("敌人", "1.1.0", "1.1.1", data);
  expect(upgraded).toEqual(data);
  expect(upgraded).not.toBe(data);
  expect((await loadTrustedRenderer("敌人", "1.1.0"))!.revision).toBe("enemy-card-r6");
  expect((await loadTrustedRenderer("敌人", "1.1.1"))!.revision).toBe("enemy-card-r7");
  const environmentData = { ...environmentTemplate.defaultData, 特性: [{ 特性名称: "列表", 特性类型: "被动", 特性描述: "- 甲\n- 乙", 引导问题: "1. 谁？\n2. 何时？" }] };
  expect(templateRegistry.upgradeData("环境", "1.1.0", "1.1.1", environmentData)).toEqual(environmentData);
  expect((await loadTrustedRenderer("环境", "1.1.0"))!.revision).toBe("environment-card-r5");
  expect((await loadTrustedRenderer("环境", "1.1.1"))!.revision).toBe("environment-card-r6");
});
