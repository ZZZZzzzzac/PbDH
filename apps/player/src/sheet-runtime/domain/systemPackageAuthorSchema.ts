import { z } from "zod";
import { characterCreationGuideSchema } from "./characterCreationGuide";
import {
  characterFormatAdapterSourceSchema,
  resourceFormatAdapterSourceSchema,
} from "./formatAdapter";
import { resourceLibraryReferenceSchema } from "./resourceLibrary";
import { characterTextExportSchema } from "./characterTextExport";
import { dependencyRuleSchema, sheetModuleSchema } from "./systemPackage";

export const packageRelativePathSchema = z.string().min(1).refine(
  (path) => !path.startsWith("/")
    && !path.includes("\\")
    && !/^[a-z][a-z0-9+.-]*:/iu.test(path)
    && path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."),
  { message: "必须是安全的包内相对路径。" },
);

export const htmlLayoutSourceSchema = z.object({
  类型: z.literal("htmlTemplate"),
  html: packageRelativePathSchema,
  css: packageRelativePathSchema.optional(),
});

export const packagePageSourceSchema = z.object({
  ID: z.string().min(1),
  名称: z.string().min(1),
  默认隐藏: z.boolean().optional().meta({ default: false }),
  打印: z.boolean().optional().describe("省略时跟随该 Page 的运行时可见性。"),
  layout: htmlLayoutSourceSchema,
});

export const packagePagesSourceSchema = z.array(packagePageSourceSchema).min(1);
export const packageModulesSourceSchema = z.array(sheetModuleSchema).min(1);
export const packageDependenciesSourceSchema = z.array(dependencyRuleSchema);
export const packageGuideSourceSchema = characterCreationGuideSchema;
export const resourceFormatAdaptersSourceSchema = z.array(resourceFormatAdapterSourceSchema).min(1);
export const characterFormatAdaptersSourceSchema = z.array(characterFormatAdapterSourceSchema).min(1);
export const characterTextExportsSourceSchema = z.array(characterTextExportSchema).min(1);

export const packageShellSourceSchema = z.object({
  html: packageRelativePathSchema,
  css: packageRelativePathSchema.optional(),
});

export const packageSkinSourceSchema = z.object({
  ID: z.string().min(1),
  名称: z.string().min(1),
  css: packageRelativePathSchema,
  推荐框架配色: z.enum(["light", "dark"]),
  layoutOverrides: z.object({
    shell: z.object({ html: packageRelativePathSchema }).optional(),
    pages: z.array(z.object({
      ID: z.string().min(1),
      html: packageRelativePathSchema,
    })).min(1).optional(),
  }).optional(),
});

export const packageValidationCheckSourceSchema = z.object({
  ID: z.string().min(1),
  脚本: packageRelativePathSchema,
});

export const packageQuestionnaireSourceSchema = z.object({
  ID: z.string().min(1),
  名称: z.string().min(1),
  html: packageRelativePathSchema,
});

export const systemPackageManifestSourceSchema = z.object({
  ID: z.string().min(1),
  名称: z.string().min(1),
  版本: z.string().min(1),
  schemaVersion: z.string().min(1),
  加载展示: z.object({
    标语: z.string().trim().min(1).max(80),
    强调色: z.string().regex(/^#[0-9a-f]{6}$/iu),
  }).optional(),
  pages: packageRelativePathSchema,
  modules: packageRelativePathSchema,
  shell: packageShellSourceSchema.optional(),
  skins: z.array(packageSkinSourceSchema).min(1).optional(),
  defaultSkin: z.string().min(1).optional(),
  dependencies: packageRelativePathSchema.optional(),
  characterCreationGuide: packageRelativePathSchema.optional(),
  questionnaireCharacterCreation: packageQuestionnaireSourceSchema.optional(),
  resourceFormatAdapters: packageRelativePathSchema.optional(),
  characterFormatAdapters: packageRelativePathSchema.optional(),
  characterTextExports: packageRelativePathSchema.optional(),
  assets: z.never().optional(),
  resourceLibraries: z.array(resourceLibraryReferenceSchema).optional(),
  validationChecks: z.array(packageValidationCheckSourceSchema).optional(),
});

export const resourceEntrySourceSchema = z.object({
  ID: z.string().min(1),
  旧ID: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
}).catchall(z.unknown());

export const resourceLibraryFileSourceSchema = z.array(resourceEntrySourceSchema);

export const authorContractSchemas = {
  manifest: systemPackageManifestSourceSchema,
  pages: packagePagesSourceSchema,
  modules: packageModulesSourceSchema,
  dependencies: packageDependenciesSourceSchema,
  guide: packageGuideSourceSchema,
  questionnaire: packageQuestionnaireSourceSchema,
  resourceLibraryFile: resourceLibraryFileSourceSchema,
  resourceFormatAdapters: resourceFormatAdaptersSourceSchema,
  characterFormatAdapters: characterFormatAdaptersSourceSchema,
  characterTextExports: characterTextExportsSourceSchema,
} as const;

export type SystemPackageManifestSource = z.infer<typeof systemPackageManifestSourceSchema>;
export type PackagePageSource = z.infer<typeof packagePageSourceSchema>;
