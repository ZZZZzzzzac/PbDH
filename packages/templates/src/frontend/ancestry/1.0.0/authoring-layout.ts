import type { AuthoringLayout } from "../../types.ts";

export const ancestryAuthoringLayout: AuthoringLayout = {
  templateId: "种族",
  templateVersion: "1.0.0",
  sections: [
    { id: "identity", label: "基本信息", columns: 2, fields: [
      { path: "名称", label: "名称", control: "text" },
      { path: "类型", label: "类型", control: "text" },
      { path: "简介", label: "简介", control: "textarea", span: 2 },
    ] },
    { id: "features", label: "种族特性", columns: 1, fields: [], repeats: [{
      path: "特性", label: "特性", itemFields: [
        { path: "名称", label: "名称", control: "text" },
        { path: "描述", label: "描述", control: "textarea", span: 2 },
      ],
      columns: 2,
      itemDefaults: { 名称: "新特性", 描述: "" },
    }] },
  ],
};
