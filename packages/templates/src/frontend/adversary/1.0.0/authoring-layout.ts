import type { AuthoringLayout } from "../../types.ts";

export const adversaryAuthoringLayout: AuthoringLayout = {
  templateId: "敌人",
  templateVersion: "1.0.0",
  sections: [
    { id: "identity", label: "身份", fields: [
      { path: "名称", label: "名称", control: "text" }, { path: "原文", label: "原文", control: "text" },
      { path: "类型", label: "类型", control: "text" }, { path: "位阶", label: "位阶", control: "text" },
      { path: "种类", label: "种类", control: "text" },
    ] },
    { id: "description", label: "描述", fields: [
      { path: "简介", label: "简介", control: "textarea" },
      { path: "动机与战术", label: "动机与战术", control: "textarea" },
      { path: "经历", label: "经历", control: "text" },
    ] },
    { id: "combat", label: "战斗数据", fields: [
      { path: "难度", label: "难度", control: "text" }, { path: "重度伤害阈值", label: "重度伤害阈值", control: "text" },
      { path: "严重伤害阈值", label: "严重伤害阈值", control: "text" }, { path: "生命点", label: "生命点", control: "text" },
      { path: "压力点", label: "压力点", control: "text" }, { path: "攻击命中", label: "攻击命中", control: "text" },
      { path: "攻击武器", label: "攻击武器", control: "text" }, { path: "攻击范围", label: "攻击范围", control: "text" },
      { path: "攻击伤害", label: "攻击伤害", control: "text" }, { path: "攻击属性", label: "攻击属性", control: "text" },
    ] },
    { id: "features", label: "特性", fields: [], repeats: [{
      path: "特性", label: "特性", itemFields: [
        { path: "名称", label: "名称", control: "text" }, { path: "原名", label: "原名", control: "text" },
        { path: "类型", label: "类型", control: "text" }, { path: "特性描述", label: "特性描述", control: "textarea" },
      ],
    }] },
  ],
};
