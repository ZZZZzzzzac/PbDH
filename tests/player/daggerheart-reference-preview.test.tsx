import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PlayerResourcePreviewDialog } from "../../apps/player/src/resource-manager/ResourceManager.tsx";
import type { InstalledResourcePackage } from "../../apps/player/src/resources/resource-library.ts";
import {
  ancestryTemplate, communityTemplate, domainTemplate, itemTemplate, professionTemplate, subclassTemplate,
} from "../../packages/templates/src/core/index.ts";

const templates = [ancestryTemplate, communityTemplate, professionTemplate, subclassTemplate, itemTemplate, domainTemplate];

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
});
