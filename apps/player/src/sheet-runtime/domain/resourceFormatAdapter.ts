import type { RuntimePackageAsset } from "../loaders/assetResolver";
import { carrierMatches, normalizeExternalName, stableAdapterId, type FormatDiagnostic, type ResourceFormatAdapter } from "./formatAdapter";
import { executePackageScriptInWorker } from "./packageScriptRunner";
import { resourceAdapterImportOutputSchema, type ResourceAdapterImportOutput } from "./packageScriptContract";
import type { SystemPackage } from "./systemPackage";

export interface ExternalResourceSource { document: unknown; fileName: string; assets: ReadonlyMap<string, Uint8Array>; sourceType: "json" | "zip"; diagnostics?: FormatDiagnostic[] }
export interface ResourceAdapterConversion {
  adapter: ResourceFormatAdapter;
  extensionDocument: Record<string, unknown>;
  assets: RuntimePackageAsset[];
  diagnostics: FormatDiagnostic[];
  counts: { sourceEntries: number; convertedEntries: number; skippedEntries: number; convertedFields: number; skippedFields: number; boundImages: number; orphanImages: number };
}
export type ResourceAdapterDetection = { status: "none" } | { status: "ambiguous"; adapters: ResourceFormatAdapter[] } | { status: "match"; adapter: ResourceFormatAdapter };

export function detectResourceFormatAdapter(source: ExternalResourceSource, adapters: ResourceFormatAdapter[]): ResourceAdapterDetection {
  const matches = adapters.filter((adapter) => adapter.载体.some((carrier) => carrierMatches(carrier, source.document, source.fileName)));
  return matches.length === 0 ? { status: "none" } : matches.length > 1 ? { status: "ambiguous", adapters: matches } : { status: "match", adapter: matches[0] };
}

export async function convertExternalResourceSource(source: ExternalResourceSource, adapter: ResourceFormatAdapter, systemPackage: SystemPackage): Promise<ResourceAdapterConversion | { error: FormatDiagnostic }> {
  let raw: unknown;
  try {
    raw = await executePackageScriptInWorker(adapter.importScriptContent, {
      document: source.document,
      fileName: source.fileName,
      assets: [...source.assets].map(([path, bytes]) => ({ path, bytes })),
      resourceLibraries: systemPackage.resourceLibraries ?? [],
    }, `${adapter.名称} Resource Import Script`);
  } catch (error) {
    return { error: { level: "error", code: "RESOURCE_ADAPTER_IMPORT_SCRIPT_ERROR", text: `${adapter.名称} 执行失败：${error instanceof Error ? error.message : String(error)}` } };
  }
  const parsed = resourceAdapterImportOutputSchema.safeParse(raw);
  if (!parsed.success) return { error: invalidOutput(adapter, parsed.error.issues[0]?.message ?? "返回结构无效。") };
  const result: ResourceAdapterImportOutput = parsed.data;
  const diagnostics = result.diagnostics ?? [];
  const packageName = normalizeExternalName(result.name);
  const extensionId = `resource-adapter:${adapter.ID}:${stableAdapterId(systemPackage.manifest.ID, adapter.ID, packageName)}`;
  const assets: RuntimePackageAsset[] = [];
  const targetPaths = new Set<string>();
  for (const [index, retained] of (result.retainedAssets ?? []).entries()) {
    if (!isRecord(retained) || typeof retained.sourcePath !== "string" || typeof retained.targetPath !== "string" || !isSafePath(retained.sourcePath) || !isSafePath(retained.targetPath)) return { error: invalidOutput(adapter, `retainedAssets.${index} 路径无效。`) };
    const bytes = source.assets.get(retained.sourcePath);
    if (!bytes) return { error: invalidOutput(adapter, `retainedAssets.${index} 引用了不存在的源资产 ${retained.sourcePath}。`) };
    if (targetPaths.has(retained.targetPath)) return { error: invalidOutput(adapter, `retainedAssets.${index} 目标路径重复。`) };
    targetPaths.add(retained.targetPath);
    assets.push({ 路径: retained.targetPath, 类型: mimeFromBytes(bytes, retained.targetPath), bytes, sourceType: "resourceExtension", sourceId: extensionId });
  }
  return {
    adapter,
    extensionDocument: { ID: extensionId, 名称: packageName, 版本: normalizeExternalName(result.version ?? "未声明") || "未声明", 目标系统包ID: systemPackage.manifest.ID, resourceLibraries: result.resourceLibraries },
    assets,
    diagnostics: [...(source.diagnostics ?? []), ...diagnostics],
    counts: result.counts,
  };
}

function invalidOutput(adapter: ResourceFormatAdapter, detail: string): FormatDiagnostic { return { level: "error", code: "RESOURCE_ADAPTER_SCRIPT_OUTPUT_INVALID", text: `${adapter.名称} 输出无效：${detail}` }; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isSafePath(value: string): boolean { return value.length > 0 && !value.startsWith("/") && !value.includes("\\") && value.split("/").every((part) => part !== "" && part !== "." && part !== ".."); }
function mimeFromPath(path: string): string { const extension = path.split(".").at(-1)?.toLocaleLowerCase(); return extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "svg" ? "image/svg+xml" : `image/${extension ?? "png"}`; }
function mimeFromBytes(bytes: Uint8Array, fallbackPath: string): string { if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "image/webp"; if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return "image/png"; if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"; return mimeFromPath(fallbackPath); }
