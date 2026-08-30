import type { AuthoringLayout } from "../../types.ts";

export const weaponAuthoringLayout: AuthoringLayout = {
  templateId: "武器",
  templateVersion: "1.0.0",
  sections: [
    { id: "identity", label: "武器", fields: [
      { path: "名称", label: "名称", control: "text" }, { path: "类型", label: "类型", control: "text" },
      { path: "位阶", label: "位阶", control: "text" }, { path: "风味描述", label: "风味描述", control: "textarea" },
    ] },
    { id: "combat", label: "属性", fields: [
      { path: "属性", label: "属性", control: "text" }, { path: "距离", label: "距离", control: "text" },
      { path: "伤害", label: "伤害", control: "text" }, { path: "伤害类型", label: "伤害类型", control: "text" },
      { path: "负荷", label: "负荷", control: "text" },
    ] },
    { id: "feature", label: "游戏效果", fields: [{ path: "描述", label: "游戏效果", control: "textarea" }] },
  ],
};
