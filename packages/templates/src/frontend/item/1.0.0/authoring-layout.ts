import type { AuthoringLayout } from "../../types.ts";

export const itemAuthoringLayout: AuthoringLayout = {
  templateId: "物品",
  templateVersion: "1.0.0",
  sections: [
    { id: "identity", label: "基本信息", fields: [
      { path: "名称", label: "名称", control: "text" },
      { path: "类型", label: "类型", control: "text" },
      { path: "掷骰", label: "掷骰", control: "text" },
    ] },
    { id: "description", label: "说明", fields: [
      { path: "描述", label: "描述", control: "textarea" },
      { path: "风味描述", label: "风味描述", control: "textarea" },
    ] },
  ],
};
