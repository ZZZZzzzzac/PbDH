import type { z } from "zod";
import { characterDataSchema } from "./characterData";
import { resourceExtensionDocumentSchema } from "./resourceExtension";
import { resourceLibrarySchema } from "./resourceLibrary";
import { questionnaireDefinitionSchema, questionnaireResultSchema } from "./questionnaireContract";
import {
  authorContractSchemas,
  packagePageSourceSchema,
  packageSkinSourceSchema,
  packageValidationCheckSourceSchema,
} from "./systemPackageAuthorSchema";
import {
  cardTableModuleSchema,
  checkboxResourceModuleSchema,
  countableResourceModuleSchema,
  freeTextModuleSchema,
  imageFieldModuleSchema,
  longTextModuleSchema,
  packagePageSchema,
  readOnlyDisplayModuleSchema,
  resourceComposerModuleSchema,
  resourcePickerModuleSchema,
  systemPackageSkinSchema,
} from "./systemPackage";
import { scriptContractSchemas } from "./packageScriptContract";
import { packageScriptTimeoutMs } from "./packageScriptRunner";

export interface SystemPackageContractEntry {
  id: string;
  title: string;
  group: "author-source" | "runtime" | "script";
  io?: "input" | "output";
  schema: z.ZodType;
  summary: string;
  semanticConstraints: readonly string[];
  document?: string;
}

export const systemPackageContractEntries: readonly SystemPackageContractEntry[] = [
  {
    id: "manifest",
    title: "manifest.json",
    group: "author-source",
    schema: authorContractSchemas.manifest,
    summary: "包身份、入口文件、资源库、检查脚本、Shell 与 Skins 的唯一根声明。",
    document: "package-and-assets.md",
    semanticConstraints: [
      "文件固定命名为 manifest.json 并位于包根。",
      "schemaVersion 与当前框架版本不一致时允许加载但产生兼容性 warning。",
      "defaultSkin 必须引用 skins 中的 ID；所有声明路径必须存在且保持在包根内。",
      "assets 不在 manifest 中枚举；受支持图片从 assets/** 自动发现。",
    ],
  },
  {
    id: "pages",
    title: "Pages author source",
    group: "author-source",
    schema: authorContractSchemas.pages,
    summary: "Page 身份、导航/打印标志和 HTML/CSS Layout 源文件。",
    document: "pages-layout-skins.md",
    semanticConstraints: [
      "Page ID 在包内唯一；layout.html 与可选 layout.css 必须存在。",
      "Layout 中引用的 pb-module ID 必须存在；打印页面几何由包 CSS 负责。",
    ],
  },
  {
    id: "modules",
    title: "Sheet Modules",
    group: "author-source",
    schema: authorContractSchemas.modules,
    summary: "九类 Sheet Module 的完整判别联合。",
    semanticConstraints: [
      "Module ID 在包内唯一且是 Character Data 的持久键。",
      "默认值、Resource/Composer/Card 引用和创建卡牌目标会接受跨实体语义校验。",
      "未知 Module 类型不会降级；会产生 UNSUPPORTED_MODULE_TYPE。",
    ],
  },
  ...([
    ["module-free-text", "freeText", freeTextModuleSchema, "modules/free-text.md"],
    ["module-long-text", "longText", longTextModuleSchema, "modules/long-text.md"],
    ["module-checkbox-resource", "checkboxResource", checkboxResourceModuleSchema, "modules/checkbox-resource.md"],
    ["module-countable-resource", "countableResource", countableResourceModuleSchema, "modules/countable-resource.md"],
    ["module-read-only-display", "readOnlyDisplay", readOnlyDisplayModuleSchema, "modules/read-only-display.md"],
    ["module-image-field", "imageField", imageFieldModuleSchema, "modules/image-field.md"],
    ["module-resource-picker", "resourcePicker", resourcePickerModuleSchema, "modules/resource-picker.md"],
    ["module-resource-composer", "resourceComposer", resourceComposerModuleSchema, "modules/resource-composer.md"],
    ["module-card-table", "cardTable", cardTableModuleSchema, "modules/card-table.md"],
  ] as const).map(([id, type, schema, document]): SystemPackageContractEntry => ({
    id,
    title: `${type} Module`,
    group: "author-source",
    schema,
    document,
    summary: `${type} Sheet Module 的作者源文件形状。`,
    semanticConstraints: [
      "ID 是 Character Data 的持久键；发布后不可随显示名称随意改变。",
      "默认值只在没有持久值时生效；未知字段不属于受支持合同。",
    ],
  })),
  {
    id: "dependencies",
    title: "Dependency rules",
    group: "author-source",
    schema: authorContractSchemas.dependencies,
    summary: "事件来源、目标、触发、条件和值/动作 variant。",
    document: "dependencies.md",
    semanticConstraints: [
      "每条规则 ID 唯一；source、trigger、condition、target 和 action 必须与真实 Module 类型兼容。",
      "规则只响应声明事件；加载 Character Data 不重放一次性写入。",
      "setVisibility/default filters/placeholder 等纯派生展示可从持久快照重建。",
    ],
  },
  {
    id: "guide",
    title: "Character Creation Guide",
    group: "author-source",
    schema: authorContractSchemas.guide,
    summary: "线性 Guide Steps 与可选 Page/Module/Layout Region 目标。",
    document: "guides-validation.md",
    semanticConstraints: [
      "无目标 Step 合法；它只显示说明面板。",
      "region 目标由 Layout 元素的 data-guide-region-id 声明；ID 必须非空并在有效 Layout 中存在。",
      "Guide 只聚焦和解释，不写 Character Data。",
    ],
  },
  {
    id: "questionnaire-source",
    title: "Questionnaire Character Creation declaration",
    group: "author-source",
    schema: authorContractSchemas.questionnaire,
    summary: "manifest 内的问卷身份、显示名称与自包含 HTML 路径。",
    document: "questionnaire-character-creation.md",
    semanticConstraints: [
      "每个 System Package 至多声明一个问卷；HTML 在 Base-owned 新标签页的 sandbox iframe 中运行。",
      "问卷问题、计分、推荐和视觉表现完全由 Author HTML/CSS/JS 负责。",
      "问卷不读取 Character Data，也不能直接调用 Runtime Store、Storage 或 Dependency Engine。",
    ],
  },
  {
    id: "questionnaire-runtime",
    title: "Loaded Questionnaire runtime shape",
    group: "runtime",
    schema: questionnaireDefinitionSchema,
    summary: "Loader 装配 HTML 内容后的问卷定义。",
    document: "questionnaire-character-creation.md",
    semanticConstraints: ["Author 不直接编写 htmlContent；它由 manifest 声明的安全包内路径装配。"],
  },
  {
    id: "questionnaire-result",
    title: "Questionnaire result",
    group: "runtime",
    schema: questionnaireResultSchema,
    summary: "问卷返回的有序 Resource Picker 选择列表。",
    document: "questionnaire-character-creation.md",
    semanticConstraints: [
      "仅支持 resourceSelected；sourceModuleId 必须是现有 Resource Picker，libraryId 必须是该 Picker 已链接的 Resource Library。",
      "entryIds 必须是稳定且不重复的 Resource Entry ID，并遵守 Picker 单选/多选约束；Entry 可由可选 Resource Extension 提供。",
      "当前 Effective Resource Catalog 中缺失的 Entry 会在 Base 确认界面警告并跳过；没有任何可用选择时不能确认。",
      "Base 按 interactions 声明顺序在草稿上重放可用 Picker 选择；Player 确认后才原子写入并保存一次。",
      "问卷结果最大 64 KiB；无效、过期或取消的结果不会修改 Character Data。",
      "接入问卷不要求修改 dependencies.json；重放会自然触发 Picker 已有的 resourceSelected Dependency Logic。",
    ],
  },
  {
    id: "resource-library-file",
    title: "Resource Library source file",
    group: "author-source",
    schema: authorContractSchemas.resourceLibraryFile,
    summary: "作者资源条目数组；ID/旧ID 为框架身份字段，其余键是系统自定义 Resource Values。",
    document: "resources-cards.md",
    semanticConstraints: [
      "同一库内 ID 与所有旧ID必须唯一且互不冲突。",
      "复杂 Resource Value 会序列化为 JSON 文本且默认不参与筛选、排序或搜索。",
      "Resource Values 默认按显示文本处理，不推断数字语义。",
    ],
  },
  {
    id: "resource-format-adapters",
    title: "Resource Format Adapter declarations",
    group: "author-source",
    schema: authorContractSchemas.resourceFormatAdapters,
    summary: "外部资源格式的 carrier 检测和导入脚本路径。",
    document: "extensions-adapters.md",
    semanticConstraints: [
      "检测必须唯一命中；Base 不解释第三方格式字段。",
      "zip carrier 只读取声明的安全 JSON成员，并把成员挂到对应键。",
    ],
  },
  {
    id: "character-format-adapters",
    title: "Character Format Adapter declarations",
    group: "author-source",
    schema: authorContractSchemas.characterFormatAdapters,
    summary: "外部人物格式的 carrier、导入及可选导出脚本。",
    document: "extensions-adapters.md",
    semanticConstraints: [
      "声明导出脚本才支持导出；当前导出文件后缀固定为 .json。",
      "embeddedJson 只截取标记之间的 JSON，不解析 DOM 或执行外部脚本。",
    ],
  },
  {
    id: "character-text-exports",
    title: "Character Text Export declarations",
    group: "author-source",
    schema: authorContractSchemas.characterTextExports,
    summary: "Character Data Module Value 到剪贴板文本的声明式格式化规则。",
    document: "character-text-export.md",
    semanticConstraints: [
      "Module ID 必须存在；文本只适用于 freeText/longText，当前值与最大值只适用于 countableResource。",
      "Player 值不是有符号十进制安全整数时只跳过字段；导出不会修改 Character Save。",
      "总模板替换 {字段}，字段模板替换 {值}；未知占位符保留。",
    ],
  },
  {
    id: "page-runtime",
    title: "Loaded Page runtime shape",
    group: "runtime",
    schema: packagePageSchema,
    summary: "Loader 解析 HTML/CSS 后交给 Validator/Renderer 的 Page。",
    document: "pages-layout-skins.md",
    semanticConstraints: ["Author 不直接编写 htmlContent/cssContent；它们由源文件装配。"],
  },
  {
    id: "skin-source",
    title: "Skin author source",
    group: "author-source",
    schema: packageSkinSourceSchema,
    summary: "Skin CSS 与可选 Shell/Page HTML override 源路径。",
    document: "pages-layout-skins.md",
    semanticConstraints: [
      "Page override 必须保留 Base Layout 的完整 Module ID 集合。",
      "Shell override 必须保留恰好一个 pb-page-outlet 和原打印页所有权。",
    ],
  },
  {
    id: "skin-runtime",
    title: "Loaded Skin runtime shape",
    group: "runtime",
    schema: systemPackageSkinSchema,
    summary: "Loader 装配内容后的 Skin。",
    document: "pages-layout-skins.md",
    semanticConstraints: ["Author 不直接编写 cssContent/htmlContent。"],
  },
  {
    id: "validation-check-source",
    title: "Validation Check declaration",
    group: "author-source",
    schema: packageValidationCheckSourceSchema,
    summary: "manifest 内的 Check ID 与脚本路径。",
    document: "guides-validation.md",
    semanticConstraints: ["脚本必须能被 Acorn 解析，并在隔离 Worker 中执行。"],
  },
  {
    id: "character-data",
    title: "Character Data",
    group: "runtime",
    schema: characterDataSchema,
    summary: "角色值、Cards、Composite Resources、选择快照与 Player Images 的持久格式。",
    document: "modules-character-data.md",
    semanticConstraints: [
      "Character Data 的 systemPackage id 必须匹配当前包；version 不阻止原生导入。导入从当前包默认值建立新存档，只原样保留当前包可合法使用的数据，并报告、丢弃其他数据。",
      "Player Image dataUrl 只在 Character Data 中嵌入；System Package 资产只保存引用。",
    ],
  },
  {
    id: "resource-library-runtime",
    title: "Normalized Resource Library",
    group: "runtime",
    schema: resourceLibrarySchema,
    summary: "Author Resource 文件归一化后的字段元数据与字符串值。",
    document: "resources-cards.md",
    semanticConstraints: ["Author 脚本读取的是此 normalized shape，而不是原始资源 JSON。"],
  },
  {
    id: "resource-extension",
    title: "Resource Extension document",
    group: "runtime",
    schema: resourceExtensionDocumentSchema,
    summary: "独立资源扩展的目标包和库贡献。",
    document: "resources-cards.md",
    semanticConstraints: [
      "缺失的 Extension/Library/Entry ID 可由导入流程生成；生成后归一化 JSON 会显式写回。",
      "根级 metadata 使用反向域名式命名空间；Base 原样保留但不把它归一化为 Resource Value，也不用于展示、搜索、筛选或 Card Presentation。",
    ],
  },
  ...Object.entries(scriptContractSchemas).map(([id, schema]): SystemPackageContractEntry => ({
    id: `script-${id}`,
    title: `Script API: ${id}`,
    group: "script",
    io: id.endsWith("Input") ? "output" : "input",
    schema,
    summary: "隔离 Package Script Worker 的结构化输入或输出合同。",
    document: id.startsWith("validation") ? "guides-validation.md" : "extensions-adapters.md",
    semanticConstraints: [
      "输入在传入脚本前 structuredClone 并 deep-freeze。",
      `生产环境在独立 Worker 执行，默认超时 ${packageScriptTimeoutMs} ms；DOM、网络和宿主状态不在合同内。`,
      "脚本通过 module.exports 导出同步或 async 函数；异常、超时和无效输出均转为诊断。",
      ...scriptSpecificConstraints(id),
    ],
  })),
] as const;

function scriptSpecificConstraints(id: string): string[] {
  switch (id) {
    case "validationInput":
      return ["cardState 与 characterData.cards 指向同一份只读 Card 状态快照；resourceLibraries 已归一化为字符串字段。"];
    case "validationOutput":
      return ["脚本只返回 level/text/path/code；source 由 Host 使用 Check ID 注入。location/evidence 不属于 Validation Script 输出合同。"];
    case "resourceAdapterImportInput":
      return ["assets[].bytes 是 Uint8Array；只包含用户选择的 zip 中安全读取的文件。"];
    case "resourceAdapterImportOutput":
      return ["七个 counts 字段全部必填且为非负整数；retainedAssets 的 sourcePath 必须存在，targetPath 必须安全且唯一。"];
    case "characterAdapterImportOutput":
      return ["values 键必须是当前包 Module ID 且值形状匹配 Module；cards 必须引用现有 Card Table 与 Resource Entry；images 只接受受支持 image data URL。"];
    case "characterAdapterExportOutput":
      return ["document 必须是对象；省略的六个导出/跳过计数由 Host 归零。"];
    default:
      return [];
  }
}
