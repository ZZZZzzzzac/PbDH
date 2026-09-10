import catalog from "../../catalog.json";
import playerCardState from "./player-card/1.0.0/state-schema.json";
import { deepFreeze, type TemplateCoreCapability } from "./types.ts";

type ValidationMetadata = Pick<TemplateCoreCapability<any>, "id" | "version"> & {
  tabletop: Pick<TemplateCoreCapability<any>["tabletop"], "stateSchema" | "replacements">;
};

const emptyState = { type: "object", properties: {}, additionalProperties: false };
const adversaryState = {
  type: "object", required: ["currentHp", "currentStress", "focused", "notes"],
  properties: {
    currentHp: { type: "string" }, currentStress: { type: "string" },
    focused: { type: "string", enum: ["true", "false"] }, notes: { type: "string" },
  },
  additionalProperties: false,
};

const metadata = new Map<string, ValidationMetadata>(catalog.templates.map((entry) => [
  `${entry.id}@${entry.version}`,
  deepFreeze({ id: entry.id, version: entry.version, tabletop: {
    stateSchema: entry.id === "玩家卡" && entry.version === "1.0.0" ? playerCardState : entry.id === "敌人" ? adversaryState : emptyState,
    replacements: entry.tabletopReplacements ?? [],
  } }),
]));

export function templateValidationMetadata(id: string, version: string): ValidationMetadata | undefined {
  return metadata.get(`${id}@${version}`);
}
