import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test } from "vitest";
import { loadTrustedRenderer } from "@pbdh/templates/frontend/lazy";

import { PlayerResourcePreviewDialog } from "../../apps/player/src/resource-manager/ResourceManager.tsx";
import { CardFace, canonicalCardAssets, canonicalCardResource } from "../../apps/player/src/sheet-runtime/rendering/cardTable/CardFace.tsx";
import type { CardTableModule } from "../../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import type { InstalledResourcePackage } from "../../apps/player/src/resources/resource-library.ts";
import {
  ancestryTemplate, communityTemplate, domainTemplate, itemTemplate, professionTemplate, subclassTemplate,
} from "../../packages/templates/src/core/index.ts";

const templates = [ancestryTemplate, communityTemplate, professionTemplate, subclassTemplate, itemTemplate, domainTemplate];
beforeAll(() => Promise.all(templates.map((template) => loadTrustedRenderer(template.id, template.version))));

describe("Player 六类稳定资源预览", () => {
  test.each(templates)("binds %s to the shared Canonical Card Surface", (template) => {
    const resource = {
      id: `resource-${template.id}`, path: `${template.id}/测试.json`,
      template: { id: template.id, version: template.version }, presentation: template.defaultPresentation,
      data: { ...template.defaultData, 名称: `测试${template.id}` }, media: {},
    };
    const installed = {
      document: {
        contractVersion: "1.0.0", package: { id: "test-package", version: "1.0.0", name: "测试包", description: "" },
        targets: [], license: { label: "测试", declaration: "测试" }, forkSource: null, assets: [], resources: [resource],
        emptyDirectories: [], snapshotDigest: `sha256:${"0".repeat(64)}`,
      },
      media: new Map(), routes: [{ destination: "native", nativeEntry: { id: template.id, label: template.id }, resource }],
    } as InstalledResourcePackage;
    const markup = renderToStaticMarkup(<PlayerResourcePreviewDialog installed={installed} resourceId={resource.id} onClose={() => undefined} />);
    expect(markup).toContain(`测试${template.id}玩家规范卡面`);
    expect(markup).not.toContain("当前 Player 版本尚不能呈现");
  });

  test("玩家桌面上的卡图也进入共享规范卡面", () => {
    const portraitId = "sha256:portrait";
    const markup = renderToStaticMarkup(<CardFace
      definition={{
        ID: "test-package:ancestry",
        fields: { 名称: "械灵", 卡图: "data:image/webp;base64,AA==", 卡背: "", 卡牌显示方式: "image" },
        resourceCopy: {
          source: { packageId: "test-package", resourceId: "ancestry" },
          template: { id: ancestryTemplate.id, version: ancestryTemplate.version },
          presentation: { ...ancestryTemplate.defaultPresentation, mode: "image" },
          data: { ...ancestryTemplate.defaultData, 名称: "械灵" },
          labels: [],
          media: { portrait: portraitId },
        },
      }}
      definitionRef={{ type: "resourceLibrary", libraryId: "ancestries", entryId: "test-package:ancestry" }}
      module={{ 类型: "cardTable", ID: "cards", 标签: "卡牌", 资源来源: [{ 类型: "resourceLibrary", ID: "ancestries" }], 显示方式: "image" } as CardTableModule}
      fallbackName="械灵"
    />);
    expect(markup).toContain("械灵规范卡面");
    expect(markup).toContain("data-pbdh-canonical-surface");
    expect(markup).not.toContain("play-card-text");
  });

  test("从资源包图片表中找到桌面卡图", () => {
    const packageId = "test-package";
    const portraitId = "sha256:portrait";
    const runtimePath = `platform-resources/${packageId}/${encodeURIComponent(portraitId)}.webp`;
    const module = { 类型: "cardTable", ID: "cards", 标签: "卡牌", 资源来源: [{ 类型: "resourceLibrary", ID: "ancestries" }] } as CardTableModule;
    const resourceCopy = {
      source: { packageId, resourceId: "ancestry" },
      template: { id: ancestryTemplate.id, version: ancestryTemplate.version },
      presentation: { ...ancestryTemplate.defaultPresentation },
      data: { ...ancestryTemplate.defaultData, 名称: "械灵" },
      labels: [],
      media: { portrait: portraitId },
    };
    const assets = canonicalCardAssets(
      resourceCopy,
      { ID: `${packageId}:ancestry`, fields: { 卡图: runtimePath }, resourceCopy },
      module,
      { type: "systemPackage", id: "daggerheart-core", name: "匕首之心", version: "1.0.0" },
      { [`resource-extension:${packageId}:${runtimePath}`]: "blob:portrait" },
    );

    expect(assets.get(portraitId)).toEqual({ status: "ready", url: "blob:portrait" });
  });

  test("规范资源卡面不接受系统包扁平字段覆盖", () => {
    const portraitId = "sha256:portrait";
    const resourceCopy = {
      source: { packageId: "test-package", resourceId: "ancestry" },
      template: { id: ancestryTemplate.id, version: ancestryTemplate.version },
      presentation: { ...ancestryTemplate.defaultPresentation, mode: "split" as const },
      data: { ...ancestryTemplate.defaultData, 名称: "乌萨斯" },
      labels: [],
      media: { portrait: portraitId },
    };
    const definition = {
      ID: "test-package:ancestry",
      fields: { 名称: "乌萨斯", 卡图: "portrait.webp", 显示方式: "image" },
      resourceCopy,
    };
    const module = {
      类型: "cardTable",
      ID: "cards",
      标签: "卡牌",
      资源来源: [{ 类型: "resourceLibrary", ID: "ancestries" }],
      显示方式: "image",
      显示方式字段: "显示方式",
    } as CardTableModule;

    expect(canonicalCardResource(resourceCopy, definition, module, {
      type: "resourceLibrary",
      libraryId: "ancestries",
      entryId: definition.ID,
    }).presentation.mode).toBe("split");
  });
});
