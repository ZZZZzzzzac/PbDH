import type { PackageIssue, SystemPackage } from "../domain/systemPackage";
import { inferMimeType } from "../utils";
import { createVirtualFileSystem, normalizePackagePath, packageArchiveLimits } from "./packageVfs";
import {
  loadSystemPackageFromVfs,
  type PackageLoadOverrides,
  type PackageLoadResult,
} from "./systemPackageLoader";

// 单个预制包文件的抓取超时：连接挂死时不再无限等待，超时后按加载失败处理。
const presetFetchTimeoutMs = 15_000;

export interface PresetSystemPackage {
  id: string;
  /** 直达链接使用的短路径段，默认与 id 相同。 */
  urlPath: string;
  name: string;
  version: string;
  releaseVersion: string;
  directory: string;
  inventoryPath: string;
  fileCount: number;
  metadataFileCount: number;
  loadingPresentation?: NonNullable<SystemPackage["manifest"]["加载展示"]>;
}

// 按直达链接路径段查找预制包；只匹配 urlPath，不匹配旧的长 id。
export function findPresetByUrlPath(
  presets: readonly Pick<PresetSystemPackage, "id" | "urlPath">[],
  segment: string | null,
): PresetSystemPackage | undefined {
  if (!segment) return undefined;
  return presets.find((preset) => preset.urlPath === segment) as PresetSystemPackage | undefined;
}

export interface PresetLoadProgress {
  completed: number;
  total: number;
}

export async function loadPresetSystemPackage(
  preset: PresetSystemPackage,
  baseUrl = import.meta.env.BASE_URL,
  fetchFile: typeof fetch = fetch,
  onProgress?: (progress: PresetLoadProgress) => void,
  overrides: PackageLoadOverrides = {},
): Promise<PackageLoadResult> {
  if (preset.fileCount > packageArchiveLimits.maxFiles) {
    return failedPreset("PACKAGE_ARCHIVE_FILE_COUNT_LIMIT", `预制 System Package ${preset.name} 的文件数量超过限制。`);
  }

  const inventory = await loadPresetInventory(preset, baseUrl, fetchFile);
  if (!inventory.ok) return inventory.result;

  const files = new Map<string, Uint8Array>();
  const imagePaths: string[] = [];
  const metadataPaths: string[] = [];
  for (const file of inventory.files) {
    const pathResult = normalizePackagePath(file);
    if (!pathResult.ok) return { ok: false, issues: [pathResult.issue] };
    if (isPresetImagePath(pathResult.path)) {
      imagePaths.push(pathResult.path);
      files.set(pathResult.path, new Uint8Array());
    } else {
      metadataPaths.push(pathResult.path);
    }
  }
  onProgress?.({ completed: 0, total: metadataPaths.length });
  let totalBytes = 0;
  let completed = 0;
  let nextIndex = 0;
  let failure: PackageIssue | undefined;
  const workers = Array.from({ length: Math.min(4, metadataPaths.length) }, async () => {
    while (!failure) {
      const index = nextIndex++;
      if (index >= metadataPaths.length) return;
      const pathResult = { ok: true as const, path: metadataPaths[index] };
      try {
        const response = await fetchFile(presetFileUrl(baseUrl, preset.directory, pathResult.path, preset.releaseVersion), {
          signal: AbortSignal.timeout(presetFetchTimeoutMs),
        });
        if (!response.ok) {
          failure = presetFetchIssue(preset, pathResult.path, `HTTP ${response.status}`);
          return;
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        totalBytes += bytes.byteLength;
        if (totalBytes > packageArchiveLimits.maxExpandedBytes) {
          failure = {
            level: "fatal",
            code: "PACKAGE_ARCHIVE_EXPANDED_SIZE_LIMIT",
            text: `预制 System Package ${preset.name} 的总文件体积超过限制。`,
          };
          return;
        }
        files.set(pathResult.path, bytes);
        completed += 1;
        onProgress?.({ completed, total: metadataPaths.length });
      } catch (error) {
        failure = presetFetchIssue(preset, pathResult.path, error instanceof Error ? error.message : String(error));
        return;
      }
    }
  });
  await Promise.all(workers);
  if (failure) return { ok: false, issues: [failure] };
  const result = await loadSystemPackageFromVfs(createVirtualFileSystem(files), overrides);
  if (!result.ok) return result;
  return {
    ...result,
    packageAssets: imagePaths.map((path) => ({
      路径: path,
      类型: inferMimeType(path),
      staticUrl: presetFileUrl(baseUrl, preset.directory, path, preset.releaseVersion),
    })),
  };
}

async function loadPresetInventory(
  preset: PresetSystemPackage,
  baseUrl: string,
  fetchFile: typeof fetch,
): Promise<{ ok: true; files: string[] } | { ok: false; result: PackageLoadResult }> {
  try {
    const response = await fetchFile(presetFileUrl(baseUrl, preset.directory, preset.inventoryPath, preset.releaseVersion), {
      signal: AbortSignal.timeout(presetFetchTimeoutMs),
    });
    if (!response.ok) {
      return { ok: false, result: { ok: false, issues: [presetFetchIssue(preset, preset.inventoryPath, `HTTP ${response.status}`)] } };
    }
    const parsed: unknown = JSON.parse(await response.text());
    if (!isPresetInventory(parsed)) {
      return { ok: false, result: failedPreset("PRESET_PACKAGE_INVENTORY_INVALID", `预制 System Package ${preset.name} 的文件清单格式无效。`) };
    }
    if (parsed.files.length !== preset.fileCount) {
      return { ok: false, result: failedPreset("PRESET_PACKAGE_INVENTORY_MISMATCH", `预制 System Package ${preset.name} 的文件清单数量与目录不一致。`) };
    }
    return { ok: true, files: parsed.files };
  } catch (error) {
    return {
      ok: false,
      result: { ok: false, issues: [presetFetchIssue(preset, preset.inventoryPath, error instanceof Error ? error.message : String(error))] },
    };
  }
}

function isPresetInventory(value: unknown): value is { schemaVersion: 1; files: string[] } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { schemaVersion?: unknown; files?: unknown };
  return candidate.schemaVersion === 1
    && Array.isArray(candidate.files)
    && candidate.files.every((file) => typeof file === "string");
}

function isPresetImagePath(path: string): boolean {
  return path.startsWith("assets/") && /\.(?:png|jpe?g|webp|gif|avif|svg)$/iu.test(path);
}

function presetFileUrl(baseUrl: string, directory: string, path: string, releaseVersion: string): string {
  const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const encodedPath = [directory, ...path.split("/")].map(encodeURIComponent).join("/");
  return `${root}system-packages/${encodedPath}?v=${encodeURIComponent(releaseVersion)}`;
}

function presetFetchIssue(preset: PresetSystemPackage, path: string, reason: string): PackageIssue {
  return {
    level: "fatal",
    code: "PRESET_PACKAGE_FETCH_FAILED",
    text: `无法读取预制 System Package ${preset.name}：${path}（${reason}）`,
    path,
  };
}

function failedPreset(code: string, text: string): PackageLoadResult {
  return { ok: false, issues: [{ level: "fatal", code, text }] };
}
