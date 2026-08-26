import { z } from "zod";

export const characterTextExportValueSelectorSchema = z.enum(["文本", "当前值", "最大值"]);

export const characterTextExportFieldSchema = z.object({
  模块ID: z.string().min(1),
  取值: characterTextExportValueSelectorSchema,
  模板: z.string(),
});

export const characterTextExportSchema = z.object({
  ID: z.string().min(1),
  名称: z.string().min(1),
  模板: z.string(),
  字段分隔符: z.string(),
  字段: z.array(characterTextExportFieldSchema),
});

export type CharacterTextExport = z.infer<typeof characterTextExportSchema>;
export type CharacterTextExportField = z.infer<typeof characterTextExportFieldSchema>;
