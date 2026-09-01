import type { AuthoringLayout } from "../../types.ts";

export const subclassAuthoringLayout: AuthoringLayout = {
  templateId: "子职业",
  templateVersion: "1.0.0",
  sections: [
    { id: "identity", label: "基本信息", columns: 3, fields: [
      { path: "名称", label: "名称", control: "text" },
      { path: "类型", label: "类型", control: "text" },
      { path: "主职", label: "主职", control: "text" },
      { path: "等级", label: "等级", control: "text", enum: ["基础", "进阶", "精通"] },
      { path: "施法属性", label: "施法属性", control: "text" },
    ] },
    { id: "description", label: "说明", columns: 2, fields: [
      { path: "描述", label: "描述", control: "textarea", span: 2 },
      { path: "风味描述", label: "风味描述", control: "textarea", span: 2 },
    ] },
  ],
};
