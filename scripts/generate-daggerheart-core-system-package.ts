import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

import {
  computeResourcePackageSnapshotDigest,
  loadPbres,
  writePbres,
  type ResourcePackageCandidate,
  type ResourcePackageLogicalDocument,
  type ResourcePackageMedia,
  type SystemPackageDocument,
} from "../packages/contract-runtime/src/index.ts";
import { templateRegistry } from "../packages/templates/src/core/index.ts";

type SourceEntry = Record<string, unknown> & { ID: string; 名称: string };
type ResourceData = ResourcePackageLogicalDocument["resources"][number]["data"];
type LegacyRuntimeManifest = {
  角色数据版本: string;
  加载展示?: { 标语: string; 强调色: string };
  pages: string;
  shell?: { html: string; css?: string };
  skins?: Array<{
    ID: string;
    名称: string;
    css: string;
    推荐框架配色: "light" | "dark";
    layoutOverrides?: {
      shell?: { html: string };
      pages?: Array<{ ID: string; html: string }>;
    };
  }>;
  defaultSkin?: string;
  modules: string;
  dependencies?: string;
  characterCreationGuide?: string;
  questionnaireCharacterCreation?: { ID: string; 名称: string; html: string };
  characterFormatAdapters?: string;
  characterTextExports?: string;
  validationChecks?: Array<{ ID: string; 脚本: string }>;
};

const sourceRoot = path.resolve("apps/player/system-package-sources/daggerheart-core");
const resourceRoot = path.resolve(argument("--resource-root") ?? path.join(sourceRoot, "resources"));
const outputRoot = path.resolve("apps/player/public/system-packages/daggerheart-core");
const thirdPartyGmPackagePath = path.resolve("docs/third/daggerheart-core-gm.pbres");
const generatedSystemDocumentPath = path.resolve("apps/player/src/daggerheart-core-system.generated.json");
const generatedPresetPath = path.resolve("apps/player/src/daggerheart-core-preset.generated.json");
const runtimeInventoryName = ".pbdh-runtime-files.json";
const systemPackageId = "01a0132c-4eef-7703-94ac-ec8d1a660001";
const systemPackageVersion = "1.0.0";
const resourcePackageVersion = "1.0.24";
const resourcePackageId = "01a0132c-4eef-7703-94ac-ec8d1a660002";
const gmResourcePackageVersion = "1.0.5";
const gmResourcePackageId = "01a0132c-4eef-7703-94ac-ec8d1a660003";
const previousPlayerPackage = await loadPreviousPackage(path.join(outputRoot, "resources", "daggerheart-core.pbres"));
const previousGmPackage = await loadPreviousPackage(thirdPartyGmPackagePath);
const legacyManifest = JSON.parse(await readFile(
  path.join(sourceRoot, "manifest.json"),
  "utf8",
)) as LegacyRuntimeManifest;

const playerLibraries = [
  library("ancestries", "种族", "种族", "1.0.1", transformAncestry),
  library("communities", "社群", "社群", "1.0.1", transformCommunity),
  library("classes", "职业", "职业", "1.0.1", transformProfession),
  library("subclasses", "子职业", "子职业", "1.0.1", transformSubclass),
  library("beastforms", "野兽形态", "自由", "1.0.1", transformBeastform),
  library("weapons", "武器", "武器", "1.0.1", transformWeapon),
  library("armor", "护甲", "护甲", "1.0.1", transformArmor),
  library("loot", "物品与消耗品", "物品", "1.0.1", transformItem),
  library("domain-cards", "领域卡", "领域卡", "1.0.1", transformDomain),
] as const;
const gmLibraries = [
  library("adversaries", "敌人", "敌人", "1.0.1", transformAdversary),
  library("environments", "环境", "环境", "1.0.1", transformEnvironment),
] as const;
const libraries = [...playerLibraries, ...gmLibraries] as const;

const generatedLibraries: Array<{
  definition: typeof libraries[number];
  assets: ResourcePackageLogicalDocument["assets"];
  resources: ResourcePackageLogicalDocument["resources"];
  media: Map<string, Uint8Array>;
}> = [];

for (const definition of libraries) {
  const media = new Map<string, Uint8Array>();
  const assets = new Map<string, ResourcePackageLogicalDocument["assets"][number]>();
  const resources: ResourcePackageLogicalDocument["resources"] = [];
  const template = templateRegistry.resolve(definition.templateId, definition.templateVersion);
  if (!template) throw new Error(`Missing Template: ${definition.templateId}@${definition.templateVersion}`);
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(template.schema);
  const entries = JSON.parse(await readFile(
    path.join(resourceRoot, `${definition.id}.json`),
    "utf8",
  )) as SourceEntry[];
  const previousPackage = playerLibraries.some((candidate) => candidate.id === definition.id)
    ? previousPlayerPackage
    : previousGmPackage;
  for (const entry of entries) {
    const data = definition.transform(entry);
    if (!validate(data)) {
      throw new Error(`${definition.id}/${entry.ID} does not match ${definition.templateId}: ${JSON.stringify(validate.errors)}`);
    }
    const resourceMedia: Record<string, string> = {};
    await admitSourceImage(entry, previousPackage, "卡图", "portrait", resourceMedia, assets, media);
    await admitSourceImage(entry, previousPackage, "卡背", "back", resourceMedia, assets, media);
    resources.push({
      id: entry.ID,
      path: resourcePath(definition.id, data as ResourceData),
      template: { id: definition.templateId, version: definition.templateVersion },
      presentation: {
        ...template.defaultPresentation,
        mode: resourceMedia.portrait ? "image" : "text",
      },
      data: data as ResourceData,
      media: resourceMedia,
      attribution: { artworkCredit: "", sourceLabel: playerLibraries.some((candidate) => candidate.id === definition.id) ? "匕首之心玩家资源" : "匕首之心主持人资源" },
    });
  }
  generatedLibraries.push({
    definition,
    assets: [...assets.values()].sort((left, right) => left.id.localeCompare(right.id)),
    resources: resources.sort((left, right) => left.path.localeCompare(right.path)),
    media,
  });
}

let coreDocument: ResourcePackageLogicalDocument = resourceDocument(
  resourcePackageId,
  resourcePackageVersion,
  "匕首之心玩家资源",
  "种族、社群、职业、子职业、野兽形态、武器、护甲、物品与领域卡。",
  new Set(playerLibraries.map((definition) => definition.id)),
);
const coreMedia = mediaFor(new Set(playerLibraries.map((definition) => definition.id)));
coreDocument = {
  ...coreDocument,
  snapshotDigest: await computeResourcePackageSnapshotDigest(coreDocument, coreMedia),
};

let gmDocument: ResourcePackageLogicalDocument = resourceDocument(
  gmResourcePackageId,
  gmResourcePackageVersion,
  "匕首之心主持人资源",
  "仅包含环境与敌人资源。",
  new Set(gmLibraries.map((definition) => definition.id)),
);
const gmMedia = mediaFor(new Set(gmLibraries.map((definition) => definition.id)));
gmDocument = {
  ...gmDocument,
  snapshotDigest: await computeResourcePackageSnapshotDigest(gmDocument, gmMedia),
};

function resourceDocument(id: string, version: string, name: string, description: string, libraryIds: Set<string>): ResourcePackageLogicalDocument {
  const selected = generatedLibraries.filter(({ definition }) => libraryIds.has(definition.id));
  return {
  contractVersion: "1.1.0",
  package: {
    id,
    version,
    name,
    description,
  },
  targets: [{ systemPackageId, version: systemPackageVersion }],
  license: {
    label: "Darrington Press Community Gaming License",
    declaration: "https://darringtonpress.com/license/",
  },
  forkSource: null,
  assets: [...new Map(selected.flatMap(({ assets }) =>
    assets.map((asset) => [asset.id, asset] as const))).values()]
    .sort((left, right) => left.id.localeCompare(right.id)),
  resources: selected.flatMap(({ resources }) => resources)
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
  emptyDirectories: [],
  snapshotDigest: `sha256:${"0".repeat(64)}`,
  };
}

function mediaFor(libraryIds: Set<string>): Map<string, Uint8Array> {
  const media = new Map<string, Uint8Array>();
  for (const library of generatedLibraries.filter(({ definition }) => libraryIds.has(definition.id))) {
    for (const [assetId, bytes] of library.media) media.set(assetId, bytes);
  }
  return media;
}

const systemDocument: SystemPackageDocument = {
  contractVersion: "1.0.0",
  package: {
    id: systemPackageId,
    version: systemPackageVersion,
    name: "匕首之心",
    description: "由迁移后的 Sheet Runtime 驱动的 Daggerheart Core 系统包。",
  },
  runtime: mapLegacyRuntime(legacyManifest),
  resourceCompatibility: libraries.map((definition) => ({
    templateId: definition.templateId,
    versionRange: { minimumInclusive: "1.0.0", maximumExclusive: "2.0.0" },
    nativeEntry: { id: definition.id, label: definition.label },
  })),
  embeddedResources: [
    { path: "resources/daggerheart-core.pbres" },
  ],
};

await mkdir(outputRoot, { recursive: true });
const systemDocumentJson = `${JSON.stringify(systemDocument, null, 2)}\n`;
await writeFile(path.join(outputRoot, "system.json"), systemDocumentJson, "utf8");
await writeFile(generatedSystemDocumentPath, systemDocumentJson, "utf8");
await mkdir(path.join(outputRoot, "resources"), { recursive: true });
await writeFile(
  path.join(outputRoot, "resources", "daggerheart-core.pbres"),
  writePbres(coreDocument, coreMedia),
);
await mkdir(path.dirname(thirdPartyGmPackagePath), { recursive: true });
await writeFile(thirdPartyGmPackagePath, writePbres(gmDocument, gmMedia));
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
  urlPath: "daggerheart",
  name: "匕首之心",
  version: systemPackageVersion,
  releaseVersion: "0.0.0-dev",
  directory: "daggerheart-core",
  inventoryPath: runtimeInventoryName,
  fileCount: runtimeFiles.length,
  metadataFileCount: runtimeFiles.filter((file) => !file.startsWith("assets/")).length,
  embeddedResourceIndex: [
    { path: "resources/daggerheart-core.pbres", packageId: coreDocument.package.id },
  ],
  loadingPresentation: legacyManifest.加载展示,
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  archive: {
    id: "daggerheart-core",
    assets: coreDocument.assets.length,
    bytes: [...coreMedia.values()].reduce((total, value) => total + value.byteLength, 0),
    resources: coreDocument.resources.length,
    snapshotDigest: coreDocument.snapshotDigest,
  },
  gmArchive: {
    id: "daggerheart-core-gm",
    assets: gmDocument.assets.length,
    bytes: [...gmMedia.values()].reduce((total, value) => total + value.byteLength, 0),
    resources: gmDocument.resources.length,
    snapshotDigest: gmDocument.snapshotDigest,
  },
}, null, 2));

function library<T extends SourceEntry>(
  id: string,
  label: string,
  templateId: string,
  templateVersion: string,
  transform: (entry: T) => Record<string, unknown>,
) {
  return { id, label, templateId, templateVersion, transform: transform as (entry: SourceEntry) => Record<string, unknown> };
}

function mapLegacyRuntime(manifest: LegacyRuntimeManifest): SystemPackageDocument["runtime"] {
  return {
    characterDataVersion: manifest.角色数据版本,
    ...(manifest.加载展示 ? { loadingPresentation: {
      tagline: manifest.加载展示.标语,
      accentColor: manifest.加载展示.强调色,
    } } : {}),
    pages: manifest.pages,
    ...(manifest.shell ? { shell: manifest.shell } : {}),
    ...(manifest.skins ? { skins: manifest.skins.map((skin) => ({
      id: skin.ID,
      name: skin.名称,
      css: skin.css,
      frameworkColorScheme: skin.推荐框架配色,
      ...(skin.layoutOverrides ? { layoutOverrides: {
        ...(skin.layoutOverrides.shell ? { shell: skin.layoutOverrides.shell } : {}),
        ...(skin.layoutOverrides.pages ? { pages: skin.layoutOverrides.pages.map((page) => ({
          id: page.ID,
          html: page.html,
        })) } : {}),
      } } : {}),
    })) } : {}),
    ...(manifest.defaultSkin ? { defaultSkin: manifest.defaultSkin } : {}),
    modules: manifest.modules,
    ...(manifest.dependencies ? { dependencies: manifest.dependencies } : {}),
    ...(manifest.characterCreationGuide ? { characterCreationGuide: manifest.characterCreationGuide } : {}),
    ...(manifest.questionnaireCharacterCreation ? { questionnaireCharacterCreation: {
      id: manifest.questionnaireCharacterCreation.ID,
      name: manifest.questionnaireCharacterCreation.名称,
      html: manifest.questionnaireCharacterCreation.html,
    } } : {}),
    ...(manifest.characterFormatAdapters ? { characterFormatAdapters: manifest.characterFormatAdapters } : {}),
    ...(manifest.characterTextExports ? { characterTextExports: manifest.characterTextExports } : {}),
    ...(manifest.validationChecks ? { validationChecks: manifest.validationChecks.map((check) => ({
      id: check.ID,
      script: check.脚本,
    })) } : {}),
  };
}

async function admitSourceImage(
  entry: SourceEntry,
  previousPackage: ResourcePackageCandidate | null,
  sourceField: "卡图" | "卡背",
  slot: string,
  resourceMedia: Record<string, string>,
  assets: Map<string, ResourcePackageLogicalDocument["assets"][number]>,
  media: Map<string, Uint8Array>,
) {
  const relativePath = entry[sourceField];
  const previousResource = previousPackage?.document.resources.find((resource) => resource.id === entry.ID)
    ?? previousPackage?.document.resources.find((resource) => resource.data.名称 === entry.名称 && (entry.等级 === undefined || resource.data.等级 === entry.等级));
  const previousAssetId = previousResource?.media[slot];
  const previousBytes = previousAssetId ? previousPackage?.media.get(previousAssetId) : undefined;
  if ((typeof relativePath !== "string" || !relativePath.endsWith(".webp")) && !previousBytes) return;
  let bytes: Uint8Array;
  if (typeof relativePath === "string" && relativePath.endsWith(".webp")) {
    try {
      bytes = new Uint8Array(await readFile(path.join(sourceRoot, ...relativePath.split("/"))));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      if (!previousBytes) throw new Error(`Missing packed media for ${entry.ID}/${slot}: ${relativePath}`);
      bytes = previousBytes;
    }
  } else {
    bytes = previousBytes!;
  }
  const id = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (!assets.has(id)) {
    const dimensions = webpDimensions(bytes);
    assets.set(id, {
      id,
      mediaType: "image/webp",
      byteLength: String(bytes.byteLength),
      width: String(dimensions.width),
      height: String(dimensions.height),
    });
    media.set(id, bytes);
  }
  resourceMedia[slot] = id;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
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

async function loadPreviousPackage(filePath: string): Promise<ResourcePackageCandidate | null> {
  try {
    const loaded = await loadPbres(new Uint8Array(await readFile(filePath)), async () => []);
    if (!loaded.candidate) throw new Error(`Invalid existing Resource Package: ${filePath}`);
    return loaded.candidate;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function transformAncestry(entry: SourceEntry) {
  return { 名称: string(entry.名称), 原文: string(entry.原文), 类型: string(entry.类型), 简介: string(entry.简介), 特性: entry.特性 };
}

function transformCommunity(entry: SourceEntry) {
  return { 名称: string(entry.名称), 原文: string(entry.原文), 类型: string(entry.类型), 简介: string(entry.简介), 性格: string(entry.性格), 特性: entry.特性 };
}

function transformProfession(entry: SourceEntry) {
  return {
    名称: string(entry.名称), 原文: string(entry.原文), 类型: string(entry.类型), 简介: string(entry.简介),
    领域: entry.领域, 生命点: string(entry.生命点), 闪避值: string(entry.闪避值), 职业物品: string(entry.职业物品),
    希望特性: entry.希望特性, 特性: entry.特性, 推荐初始属性: entry.推荐初始属性,
    推荐初始武器: string(entry.推荐初始武器), 推荐初始护甲: string(entry.推荐初始护甲), 背景问题: entry.背景问题, 关系问题: entry.关系问题,
  };
}

function transformSubclass(entry: SourceEntry) {
  return {
    名称: string(entry.名称), 原文: string(entry.原文), 类型: string(entry.类型), 主职: string(entry.主职), 等级: string(entry.等级),
    施法属性: string(entry.施法属性), 特性: entry.特性, 简介: string(entry.简介),
  };
}

function transformBeastform(entry: SourceEntry) {
  return Object.fromEntries(Object.entries(entry).filter(([key]) => !["ID", "卡图", "卡背"].includes(key)));
}

function transformWeapon(entry: SourceEntry) {
  return {
    名称: string(entry.名称), 原文: string(entry.原文), 类型: string(entry.类型), 属性: string(entry.属性), 距离: string(entry.距离),
    伤害: string(entry.伤害), 负荷: string(entry.负荷), 伤害类型: string(entry.伤害类型),
    特性名称: string(entry.特性名称), 特性原文: string(entry.特性原文), 特性描述: string(entry.特性描述), 简介: string(entry.简介), 位阶: string(entry.位阶),
  };
}

function transformArmor(entry: SourceEntry) {
  return {
    名称: string(entry.名称), 原文: string(entry.原文), 类型: string(entry.类型), 护甲值: string(entry.护甲值),
    重度伤害阈值: string(entry.重度伤害阈值), 严重伤害阈值: string(entry.严重伤害阈值),
    特性名称: string(entry.特性名称), 特性原文: string(entry.特性原文), 特性描述: string(entry.特性描述),
    简介: string(entry.简介), 位阶: string(entry.位阶),
  };
}

function transformItem(entry: SourceEntry) {
  return {
    名称: string(entry.名称), 原文: string(entry.原文), 类型: string(entry.类型), 掷骰: string(entry.掷骰),
    特性描述: string(entry.特性描述), 简介: string(entry.简介),
  };
}

function transformDomain(entry: SourceEntry) {
  return {
    名称: string(entry.名称), 原文: string(entry.原文), 类型: string(entry.类型), 领域: string(entry.领域), 等级: numericToken(entry.等级), 属性: string(entry.属性),
    回想: numericToken(entry.回想), 特性描述: string(entry.特性描述), 简介: string(entry.简介),
  };
}

function transformAdversary(entry: SourceEntry) {
  return Object.fromEntries(Object.entries(entry).filter(([key]) => !["ID", "卡图", "卡背"].includes(key)));
}

function transformEnvironment(entry: SourceEntry) {
  return Object.fromEntries(Object.entries(entry).filter(([key]) => !["ID", "卡图", "卡背"].includes(key)));
}

function string(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function numericToken(value: unknown): string {
  return /[0-9]+/u.exec(string(value))?.[0] ?? "";
}

function portableName(value: unknown): string {
  return string(value).normalize("NFC").replace(/[<>:"/\\|?*]/gu, "-").trim() || "未命名资源";
}

function resourcePath(kind: string, data: ResourceData): string {
  const value = data as Record<string, unknown>;
  const name = `${portableName(value.名称)}.json`;
  const parts = (() => {
    switch (kind) {
      case "weapons": return ["武器", portableName(value.类型), `位阶${portableName(value.位阶)}`, name];
      case "armor": return ["护甲", `位阶${portableName(value.位阶)}`, name];
      case "loot": return ["物品", portableName(value.类型), name];
      case "domain-cards": return ["领域卡", portableName(value.领域), name];
      case "subclasses": return ["子职业", portableName(value.主职), `${portableName(value.名称)}-${portableName(value.等级)}.json`];
      case "beastforms": return ["野兽形态", name];
      case "adversaries": return ["敌人", `位阶${portableName(value.位阶)}`, adversaryFolder(value.种类), name];
      case "environments": return ["环境", `位阶${portableName(value.位阶)}`, portableName(value.种类), name];
      case "ancestries": return ["种族", name];
      case "communities": return ["社群", name];
      case "classes": return ["职业", name];
      default: throw new Error(`Unsupported resource library path: ${kind}`);
    }
  })();
  return parts.join("/");
}

function adversaryFolder(type: unknown): string {
  const name = portableName(type);
  return /^集群(?:\(|$)/u.test(name) ? "集群" : name;
}

function webpDimensions(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") throw new Error("Invalid WebP asset.");
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X") {
    return { width: uint24(bytes, 24) + 1, height: uint24(bytes, 27) + 1 };
  }
  if (chunk === "VP8 ") {
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const bits = view.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  throw new Error(`Unsupported WebP chunk: ${chunk}`);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function uint24(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}
