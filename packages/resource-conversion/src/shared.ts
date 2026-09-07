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

export function recommendedAttributes(value: unknown): JsonObject {
  const result: JsonObject = Object.fromEntries(["敏捷", "力量", "灵巧", "本能", "风度", "知识"].map((name) => [name, ""]));
  if (Array.isArray(value)) {
    for (const item of value) if (isObject(item)) for (const [key, entry] of Object.entries(item)) if (key in result) result[key] = text(entry);
    return result;
  }
  if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) if (key in result) result[key] = text(item);
    return result;
  }
  const source = text(value);
  for (const match of source.matchAll(/(敏捷|力量|灵巧|本能|风度|知识)[^+\-−\d]*([+\-−]?\d+)/gu)) {
    result[match[1]!] = match[2]!.replace("−", "-");
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
  const heading = markdownFeatureHeadings(source)[0];
  if (heading?.index === 0) return {
    名称: heading[2]!.trim(), 描述: source.slice(heading[0].length).trim(),
  };
  const match = /^(?::[^\[]+\[)?\*\*(.+?)\*\*\]?[：:]\s*([\s\S]*)$/u.exec(source)
    ?? /^([^\n：:]{1,80})[：:]\s*([\s\S]+)$/u.exec(source);
  return match ? { 名称: match[1]!.trim(), 描述: match[2]!.trim() } : { 名称: "", 描述: source };
}

function markdownFeatureHeadings(source: string) {
  // 第三方常把冒号包在强调内，如 *__名称：__*；先消费完整标记再拆分正文。
  return [...source.matchAll(/^([*_]{1,6})([^\n：:]+?)[：:]([*_]{1,6})/gmu)]
    .flatMap((match) => {
      const closing = [...match[1]!].reverse().join("");
      if (!match[3]!.startsWith(closing)) return [];
      // 正文可能紧接另一段强调，只消费属于标题的闭合标记。
      match[0] = match[0].slice(0, match[0].length - match[3]!.length + closing.length);
      return [match];
    });
}

export function namedFeatureGroup(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const feature = value as JsonObject;
    return { 特性名称: text(feature.特性名称 ?? feature.名称), 特性原文: text(feature.特性原文 ?? feature.原文 ?? feature.原名), 特性描述: text(feature.特性描述 ?? feature.描述) };
  }
  const feature = namedFeature(value);
  return { 特性名称: text(feature.名称), 特性原文: "", 特性描述: text(feature.描述) };
}

export function formatNamedFeatureGroup(value: unknown): string {
  return formatNamedFeatures([namedFeatureGroup(value)]);
}

export function formatNamedFeature(value: unknown): string {
  const feature = asJsonObject(value) ?? {};
  const name = text(feature.特性名称).trim();
  const description = text(feature.特性描述).trim();
  return name ? `${name}：${description}` : description;
}

export function namedFeatures(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.map((item) => {
    const feature = asJsonObject(item) ?? {};
    return { 特性名称: text(feature.特性名称 ?? feature.名称), 特性原文: text(feature.特性原文 ?? feature.原文 ?? feature.原名), 特性描述: text(feature.特性描述 ?? feature.描述) };
  });
  const source = text(value).trim();
  if (!source) return [];
  const headings = markdownFeatureHeadings(source);
  if (headings[0]?.index === 0) return headings.map((heading, index) => ({
    特性名称: heading[2]!.trim(),
    特性原文: "",
    特性描述: source.slice(heading.index! + heading[0].length, headings[index + 1]?.index ?? source.length).trim(),
  }));
  const markers = [...source.matchAll(/:red\[\*\*(.*?)\*\*\]：/gu)];
  if (markers.length > 0) return markers.map((marker, index) => ({
    特性名称: marker[1]!.trim(),
    特性描述: source.slice(marker.index! + marker[0].length, markers[index + 1]?.index ?? source.length).trim(),
  }));
  const feature = namedFeature(source);
  return [{ 特性名称: text(feature.名称), 特性原文: "", 特性描述: text(feature.描述) }];
}

export function formatNamedFeatures(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map((item) => {
    const feature = asJsonObject(item) ?? {};
    const name = text(feature.特性名称 ?? feature.名称).trim();
    const description = text(feature.特性描述 ?? feature.描述).trim();
    return name ? `${name}：${description}` : description;
  }).filter(Boolean).join("\n\n");
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
