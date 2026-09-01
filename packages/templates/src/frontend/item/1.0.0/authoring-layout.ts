import type { AuthoringLayout } from "../../types.ts";

export const itemAuthoringLayout: AuthoringLayout = {
  templateId: "物品",
  templateVersion: "1.0.0",
  sections: [
    { id: "identity", label: "基本信息", columns: 3, fields: [
      { path: "名称", label: "名称", control: "text" },
      { path: "类型", label: "类型", control: "text", enum: ["物品", "消耗品"] },
      { path: "掷骰", label: "掷骰", control: "text" },
    ] },
    { id: "description", label: "说明", columns: 2, fields: [
      { path: "描述", label: "描述", control: "textarea", span: 2 },
      { path: "风味描述", label: "风味描述", control: "textarea", span: 2 },
    ] },
  ],
};
