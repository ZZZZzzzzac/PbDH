import { describe, expect, test, vi } from "vitest";
import { generatedPublicationCover } from "../../apps/creator/src/workspace-prototype/creator-publication.ts";
import { createBlankWorkspace } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";
import { manifestEntryFor } from "../../packages/templates/src/frontend/template-frontend-manifest.ts";

import { publicationRenderer } from "../../apps/creator/src/workspace-prototype/CreatorWorkspacePrototype.tsx";
import type { WorkspaceResource } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";
import { buildCanonicalCardCoverSvg } from "../../packages/resource-renderer/src/react.tsx";
import { freeTemplate } from "../../packages/templates/src/core/index.ts";

describe("Creator 发布封面", () => {
  test("同一版本加载失败时不会按资源数量重复请求", async () => {
    const workspace = await createBlankWorkspace("封面测试");
    workspace.document.resources = ["one", "two", "three"].map((id) => ({
      id, path: `${id}.json`, template: { id: "自由", version: "1.0.2" },
      presentation: freeTemplate.defaultPresentation, data: freeTemplate.defaultData, media: {},
    }));
    const load = vi.spyOn(manifestEntryFor("自由", "1.0.2")!, "loadRenderer").mockRejectedValue(new Error("offline"));
    try {
      await expect(generatedPublicationCover(workspace)).rejects.toThrow("creator.publication-cover.render-failed");
      expect(load).toHaveBeenCalledOnce();
    } finally {
      load.mockRestore();
    }
  });

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
    const binding = await publicationRenderer(resource);

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
