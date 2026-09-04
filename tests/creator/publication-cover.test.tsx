import { describe, expect, test } from "vitest";

import { publicationRenderer } from "../../apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx";
import type { WorkspaceResource } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";
import { buildCanonicalCardCoverSvg } from "../../packages/resource-renderer/src/react.tsx";
import { freeTemplate } from "../../packages/templates/src/core/index.ts";

describe("Creator 发布封面", () => {
  test("没有图片的自由资源仍可由规范卡面生成封面", async () => {
    const resource = {
      id: "resource-text-only",
      path: "自由/纯文字卡牌.json",
      template: { id: freeTemplate.id, version: freeTemplate.version },
      presentation: freeTemplate.defaultPresentation,
      data: {
        ...freeTemplate.defaultData,
        名称: "纯文字卡牌",
        简介: "没有图片也必须能生成发布封面。",
        内容: [],
      },
      media: {},
    } satisfies WorkspaceResource;
    const binding = publicationRenderer(resource);

    const cover = await buildCanonicalCardCoverSvg({
      resource,
      expectedRendererRevision: binding.expectedRendererRevision,
      renderer: binding.renderer,
      assets: new Map(),
      label: "纯文字卡牌发布封面",
    });

    expect(cover.svg).toContain("data-renderer-revision=\"free-card-r1\"");
    expect(cover.svg).toContain("纯文字卡牌");
  });
});
