import schema from "./schema.json";

import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type AdversaryFeature = { 名称: string; 原名: string; 类型: string; 特性描述: string };
export type AdversaryData = {
  名称: string; 原文: string; 位阶: string; 种类: string; 特性: AdversaryFeature[]; 类型: string;
  简介: string; 动机与战术: string; 难度: string; 重度伤害阈值: string; 严重伤害阈值: string;
  生命点: string; 压力点: string; 攻击命中: string; 攻击武器: string; 攻击范围: string;
  攻击伤害: string; 攻击属性: string; 经历: string;
};

const defaultData: AdversaryData = {
  名称: "", 原文: "", 位阶: "", 种类: "", 特性: [], 类型: "敌人", 简介: "", 动机与战术: "",
  难度: "", 重度伤害阈值: "", 严重伤害阈值: "", 生命点: "", 压力点: "", 攻击命中: "",
  攻击武器: "", 攻击范围: "", 攻击伤害: "", 攻击属性: "", 经历: "",
};

function normalize(value: string): string { return value.trim().replace(/\s+/g, " "); }

export const adversaryTemplate = deepFreeze<TemplateCoreCapability<AdversaryData>>({
  id: "敌人",
  version: "1.0.0",
  state: "development",
  schema,
  defaultData,
  proposeResourceId(data) {
    return normalize(data.名称 || data.原文 || "未命名敌人").normalize("NFC").replaceAll("/", "-");
  },
  project(data) {
    const title = normalize(data.名称 || data.原文 || "未命名敌人");
    const summary = normalize(data.简介);
    const searchText = [
      data.名称, data.原文, data.位阶, data.种类, data.类型, data.简介, data.动机与战术, data.难度,
      data.重度伤害阈值, data.严重伤害阈值, data.生命点, data.压力点, data.攻击命中, data.攻击武器,
      data.攻击范围, data.攻击伤害, data.攻击属性, data.经历,
      ...data.特性.flatMap((feature) => [feature.名称, feature.原名, feature.类型, feature.特性描述]),
    ].map(normalize).filter(Boolean).join(" ");
    return { title, summary, searchText };
  },
  mediaSlots: [{ id: "portrait", label: "主图", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { width: "63", height: "88", unit: "mm", mode: "split", fixedRatio: true },
  rendererRevision: "enemy-card-r1",
  tabletop: {
    stateSchema: {
      type: "object",
      required: ["currentHp", "currentStress", "focused", "notes"],
      properties: {
        currentHp: { type: "string" }, currentStress: { type: "string" },
        focused: { type: "string", enum: ["true", "false"] }, notes: { type: "string" },
      },
      additionalProperties: false,
    },
    defaultState(data) { return { currentHp: data.生命点, currentStress: "0", focused: "false", notes: "" }; },
    commands: [
      { id: "adjust-hp", capability: "adjust-decimal-string", field: "currentHp" },
      { id: "adjust-stress", capability: "adjust-decimal-string", field: "currentStress" },
      { id: "set-focused", capability: "set-string", field: "focused", values: ["true", "false"] },
      { id: "set-notes", capability: "set-string", field: "notes" },
    ],
    replacements: [{ id: "alternate-form", label: "切换形态" }],
  },
});
