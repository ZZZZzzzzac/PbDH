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
  type SystemPackageDocument,
} from "../packages/contract-runtime/src/index.ts";
import { templateRegistry } from "../packages/templates/src/core/index.ts";

type SourceEntry = Record<string, unknown> & { ID: string; 名称: string };
type LegacyLibrary = { ID: string; 名称: string; 路径: string };
type LegacyManifest = {
  ID: string;
  名称: string;
  版本: string;
  角色数据版本?: string;
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
  resourceLibraries: LegacyLibrary[];
};
type PackageConfig = {
  directory: "witchy" | "hows-my-driving" | "tttri";
  urlPath: string;
  systemPackageId: string;
  resourcePackageId: string;
  standardLibraries?: Record<string, { templateId: string; transform: (entry: SourceEntry) => Record<string, unknown> }>;
};

const configs: PackageConfig[] = [
  {
    directory: "witchy",
    urlPath: "witchy",
    systemPackageId: "01a05400-0000-7000-8000-000000000001",
    resourcePackageId: "01a05400-0000-7000-8000-000000000002",
  },
  {
    directory: "hows-my-driving",
    urlPath: "hows-my-driving",
    systemPackageId: "01a05400-0000-7000-8000-000000000101",
    resourcePackageId: "01a05400-0000-7000-8000-000000000102",
  },
  {
    directory: "tttri",
    urlPath: "tttri",
    systemPackageId: "01a05400-0000-7000-8000-000000000201",
    resourcePackageId: "01a05400-0000-7000-8000-000000000202",
    standardLibraries: {
      classes: { templateId: "职业", transform: transformProfession },
      subclasses: { templateId: "子职业", transform: transformSubclass },
      ancestries: { templateId: "种族", transform: transformAncestry },
      communities: { templateId: "社群", transform: transformCommunity },
      "domain-cards": { templateId: "领域卡", transform: transformDomain },
      armor: { templateId: "护甲", transform: transformArmor },
      loot: { templateId: "物品", transform: transformItem },
    },
  },
];

for (const config of configs) await generate(config);

async function generate(config: PackageConfig) {
  const sourceRoot = path.resolve("apps/player/system-package-sources", config.directory);
  const outputRoot = path.resolve("apps/player/public/system-packages", config.directory);
  const manifest = JSON.parse(await readFile(path.join(sourceRoot, "manifest.json"), "utf8")) as LegacyManifest;
  const previousPackage = await loadPreviousPackage(path.join(outputRoot, "resources", `${config.directory}.pbres`));
  const assets = new Map<string, ResourcePackageLogicalDocument["assets"][number]>();
  const media = new Map<string, Uint8Array>();
  const resources: ResourcePackageLogicalDocument["resources"] = [];
  const legacyLibraries: Array<LegacyLibrary & { entries: SourceEntry[] }> = [];

  for (const library of manifest.resourceLibraries) {
    const entries = JSON.parse(await readFile(path.join(sourceRoot, ...library.路径.split("/")), "utf8")) as SourceEntry[];
    legacyLibraries.push({ ...library, entries });
    const standard = config.standardLibraries?.[library.ID];
    const templateId = standard?.templateId ?? "自由";
    const template = templateRegistry.resolve(templateId, "1.0.0");
    if (!template) throw new Error(`Missing Template: ${templateId}@1.0.0`);
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(template.schema);
    for (const entry of entries) {
      const data = standard ? standard.transform(entry) : transformFree(entry, library.名称);
      if (!validate(data)) {
        throw new Error(`${config.directory}/${library.ID}/${entry.ID}: ${JSON.stringify(validate.errors)}`);
      }
      const resourceMedia: Record<string, string> = {};
      await admitImage(sourceRoot, previousPackage, entry, "卡图", "portrait", resourceMedia, assets, media);
      await admitImage(sourceRoot, previousPackage, entry, "卡背", "back", resourceMedia, assets, media);
      resources.push({
        id: entry.ID,
        path: `${library.名称}/${portableName(entry.ID)}.json`,
        template: { id: templateId, version: "1.0.0" },
        presentation: { ...template.defaultPresentation, mode: resourceMedia.portrait ? "image" : "text" },
        data,
        media: resourceMedia,
      });
    }
  }

  let resourceDocument: ResourcePackageLogicalDocument = {
    contractVersion: "1.0.0",
    package: {
      id: config.resourcePackageId,
      version: manifest.版本,
      name: `${manifest.名称}官方资源`,
      description: `${manifest.名称}系统包随附的完整游戏资源。`,
    },
    targets: [{ systemPackageId: config.systemPackageId, version: manifest.版本 }],
    license: { label: "系统包内置资源", declaration: `由${manifest.名称}系统包提供。` },
    forkSource: null,
    assets: [...assets.values()].sort((left, right) => left.id.localeCompare(right.id)),
    resources: resources.sort((left, right) => left.path.localeCompare(right.path)),
    emptyDirectories: [],
    snapshotDigest: `sha256:${"0".repeat(64)}`,
  };
  resourceDocument = {
    ...resourceDocument,
    snapshotDigest: await computeResourcePackageSnapshotDigest(resourceDocument, media),
  };

  const standardCompatibility = manifest.resourceLibraries.flatMap((library) => {
    const standard = config.standardLibraries?.[library.ID];
    return standard ? [{
      templateId: standard.templateId,
      versionRange: { minimumInclusive: "1.0.0", maximumExclusive: "2.0.0" },
      nativeEntry: { id: library.ID, label: library.名称 },
    }] : [];
  });
  const systemDocument: SystemPackageDocument = {
    contractVersion: "1.0.0",
    package: {
      id: config.systemPackageId,
      version: manifest.版本,
      name: manifest.名称,
      description: `由迁移后的 Sheet Runtime 驱动的${manifest.名称}系统包。`,
    },
    runtime: mapLegacyRuntime(manifest),
    resourceCompatibility: standardCompatibility,
    embeddedResources: [{ path: `resources/${config.directory}.pbres` }],
  };

  await mkdir(outputRoot, { recursive: true });
  const systemJson = `${JSON.stringify(systemDocument, null, 2)}\n`;
  await writeFile(path.join(outputRoot, "system.json"), systemJson, "utf8");
  await writeFile(path.resolve("apps/player/src", `${config.directory}-system.generated.json`), systemJson, "utf8");
  await mkdir(path.join(outputRoot, "resources"), { recursive: true });
  await writeFile(path.join(outputRoot, "resources", `${config.directory}.pbres`), writePbres(resourceDocument, media));
  await writeFile(
    path.resolve("apps/player/src", `${config.directory}-legacy-resources.generated.json`),
    `${JSON.stringify(legacyLibraries, null, 2)}\n`,
    "utf8",
  );

  const runtimeFiles = [...await collectPublishedRuntimePaths(outputRoot), "system.json"].sort();
  const inventoryName = ".pbdh-runtime-files.json";
  await writeFile(path.join(outputRoot, inventoryName), `${JSON.stringify({ schemaVersion: 1, files: runtimeFiles })}\n`, "utf8");
  await writeFile(path.resolve("apps/player/src", `${config.directory}-preset.generated.json`), `${JSON.stringify({
    id: config.systemPackageId,
    urlPath: config.urlPath,
    name: manifest.名称,
    version: manifest.版本,
    releaseVersion: "0.0.0-dev",
    directory: config.directory,
    inventoryPath: inventoryName,
    fileCount: runtimeFiles.length,
    metadataFileCount: runtimeFiles.filter((file) => !file.startsWith("assets/")).length,
    embeddedResourceIndex: [{
      path: `resources/${config.directory}.pbres`,
      packageId: resourceDocument.package.id,
      version: resourceDocument.package.version,
      snapshotDigest: resourceDocument.snapshotDigest,
    }],
    loadingPresentation: manifest.加载展示,
  }, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    id: config.directory,
    files: runtimeFiles.length,
    resources: resources.length,
    assets: assets.size,
    mediaBytes: [...media.values()].reduce((total, bytes) => total + bytes.byteLength, 0),
  }));
}

function mapLegacyRuntime(manifest: LegacyManifest): SystemPackageDocument["runtime"] {
  return {
    characterDataVersion: manifest.角色数据版本 ?? manifest.版本,
    ...(manifest.加载展示 ? { loadingPresentation: { tagline: manifest.加载展示.标语, accentColor: manifest.加载展示.强调色 } } : {}),
    pages: manifest.pages,
    ...(manifest.shell ? { shell: manifest.shell } : {}),
    ...(manifest.skins ? { skins: manifest.skins.map((skin) => ({
      id: skin.ID,
      name: skin.名称,
      css: skin.css,
      frameworkColorScheme: skin.推荐框架配色,
      ...(skin.layoutOverrides ? { layoutOverrides: {
        ...(skin.layoutOverrides.shell ? { shell: skin.layoutOverrides.shell } : {}),
        ...(skin.layoutOverrides.pages ? { pages: skin.layoutOverrides.pages.map((page) => ({ id: page.ID, html: page.html })) } : {}),
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
    ...(manifest.validationChecks ? { validationChecks: manifest.validationChecks.map((check) => ({ id: check.ID, script: check.脚本 })) } : {}),
  };
}

async function admitImage(
  sourceRoot: string,
  previousPackage: ResourcePackageCandidate | null,
  entry: SourceEntry,
  field: "卡图" | "卡背",
  slot: string,
  resourceMedia: Record<string, string>,
  assets: Map<string, ResourcePackageLogicalDocument["assets"][number]>,
  media: Map<string, Uint8Array>,
) {
  const relativePath = entry[field];
  if (typeof relativePath !== "string" || !relativePath.endsWith(".webp")) return;
  const normalizedPath = relativePath.replaceAll("\\", "/");
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await readFile(path.join(sourceRoot, ...normalizedPath.split("/"))));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const previousResource = previousPackage?.document.resources.find((resource) => resource.id === entry.ID);
    const previousAssetId = previousResource?.media[slot];
    const previousBytes = previousAssetId ? previousPackage?.media.get(previousAssetId) : undefined;
    if (!previousBytes) throw new Error(`Missing packed media for ${entry.ID}/${slot}: ${normalizedPath}`);
    bytes = previousBytes;
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

async function collectPublishedRuntimePaths(sourceDirectory: string, relative = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relative, entry.name);
    if (relativePath === "resources" || relativePath.startsWith("resources/")) continue;
    if (relativePath === "system.json" || relativePath === ".pbdh-runtime-files.json") continue;
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

function transformFree(entry: SourceEntry, type: string) {
  const excluded = new Set(["ID", "名称", "简介", "描述", "卡图", "卡背", "卡牌显示方式"]);
  const content = Object.entries(entry).flatMap(([title, value]) => excluded.has(title)
    ? []
    : [{ 名称: title, 描述: typeof value === "string" ? value : JSON.stringify(value) }]);
  const summary = string(entry.简介 ?? entry.描述);
  const description = string(entry.描述);
  if (description && description !== summary) content.unshift({ 名称: "描述", 描述: description });
  return {
    名称: string(entry.名称),
    原文: string(entry.原文),
    类型: type || "自由",
    简介: summary,
    内容: content,
  };
}

function transformAncestry(entry: SourceEntry) {
  return { 名称: string(entry.名称), 原文: string(entry.原文 ?? entry.原名), 类型: string(entry.类型 || "种族"), 简介: string(entry.简介), 特性: [feature(entry.特性A), feature(entry.特性B)] };
}
function transformCommunity(entry: SourceEntry) {
  return { 名称: string(entry.名称), 原文: string(entry.原文 ?? entry.原名), 类型: string(entry.类型 || "社群"), 简介: string(entry.简介), 性格: string(entry.性格), 特性: feature(entry.描述) };
}
function transformProfession(entry: SourceEntry) {
  return {
    名称: string(entry.名称), 原文: string(entry.原文 ?? entry.原名), 类型: string(entry.类型 || "职业"), 简介: string(entry.简介 ?? entry.描述), 领域: [string(entry.主领域 ?? entry.领域)].filter(Boolean),
    生命点: string(entry.生命点), 闪避值: string(entry.闪避值), 职业物品: string(entry.职业物品),
    希望特性: migratedHopeFeature(entry.希望特性), 特性: migratedProfessionFeatures(entry.职业特性), 推荐初始属性: recommendedAttributes(entry.推荐初始属性),
    推荐初始武器: recommendedWeapons(entry.推荐初始武器), 推荐初始护甲: string(entry.推荐初始护甲),
    背景问题: [entry.背景问题1, entry.背景问题2, entry.背景问题3].map(string),
    关系问题: [entry.关系问题1, entry.关系问题2, entry.关系问题3].map(string),
  };
}
function migratedHopeFeature(value: unknown): { 特性名称: string; 特性原文: string; 特性描述: string } {
  const source = string(value).trim();
  const marker = /^(?:\*\\?\*)?([^：\n]{1,80})(?:\*\\?\*)?：/u.exec(source);
  return marker
    ? { 特性名称: marker[1]!.trim(), 特性原文: "", 特性描述: source.slice(marker[0].length).trim() }
    : { 特性名称: "", 特性原文: "", 特性描述: source };
}
function migratedProfessionFeatures(value: unknown): Array<{ 特性名称: string; 特性原文: string; 特性描述: string }> {
  const source = string(value).trim();
  if (!source) return [];
  const markers = [...source.matchAll(/(?:^|\n\n?)(?:\*\\?\*)?([^：\n]{1,80})(?:\*\\?\*)?：/gu)];
  if (markers.length === 0) return [{ 特性名称: "职业特性", 特性原文: "", 特性描述: source }];
  return markers.map((marker, index) => ({
    特性名称: marker[1]!.trim(),
    特性原文: "",
    特性描述: source.slice(marker.index! + marker[0].length, markers[index + 1]?.index ?? source.length).trim(),
  }));
}
function transformSubclass(entry: SourceEntry) {
  const stage = string(entry.阶段);
  return {
    名称: string(entry.名称), 原文: string(entry.原文 ?? entry.原名), 类型: string(entry.类型 || "子职业"), 主职: string(entry.主职), 等级: stage.startsWith("T4") ? "精通" : stage === "T3" ? "进阶" : "基础",
    施法属性: string(entry.施法属性), 特性: migratedSubclassFeatures(entry.子职提升 ?? entry.描述), 简介: string(entry.简介 ?? entry.风味描述),
  };
}
function migratedSubclassFeatures(value: unknown): Array<{ 特性名称: string; 特性原文: string; 特性描述: string }> {
  const source = string(value).trim();
  if (!source) return [];
  const markers = [...source.matchAll(/(?:^|\n\n)(?:子职|职业|希望)特性(?:获得|增强|追加)：([^：\n]+)：/gu)];
  return markers.map((marker, index) => ({
    特性名称: marker[1]!.trim(),
    特性原文: "",
    特性描述: source.slice(marker.index! + marker[0].length, markers[index + 1]?.index ?? source.length).trim(),
  }));
}
function transformArmor(entry: SourceEntry) {
  return {
    名称: string(entry.名称), 原文: string(entry.原文), 类型: string(entry.类型), 护甲值: string(entry.护甲值),
    重度伤害阈值: string(entry.重度阈值), 严重伤害阈值: string(entry.严重阈值),
    特性名称: string(entry.特性名称 ?? entry.特性名), 特性原文: string(entry.特性原文 ?? entry.特性原名), 特性描述: string(entry.特性描述),
    简介: string(entry.简介 ?? entry.风味描述), 位阶: string(entry.位阶),
  };
}
function transformItem(entry: SourceEntry) {
  return { 名称: string(entry.名称), 原文: string(entry.原文), 类型: string(entry.类型), 掷骰: string(entry.掷骰), 特性描述: string(entry.特性描述 ?? entry.描述), 简介: string(entry.简介 ?? entry.风味描述) };
}
function transformDomain(entry: SourceEntry) {
  return {
    名称: string(entry.名称), 原文: string(entry.原文), 类型: string(entry.类型 || "领域卡"), 领域: string(entry.领域), 等级: numericToken(entry.等级), 属性: string(entry.属性),
    回想: numericToken(entry.回想), 特性描述: string(entry.特性描述 ?? entry.描述), 简介: string(entry.简介 ?? entry.风味描述),
  };
}
function feature(value: unknown) {
  const text = string(value);
  const prefix = /^(?::red\[)?\*\*([^*]+)\*\*(?:\])?[：:]\s*/u.exec(text);
  return { 特性名称: prefix?.[1] ?? "特性", 特性原文: "", 特性描述: prefix ? text.slice(prefix[0].length) : text };
}
function recommendedAttributes(value: unknown): Record<string, string> {
  const result: Record<string, string> = Object.fromEntries(["敏捷", "力量", "灵巧", "本能", "风度", "知识"].map((name) => [name, ""]));
  const entries = Array.isArray(value) ? value.flatMap((item) => item && typeof item === "object" ? Object.entries(item) : [])
    : value && typeof value === "object" ? Object.entries(value)
      : [...string(value).matchAll(/([^\s<>]+)\s+\*\*([^*]+)\*\*/gu)].map((match) => [match[1]!, match[2]!] as const);
  for (const [name, score] of entries) if (name in result) result[name] = string(score);
  return result;
}
function recommendedWeapons(value: unknown): string {
  return (Array.isArray(value) ? value : string(value).split("+")).map(string).map((item) => item.trim()).filter(Boolean).join(" + ");
}
function string(value: unknown): string { return value === undefined || value === null ? "" : String(value); }
function numericToken(value: unknown): string { return /[0-9]+/u.exec(string(value))?.[0] ?? ""; }
function portableName(value: unknown): string { return string(value).normalize("NFC").replace(/[<>:"/\\|?*]/gu, "-").trim() || "未命名资源"; }

function webpDimensions(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") throw new Error("Invalid WebP asset.");
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X") return { width: uint24(bytes, 24) + 1, height: uint24(bytes, 27) + 1 };
  if (chunk === "VP8 ") return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = view.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  throw new Error(`Unsupported WebP chunk: ${chunk}`);
}
function ascii(bytes: Uint8Array, offset: number, length: number): string { return String.fromCharCode(...bytes.subarray(offset, offset + length)); }
function uint24(bytes: Uint8Array, offset: number): number { return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16); }
