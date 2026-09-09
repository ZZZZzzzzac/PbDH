import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test } from "vitest";
import { loadTrustedRenderer } from "@pbdh/templates/frontend/lazy";
beforeAll(() => loadTrustedRenderer("环境", "1.0.0"));

import {
  PlayerResourcePreviewDialog,
  supportsPlayerResourcePreview,
} from "../../apps/player/src/resource-manager/ResourceManager.tsx";
import type { InstalledResourcePackage } from "../../apps/player/src/resources/resource-library.ts";
import { environmentTemplate } from "../../packages/templates/src/core/index.ts";

const resource = {
  id: "environment-abandoned-grove",
  path: "环境/荒废林地.json",
  template: { id: environmentTemplate.id, version: environmentTemplate.version },
  presentation: environmentTemplate.defaultPresentation,
  data: { ...environmentTemplate.defaultData, 名称: "荒废林地", 难度: "11" },
  media: {},
};

const installed = {
  document: {
    contractVersion: "1.0.0",
    package: { id: "environment-package", version: "1.0.0", name: "环境测试包", description: "" },
    targets: [],
    license: { label: "测试", declaration: "测试" },
    forkSource: null,
    assets: [],
    resources: [resource],
    emptyDirectories: [],
    snapshotDigest: `sha256:${"0".repeat(64)}`,
  },
  media: new Map(),
  routes: [{ destination: "other-resources", resource }],
} as InstalledResourcePackage;

describe("Player environment Canonical Resource preview", () => {
  test("renders an installed environment from Other Resources with the shared Surface", () => {
    expect(supportsPlayerResourcePreview(resource)).toBe(true);
    const markup = renderToStaticMarkup(<PlayerResourcePreviewDialog installed={installed} resourceId={resource.id} onClose={() => undefined} />);
    expect(markup).toContain("荒废林地玩家规范卡面");
    expect(markup).toContain("data-pbdh-canonical-surface");
    expect(markup).not.toContain("当前 Player 版本尚不能呈现");
  });
});
