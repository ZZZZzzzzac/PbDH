import { z } from "zod";
import { characterDataSchema } from "./characterData";
import { formatCarrierSchema, formatDiagnosticSchema } from "./formatAdapter";
import { resourceExtensionDocumentSchema } from "./resourceExtension";
import { resourceLibrarySchema } from "./resourceLibrary";

export const nonNegativeIntegerSchema = z.number().int().min(0);

export const validationScriptIssueSchema = z.object({
  level: z.enum(["error", "warning", "info"]),
  text: z.string().trim().min(1),
  path: z.string().optional(),
  code: z.string().optional(),
});

export const validationScriptOutputSchema = z.union([
  z.array(validationScriptIssueSchema),
  z.object({ issues: z.array(validationScriptIssueSchema) }),
]);

export const validationScriptInputSchema = z.object({
  characterData: characterDataSchema,
  resourceLibraries: z.array(resourceLibrarySchema),
  cardState: characterDataSchema.shape.cards,
  packageMetadata: z.object({ id: z.string().min(1), version: z.string().min(1) }),
});

export const resourceAdapterCountsSchema = z.object({
  sourceEntries: nonNegativeIntegerSchema,
  convertedEntries: nonNegativeIntegerSchema,
  skippedEntries: nonNegativeIntegerSchema,
  convertedFields: nonNegativeIntegerSchema,
  skippedFields: nonNegativeIntegerSchema,
  boundImages: nonNegativeIntegerSchema,
  orphanImages: nonNegativeIntegerSchema,
});

const workerAssetSchema = z.object({
  path: z.string().min(1),
  bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array, { message: "bytes 必须是 Uint8Array。" }).describe("Uint8Array"),
});

export const resourceAdapterImportInputSchema = z.object({
  document: z.unknown(),
  fileName: z.string(),
  assets: z.array(workerAssetSchema),
  resourceLibraries: z.array(resourceLibrarySchema),
});

export const resourceAdapterRetainedAssetSchema = z.object({
  sourcePath: z.string().min(1),
  targetPath: z.string().min(1),
});

export const resourceAdapterImportOutputSchema = z.object({
  name: z.string().trim().min(1),
  version: z.string().optional(),
  resourceLibraries: resourceExtensionDocumentSchema.shape.resourceLibraries,
  retainedAssets: z.array(resourceAdapterRetainedAssetSchema).optional(),
  diagnostics: z.array(formatDiagnosticSchema).optional(),
  counts: resourceAdapterCountsSchema,
});

export const characterAdapterImportInputSchema = z.object({
  document: z.unknown(),
  fileName: z.string(),
  resourceLibraries: z.array(resourceLibrarySchema),
});

export const characterAdapterImportCardSchema = z.object({
  tableModuleId: z.string().min(1),
  state: z.string(),
  libraryId: z.string().min(1),
  entryId: z.string().min(1),
});

export const characterAdapterImportImageSchema = z.object({
  moduleId: z.string().min(1),
  name: z.string().optional(),
  dataUrl: z.string().min(1),
});

export const characterAdapterImportOutputSchema = z.object({
  values: z.record(z.string().min(1), z.unknown()),
  cards: z.array(characterAdapterImportCardSchema).optional(),
  images: z.array(characterAdapterImportImageSchema).optional(),
  suggestedSaveName: z.string().optional(),
  skippedFields: nonNegativeIntegerSchema.optional(),
  skippedCards: nonNegativeIntegerSchema.optional(),
  skippedImages: nonNegativeIntegerSchema.optional(),
  diagnostics: z.array(formatDiagnosticSchema).optional(),
});

export const characterAdapterExportInputSchema = z.object({
  adapterId: z.string().min(1),
  characterData: characterDataSchema,
  resourceLibraries: z.array(resourceLibrarySchema),
});

export const characterAdapterExportOutputSchema = z.object({
  document: z.record(z.string(), z.unknown()),
  diagnostics: z.array(formatDiagnosticSchema).optional(),
  exportedFields: nonNegativeIntegerSchema.optional(),
  skippedFields: nonNegativeIntegerSchema.optional(),
  exportedCards: nonNegativeIntegerSchema.optional(),
  skippedCards: nonNegativeIntegerSchema.optional(),
  exportedImages: nonNegativeIntegerSchema.optional(),
  skippedImages: nonNegativeIntegerSchema.optional(),
});

export const parsedFormatSourceSchema = z.object({
  document: z.unknown(),
  fileName: z.string(),
  carrier: formatCarrierSchema,
});

export const scriptContractSchemas = {
  validationInput: validationScriptInputSchema,
  validationOutput: validationScriptOutputSchema,
  resourceAdapterImportInput: resourceAdapterImportInputSchema,
  resourceAdapterImportOutput: resourceAdapterImportOutputSchema,
  characterAdapterImportInput: characterAdapterImportInputSchema,
  characterAdapterImportOutput: characterAdapterImportOutputSchema,
  characterAdapterExportInput: characterAdapterExportInputSchema,
  characterAdapterExportOutput: characterAdapterExportOutputSchema,
} as const;

export type ValidationScriptInput = z.input<typeof validationScriptInputSchema>;
export type ResourceAdapterImportOutput = z.infer<typeof resourceAdapterImportOutputSchema>;
export type CharacterAdapterImportOutput = z.infer<typeof characterAdapterImportOutputSchema>;
export type CharacterAdapterExportOutput = z.infer<typeof characterAdapterExportOutputSchema>;
