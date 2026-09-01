import type {
  ConversionDiagnostic,
  ConversionReport,
  ExportResult,
  ImportResult,
  JsonObject,
  JsonValue,
  ResourceArtifact,
  ResourceFormatId,
  TemporaryResource,
} from "./types.ts";

export const encoder = new TextEncoder();
export const decoder = new TextDecoder("utf-8", { fatal: true });

export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isObject(value) && Object.values(value).every(isJsonValue);
}

export function asJsonObject(value: unknown): JsonObject | undefined {
  return isObject(value) && isJsonValue(value) ? value as JsonObject : undefined;
}

export function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

export function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

export function splitJoined(value: unknown): string[] {
  return textList(value).length > 0
    ? textList(value)
    : text(value).split(/[+＋]/u).map((item) => item.trim()).filter(Boolean);
}

export function semanticCount(value: unknown): string {
  return text(value).replace(/[级⚡]/gu, "").trim();
}

export function recommendedAttributes(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.flatMap((item) => isObject(item)
    ? Object.entries(item).map(([key, entry]) => ({ [key]: text(entry) }))
    : []);
  if (isObject(value)) {
    return Object.entries(value).map(([key, item]) => ({ [key]: text(item) }));
  }
  const result: JsonObject[] = [];
  const source = text(value);
  for (const match of source.matchAll(/(敏捷|力量|灵巧|本能|风度|知识)[^+\-−\d]*([+\-−]?\d+)/gu)) {
    result.push({ [match[1]!]: match[2]!.replace("−", "-") });
  }
  return result;
}

export function numberedTextList(raw: JsonObject, arrayKey: string, prefix: string): string[] {
  const array = textList(raw[arrayKey]);
  if (array.length > 0) return array;
  return Object.keys(raw)
    .filter((key) => key.startsWith(prefix) && /^\d+$/u.test(key.slice(prefix.length)))
    .sort((left, right) => Number(left.slice(prefix.length)) - Number(right.slice(prefix.length)))
    .map((key) => text(raw[key]))
    .filter(Boolean);
}

export function namedFeature(value: unknown): JsonObject {
  const source = text(value).trim();
  if (!source) return { 名称: "", 描述: "" };
  const match = /^(?::[^\[]+\[)?\*\*(.+?)\*\*\]?[：:]\s*([\s\S]*)$/u.exec(source)
    ?? /^([^\n：:]{1,80})[：:]\s*([\s\S]+)$/u.exec(source);
  return match ? { 名称: match[1]!.trim(), 描述: match[2]!.trim() } : { 名称: "", 描述: source };
}

export function formatNamedFeature(value: unknown): string {
  const feature = asJsonObject(value) ?? {};
  const name = text(feature.名称).trim();
  const description = text(feature.描述).trim();
  return name ? `${name}：${description}` : description;
}

export function parseJson(bytes: Uint8Array): unknown {
  return JSON.parse(decoder.decode(bytes)) as unknown;
}

export function jsonArtifact(value: JsonValue, fileName: string): ResourceArtifact {
  return {
    bytes: encoder.encode(`${JSON.stringify(value, null, 2)}\n`),
    fileName,
    container: "json",
    mediaType: "application/json",
  };
}

export function report(
  formatId: ResourceFormatId,
  direction: ConversionReport["direction"],
  converted: number,
  diagnostics: ConversionDiagnostic[] = [],
): ConversionReport {
  return {
    formatId,
    direction,
    converted,
    failed: diagnostics.filter((item) => item.severity === "error").length,
    diagnostics,
  };
}

export function importFailure(formatId: ResourceFormatId, code: string, message: string, path?: string): ImportResult {
  return { ok: false, report: report(formatId, "import", 0, [{ code, severity: "error", message, path }]) };
}

export function exportFailure(
  formatId: ResourceFormatId,
  diagnostics: ConversionDiagnostic[],
  converted = 0,
): ExportResult {
  return { ok: false, report: report(formatId, "export", converted, diagnostics) };
}

export function sourceRaw(resource: TemporaryResource, formatId: ResourceFormatId): JsonObject | undefined {
  return resource.source.formatId === formatId ? asJsonObject(resource.source.raw) : undefined;
}

export function safeStem(value: string): string {
  const stem = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "-").replace(/[ .]+$/u, "");
  return stem || "resources";
}
