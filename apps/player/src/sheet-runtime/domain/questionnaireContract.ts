import { z } from "zod";

export const questionnaireDefinitionSchema = z.object({
  ID: z.string().min(1),
  名称: z.string().min(1),
  htmlContent: z.string().min(1),
});

export const questionnaireResourceSelectionSchema = z.object({
  type: z.literal("resourceSelected"),
  sourceModuleId: z.string().min(1),
  libraryId: z.string().min(1),
  entryIds: z.array(z.string().min(1)).min(1).max(100)
    .refine((ids) => new Set(ids).size === ids.length, { message: "Resource Entry IDs 不能重复。" }),
});

export const questionnaireResultSchema = z.object({
  protocolVersion: z.literal("1"),
  interactions: z.array(questionnaireResourceSelectionSchema).min(1).max(32),
});

export type QuestionnaireDefinition = z.infer<typeof questionnaireDefinitionSchema>;
export type QuestionnaireResourceSelection = z.infer<typeof questionnaireResourceSelectionSchema>;
export type QuestionnaireResult = z.infer<typeof questionnaireResultSchema>;
