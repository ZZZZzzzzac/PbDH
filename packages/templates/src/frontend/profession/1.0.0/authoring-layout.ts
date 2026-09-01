import type { AuthoringLayout } from "../../types.ts";

export const professionAuthoringLayout: AuthoringLayout = {
  templateId: "职业",
  templateVersion: "1.0.0",
  sections: [
    { id: "identity", label: "基本信息", columns: 2, fields: [
      { path: "名称", label: "名称", control: "text" },
      { path: "类型", label: "类型", control: "text" },
      { path: "描述", label: "描述", control: "textarea", span: 2 },
      { path: "领域", label: "领域", control: "string-list", span: 2 },
      { path: "施法属性", label: "施法属性", control: "text" },
    ] },
    { id: "stats", label: "职业数据", columns: 2, fields: [
      { path: "生命点", label: "生命点", control: "text" },
      { path: "闪避值", label: "闪避值", control: "text" },
      { path: "职业物品", label: "职业物品", control: "textarea", span: 2 },
      { path: "希望特性", label: "希望特性", control: "textarea", span: 2 },
      { path: "职业特性", label: "职业特性", control: "textarea", span: 2 },
    ] },
    { id: "recommendations", label: "推荐起始配置", columns: 2, fields: [
      { path: "推荐初始属性", label: "推荐初始属性", control: "single-entry-map-list", span: 2 },
      { path: "推荐初始武器", label: "推荐初始武器", control: "string-list", span: 2 },
      { path: "推荐初始护甲", label: "推荐初始护甲", control: "textarea", span: 2 },
    ] },
    { id: "questions", label: "问题", columns: 2, fields: [
      { path: "背景问题", label: "背景问题", control: "string-list", span: 2 },
      { path: "关系问题", label: "关系问题", control: "string-list", span: 2 },
    ] },
  ],
};
