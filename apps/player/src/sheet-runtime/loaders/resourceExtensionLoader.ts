import { strToU8, zipSync } from "fflate";
import type { GeneratedResourceId, ResourceExtension, ResourceExtensionIdContext, ResourceExtensionIssue } from "../domain/resourceExtension";
import { loadResourceExtensionJson } from "../domain/resourceExtension";
import { inferMimeType } from "../utils";
import type { RuntimePackageAsset } from "./assetResolver";
import { createVirtualFileSystemFromZipFile, type PackageVirtualFileSystem } from "./packageVfs";
import type { SystemPackage } from "../domain/systemPackage";
import { convertExternalResourceSource, detectResourceFormatAdapter, type ExternalResourceSource } from "../domain/resourceFormatAdapter";

export interface NormalizedResourceExtensionArtifact {
  fileName: string;
  mimeType: "application/json" | "application/zip";
  bytes: Uint8Array;
}

export type ResourceExtensionFileLoadResult =
  | {
      ok: true;
      extension: ResourceExtension;
      assets: RuntimePackageAsset[];
      issues: ResourceExtensionIssue[];
      generatedIds: GeneratedResourceId[];
      normalizedArtifact: NormalizedResourceExtensionArtifact;
      conversion?: {
        adapterId: string;
        adapterName: string;
        counts: { sourceEntries: number; convertedEntries: number; skippedEntries: number; convertedFields: number; skippedFields: number; boundImages: number; orphanImages: number };
      };
    }
  | { ok: false; issues: ResourceExtensionIssue[] };

export async function loadResourceExtensionFromFile(
  file: Blob,
  currentPackage: SystemPackage,
  context: ResourceExtensionIdContext = {},
  selectedAdapterId?: string,
): Promise<ResourceExtensionFileLoadResult | { ok: false; issues: ResourceExtensionIssue[]; ambiguousAdapters: Array<{ ID: string; 名称: string }> }> {
  const fileName = "name" in file && typeof file.name === "string" ? file.name : "";
  const isZip = /\.(?:zip|dhcb)$/iu.test(fileName) || file.type === "application/zip";
  const native = isZip
    ? await loadResourceExtensionFromZipFile(file, currentPackage.manifest.ID, context)
    : loadResourceExtensionFromJsonText(await file.text(), currentPackage.manifest.ID, context);
  if (native.ok) return native;

  const sourceResult = isZip ? await readExternalZipSource(file, fileName, currentPackage) : readExternalJsonSource(await file.text(), fileName);
  if (!sourceResult.ok) return sourceResult;
  const adapters = currentPackage.resourceFormatAdapters ?? [];
  const detection = detectResourceFormatAdapter(sourceResult.source, adapters);
  if (detection.status === "none") {
    return { ok: false, issues: [{ level: "error", code: "RESOURCE_FORMAT_UNSUPPORTED", text: "当前 System Package 不支持此资源包格式。" }] };
  }
  const adapter = selectedAdapterId
    ? adapters.find((candidate) => candidate.ID === selectedAdapterId && (detection.status === "match" ? candidate.ID === detection.adapter.ID : detection.adapters.some((item) => item.ID === candidate.ID)))
    : detection.status === "match" ? detection.adapter : undefined;
  if (!adapter) {
    return {
      ok: false,
      issues: [{ level: "error", code: "RESOURCE_FORMAT_AMBIGUOUS", text: "多个 Resource Format Adapter 匹配，请明确选择格式。" }],
      ambiguousAdapters: detection.status === "ambiguous" ? detection.adapters.map(({ ID, 名称 }) => ({ ID, 名称 })) : [],
    };
  }
  const converted = await convertExternalResourceSource(sourceResult.source, adapter, currentPackage);
  if ("error" in converted) return { ok: false, issues: [converted.error] };
  const loaded = loadResourceExtensionJson(JSON.stringify(converted.extensionDocument), currentPackage.manifest.ID, context);
  if (!loaded.ok) return loaded;
  const assets = converted.assets.map((asset) => ({ ...asset, sourceId: loaded.extension.ID }));
  const normalizedJson = loaded.normalizedJson;
  const normalizedArtifact = assets.length === 0
    ? { fileName: `${loaded.extension.ID}.normalized.json`, mimeType: "application/json" as const, bytes: strToU8(normalizedJson) }
    : buildConvertedZip(loaded.extension.ID, normalizedJson, assets);
  return {
    ok: true,
    extension: { ...loaded.extension, sourceType: assets.length > 0 ? "zip" : "json" },
    assets,
    issues: converted.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    generatedIds: loaded.generatedIds,
    normalizedArtifact,
    conversion: { adapterId: adapter.ID, adapterName: adapter.名称, counts: converted.counts },
  };
}

export function loadResourceExtensionFromJsonText(
  text: string,
  currentSystemPackageId: string,
  context: ResourceExtensionIdContext = {},
): ResourceExtensionFileLoadResult {
  const loaded = loadResourceExtensionJson(text, currentSystemPackageId, context);
  if (!loaded.ok) return loaded;
  const contentIssues = validateJsonExtensionContent(loaded.extension);
  if (contentIssues.length > 0) return { ok: false, issues: contentIssues };
  return {
    ok: true,
    extension: loaded.extension,
    assets: [],
    issues: [],
    generatedIds: loaded.generatedIds,
    normalizedArtifact: {
      fileName: `${loaded.extension.ID}.normalized.json`,
      mimeType: "application/json",
      bytes: strToU8(loaded.normalizedJson),
    },
  };
}

export async function loadResourceExtensionFromZipFile(
  file: Blob,
  currentSystemPackageId: string,
  context: ResourceExtensionIdContext = {},
): Promise<ResourceExtensionFileLoadResult> {
  const vfsResult = await createVirtualFileSystemFromZipFile(file);
  if (!vfsResult.ok) return { ok: false, issues: vfsResult.issues.map(toExtensionIssue) };
  const vfs = vfsResult.vfs;
  const document = vfs.readText("extension.json");
  if (!document.ok) {
    return { ok: false, issues: [{ level: "error", code: "RESOURCE_EXTENSION_MANIFEST_MISSING", text: "ZIP 根目录缺少 extension.json。", path: "extension.json" }] };
  }
  const loaded = loadResourceExtensionJson(document.value, currentSystemPackageId, context);
  if (!loaded.ok) return loaded;

  const issues: ResourceExtensionIssue[] = [];
  const assets: RuntimePackageAsset[] = [];
  for (const path of vfs.listFiles()) {
    if (path === "extension.json") continue;
    if (!path.startsWith("assets/") || !isSupportedImagePath(path)) {
      issues.push({ level: "error", code: "RESOURCE_EXTENSION_FILE_UNSUPPORTED", text: `Resource Extension 不支持文件：${path}`, path });
      continue;
    }
    const read = vfs.readBytes(path);
    if (!read.ok) {
      issues.push(toExtensionIssue(read.issue));
      continue;
    }
    if (path.toLocaleLowerCase().endsWith(".svg") && !isSafeSvg(read.value)) {
      issues.push({ level: "error", code: "RESOURCE_EXTENSION_SVG_UNSAFE", text: `SVG 包含不安全内容：${path}`, path });
      continue;
    }
    assets.push({
      路径: read.path,
      类型: inferMimeType(read.path),
      bytes: read.value,
      sourceType: "resourceExtension",
      sourceId: loaded.extension.ID,
    });
  }

  const referencedPaths = collectExtensionImageReferences(loaded.extension);
  const assetPaths = new Set(assets.map((asset) => asset.路径));
  for (const path of referencedPaths) {
    if (!assetPaths.has(path)) issues.push({ level: "error", code: "RESOURCE_EXTENSION_IMAGE_MISSING", text: `Resource Extension 引用了不存在的图片：${path}`, path });
  }
  for (const path of assetPaths) {
    if (!referencedPaths.has(path)) issues.push({ level: "warning", code: "RESOURCE_EXTENSION_IMAGE_UNUSED", text: `Resource Extension 图片未被引用：${path}`, path });
  }
  if (issues.some((issue) => issue.level === "error")) return { ok: false, issues };

  return {
    ok: true,
    extension: { ...loaded.extension, sourceType: "zip" },
    assets,
    issues,
    generatedIds: loaded.generatedIds,
    normalizedArtifact: buildNormalizedZip(vfs, loaded.extension.ID, loaded.normalizedJson),
  };
}

function validateJsonExtensionContent(extension: ResourceExtension): ResourceExtensionIssue[] {
  const issues: ResourceExtensionIssue[] = [];
  for (const contribution of extension.resourceLibraries) {
    contribution.entries.forEach((entry, entryIndex) => {
      for (const value of collectStrings(entry)) {
        if (value.startsWith("data:image/")) {
          issues.push({ level: "error", code: "RESOURCE_EXTENSION_INLINE_IMAGE_UNSUPPORTED", text: "JSON Resource Extension 不接受 base64 图片；请改用 ZIP assets。", path: `resourceLibraries.${contribution.ID}.entries.${entryIndex}` });
        } else if (isSupportedImagePath(value) && value.startsWith("assets/")) {
          issues.push({ level: "error", code: "RESOURCE_EXTENSION_IMAGE_REQUIRES_ZIP", text: `JSON Resource Extension 无法携带图片：${value}`, path: value });
        }
      }
    });
  }
  return issues;
}

function collectExtensionImageReferences(extension: ResourceExtension): Set<string> {
  const paths = new Set<string>();
  for (const contribution of extension.resourceLibraries) {
    for (const entry of contribution.entries) {
      for (const value of collectStrings(entry)) {
        if (value.startsWith("assets/") && isSupportedImagePath(value)) paths.add(value);
        if (value.startsWith("data:image/")) paths.add(value);
      }
    }
  }
  return paths;
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(collectStrings);
  return [];
}

function isSupportedImagePath(path: string): boolean {
  return /\.(?:png|jpe?g|webp|gif|avif|svg)$/iu.test(path);
}

function isSafeSvg(bytes: Uint8Array): boolean {
  const svg = new TextDecoder().decode(bytes);
  if (!/<svg\b/iu.test(svg)) return false;
  return !/<(?:script|foreignObject)\b|\bon[a-z]+\s*=|<!ENTITY|<\?xml-stylesheet|\b(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|data:|javascript:)|url\(\s*["']?\s*(?:https?:|\/\/|data:|javascript:)/iu.test(svg);
}

function buildNormalizedZip(vfs: PackageVirtualFileSystem, extensionId: string, normalizedJson: string): NormalizedResourceExtensionArtifact {
  const files: Record<string, Uint8Array> = { "extension.json": strToU8(normalizedJson) };
  for (const path of vfs.listFiles().filter((path) => path.startsWith("assets/") && isSupportedImagePath(path))) {
    const read = vfs.readBytes(path);
    if (read.ok) files[path] = read.value;
  }
  return { fileName: `${extensionId}.normalized.zip`, mimeType: "application/zip", bytes: zipSync(files, { level: 6 }) };
}

function buildConvertedZip(extensionId: string, normalizedJson: string, assets: RuntimePackageAsset[]): NormalizedResourceExtensionArtifact {
  const files: Record<string, Uint8Array> = { "extension.json": strToU8(normalizedJson) };
  for (const asset of assets) if (asset.bytes) files[asset.路径] = asset.bytes;
  return { fileName: `${extensionId}.normalized.zip`, mimeType: "application/zip", bytes: zipSync(files, { level: 6 }) };
}

function readExternalJsonSource(text: string, fileName: string): { ok: true; source: ExternalResourceSource } | { ok: false; issues: ResourceExtensionIssue[] } {
  try {
    return { ok: true, source: { document: JSON.parse(text), fileName, assets: new Map(), sourceType: "json" } };
  } catch {
    return { ok: false, issues: [{ level: "error", code: "RESOURCE_FORMAT_JSON_INVALID", text: "外部资源 JSON 无法解析。" }] };
  }
}

async function readExternalZipSource(file: Blob, fileName: string, systemPackage: SystemPackage): Promise<{ ok: true; source: ExternalResourceSource } | { ok: false; issues: ResourceExtensionIssue[] }> {
  const vfsResult = await createVirtualFileSystemFromZipFile(file);
  if (!vfsResult.ok) return { ok: false, issues: vfsResult.issues.map(toExtensionIssue) };
  const vfs = vfsResult.vfs;
  const zipAdapters = (systemPackage.resourceFormatAdapters ?? []).flatMap((adapter) => adapter.载体.filter((carrier) => carrier.类型 === "zip"));
  const requestedMembers = new Map(zipAdapters.flatMap((carrier) => carrier.JSON成员.map((member) => [member.路径, member.键] as const)));
  const document: Record<string, unknown> = {};
  for (const [path, key] of requestedMembers) {
    const read = vfs.readText(path);
    if (!read.ok) continue;
    try { document[key] = JSON.parse(read.value); } catch {
      return { ok: false, issues: [{ level: "error", code: "RESOURCE_FORMAT_ZIP_JSON_INVALID", text: `ZIP 中的 JSON 成员无法解析：${path}`, path }] };
    }
  }
  const assets = new Map<string, Uint8Array>();
  const diagnostics: Array<{ level: "warning"; code: string; text: string; path: string }> = [];
  for (const path of vfs.listFiles().filter(isSupportedImagePath)) {
    const read = vfs.readBytes(path);
    if (!read.ok) return { ok: false, issues: [toExtensionIssue(read.issue)] };
    if (!isValidImageBytes(path, read.value)) {
      diagnostics.push({ level: "warning", code: "RESOURCE_ADAPTER_IMAGE_INVALID", text: `外部图片内容损坏或与扩展名不符，已跳过：${path}`, path });
      continue;
    }
    assets.set(path, read.value);
  }
  return { ok: true, source: { document, fileName, assets, sourceType: "zip", diagnostics } };
}

function isValidImageBytes(path: string, bytes: Uint8Array): boolean {
  return detectImageMime(bytes, path) !== undefined;
}

function detectImageMime(bytes: Uint8Array, path = ""): string | undefined {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const header6 = new TextDecoder().decode(bytes.slice(0, 6));
  if (header6 === "GIF87a" || header6 === "GIF89a") return "image/gif";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp" && /^(?:avif|avis)$/u.test(new TextDecoder().decode(bytes.slice(8, 12)))) return "image/avif";
  if (path.toLocaleLowerCase().endsWith(".svg") && isSafeSvg(bytes)) return "image/svg+xml";
  return undefined;
}

function toExtensionIssue(issue: { code: string; text: string; path?: string }): ResourceExtensionIssue {
  return { level: "error", code: issue.code, text: issue.text.replaceAll("System Package", "Resource Extension"), path: issue.path };
}
