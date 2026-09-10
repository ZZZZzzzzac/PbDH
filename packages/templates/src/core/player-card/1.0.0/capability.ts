import schema from "./schema.json";
import stateSchema from "./state-schema.json";
import { sharedTabletopReplacements } from "../../shared-replacements.ts";
import { deepFreeze, type TemplateCoreCapability } from "../../types.ts";

export type PlayerCardData = {
  名称: string; 类型: string; 玩家名: string;
  生命上限: string; 压力上限: string; 希望上限: string; 护甲槽上限: string; 备注: string;
};

export type PlayerCardState = {
  currentHp: string; currentStress: string; currentHope: string; currentArmor: string; notes: string;
};

export const playerCardTracks = deepFreeze([
  { label: "生命", meaning: "已标记", maximum: "生命上限", field: "currentHp", command: "hp" },
  { label: "压力", meaning: "已标记", maximum: "压力上限", field: "currentStress", command: "stress" },
  { label: "希望", meaning: "当前", maximum: "希望上限", field: "currentHope", command: "hope" },
  { label: "护甲槽", meaning: "已标记", maximum: "护甲槽上限", field: "currentArmor", command: "armor" },
] as const);

const normalize = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

export const playerCardTemplate = deepFreeze<TemplateCoreCapability<PlayerCardData>>({
  id: "玩家卡",
  version: "1.0.0",
  state: "published",
  schema,
  defaultData: { 名称: "", 类型: "玩家卡", 玩家名: "", 生命上限: "6", 压力上限: "6", 希望上限: "6", 护甲槽上限: "0", 备注: "" },
  proposeResourceId(data) { return normalize(data.名称 || "未命名玩家卡").normalize("NFC").replaceAll("/", "-"); },
  project(data) {
    return {
      title: normalize(data.名称 || "未命名玩家卡"),
      summary: normalize([data.玩家名, data.备注].filter(Boolean).join(" · ")),
      searchText: Object.values(data).map(normalize).filter(Boolean).join(" "),
    };
  },
  mediaSlots: [{ id: "portrait", label: "肖像", required: false, accepts: ["image/webp"] }],
  defaultPresentation: { mode: "text", fixedRatio: false },
  rendererRevision: "player-card-r1",
  tabletop: {
    stateSchema,
    defaultState(data): PlayerCardState { return { currentHp: "0", currentStress: "0", currentHope: "0", currentArmor: "0", notes: data.备注 }; },
    commands: [
      ...playerCardTracks.flatMap((track) => [
        { id: `adjust-${track.command}`, capability: "adjust-decimal-string" as const, field: track.field },
        { id: `set-${track.command}`, capability: "set-string" as const, field: track.field },
      ]),
      { id: "set-notes", capability: "set-string", field: "notes" },
    ],
    replacements: sharedTabletopReplacements,
  },
});
