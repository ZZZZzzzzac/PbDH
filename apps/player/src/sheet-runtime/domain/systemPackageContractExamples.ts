import type { z } from "zod";
import { authorContractSchemas } from "./systemPackageAuthorSchema";
import {
  characterAdapterExportOutputSchema,
  characterAdapterImportOutputSchema,
  resourceAdapterImportOutputSchema,
  validationScriptOutputSchema,
} from "./packageScriptContract";
import {
  cardTableModuleSchema,
  checkboxResourceModuleSchema,
  countableResourceModuleSchema,
  freeTextModuleSchema,
  imageFieldModuleSchema,
  longTextModuleSchema,
  readOnlyDisplayModuleSchema,
  resourceComposerModuleSchema,
  resourcePickerModuleSchema,
} from "./systemPackage";

export interface SystemPackageContractExample {
  id: string;
  title: string;
  schema: z.ZodType;
  value: unknown;
  notes: string;
  document: string;
}

export const systemPackageContractExamples: readonly SystemPackageContractExample[] = [
  {
    id: "module-free-text",
    title: "freeText 最小例子",
    schema: freeTextModuleSchema,
    document: "modules/free-text.md",
    notes: "选项存在时显示下拉；省略时显示单行文字输入。",
    value: { ID: "name", 类型: "freeText", 标签: "姓名", 选项: ["A", "B"] },
  },
  {
    id: "module-long-text",
    title: "longText 最小例子",
    schema: longTextModuleSchema,
    document: "modules/long-text.md",
    notes: "行数控制编辑区域的基准高度。",
    value: { ID: "notes", 类型: "longText", 标签: "记录", 行数: 4 },
  },
  {
    id: "module-checkbox-resource",
    title: "checkboxResource 最小例子",
    schema: checkboxResourceModuleSchema,
    document: "modules/checkbox-resource.md",
    notes: "选项 ID 是 Character Data 中的持久键。",
    value: { ID: "flags", 类型: "checkboxResource", 标签: "状态", 选项: [{ ID: "ready", 标签: "就绪" }] },
  },
  {
    id: "module-countable-resource",
    title: "countableResource 标记例子",
    schema: countableResourceModuleSchema,
    document: "modules/countable-resource.md",
    notes: "标记模式必须同时声明当前值和剩余值标记。",
    value: { ID: "stress", 类型: "countableResource", 标签: "压力", 最大值: 6, 显示方式: "标记", 当前值标记: { 类型: "文字", 内容: "●" }, 剩余值标记: { 类型: "图片", 资源路径: "assets/empty.webp" } },
  },
  {
    id: "module-read-only-display",
    title: "readOnlyDisplay 最小例子",
    schema: readOnlyDisplayModuleSchema,
    document: "modules/read-only-display.md",
    notes: "静态内容不写入 Character Data。",
    value: { ID: "help", 类型: "readOnlyDisplay", 标签: "说明", 内容: "规则文字" },
  },
  {
    id: "module-image-field",
    title: "imageField 最小例子",
    schema: imageFieldModuleSchema,
    document: "modules/image-field.md",
    notes: "玩家选择的图片保存在 Character Data playerImages。",
    value: { ID: "portrait", 类型: "imageField", 标签: "头像" },
  },
  {
    id: "module-resource-picker",
    title: "resourcePicker 最小例子",
    schema: resourcePickerModuleSchema,
    document: "modules/resource-picker.md",
    notes: "引用的资源库和查询字段必须通过完整包 Validator 闭合。",
    value: { ID: "pick-class", 类型: "resourcePicker", 按钮文本: "选择职业", 资源库: [{ ID: "classes", 默认查询: { filters: { 类型: ["基础"] }, sort: { field: "名称", direction: "asc" } } }], 多选: false },
  },
  {
    id: "module-resource-composer",
    title: "resourceComposer 最小例子",
    schema: resourceComposerModuleSchema,
    document: "modules/resource-composer.md",
    notes: "槽位、输出字段和来源字段引用必须闭合。",
    value: { ID: "compose-item", 类型: "resourceComposer", 按钮文本: "组合物品", 来源槽位: [{ ID: "base", 标签: "基础", 资源库ID: "items" }], 输出字段: [{ 字段: "名称", 来源槽位ID: "base", 来源字段: "名称" }] },
  },
  {
    id: "module-card-table",
    title: "cardTable 最小例子",
    schema: cardTableModuleSchema,
    document: "modules/card-table.md",
    notes: "来源可混合原生库、Composer 和其他资源。",
    value: { ID: "cards", 类型: "cardTable", 标签: "卡牌", 资源来源: [{ 类型: "resourceLibrary", ID: "cards" }, { 类型: "resourceComposer", ID: "compose-item" }, { 类型: "otherResourceLibraries", ID: "其他" }], 状态选项: ["当前", "已消耗"] },
  },
  {
    id: "dependency-variants",
    title: "Dependency triggers、conditions、actions 与 value variants",
    schema: authorContractSchemas.dependencies,
    notes: "示例集中覆盖所有公开 action，并展示 text/countable/filter 的各类值来源。",
    document: "dependencies.md",
    value: [
      {
        ID: "resource-to-text",
        sources: [{ 类型: "resourcePicker", 模块ID: "pick" }],
        targets: [{ 类型: "module", 模块ID: "name" }],
        触发: { 类型: "resourceSelected", 来源模块ID: "pick" },
        条件: { 类型: "selectedResourceFieldEquals", 字段: "类型", 值: "基础" },
        动作: [
          { 类型: "fillText", 目标模块ID: "name", 内容: "固定文字" },
          { 类型: "fillText", 目标模块ID: "name", 内容: { 类型: "selectedResourceField", 字段: "名称" } },
          { 类型: "fillText", 目标模块ID: "name", 内容: { 类型: "selectedResourceTemplate", 格式: "{名称}（{类型}）" } },
          { 类型: "setTextPlaceholder", 目标模块ID: "name", 内容: { 类型: "selectedResourceField", 字段: "说明" } },
        ],
      },
      {
        ID: "checkbox-visibility",
        sources: [{ 类型: "checkboxResource", 模块ID: "flags" }],
        targets: [{ 类型: "page", 页面ID: "advanced" }],
        触发: { 类型: "checkboxChanged", 来源模块ID: "flags" },
        条件: { 类型: "checkboxOptionChecked", 选项ID: "advanced" },
        动作: [{ 类型: "setVisibility", 目标类型: "page", 目标ID: "advanced", 显示: true }],
      },
      {
        ID: "countable-calculation",
        sources: [{ 类型: "countableResource", 模块ID: "level" }],
        targets: [{ 类型: "module", 模块ID: "stress" }],
        触发: { 类型: "countableChanged", 来源模块ID: "level" },
        条件: { 类型: "always" },
        动作: [
          { 类型: "fillCountable", 目标模块ID: "stress", 当前值: 0 },
          { 类型: "fillCountable", 目标模块ID: "stress", 最大值: { 类型: "selectedResourceField", 字段: "上限" } },
          { 类型: "fillCountable", 目标模块ID: "stress", 最大值: { 类型: "integerCalculation", 初始值: 4, 运算: [{ 操作: "add", 值: { 类型: "countableCurrent", 模块ID: "level" } }, { 操作: "subtract", 值: { 类型: "resourceSelectionCount", 模块ID: "pick" } }], 最小值: 0 } },
        ],
      },
      {
        ID: "free-text-filter",
        sources: [{ 类型: "freeText", 模块ID: "domain" }],
        targets: [{ 类型: "module", 模块ID: "pick" }],
        触发: { 类型: "freeTextChanged", 来源模块ID: "domain" },
        条件: { 类型: "checkboxOptionUnchecked", 选项ID: "all" },
        动作: [
          { 类型: "setResourceDefaultFilter", 目标模块ID: "pick", 字段: "领域", 值: ["利刃"] },
          { 类型: "setResourceDefaultFilter", 目标模块ID: "pick", 字段: "领域", 值: { 类型: "selectedResourceField", 字段: "领域" } },
          { 类型: "setResourceDefaultFilter", 目标模块ID: "pick", 字段: "领域", 值: { 类型: "freeTextValues", 模块IDs: ["domain"] } },
        ],
      },
      {
        ID: "resource-in-condition",
        sources: [{ 类型: "resourceComposer", 模块ID: "compose" }],
        targets: [{ 类型: "module", 模块ID: "help" }],
        触发: { 类型: "resourceSelected", 来源模块ID: "compose" },
        条件: { 类型: "selectedResourceFieldIn", 字段: "类型", 值: ["A", "B"] },
        动作: [{ 类型: "setVisibility", 目标类型: "module", 目标ID: "help", 显示: true }],
      },
      {
        ID: "resource-not-condition",
        sources: [{ 类型: "resourcePicker", 模块ID: "pick" }],
        targets: [{ 类型: "module", 模块ID: "help" }],
        触发: { 类型: "resourceSelected", 来源模块ID: "pick" },
        条件: { 类型: "selectedResourceFieldNotEquals", 字段: "类型", 值: "隐藏" },
        动作: [{ 类型: "setVisibility", 目标类型: "module", 目标ID: "help", 显示: true }],
      },
    ],
  },
  {
    id: "guide-target-variants",
    title: "Guide target variants",
    schema: authorContractSchemas.guide,
    notes: "目标可省略，或指向 Page、Module、Layout Region。",
    document: "guides-validation.md",
    value: { 步骤: [
      { ID: "intro", 标题: "开始", 说明: "无目标步骤。" },
      { ID: "page", 标题: "页面", 说明: "打开页面。", 目标: { 类型: "page", 页面ID: "main" } },
      { ID: "module", 标题: "字段", 说明: "填写字段。", 目标: { 类型: "module", 模块ID: "name" } },
      { ID: "region", 标题: "区域", 说明: "查看区域。", 目标: { 类型: "region", 区域ID: "identity" } },
    ] },
  },
  {
    id: "format-carrier-variants",
    title: "Format Adapter carrier variants",
    schema: authorContractSchemas.resourceFormatAdapters,
    notes: "json、embeddedJson 与 zip 三种 carrier；检测路径允许字符串或非负数组索引。",
    document: "extensions-adapters.md",
    value: [{
      ID: "external-format",
      名称: "External Format",
      导入脚本: "adapters/import.js",
      载体: [
        { 类型: "json", 根类型: "object", 文件后缀: ".json", 检测: [{ 路径: ["kind"], 等于: "external" }] },
        { 类型: "embeddedJson", 文件后缀: ".html", 开始标记: "DATA=", 结束标记: ";", 检测: [{ 路径: ["kind"], 存在: true }] },
        { 类型: "zip", 文件后缀: ".pack", JSON成员: [{ 路径: "manifest.json", 键: "manifest" }], 检测: [{ 路径: ["manifest", "kind"], 等于: "external" }] },
      ],
    }],
  },
  {
    id: "validation-output",
    title: "Validation Script output",
    schema: validationScriptOutputSchema,
    notes: "可直接返回 issue 数组，或返回 `{ issues }`。source 由 Host 注入，脚本不返回。",
    document: "guides-validation.md",
    value: [{ level: "warning", code: "EXAMPLE_WARNING", text: "示例警告", path: "character.values.level" }],
  },
  {
    id: "resource-adapter-output",
    title: "Resource Adapter import output",
    schema: resourceAdapterImportOutputSchema,
    notes: "counts 的七个非负整数均必填；retainedAssets 只声明从输入 assets 保留的安全路径。",
    document: "extensions-adapters.md",
    value: { name: "扩展资源", version: "1.0.0", resourceLibraries: [{ ID: "items", 名称: "物品", entries: [] }], retainedAssets: [{ sourcePath: "images/a.webp", targetPath: "assets/imported/a.webp" }], diagnostics: [], counts: { sourceEntries: 0, convertedEntries: 0, skippedEntries: 0, convertedFields: 0, skippedFields: 0, boundImages: 1, orphanImages: 0 } },
  },
  {
    id: "character-adapter-import-output",
    title: "Character Adapter import output",
    schema: characterAdapterImportOutputSchema,
    notes: "values 键必须对应当前包 Module ID；Host 随后按 Module 类型和 Resource Entry 引用做语义校验。",
    document: "extensions-adapters.md",
    value: { values: { name: "角色名", stress: { current: 1, max: 6 } }, cards: [{ tableModuleId: "cards", state: "当前", libraryId: "cards", entryId: "card-1" }], diagnostics: [] },
  },
  {
    id: "character-adapter-export-output",
    title: "Character Adapter export output",
    schema: characterAdapterExportOutputSchema,
    notes: "document 是目标格式根对象；所有计数省略时 Host 归零。",
    document: "extensions-adapters.md",
    value: { document: { kind: "external-character", name: "角色名" }, exportedFields: 1, diagnostics: [] },
  },
] as const;
