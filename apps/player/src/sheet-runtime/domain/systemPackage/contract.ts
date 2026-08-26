import { z } from "zod";
import {
  resourceLibraryFieldTemplateSchema,
  resourceLibraryPackageInputSchema,
  resourceLibrarySchema,
  type ResourceLibrary,
} from "../resourceLibrary";
import {
  characterCreationGuideSchema,
  type CharacterCreationGuide,
} from "../characterCreationGuide";
import { questionnaireDefinitionSchema, type QuestionnaireDefinition } from "../questionnaireContract";
import {
  characterFormatAdapterSchema,
  resourceFormatAdapterSchema,
  type CharacterFormatAdapter,
  type ResourceFormatAdapter,
} from "../formatAdapter";
import { characterTextExportSchema, type CharacterTextExport } from "../characterTextExport";

export const frameworkSchemaVersion = "0.2.0";

export const loadingPresentationSchema = z.object({
  标语: z.string().trim().min(1).max(80),
  强调色: z.string().regex(/^#[0-9a-f]{6}$/i, "加载强调色必须是六位十六进制颜色，例如 #63bfd1。"),
});

export const systemPackageRuntimeManifestSchema = z.object({
  ID: z.string().min(1),
  名称: z.string().min(1),
  版本: z.string().min(1),
  schemaVersion: z.string().min(1),
  加载展示: loadingPresentationSchema.optional(),
});

const sheetModuleBaseSchema = z.object({
  ID: z.string().min(1),
  默认隐藏: z.boolean().optional().meta({ default: false }),
});

export const freeTextModuleSchema = sheetModuleBaseSchema.extend({
  类型: z.literal("freeText"),
  标签: z.string(),
  默认值: z.string().optional().meta({ default: "" }),
  隐藏标签: z.boolean().optional().meta({ default: false }),
  占位文本: z.string().optional(),
  选项: z.array(z.string().refine((value) => value.trim().length > 0, {
    message: "Free Text 下拉选项不能为空白字符串。",
  })).min(1).refine((options) => new Set(options).size === options.length, {
    message: "Free Text 下拉选项不能重复。",
  }).optional(),
}).superRefine((module, context) => {
  if (module.选项 !== undefined && module.默认值 !== undefined && !module.选项.includes(module.默认值)) {
    context.addIssue({
      code: "custom",
      path: ["默认值"],
      message: "Free Text 下拉模式的默认值必须属于选项。",
    });
  }
});

export const longTextModuleSchema = sheetModuleBaseSchema.extend({
  类型: z.literal("longText"),
  标签: z.string(),
  默认值: z.string().optional().meta({ default: "" }),
  行数: z.number().int().min(2).max(20).optional().meta({ default: 4 }),
  隐藏标签: z.boolean().optional().meta({ default: false }),
  占位文本: z.string().optional(),
});

export const checkboxResourceModuleSchema = sheetModuleBaseSchema.extend({
  类型: z.literal("checkboxResource"),
  标签: z.string().min(1),
  选项: z
    .array(
      z.object({
        ID: z.string().min(1),
        标签: z.string().min(1),
        默认选中: z.boolean().optional().meta({ default: false }),
        分组: z.string().min(1).optional(),
      }),
    )
    .min(1),
});

const textMarkerDescriptorSchema = z.object({
  类型: z.literal("文字"),
  内容: z.string().refine(isSingleVisibleGrapheme, {
    message: "文字标记内容必须是一个可见 Unicode 字素。",
  }),
});

const imageMarkerDescriptorSchema = z.object({
  类型: z.literal("图片"),
  资源路径: z.string().refine((value) => value.trim().length > 0, {
    message: "图片标记资源路径不能为空白字符串。",
  }),
});

export const markerDescriptorSchema = z.discriminatedUnion("类型", [
  textMarkerDescriptorSchema,
  imageMarkerDescriptorSchema,
]);

export const countableResourceModuleSchema = sheetModuleBaseSchema.extend({
  类型: z.literal("countableResource"),
  标签: z.string().min(1),
  最小值: z.number().int().optional().meta({ default: 0 }),
  最大值: z.number().int().optional(),
  默认值: z.number().int().optional(),
  步长: z.number().int().positive().optional().meta({ default: 1 }),
  最大值可改: z.boolean().optional().meta({ default: false }),
  显示方式: z.enum(["数值", "标记"]).optional().meta({ default: "数值" }),
  当前值标记: markerDescriptorSchema.optional(),
  剩余值标记: markerDescriptorSchema.optional(),
  标记尺寸: z.number().min(5).max(96).optional(),
  加减号字号: z.number().min(5).max(96).optional(),
}).superRefine((module, context) => {
  if (module.显示方式 !== "标记") return;
  if (module.当前值标记 === undefined) {
    context.addIssue({ code: "custom", path: ["当前值标记"], message: "标记展示需要当前值标记。" });
  }
  if (module.剩余值标记 === undefined) {
    context.addIssue({ code: "custom", path: ["剩余值标记"], message: "标记展示需要剩余值标记。" });
  }
  if (module.当前值标记 !== undefined && module.剩余值标记 !== undefined
    && markerDescriptorsEqual(module.当前值标记, module.剩余值标记)) {
    context.addIssue({ code: "custom", path: ["剩余值标记"], message: "当前值标记与剩余值标记必须不同。" });
  }
  if ((module.最小值 ?? 0) < 0) {
    context.addIssue({ code: "custom", path: ["最小值"], message: "标记展示的最小值不能为负数。" });
  }
});

function isSingleVisibleGrapheme(value: string): boolean {
  if (!/[^\p{White_Space}\p{Control}\p{Format}\p{Mark}]/u.test(value)) return false;
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return [...segmenter.segment(value)].length === 1;
}

function markerDescriptorsEqual(
  current: z.infer<typeof markerDescriptorSchema>,
  remaining: z.infer<typeof markerDescriptorSchema>,
): boolean {
  if (current.类型 !== remaining.类型) return false;
  return current.类型 === "文字" && remaining.类型 === "文字"
    ? current.内容.normalize("NFC") === remaining.内容.normalize("NFC")
    : current.类型 === "图片" && remaining.类型 === "图片"
      ? current.资源路径 === remaining.资源路径
      : false;
}

export const readOnlyDisplayModuleSchema = sheetModuleBaseSchema.extend({
  类型: z.literal("readOnlyDisplay"),
  标签: z.string().min(1),
  内容: z.string().min(1).optional(),
  资源路径: z.string().min(1).optional(),
  替代文本: z.string().optional(),
});

export const imageFieldModuleSchema = sheetModuleBaseSchema.extend({
  类型: z.literal("imageField"),
  标签: z.string().min(1),
  替代文本: z.string().optional(),
});

export const cardPresentationSchema = z.object({
  名称模板: z.string().min(1).optional(),
  描述模板: z.string().min(1).optional(),
  标签字段: z.array(z.string().min(1)).refine((fields) => new Set(fields).size === fields.length, {
    message: "Card Presentation 的标签字段不能重复。",
  }).optional(),
});

export const cardTableResourceSourceSchema = z.discriminatedUnion("类型", [
  z.object({ 类型: z.literal("resourceLibrary"), ID: z.string().min(1), 卡牌展示: cardPresentationSchema.optional() }),
  z.object({ 类型: z.literal("resourceComposer"), ID: z.string().min(1), 卡牌展示: cardPresentationSchema.optional() }),
  z.object({ 类型: z.literal("otherResourceLibraries"), ID: z.literal("其他"), 卡牌展示: cardPresentationSchema.optional() }),
]);

export const cardTableModuleSchema = sheetModuleBaseSchema.extend({
  类型: z.literal("cardTable"),
  标签: z.string().min(1),
  资源来源: z.array(cardTableResourceSourceSchema).min(1).refine((sources) => new Set(sources.map((source) => `${source.类型}:${source.ID}`)).size === sources.length, {
    message: "Card Table 的资源来源不能重复。",
  }),
  状态选项: z.array(z.string().min(1)).min(1).refine((states) => new Set(states).size === states.length, {
    message: "Card Table 的状态选项不能重复。",
  }).optional(),
  状态外观: z.record(
    z.string().min(1),
    z.object({
      描边颜色: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Card state 描边颜色必须是 #RRGGBB 六位十六进制颜色。"),
      徽标: z.string().refine((value) => value.trim().length > 0, { message: "Card state 徽标不能为空白字符串。" }),
    }),
  ).optional(),
  显示方式: z.enum(["image", "text", "split"]).optional().meta({ default: "image" }),
  卡图字段: z.string().min(1).optional(),
  卡背字段: z.string().min(1).optional(),
  显示方式字段: z.string().min(1).optional(),
  背面卡牌ID字段: z.string().min(1).optional(),
});

export const resourcePickerQuerySchema = z.object({
  filters: z.record(z.string(), z.array(z.string())).optional(),
  sort: z
    .object({
      field: z.string().min(1),
      direction: z.enum(["asc", "desc"]).optional().meta({ default: "asc" }),
    })
    .optional(),
});

export const resourcePickerModuleSchema = sheetModuleBaseSchema.extend({
  类型: z.literal("resourcePicker"),
  按钮文本: z.string().min(1),
  资源库: z.union([
    z.array(z.object({
      ID: z.string().min(1),
      字段模板: z.array(resourceLibraryFieldTemplateSchema).optional(),
      默认查询: resourcePickerQuerySchema.optional(),
    })).min(1).refine((links) => new Set(links.map((link) => link.ID)).size === links.length, { message: "Resource Picker 的 Resource Library 链接不能重复。" }),
    z.literal("其他"),
  ]),
  多选: z.boolean().optional().meta({ default: false }),
  创建卡牌: z
    .object({
      卡牌桌面模块ID: z.string().min(1),
      默认状态: z.string().min(1).optional(),
    })
    .optional(),
});

export const resourceComposerModuleSchema = sheetModuleBaseSchema.extend({
  类型: z.literal("resourceComposer"),
  按钮文本: z.string().min(1),
  来源槽位: z.array(z.object({
    ID: z.string().min(1),
    标签: z.string().min(1),
    资源库ID: z.string().min(1),
    字段模板: z.array(resourceLibraryFieldTemplateSchema).optional(),
  }))
    .min(1).refine((slots) => new Set(slots.map((slot) => slot.ID)).size === slots.length, { message: "Resource Composer 的来源槽位 ID 不能重复。" }),
  输出字段: z.array(z.object({
    字段: z.string().min(1).refine((field) => field !== "ID", { message: "Composite Resource ID 由框架生成。" }),
    来源槽位ID: z.string().min(1),
    来源字段: z.string().min(1),
  })).min(1).refine((mappings) => new Set(mappings.map((mapping) => mapping.字段)).size === mappings.length, { message: "Resource Composer 的输出字段不能重复。" }),
  选择关系输出: z.object({
    字段: z.string().min(1).refine((field) => field !== "ID", { message: "Composite Resource ID 由框架生成。" }),
    全部相同时: z.string().min(1),
    全部相同时来源字段: z.string().min(1).optional(),
    不全相同时: z.string().min(1),
  }).optional(),
  创建卡牌: z.object({ 卡牌桌面模块ID: z.string().min(1), 默认状态: z.string().min(1).optional() }).optional(),
});

export const dependencySourceSchema = z.discriminatedUnion("类型", [
  z.object({
    类型: z.literal("resourcePicker"),
    模块ID: z.string().min(1),
  }),
  z.object({
    类型: z.literal("resourceComposer"),
    模块ID: z.string().min(1),
  }),
  z.object({
    类型: z.literal("checkboxResource"),
    模块ID: z.string().min(1),
  }),
  z.object({
    类型: z.literal("countableResource"),
    模块ID: z.string().min(1),
  }),
  z.object({
    类型: z.literal("freeText"),
    模块ID: z.string().min(1),
  }),
]);

export const dependencyTargetSchema = z.discriminatedUnion("类型", [
  z.object({
    类型: z.literal("module"),
    模块ID: z.string().min(1),
  }),
  z.object({
    类型: z.literal("page"),
    页面ID: z.string().min(1),
  }),
]);

export const dependencyTriggerSchema = z.discriminatedUnion("类型", [
  z.object({
    类型: z.literal("resourceSelected"),
    来源模块ID: z.string().min(1),
  }),
  z.object({
    类型: z.literal("checkboxChanged"),
    来源模块ID: z.string().min(1),
  }),
  z.object({
    类型: z.literal("countableChanged"),
    来源模块ID: z.string().min(1),
  }),
  z.object({
    类型: z.literal("freeTextChanged"),
    来源模块ID: z.string().min(1),
  }),
]);

export const dependencyConditionSchema = z.discriminatedUnion("类型", [
  z.object({
    类型: z.literal("always"),
  }),
  z.object({
    类型: z.literal("selectedResourceFieldEquals"),
    字段: z.string().min(1),
    值: z.string(),
  }),
  z.object({
    类型: z.literal("selectedResourceFieldIn"),
    字段: z.string().min(1),
    值: z.array(z.string()).min(1),
  }),
  z.object({
    类型: z.literal("selectedResourceFieldNotEquals"),
    字段: z.string().min(1),
    值: z.string(),
  }),
  z.object({
    类型: z.literal("checkboxOptionChecked"),
    选项ID: z.string().min(1),
  }),
  z.object({
    类型: z.literal("checkboxOptionUnchecked"),
    选项ID: z.string().min(1),
  }),
]);

export const fillTextContentSchema = z.union([
  z.string(),
  z.object({
    类型: z.literal("selectedResourceField"),
    字段: z.string().min(1),
    选择索引: z.number().int().min(0).optional(),
    分隔符: z.string().optional(),
  }),
  z.object({
    类型: z.literal("selectedResourceTemplate"),
    格式: z.string().min(1),
    选择索引: z.number().int().min(0).optional(),
    分隔符: z.string().optional(),
  }),
]);

const integerCalculationOperandSchema = z.union([
  z.number().int(),
  z.object({ 类型: z.literal("countableCurrent"), 模块ID: z.string().min(1) }),
  z.object({ 类型: z.literal("resourceSelectionCount"), 模块ID: z.string().min(1) }),
]);

export const integerCalculationSchema = z.object({
  类型: z.literal("integerCalculation"),
  初始值: z.number().int(),
  运算: z.array(z.object({
    操作: z.enum(["add", "subtract"]),
    值: integerCalculationOperandSchema,
  })).min(1),
  最小值: z.number().int().optional(),
  最大值: z.number().int().optional(),
}).refine((value) => value.最小值 === undefined || value.最大值 === undefined || value.最小值 <= value.最大值, {
  message: "integerCalculation 最小值不能大于最大值。",
});

const fillCountableContentSchema = z.union([
  z.number().int(),
  z.object({
    类型: z.literal("selectedResourceField"),
    字段: z.string().min(1),
    选择索引: z.number().int().min(0).optional(),
  }),
  integerCalculationSchema,
]);

export const fillCountableActionSchema = z.object({
  类型: z.literal("fillCountable"),
  目标模块ID: z.string().min(1),
  当前值: fillCountableContentSchema.optional(),
  最大值: z.union([fillCountableContentSchema, z.null()]).optional(),
}).refine((action) => action.当前值 !== undefined || action.最大值 !== undefined, {
  message: "fillCountable 至少需要 当前值 或 最大值。",
});

export const dependencyActionSchema = z.discriminatedUnion("类型", [
  z.object({
    类型: z.literal("fillText"),
    目标模块ID: z.string().min(1),
    内容: fillTextContentSchema,
    写入方式: z.enum(["替换", "追加"]).optional().meta({ default: "替换" }),
    追加分隔符: z.string().optional(),
  }),
  z.object({
    类型: z.literal("setTextPlaceholder"),
    目标模块ID: z.string().min(1),
    内容: fillTextContentSchema,
  }),
  fillCountableActionSchema,
  z.object({
    类型: z.literal("setVisibility"),
    目标类型: z.enum(["page", "module"]),
    目标ID: z.string().min(1),
    显示: z.boolean(),
  }),
  z.object({
    类型: z.literal("setResourceDefaultFilter"),
    目标模块ID: z.string().min(1),
    字段: z.string().min(1),
    值: z.union([
      z.array(z.string()).min(1),
      z.object({
        类型: z.literal("selectedResourceField"),
        字段: z.string().min(1),
        选择索引: z.number().int().min(0).optional(),
      }),
      z.object({
        类型: z.literal("freeTextValues"),
        模块IDs: z.array(z.string().min(1)).min(1).refine((ids) => new Set(ids).size === ids.length, {
          message: "freeTextValues 模块IDs不能重复。",
        }),
      }),
    ]),
  }),
]);

export const dependencyRuleSchema = z.object({
  ID: z.string().min(1),
  sources: z.array(dependencySourceSchema).min(1),
  targets: z.array(dependencyTargetSchema).min(1),
  触发: dependencyTriggerSchema,
  条件: dependencyConditionSchema.optional().describe("省略时等同 always。"),
  动作: z.array(dependencyActionSchema).min(1),
});

export const sheetModuleSchema = z.discriminatedUnion("类型", [
  freeTextModuleSchema,
  longTextModuleSchema,
  checkboxResourceModuleSchema,
  countableResourceModuleSchema,
  readOnlyDisplayModuleSchema,
  imageFieldModuleSchema,
  cardTableModuleSchema,
  resourcePickerModuleSchema,
  resourceComposerModuleSchema,
]);

export const supportedModuleTypes: Set<string> = new Set(
  sheetModuleSchema.options.map((option) => option.shape["类型"].value),
);

export const htmlTemplateLayoutSchema = z.object({
  类型: z.literal("htmlTemplate"),
  htmlContent: z.string().min(1),
  cssContent: z.string().optional(),
});

const skinLayoutOverridesSchema = z.object({
  shell: z.object({ htmlContent: z.string().min(1) }).optional(),
  pages: z.array(z.object({ ID: z.string().min(1), htmlContent: z.string().min(1) })).min(1).optional(),
});

export const systemPackageSkinSchema = z.object({
  ID: z.string().min(1),
  名称: z.string().min(1),
  cssContent: z.string().min(1),
  推荐框架配色: z.enum(["light", "dark"]),
  layoutOverrides: skinLayoutOverridesSchema.optional(),
});

export const packagePageSchema = z.object({
  ID: z.string().min(1),
  名称: z.string().min(1),
  默认隐藏: z.boolean().optional().meta({ default: false }),
  打印: z.boolean().optional().describe("省略时跟随该 Page 的运行时可见性。"),
  layout: htmlTemplateLayoutSchema,
});

const assetSchema = z.object({
  路径: z.string().min(1),
  类型: z.string().optional(),
});

export const validationCheckSchema = z.object({
  ID: z.string().min(1),
  脚本: z.string().min(1),
  scriptContent: z.string().min(1),
});

export const systemPackageEnvelopeSchema = z.object({
  manifest: systemPackageRuntimeManifestSchema,
  shell: htmlTemplateLayoutSchema.optional(),
  skins: z.array(systemPackageSkinSchema).min(1).optional(),
  defaultSkin: z.string().min(1).optional(),
  pages: z.array(packagePageSchema).min(1),
  modules: z.array(z.unknown()).min(1),
  assets: z.array(assetSchema).optional(),
  resourceLibraries: z.array(resourceLibraryPackageInputSchema).optional(),
  dependencies: z.array(z.unknown()).optional(),
  validationChecks: z.array(validationCheckSchema).optional(),
  characterCreationGuide: z.unknown().optional(),
  questionnaireCharacterCreation: questionnaireDefinitionSchema.optional(),
  resourceFormatAdapters: z.array(resourceFormatAdapterSchema).optional(),
  characterFormatAdapters: z.array(characterFormatAdapterSchema).optional(),
  characterTextExports: z.array(characterTextExportSchema).optional(),
});

export interface SystemPackage {
  manifest: z.infer<typeof systemPackageRuntimeManifestSchema>;
  shell?: HtmlTemplateLayout;
  skins?: SystemPackageSkin[];
  defaultSkin?: string;
  pages: PackagePage[];
  modules: SheetModule[];
  assets?: PackageAsset[];
  resourceLibraries?: ResourceLibrary[];
  dependencies?: DependencyRule[];
  validationChecks?: ValidationCheck[];
  characterCreationGuide?: CharacterCreationGuide;
  questionnaireCharacterCreation?: QuestionnaireDefinition;
  resourceFormatAdapters?: ResourceFormatAdapter[];
  characterFormatAdapters?: CharacterFormatAdapter[];
  characterTextExports?: CharacterTextExport[];
}
export type FreeTextModule = z.infer<typeof freeTextModuleSchema>;
export type LongTextModule = z.infer<typeof longTextModuleSchema>;
export type CheckboxResourceModule = z.infer<typeof checkboxResourceModuleSchema>;
export type CountableResourceModule = z.infer<typeof countableResourceModuleSchema>;
export type ReadOnlyDisplayModule = z.infer<typeof readOnlyDisplayModuleSchema>;
export type ImageFieldModule = z.infer<typeof imageFieldModuleSchema>;
export type CardTableModule = z.infer<typeof cardTableModuleSchema>;
export type CardTableResourceSource = z.infer<typeof cardTableResourceSourceSchema>;
export type ResourcePickerModule = z.infer<typeof resourcePickerModuleSchema>;
export type ResourceComposerModule = z.infer<typeof resourceComposerModuleSchema>;
export type SheetModule = z.infer<typeof sheetModuleSchema>;
export type PackageAsset = z.infer<typeof assetSchema>;
export type HtmlTemplateLayout = z.infer<typeof htmlTemplateLayoutSchema>;
export type SystemPackageSkin = z.infer<typeof systemPackageSkinSchema>;
export type PackagePage = z.infer<typeof packagePageSchema>;
export type DependencyRule = z.infer<typeof dependencyRuleSchema>;
export type DependencySource = z.infer<typeof dependencySourceSchema>;
export type DependencyTarget = z.infer<typeof dependencyTargetSchema>;
export type DependencyTrigger = z.infer<typeof dependencyTriggerSchema>;
export type DependencyCondition = z.infer<typeof dependencyConditionSchema>;
export type DependencyAction = z.infer<typeof dependencyActionSchema>;
export type ValidationCheck = z.infer<typeof validationCheckSchema>;
export type { CharacterFormatAdapter, ResourceFormatAdapter };
export type { ResourceLibrary };

export type PackageIssueLevel = "fatal" | "error" | "warning" | "info" | "debug";

export interface PackageIssueLocation {
  pointer: Array<string | number>;
  file?: string;
  line?: number;
  column?: number;
}

export interface PackageIssueEntity {
  kind: "manifest" | "page" | "module" | "asset" | "resourceLibrary" | "resourceEntry" | "dependency" | "validationCheck" | "guideStep" | "questionnaire";
  id?: string;
  index?: number;
}

export interface PackageIssueEvidence {
  label: string;
  value: unknown;
}

export type PackageSourceMap = Record<string, string>;

export interface PackageIssue {
  level: PackageIssueLevel;
  code: string;
  text: string;
  path?: string;
  location?: PackageIssueLocation;
  entities?: PackageIssueEntity[];
  evidence?: PackageIssueEvidence[];
}

export type PackageValidationResult =
  | { ok: true; package: SystemPackage; issues: PackageIssue[] }
  | { ok: false; issues: PackageIssue[] };

export type CachedPackageValidationResult =
  | { ok: true; package: SystemPackage }
  | { ok: false; issues: PackageIssue[] };
