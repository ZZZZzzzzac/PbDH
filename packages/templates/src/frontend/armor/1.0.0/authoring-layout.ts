import type { AuthoringLayout } from "../../types.ts";

export const armorAuthoringLayout: AuthoringLayout = {
  templateId: "护甲",
  templateVersion: "1.0.0",
  sections: [
    {
      id: "identity",
      label: "基本信息",
      fields: [
        { path: "名称", label: "名称", control: "text" },
        { path: "类型", label: "类型", control: "text" },
        { path: "位阶", label: "位阶", control: "text" },
      ],
    },
    {
      id: "protection",
      label: "防护数据",
      fields: [
        { path: "护甲值", label: "护甲值", control: "text" },
        { path: "重度伤害阈值", label: "重度伤害阈值", control: "text" },
        { path: "严重伤害阈值", label: "严重伤害阈值", control: "text" },
      ],
    },
    {
      id: "description",
      label: "说明",
      fields: [
        { path: "描述", label: "特性", control: "textarea" },
        { path: "风味描述", label: "风味描述", control: "textarea" },
      ],
    },
  ],
};
