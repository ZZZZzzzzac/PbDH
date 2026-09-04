import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

import {
  computeResourcePackageSnapshotDigest,
  writePbres,
  type ResourcePackageLogicalDocument,
  type SystemPackageDocument,
} from "../packages/contract-runtime/src/index.ts";
import { templateRegistry } from "../packages/templates/src/core/index.ts";

type SourceEntry = {
  ID: string;
  名称: string;
  简介: string;
  第一特性名称: string;
  第一特性规则: string;
  第二特性名称: string;
  第二特性规则: string;
};
type LegacyRuntimeManifest = {
  版本: string;
  角色数据版本: string;
  加载展示?: { 标语: string; 强调色: string };
  pages: string;
  skins?: Array<{
    ID: string;
    名称: string;
    css: string;
    推荐框架配色: "light" | "dark";
  }>;
  defaultSkin?: string;
  modules: string;
  dependencies?: string;
  characterTextExports?: string;
  validationChecks?: Array<{ ID: string; 脚本: string }>;
};

const sourceRoot = path.resolve("apps/player/system-package-sources/heart-of-hopefind");
const outputRoot = path.resolve("apps/player/public/system-packages/heart-of-hopefind");
const generatedSystemDocumentPath = path.resolve("apps/player/src/heart-of-hopefind-system.generated.json");
const generatedPresetPath = path.resolve("apps/player/src/heart-of-hopefind-preset.generated.json");
const runtimeInventoryName = ".pbdh-runtime-files.json";
const systemPackageId = "01a04186-51be-74e1-b94f-ec17d354dc00";
const resourcePackageId = "01a04186-51bf-7c26-8c27-2f7147125243";
const resourcePackageVersion = "1.0.1";
const legacyManifest = JSON.parse(await readFile(
  path.join(sourceRoot, "manifest.json"),
  "utf8",
)) as LegacyRuntimeManifest;
const systemPackageVersion = legacyManifest.版本;

const freeTemplate = templateRegistry.resolve("自由", "1.0.0");
if (!freeTemplate) throw new Error("Missing Template: 自由@1.0.0");
const validateFreeTemplate = new Ajv2020({ allErrors: true, strict: false }).compile(freeTemplate.schema);
const sourceEntries = JSON.parse(await readFile(
  path.join(sourceRoot, "resources", "survivor-styles.json"),
  "utf8",
)) as SourceEntry[];

const resources: ResourcePackageLogicalDocument["resources"] = sourceEntries.map((entry) => {
  const data = {
    名称: entry.名称,
    类型: "求生者风格",
    简介: entry.简介,
    内容: [
      { 名称: entry.第一特性名称, 描述: entry.第一特性规则 },
      { 名称: entry.第二特性名称, 描述: entry.第二特性规则 },
    ],
  };
  if (!validateFreeTemplate(data)) {
    throw new Error(`${entry.ID} does not match 自由@1.0.0: ${JSON.stringify(validateFreeTemplate.errors)}`);
  }
  return {
    id: entry.ID,
    path: `求生者风格/${portableName(entry.ID)}.json`,
    template: { id: "自由", version: "1.0.0" },
    presentation: { ...freeTemplate.defaultPresentation, mode: "text" },
    data,
    media: {},
  };
}).sort((left, right) => left.path.localeCompare(right.path));

let resourceDocument: ResourcePackageLogicalDocument = {
  contractVersion: "1.0.0",
  package: {
    id: resourcePackageId,
    version: resourcePackageVersion,
    name: "寻望之心官方资源",
    description: "寻望之心系统包随附的求生者风格。",
  },
  targets: [{ systemPackageId, version: systemPackageVersion }],
  license: {
    label: "系统包内置资源",
    declaration: "由寻望之心系统包提供；第三方声明见系统包 THIRD_PARTY_NOTICES.md。",
  },
  forkSource: null,
  assets: [],
  resources,
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
    version: systemPackageVersion,
    name: "寻望之心",
    description: "由迁移后的 Sheet Runtime 驱动的寻望之心系统包。",
  },
  runtime: mapLegacyRuntime(legacyManifest),
  resourceCompatibility: [{
    templateId: "自由",
    versionRange: { minimumInclusive: "1.0.0", maximumExclusive: "2.0.0" },
    nativeEntry: { id: "survivor-styles", label: "求生者风格" },
  }],
  embeddedResources: [{
    path: "resources/heart-of-hopefind.pbres",
  }],
};

await mkdir(outputRoot, { recursive: true });
const systemDocumentJson = `${JSON.stringify(systemDocument, null, 2)}\n`;
await writeFile(path.join(outputRoot, "system.json"), systemDocumentJson, "utf8");
await writeFile(generatedSystemDocumentPath, systemDocumentJson, "utf8");
await mkdir(path.join(outputRoot, "resources"), { recursive: true });
await writeFile(
  path.join(outputRoot, "resources", "heart-of-hopefind.pbres"),
  writePbres(resourceDocument, new Map()),
);

const runtimeFiles = [
  ...await collectPublishedRuntimePaths(outputRoot),
  "system.json",
].sort();
await writeFile(
  path.join(outputRoot, runtimeInventoryName),
  `${JSON.stringify({ schemaVersion: 1, files: runtimeFiles })}\n`,
  "utf8",
);
await writeFile(generatedPresetPath, `${JSON.stringify({
  id: systemPackageId,
  urlPath: "heart-of-hopefind",
  name: "寻望之心",
  version: systemPackageVersion,
  releaseVersion: "0.0.0-dev",
  directory: "heart-of-hopefind",
  inventoryPath: runtimeInventoryName,
  fileCount: runtimeFiles.length,
  metadataFileCount: runtimeFiles.filter((file) => !file.startsWith("assets/")).length,
  embeddedResourceIndex: [{
    path: "resources/heart-of-hopefind.pbres",
    packageId: resourceDocument.package.id,
    version: resourceDocument.package.version,
    snapshotDigest: resourceDocument.snapshotDigest,
  }],
  loadingPresentation: legacyManifest.加载展示,
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  id: systemPackageId,
  resources: resourceDocument.resources.length,
  snapshotDigest: resourceDocument.snapshotDigest,
}, null, 2));

function mapLegacyRuntime(manifest: LegacyRuntimeManifest): SystemPackageDocument["runtime"] {
  return {
    characterDataVersion: manifest.角色数据版本,
    ...(manifest.加载展示 ? { loadingPresentation: {
      tagline: manifest.加载展示.标语,
      accentColor: manifest.加载展示.强调色,
    } } : {}),
    pages: manifest.pages,
    ...(manifest.skins ? { skins: manifest.skins.map((skin) => ({
      id: skin.ID,
      name: skin.名称,
      css: skin.css,
      frameworkColorScheme: skin.推荐框架配色,
    })) } : {}),
    ...(manifest.defaultSkin ? { defaultSkin: manifest.defaultSkin } : {}),
    modules: manifest.modules,
    ...(manifest.dependencies ? { dependencies: manifest.dependencies } : {}),
    ...(manifest.characterTextExports ? { characterTextExports: manifest.characterTextExports } : {}),
    ...(manifest.validationChecks ? { validationChecks: manifest.validationChecks.map((check) => ({
      id: check.ID,
      script: check.脚本,
    })) } : {}),
  };
}

async function collectPublishedRuntimePaths(sourceDirectory: string, relative = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relative, entry.name);
    if (relativePath === "resources" || relativePath.startsWith("resources/")) continue;
    if (relativePath === "system.json" || relativePath === runtimeInventoryName) continue;
    if (entry.isDirectory()) files.push(...await collectPublishedRuntimePaths(path.join(sourceDirectory, entry.name), relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

function portableName(value: string): string {
  return value.normalize("NFC").replace(/[<>:"/\\|?*]/gu, "-").trim() || "未命名资源";
}
