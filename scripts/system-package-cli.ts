import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { zipSync } from "fflate";

import {
  computeResourcePackageSnapshotDigest,
  writePbres,
  type ResourcePackageLogicalDocument,
  type SystemPackageDocument,
} from "../packages/contract-runtime/src/index.ts";
import { templateRegistry } from "../packages/templates/src/core/index.ts";
import { loadPlatformSystemPackageFromVfs } from "../apps/player/src/system-package-ingress.ts";
import {
  buildSheetResourceLibraryInputs,
  buildSheetRuntimeMediaAssets,
} from "../apps/player/src/sheet-runtime/adapters/platformResourceLibraries.ts";
import type { PackageIssue } from "../apps/player/src/sheet-runtime/domain/systemPackage.ts";
import {
  createVirtualFileSystem,
  createVirtualFileSystemFromZipBytes,
  type PackageVirtualFileSystem,
} from "../apps/player/src/sheet-runtime/loaders/packageVfs.ts";
import { loadSystemPackageFromVfs } from "../apps/player/src/sheet-runtime/loaders/systemPackageLoader.ts";
import { routeResourcePackage } from "../apps/player/src/resources/route-resource-package.ts";
import { deriveCharacterDataJsonSchema } from "../apps/player/src/sheet-runtime/domain/characterDataJsonSchema.ts";

const encoder = new TextEncoder();

export type SystemPackageValidationReport = {
  ok: boolean;
  packageName?: string;
  issues: PackageIssue[];
};

export async function validateSystemPackageVfs(
  vfs: PackageVirtualFileSystem,
): Promise<SystemPackageValidationReport> {
  const platform = await loadPlatformSystemPackageFromVfs(vfs);
  const routed = new Map();
  if (platform.ok) {
    for (const candidate of platform.package.embeddedResources.values()) {
      routed.set(candidate.document.package.id, {
        document: candidate.document,
        media: candidate.media,
        routes: routeResourcePackage({
          currentSystem: platform.package.document,
          resourcePackage: candidate.document,
        }),
      });
    }
  }
  const runtime = await loadSystemPackageFromVfs(vfs, platform.ok ? {
    resourceLibraries: buildSheetResourceLibraryInputs({
      currentSystem: platform.package.document,
      installedPackages: routed,
    }),
    packageAssets: buildSheetRuntimeMediaAssets(routed),
  } : {});
  const issues = [
    ...(platform.ok ? [] : platform.issues),
    ...(runtime.ok ? runtime.issues.filter((issue) => issue.level === "warning") : runtime.issues),
  ];
  const uniqueIssues = [...new Map(issues.map((issue) => [
    `${issue.level}:${issue.code}:${issue.path ?? ""}:${issue.text}`,
    issue,
  ])).values()];
  return {
    ok: platform.ok && runtime.ok,
    ...(platform.ok ? { packageName: platform.package.document.package.name } : {}),
    issues: uniqueIssues,
  };
}

export async function buildSystemPackageScaffold(
  name = "我的规则系统",
): Promise<Map<string, Uint8Array>> {
  const systemPackageId = uuidV7();
  const resourcePackageId = uuidV7();
  const freeTemplate = templateRegistry.resolve("自由", "1.0.0");
  if (!freeTemplate) throw new Error("缺少 自由@1.0.0 Template");

  let resourceDocument: ResourcePackageLogicalDocument = {
    contractVersion: "1.0.0",
    package: {
      id: resourcePackageId,
      version: "1.0.0",
      name: `${name}官方资源`,
      description: "随系统包离线提供的起步资源。",
    },
    targets: [{ systemPackageId, version: "1.0.0" }],
    license: { label: "待填写许可", declaration: "发布前请替换为真实许可声明。" },
    forkSource: null,
    assets: [],
    resources: [{
      id: "starter-resource",
      path: "起步资源.json",
      template: { id: freeTemplate.id, version: freeTemplate.version },
      presentation: { ...freeTemplate.defaultPresentation, mode: "text" },
      data: { ...freeTemplate.defaultData, 名称: "起步资源" },
      media: {},
    }],
    emptyDirectories: [],
    snapshotDigest: `sha256:${"0".repeat(64)}`,
  };
  resourceDocument = {
    ...resourceDocument,
    snapshotDigest: await computeResourcePackageSnapshotDigest(resourceDocument, new Map()),
  };

  const systemDocument: SystemPackageDocument = {
    contractVersion: "1.0.0",
    package: {
      id: systemPackageId,
      version: "1.0.0",
      name,
      description: "由 PbDH System Package CLI 生成的最小可运行骨架。",
    },
    runtime: {
      characterDataVersion: "1.0.0",
      pages: "pages.json",
      modules: "modules.json",
    },
    resourceCompatibility: [{
      templateId: "自由",
      versionRange: { minimumInclusive: "1.0.0", maximumExclusive: "2.0.0" },
      nativeEntry: { id: "starter-resources", label: "起步资源" },
    }],
    embeddedResources: [{ path: "resources/starter.pbres" }],
  };

  return new Map([
    ["system.json", jsonBytes(systemDocument)],
    ["pages.json", jsonBytes([{
      ID: "character-sheet",
      名称: "人物卡",
      layout: { 类型: "htmlTemplate", html: "layouts/character-sheet.html", css: "layouts/base.css" },
    }])],
    ["modules.json", jsonBytes([{
      ID: "character-name",
      类型: "freeText",
      标签: "姓名",
    }])],
    ["layouts/character-sheet.html", encoder.encode('<main data-print-page="true"><div><span>姓名</span><pb-module id="character-name"></pb-module></div></main>\n')],
    ["layouts/base.css", encoder.encode("main { max-width: 210mm; margin: 0 auto; padding: 12mm; }\n")],
    ["resources/starter.pbres", writePbres(resourceDocument, new Map())],
    ["README.md", encoder.encode("# System Package 骨架\n\n请用外部编辑器或 AI 编辑 system.json、pages.json、modules.json 与 layouts/；运行 `npm run system-package -- validate <目录>` 检查，追加 `machine` 输出机器可读结果。\n")],
  ]);
}

async function main(argv: string[]): Promise<number> {
  const [command, ...args] = argv;
  const json = args.includes("machine");
  const values = args.filter((argument) => argument !== "machine");
  if (command === "validate" && values[0]) {
    const vfs = await readInputVfs(path.resolve(values[0]));
    if (!vfs.ok) return printReport({ ok: false, issues: vfs.issues }, json);
    return printReport(await validateSystemPackageVfs(vfs.vfs), json);
  }
  if (command === "schema" && values[0]) {
    const vfs = await readInputVfs(path.resolve(values[0]));
    if (!vfs.ok) return printReport({ ok: false, issues: vfs.issues }, json);
    const report = await validateSystemPackageVfs(vfs.vfs);
    if (!report.ok) return printReport(report, json);
    const systemText = vfs.vfs.readText("system.json");
    if (!systemText.ok) return printReport({ ok: false, issues: [systemText.issue] }, json);
    const systemDocument = JSON.parse(systemText.value) as { runtime: { modules: string } };
    const modulesText = vfs.vfs.readText(systemDocument.runtime.modules);
    if (!modulesText.ok) return printReport({ ok: false, issues: [modulesText.issue] }, json);
    console.log(JSON.stringify(deriveCharacterDataJsonSchema({ modules: JSON.parse(modulesText.value) }), null, 2));
    return 0;
  }
  if (command === "scaffold" && values[0]) {
    const target = path.resolve(values[0]);
    const nameIndex = values.indexOf("--name");
    const name = nameIndex >= 0 ? values[nameIndex + 1] : undefined;
    await writeScaffold(target, await buildSystemPackageScaffold(name));
    console.log(`已生成 System Package 骨架：${target}`);
    return 0;
  }
  if (command === "pack" && values[0] && values[1]) {
    const input = await readDirectoryFiles(path.resolve(values[0]));
    const report = await validateSystemPackageVfs(createVirtualFileSystem(input));
    if (!report.ok) return printReport(report, json);
    const output = path.resolve(values[1]);
    if (!output.toLowerCase().endsWith(".pbsys")) throw new Error("输出文件必须使用 .pbsys 后缀");
    try {
      await stat(output);
      throw new Error("输出文件已存在，已停止以避免覆盖");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await writeFile(output, zipSync(Object.fromEntries(input), { level: 6 }));
    console.log(`已生成 ${output}`);
    return 0;
  }
  console.error("用法：system-package <validate <目录|.pbsys> [machine] | schema <目录|.pbsys> | scaffold <目录> [--name 名称] | pack <目录> <文件.pbsys>>");
  return 2;
}

async function readInputVfs(input: string): Promise<
  | { ok: true; vfs: PackageVirtualFileSystem }
  | { ok: false; issues: PackageIssue[] }
> {
  const inputStat = await stat(input);
  if (inputStat.isDirectory()) return { ok: true, vfs: createVirtualFileSystem(await readDirectoryFiles(input)) };
  return createVirtualFileSystemFromZipBytes(new Uint8Array(await readFile(input)));
}

async function readDirectoryFiles(root: string, relative = ""): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const next = path.posix.join(relative.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) {
      for (const [filePath, bytes] of await readDirectoryFiles(root, next)) files.set(filePath, bytes);
    } else if (entry.isFile()) {
      files.set(next, new Uint8Array(await readFile(path.join(root, next))));
    }
  }
  return files;
}

async function writeScaffold(target: string, files: ReadonlyMap<string, Uint8Array>): Promise<void> {
  try {
    const existing = await readdir(target);
    if (existing.length > 0) throw new Error("目标目录不是空目录，已停止以避免覆盖文件");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (const [relative, bytes] of files) {
    const output = path.join(target, relative);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, bytes);
  }
}

function jsonBytes(value: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(value, null, 2)}\n`);
}

function uuidV7(): string {
  const bytes = randomBytes(16);
  let timestamp = BigInt(Date.now());
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function printReport(report: SystemPackageValidationReport, json: boolean): number {
  if (json) console.log(JSON.stringify(report));
  else if (report.ok) console.log(`System Package 有效：${report.packageName ?? "未命名"}`);
  else for (const issue of report.issues) {
    console.error(`[${issue.level}] ${issue.code}${issue.path ? ` ${issue.path}` : ""}: ${issue.text}`);
  }
  return report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
