import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

import {
  computeResourcePackageSnapshotDigest,
  writePbres,
  type ResourcePackageLogicalDocument,
  type ResourcePackageMedia,
  type SystemPackageDocument,
} from "../packages/contract-runtime/src/index.ts";
import { templateRegistry } from "../packages/templates/src/core/index.ts";

type SourceEntry = Record<string, unknown> & { ID: string; 名称: string };
type ResourceData = ResourcePackageLogicalDocument["resources"][number]["data"];

const sourceRoot = path.resolve("apps/player/system-package-sources/daggerheart-core");
const outputRoot = path.resolve("apps/player/public/system-packages/daggerheart-core");
const generatedSystemDocumentPath = path.resolve("apps/player/src/daggerheart-core-system.generated.json");
const generatedPresetPath = path.resolve("apps/player/src/daggerheart-core-preset.generated.json");
const runtimeInventoryName = ".pbdh-runtime-files.json";
const systemPackageId = "01a0132c-4eef-7703-94ac-ec8d1a660001";
const systemPackageVersion = "1.0.0";
const resourcePackageVersion = "1.0.2";
const resourcePackageId = "01a0132c-4eef-7703-94ac-ec8d1a660002";

const libraries = [
  library("ancestries", "种族", "种族", "0.0.0-dev.1", transformAncestry),
  library("communities", "社群", "社群", "0.0.0-dev.1", transformCommunity),
  library("classes", "职业", "职业", "0.0.0-dev.1", transformProfession),
  library("subclasses", "子职业", "子职业", "0.0.0-dev.1", transformSubclass),
  library("weapons", "武器", "武器", "1.0.0", transformWeapon),
  library("armor", "护甲", "护甲", "1.0.0", transformArmor),
  library("loot", "物品与消耗品", "物品", "0.0.0-dev.1", transformItem),
  library("domain-cards", "领域卡", "领域卡", "0.0.0-dev.1", transformDomain),
] as const;

const sourceResourceAssetPaths = new Set<string>();
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
    path.join(sourceRoot, "resources", `${definition.id}.json`),
    "utf8",
  )) as SourceEntry[];
  for (const entry of entries) {
    const data = definition.transform(entry);
    if (!validate(data)) {
      throw new Error(`${definition.id}/${entry.ID} does not match ${definition.templateId}: ${JSON.stringify(validate.errors)}`);
    }
    const resourceMedia: Record<string, string> = {};
    await admitSourceImage(entry, "卡图", "portrait", resourceMedia, assets, media);
    await admitSourceImage(entry, "卡背", "back", resourceMedia, assets, media);
    resources.push({
      id: entry.ID,
      path: `${definition.label}/${portableName(entry.ID)}.json`,
      template: { id: definition.templateId, version: definition.templateVersion },
      presentation: {
        ...template.defaultPresentation,
        mode: resourceMedia.portrait ? "image" : "text",
      },
      data: data as ResourceData,
      media: resourceMedia,
    });
  }
  generatedLibraries.push({
    definition,
    assets: [...assets.values()].sort((left, right) => left.id.localeCompare(right.id)),
    resources: resources.sort((left, right) => left.path.localeCompare(right.path)),
    media,
  });
}

const coreMedia = new Map<string, Uint8Array>();
for (const { media } of generatedLibraries) {
  for (const [assetId, bytes] of media) coreMedia.set(assetId, bytes);
}
let coreDocument: ResourcePackageLogicalDocument = {
  contractVersion: "1.0.0",
  package: {
    id: resourcePackageId,
    version: resourcePackageVersion,
    name: "Daggerheart Core",
    description: "Daggerheart Core 系统包随附的完整游戏资源。",
  },
  targets: [{ systemPackageId, version: systemPackageVersion }],
  license: {
    label: "系统包内置资源",
    declaration: "由 Daggerheart Core 系统包提供。",
  },
  forkSource: null,
  assets: [...new Map(generatedLibraries.flatMap(({ assets }) =>
    assets.map((asset) => [asset.id, asset] as const))).values()]
    .sort((left, right) => left.id.localeCompare(right.id)),
  resources: generatedLibraries.flatMap(({ resources }) => resources)
    .sort((left, right) => left.path.localeCompare(right.path)),
  emptyDirectories: [],
  snapshotDigest: `sha256:${"0".repeat(64)}`,
};
coreDocument = {
  ...coreDocument,
  snapshotDigest: await computeResourcePackageSnapshotDigest(coreDocument, coreMedia),
};

const systemDocument: SystemPackageDocument = {
  contractVersion: "1.0.0-alpha.1",
  package: {
    id: systemPackageId,
    version: systemPackageVersion,
    name: "Daggerheart",
    description: "由迁移后的 Sheet Runtime 驱动的 Daggerheart Core 系统包。",
  },
  resourceCompatibility: libraries.map((definition) => ({
    templateId: definition.templateId,
    versionRange: definition.templateVersion === "1.0.0"
      ? { minimumInclusive: "1.0.0", maximumExclusive: "2.0.0" }
      : { minimumInclusive: definition.templateVersion, maximumExclusive: "1.0.0" },
    nativeEntry: { id: definition.id, label: definition.label },
  })),
  modules: [
    {
      id: "pick-primary-weapon",
      type: "resourcePicker",
      nativeEntryId: "weapons",
      buttonLabel: "选择主武器",
      columns: [
        { field: "名称", label: "名称", width: "fill", sortable: true, filterable: false },
        { field: "属性", label: "属性", width: "normal", sortable: true, filterable: true },
        { field: "距离", label: "距离", width: "normal", sortable: true, filterable: true },
        { field: "伤害", label: "伤害", width: "normal", sortable: true, filterable: false },
        { field: "负荷", label: "负荷", width: "normal", sortable: true, filterable: true },
        { field: "位阶", label: "位阶", width: "compact", sortable: true, filterable: true },
      ],
    },
    { id: "primary-weapon-name", type: "freeText", label: "主武器" },
    { id: "primary-weapon-description", type: "longText", label: "武器特性" },
  ],
  dependencies: [{
    id: "fill-primary-weapon",
    trigger: { type: "resourceSelected", sourceModuleId: "pick-primary-weapon" },
    condition: { type: "always" },
    actions: [
      {
        type: "fillText",
        targetModuleId: "primary-weapon-name",
        content: {
          type: "selectedResourceTemplate",
          format: "**{{名称}}**｜{{属性}}｜{{距离}}｜{{伤害}} {{伤害类型}}｜{{负荷}}",
        },
      },
      {
        type: "fillText",
        targetModuleId: "primary-weapon-description",
        content: { type: "selectedResourceField", field: "描述" },
      },
    ],
  }],
  embeddedResources: [{
    path: "resources/daggerheart-core.pbres",
    packageId: coreDocument.package.id,
    version: coreDocument.package.version,
    minimumVersion: coreDocument.package.version,
    snapshotDigest: coreDocument.snapshotDigest,
  }],
};

await mkdir(outputRoot, { recursive: true });
await copyRuntimeSource(sourceRoot, outputRoot);
const systemDocumentJson = `${JSON.stringify(systemDocument, null, 2)}\n`;
await writeFile(path.join(outputRoot, "system.json"), systemDocumentJson, "utf8");
await writeFile(generatedSystemDocumentPath, systemDocumentJson, "utf8");
await mkdir(path.join(outputRoot, "runtime-libraries"), { recursive: true });
for (const definition of libraries) {
  await writeFile(path.join(outputRoot, "runtime-libraries", `${definition.id}.json`), "[]\n", "utf8");
}
await mkdir(path.join(outputRoot, "resources"), { recursive: true });
await writeFile(
  path.join(outputRoot, "resources", "daggerheart-core.pbres"),
  writePbres(coreDocument, coreMedia),
);

const manifest = JSON.parse(await readFile(path.join(sourceRoot, "manifest.json"), "utf8")) as Record<string, unknown>;
manifest.ID = systemPackageId;
manifest.版本 = systemPackageVersion;
manifest.resourceLibraries = libraries.map((definition) => ({
  ID: definition.id,
  名称: definition.label,
  路径: `runtime-libraries/${definition.id}.json`,
}));
delete manifest.resourceFormatAdapters;
await writeFile(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const runtimeFiles = [
  ...await collectRuntimeSourcePaths(sourceRoot),
  "manifest.json",
  ...libraries.map((definition) => `runtime-libraries/${definition.id}.json`),
].sort();
await writeFile(
  path.join(outputRoot, runtimeInventoryName),
  `${JSON.stringify({ schemaVersion: 1, files: runtimeFiles })}\n`,
  "utf8",
);
await writeFile(generatedPresetPath, `${JSON.stringify({
  id: systemPackageId,
  urlPath: "daggerheart",
  name: "匕首心",
  version: systemPackageVersion,
  releaseVersion: "0.0.0-dev",
  directory: "daggerheart-core",
  inventoryPath: runtimeInventoryName,
  fileCount: runtimeFiles.length,
  metadataFileCount: runtimeFiles.filter((file) => !file.startsWith("assets/")).length,
  loadingPresentation: manifest.加载展示,
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  archive: {
    id: "daggerheart-core",
    assets: coreDocument.assets.length,
    bytes: [...coreMedia.values()].reduce((total, value) => total + value.byteLength, 0),
    resources: coreDocument.resources.length,
    snapshotDigest: coreDocument.snapshotDigest,
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

async function admitSourceImage(
  entry: SourceEntry,
  sourceField: "卡图" | "卡背",
  slot: string,
  resourceMedia: Record<string, string>,
  assets: Map<string, ResourcePackageLogicalDocument["assets"][number]>,
  media: Map<string, Uint8Array>,
) {
  const relativePath = entry[sourceField];
  if (typeof relativePath !== "string" || !relativePath.endsWith(".webp")) return;
  sourceResourceAssetPaths.add(relativePath.replaceAll("\\", "/"));
  const bytes = new Uint8Array(await readFile(path.join(sourceRoot, ...relativePath.split("/"))));
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

async function copyRuntimeSource(sourceDirectory: string, targetDirectory: string, relative = "") {
  await mkdir(targetDirectory, { recursive: true });
  for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relative, entry.name);
    if (relativePath === "resources" || relativePath.startsWith("resources/")) continue;
    if (relativePath === "manifest.json") continue;
    if (relativePath === "adapters/resource-formats.json") continue;
    if (sourceResourceAssetPaths.has(relativePath)) continue;
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);
    if (entry.isDirectory()) await copyRuntimeSource(sourcePath, targetPath, relativePath);
    else if (entry.isFile()) await writeFile(targetPath, await readFile(sourcePath));
  }
}

async function collectRuntimeSourcePaths(sourceDirectory: string, relative = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relative, entry.name);
    if (relativePath === "resources" || relativePath.startsWith("resources/")) continue;
    if (relativePath === "manifest.json") continue;
    if (relativePath === "adapters/resource-formats.json") continue;
    if (sourceResourceAssetPaths.has(relativePath)) continue;
    if (entry.isDirectory()) files.push(...await collectRuntimeSourcePaths(path.join(sourceDirectory, entry.name), relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

function feature(value: unknown) {
  const text = string(value);
  return { 名称: /\*\*([^*]+)\*\*/u.exec(text)?.[1] ?? "特性", 描述: text };
}

function transformAncestry(entry: SourceEntry) {
  return { 名称: string(entry.名称), 简介: string(entry.简介), 特性: [feature(entry.特性A), feature(entry.特性B)] };
}

function transformCommunity(entry: SourceEntry) {
  return { 名称: string(entry.名称), 简介: string(entry.简介), 性格: string(entry.性格), 特性: feature(entry.描述) };
}

function transformProfession(entry: SourceEntry) {
  return {
    名称: string(entry.名称),
    描述: string(entry.描述),
    领域: string(entry.领域).split("+").map((value) => value.trim()).filter(Boolean),
    生命点: string(entry.生命点),
    闪避值: string(entry.闪避值),
    职业物品: string(entry.职业物品),
    希望特性: string(entry.希望特性),
    职业特性: string(entry.职业特性),
    推荐初始属性: { 说明: string(entry.推荐初始属性) },
    推荐初始武器: string(entry.推荐初始武器),
    推荐初始护甲: string(entry.推荐初始护甲),
    背景问题: [entry.背景问题1, entry.背景问题2, entry.背景问题3].map(string),
    关系问题: [entry.关系问题1, entry.关系问题2, entry.关系问题3].map(string),
    施法属性: string(entry.施法属性),
  };
}

function transformSubclass(entry: SourceEntry) {
  return {
    名称: string(entry.名称), 主职: string(entry.主职), 等级: string(entry.等级),
    施法属性: string(entry.施法属性), 描述: string(entry.描述), 风味描述: string(entry.风味描述),
  };
}

function transformWeapon(entry: SourceEntry) {
  return {
    名称: string(entry.名称), 类型: string(entry.类型), 属性: string(entry.属性), 距离: string(entry.距离),
    伤害: string(entry.伤害), 负荷: string(entry.负荷), 伤害类型: string(entry.伤害类型),
    描述: string(entry.描述), 位阶: string(entry.位阶),
  };
}

function transformArmor(entry: SourceEntry) {
  return {
    名称: string(entry.名称), 类型: string(entry.类型), 护甲值: string(entry.护甲值),
    重度伤害阈值: string(entry.重度阈值), 严重伤害阈值: string(entry.严重阈值),
    描述: string(entry.描述), 风味描述: string(entry.风味描述), 位阶: string(entry.位阶),
  };
}

function transformItem(entry: SourceEntry) {
  return {
    名称: string(entry.名称), 类型: string(entry.类型), 掷骰: string(entry.掷骰),
    描述: string(entry.描述), 风味描述: string(entry.风味描述),
  };
}

function transformDomain(entry: SourceEntry) {
  return {
    名称: string(entry.名称), 领域: string(entry.领域), 等级: numericToken(entry.等级), 属性: string(entry.属性),
    回想: numericToken(entry.回想), 描述: string(entry.描述), 风味描述: string(entry.风味描述),
  };
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
