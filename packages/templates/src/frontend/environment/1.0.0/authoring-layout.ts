import type { AuthoringLayout } from "../../types.ts";

export const environmentAuthoringLayout: AuthoringLayout = {
  templateId: "环境",
  templateVersion: "1.0.0",
  sections: [
    {
      id: "identity",
      label: "基本信息",
      fields: [
        { path: "名称", label: "名称", control: "text" },
        { path: "原文", label: "原文", control: "text" },
        { path: "位阶", label: "位阶", control: "text" },
        { path: "种类", label: "种类", control: "text" }
      ]
    },
    {
      id: "setting",
      label: "环境信息",
      fields: [
        { path: "简介", label: "简介", control: "textarea" },
        { path: "趋向", label: "趋向", control: "textarea" },
        { path: "难度", label: "难度", control: "text" },
        { path: "潜在敌人", label: "潜在敌人", control: "textarea" }
      ]
    },
    {
      id: "features",
      label: "特性",
      fields: [],
      repeats: [{
        path: "特性",
        label: "特性",
        itemFields: [
          { path: "名称", label: "名称", control: "text" },
          { path: "原名", label: "原名", control: "text" },
          { path: "类型", label: "类型", control: "text" },
          { path: "描述", label: "描述", control: "textarea" },
          { path: "引导问题", label: "引导问题", control: "textarea" }
        ]
      }]
    }
  ]
};
