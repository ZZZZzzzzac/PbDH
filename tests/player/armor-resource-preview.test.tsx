import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PlayerResourcePreviewDialog } from "../../apps/player/src/resource-manager/ResourceManager.tsx";
import type { InstalledResourcePackage } from "../../apps/player/src/resources/resource-library.ts";
import { armorTemplate } from "../../packages/templates/src/core/index.ts";

const resource = {
  id: "armor-padded",
  path: "护甲/填充布甲.json",
  template: { id: armorTemplate.id, version: armorTemplate.version },
  presentation: armorTemplate.defaultPresentation,
  data: {
    ...armorTemplate.defaultData,
    名称: "填充布甲",
    护甲值: "3",
    重度伤害阈值: "5",
    严重伤害阈值: "11",
  },
  media: {},
};

const installed = {
  document: {
    contractVersion: "1.0.0",
    package: { id: "armor-package", version: "1.0.0", name: "护甲测试包", description: "" },
    targets: [],
    license: { label: "测试", declaration: "测试" },
    forkSource: null,
    assets: [],
    resources: [resource],
    emptyDirectories: [],
    snapshotDigest: `sha256:${"0".repeat(64)}`,
  },
  media: new Map(),
  routes: [{ destination: "native", nativeEntry: { id: "armor", label: "护甲" }, resource }],
} as InstalledResourcePackage;

describe("Player armor Canonical Resource preview", () => {
  test("binds the installed armor to the shared Canonical Card Surface", () => {
    const markup = renderToStaticMarkup(<PlayerResourcePreviewDialog
      installed={installed}
      resourceId={resource.id}
      onClose={() => undefined}
    />);
    expect(markup).toContain("填充布甲资源详情");
    expect(markup).toContain("填充布甲玩家规范卡面");
    expect(markup).toContain("data-pbdh-canonical-surface");
    expect(markup).not.toContain("当前 Player 版本尚不能呈现");
  });
});
