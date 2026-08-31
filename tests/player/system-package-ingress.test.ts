import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { createVirtualFileSystem } from "../../apps/player/src/sheet-runtime/loaders/packageVfs.ts";
import { loadSystemPackageFromVfs } from "../../apps/player/src/sheet-runtime/loaders/systemPackageLoader.ts";
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

  test("正式入口拒绝不受支持的旧 Contract", async () => {
    const document = {
      contractVersion: "0.9.0",
      package: {
        id: "0198e155-04d2-7ccd-98f1-8a09a177dc2a",
        version: "1.0.0",
        name: "Development",
        description: "Development Contract",
      },
      runtime: { pages: "pages.json", modules: "modules.json" },
      resourceCompatibility: [],
      embeddedResources: [],
    };
    const result = await loadPlatformSystemPackageFromVfs(createVirtualFileSystem(new Map([
      ["system.json", encodeJson(document)],
    ])));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe("contract.version.unsupported");
  });

  test("运行文件缺失时返回错误而不是抛出异常", async () => {
    const files = readRuntimeFiles();
    files.delete("pages.json");

    const result = await loadSystemPackageFromVfs(createVirtualFileSystem(files));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(expect.objectContaining({
      level: "fatal",
      code: "PACKAGE_FILE_MISSING",
      path: "pages.json",
    }));
  });

  test("不存在的默认 Skin 返回 Contract 错误", async () => {
    const files = readRuntimeFiles();
    const document = readJsonFile("system.json") as {
      runtime: { defaultSkin?: string };
    };
    document.runtime.defaultSkin = "missing-skin";
    files.set("system.json", encodeJson(document));

    const result = await loadSystemPackageFromVfs(createVirtualFileSystem(files));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(expect.objectContaining({
      level: "fatal",
      code: "SYSTEM_DOCUMENT_SHAPE_INVALID",
      path: "system.json/runtime/defaultSkin",
    }));
    expect(result.issues[0]?.text).toContain("system-package.runtime.default-skin.missing");
  });

  test("Skin 覆盖不存在的 Page 时返回错误", async () => {
    const files = readRuntimeFiles();
    const document = readJsonFile("system.json") as {
      runtime: {
        skins: Array<{
          layoutOverrides?: { pages: Array<{ id: string; html: string }> };
        }>;
      };
    };
    document.runtime.skins[0]!.layoutOverrides = {
      pages: [{ id: "missing-page", html: "layouts/character-sheet.html" }],
    };
    files.set("system.json", encodeJson(document));

    const result = await loadSystemPackageFromVfs(createVirtualFileSystem(files));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(expect.objectContaining({
      level: "error",
      code: "SKIN_LAYOUT_OVERRIDE_PAGE_UNKNOWN",
    }));
  });
});

function readRuntimeFiles(): Map<string, Uint8Array> {
  const manifest = readJsonFile(".pbdh-runtime-files.json") as { files: string[] };
  return new Map(manifest.files.map((path) => [path, readBytes(path)]));
}

function readJsonFile(path: string): unknown {
  return JSON.parse(new TextDecoder().decode(readBytes(path))) as unknown;
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function readBytes(path: string): Uint8Array {
  return new Uint8Array(readFileSync(fileURLToPath(new URL(path, packageRoot))));
}
