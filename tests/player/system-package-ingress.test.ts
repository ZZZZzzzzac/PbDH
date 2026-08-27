import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { createVirtualFileSystem } from "../../apps/player/src/sheet-runtime/loaders/packageVfs.ts";
import { loadPlatformSystemPackageFromVfs } from "../../apps/player/src/system-package-ingress.ts";

const packageRoot = new URL(
  "../../apps/player/public/system-packages/heart-of-hopefind/",
  import.meta.url,
);

describe("Player System Package ingress", () => {
  test("从同一正式 Runtime 目录读取并校验平台 System Package Contract", async () => {
    const files = new Map<string, Uint8Array>([
      ["system.json", readBytes("system.json")],
      ["resources/heart-of-hopefind.pbres", readBytes("resources/heart-of-hopefind.pbres")],
    ]);

    const result = await loadPlatformSystemPackageFromVfs(createVirtualFileSystem(files));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.package.document.package.name).toBe("寻望之心");
    expect(result.package.embeddedResources.size).toBe(1);
  });

  test("拒绝只有旧 manifest、没有当前 system.json Contract 的目录", async () => {
    const result = await loadPlatformSystemPackageFromVfs(createVirtualFileSystem(new Map([
      ["manifest.json", new TextEncoder().encode("{}")],
    ])));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe("system-package.archive.root.missing");
  });
});

function readBytes(path: string): Uint8Array {
  return new Uint8Array(readFileSync(fileURLToPath(new URL(path, packageRoot))));
}
