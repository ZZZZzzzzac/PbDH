import { z } from "zod";

export const safePathSegmentSchema = z.union([z.string().min(1), z.number().int().min(0)]);
export const safePathSchema = z.array(safePathSegmentSchema);
export type SafePath = z.infer<typeof safePathSchema>;

export const safeRelativeFilePathSchema = z.string().min(1).refine(
  (path) => !path.startsWith("/") && !path.includes("\\") && path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."),
  { message: "必须是安全的包内相对路径。" },
);

export const formatDetectionRuleSchema = z.object({
  路径: safePathSchema,
  存在: z.boolean().optional(),
  等于: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
}).refine((rule) => rule.存在 !== undefined || rule.等于 !== undefined, { message: "检测规则必须声明 存在 或 等于。" });

export const jsonCarrierSchema = z.object({
  类型: z.literal("json"),
  根类型: z.enum(["object", "array"]).optional(),
  文件后缀: z.string().min(1).optional(),
  检测: z.array(formatDetectionRuleSchema).min(1),
});

export const embeddedJsonCarrierSchema = z.object({
  类型: z.literal("embeddedJson"),
  文件后缀: z.string().min(1).optional(),
  开始标记: z.string().min(1),
  结束标记: z.string().min(1),
  结束标记包含字符数: z.number().int().min(0).optional(),
  检测: z.array(formatDetectionRuleSchema).min(1),
});

export const zipCarrierSchema = z.object({
  类型: z.literal("zip"),
  文件后缀: z.string().min(1).optional(),
  JSON成员: z.array(z.object({ 路径: safeRelativeFilePathSchema, 键: z.string().min(1) })).min(1),
  检测: z.array(formatDetectionRuleSchema).min(1),
});

export const formatCarrierSchema = z.discriminatedUnion("类型", [jsonCarrierSchema, embeddedJsonCarrierSchema, zipCarrierSchema]);
export type FormatCarrier = z.infer<typeof formatCarrierSchema>;

export const adapterBaseSourceSchema = z.object({
  ID: z.string().min(1),
  名称: z.string().min(1),
  载体: z.array(formatCarrierSchema).min(1),
  导入脚本: safeRelativeFilePathSchema,
});

export const resourceFormatAdapterSourceSchema = adapterBaseSourceSchema;

export const characterFormatAdapterSourceSchema = adapterBaseSourceSchema.extend({
  导出脚本: safeRelativeFilePathSchema.optional(),
  导出文件后缀: z.literal(".json").default(".json"),
});

const adapterRuntimeBaseSchema = adapterBaseSourceSchema.extend({
  importScriptContent: z.string().min(1),
});

export const resourceFormatAdapterSchema = adapterRuntimeBaseSchema;
export type ResourceFormatAdapter = z.infer<typeof resourceFormatAdapterSchema>;

export const characterFormatAdapterSchema = adapterRuntimeBaseSchema.extend({
  导出脚本: safeRelativeFilePathSchema.optional(),
  exportScriptContent: z.string().min(1).optional(),
  导出文件后缀: z.literal(".json").default(".json"),
}).superRefine((adapter, context) => {
  if ((adapter.导出脚本 === undefined) !== (adapter.exportScriptContent === undefined)) {
    context.addIssue({ code: "custom", message: "Character Format Adapter 的 导出脚本 与 exportScriptContent 必须同时存在。" });
  }
});
export type CharacterFormatAdapter = z.infer<typeof characterFormatAdapterSchema>;

export const formatDiagnosticSchema = z.object({
  level: z.enum(["error", "warning"]),
  code: z.string(),
  text: z.string(),
  path: z.string().optional(),
});
export type FormatDiagnostic = z.infer<typeof formatDiagnosticSchema>;

export interface ParsedFormatSource {
  document: unknown;
  fileName: string;
  carrier: FormatCarrier;
}

export function readSafePath(value: unknown, path: SafePath): unknown {
  let current = value;
  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current) || segment >= current.length) return undefined;
      current = current[segment];
      continue;
    }
    if (typeof current !== "object" || current === null || Array.isArray(current) || !Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function carrierMatches(carrier: FormatCarrier, document: unknown, fileName: string): boolean {
  if (carrier.文件后缀 && !fileName.toLocaleLowerCase().endsWith(carrier.文件后缀.toLocaleLowerCase())) return false;
  if (carrier.类型 === "json" && carrier.根类型 === "array" && !Array.isArray(document)) return false;
  if (carrier.类型 === "json" && carrier.根类型 === "object" && (typeof document !== "object" || document === null || Array.isArray(document))) return false;
  return carrier.检测.every((rule) => {
    const value = readSafePath(document, rule.路径);
    if (rule.存在 !== undefined && (value !== undefined) !== rule.存在) return false;
    if ("等于" in rule && value !== rule.等于) return false;
    return true;
  });
}

export function normalizeExternalName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function stableAdapterId(...parts: string[]): string {
  const source = parts.map(normalizeExternalName).join("\u001f");
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
