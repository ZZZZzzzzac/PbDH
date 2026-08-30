import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  RestrictedMarkdown,
  RestrictedMarkdownRenderer,
} from "../../packages/resource-renderer/src/react.tsx";
import { prepareCanonicalSurface } from "../../packages/resource-renderer/src/core.ts";
import { armorTemplate, communityTemplate } from "../../packages/templates/src/core/index.ts";
import {
  armorRendererRevision,
  communityRendererRevision,
} from "../../packages/templates/src/frontend/index.ts";

describe("shared Restricted Markdown", () => {
  test("renders emphasis, lists, line breaks, and the seven safe colors", () => {
    const colors = ["red", "orange", "yellow", "green", "blue", "purple", "gray"];
    const value = [
      "**粗体**、*斜体*、***粗斜体***",
      "中文相邻_下划线斜体_仍生效，中文相邻__下划线粗体__也生效",
      ...colors.map((color) => `:${color}[${color}]`),
      "",
      "- 第一项",
      "- 第二项",
      "",
      "1. 甲",
      "2. 乙",
      "普通换行\n下一行",
    ].join("\n");

    const markup = renderToStaticMarkup(<RestrictedMarkdown value={value} />);

    expect(markup).toContain("<strong>粗体</strong>");
    expect(markup).toContain("<em>斜体</em>");
    expect(markup).toContain("<em><strong>粗斜体</strong></em>");
    expect(markup).toContain("<em>下划线斜体</em>");
    expect(markup).toContain("<strong>下划线粗体</strong>");
    expect(markup).toContain("<ul>");
    expect(markup).toContain("<ol>");
    expect(markup).toContain("<br/>");
    for (const color of colors) {
      expect(markup).toContain(`data-markdown-color="${color}"`);
    }
  });

  test("does not inject raw HTML, remote images, or nested color directives", () => {
    const markup = renderToStaticMarkup(<RestrictedMarkdownRenderer value={[
      "<script>alert('x')</script>",
      "![远程图片](https://example.com/unsafe.png)",
      ":red[外层 :blue[内层]]",
    ].join("\n")} />);

    expect(markup).not.toContain("<script");
    expect(markup).not.toContain("https://example.com");
    expect(markup).toContain("远程图片");
    expect(markup).not.toContain("data-markdown-color");
  });

  test("is used by both reference cards and specialized cards", () => {
    const community = prepareCanonicalSurface({
      resource: {
        template: { id: communityTemplate.id, version: communityTemplate.version },
        presentation: communityTemplate.defaultPresentation,
        data: {
          ...communityTemplate.defaultData,
          名称: "海港居民",
          特性: { 名称: "潮起潮落", 描述: ":blue[**保持冷静**]，然后前进。" },
        },
        media: {},
      },
      expectedRendererRevision: communityTemplate.rendererRevision,
      renderer: communityRendererRevision,
      assets: new Map(),
    });
    const armor = prepareCanonicalSurface({
      resource: {
        template: { id: armorTemplate.id, version: armorTemplate.version },
        presentation: armorTemplate.defaultPresentation,
        data: {
          ...armorTemplate.defaultData,
          名称: "测试护甲",
          描述: ":red[**燃烧**]：**标记 1 压力点**。",
        },
        media: {},
      },
      expectedRendererRevision: armorTemplate.rendererRevision,
      renderer: armorRendererRevision,
      assets: new Map(),
    });

    expect(community.status).toBe("ready");
    expect(armor.status).toBe("ready");
    if (community.status !== "ready" || armor.status !== "ready") throw new Error("Expected ready surfaces");
    const communityMarkup = renderToStaticMarkup(community.renderer.render(community.renderInput));
    const armorMarkup = renderToStaticMarkup(armor.renderer.render(armor.renderInput));
    expect(communityMarkup).toContain('data-markdown-color="blue"');
    expect(communityMarkup).toContain("<strong>保持冷静</strong>");
    expect(armorMarkup).toContain('data-markdown-color="red"');
    expect(armorMarkup).toContain("<strong>标记 1 压力点</strong>");
  });
});
