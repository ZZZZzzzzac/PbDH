import schema from "./schema.json";
import { adversaryTemplate as previous } from "../1.1.0/capability.ts";
import { deepFreeze } from "../../types.ts";
export type { AdversaryData } from "../1.0.5/capability.ts";

// 数据保持原样；仅在用户显式升级后启用支持列表的渲染器。
export const adversaryTemplate = deepFreeze({
  ...previous,
  version: "1.1.1",
  schema,
  rendererRevision: "enemy-card-r7",
  upgrades: [{ fromVersion: "1.1.0", upgradeData: (data: Record<string, unknown>) => structuredClone(data) }],
});
