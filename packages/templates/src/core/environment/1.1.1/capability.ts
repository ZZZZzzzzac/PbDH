import schema from "./schema.json";
import { environmentTemplate as previous } from "../1.1.0/capability.ts";
import { deepFreeze } from "../../types.ts";
export type { EnvironmentData } from "../1.0.3/capability.ts";

// 显式升级启用列表渲染，不修改描述或引导问题原文。
export const environmentTemplate = deepFreeze({
  ...previous,
  version: "1.1.1",
  schema,
  rendererRevision: "environment-card-r6",
  upgrades: [{ fromVersion: "1.1.0", upgradeData: (data: Record<string, unknown>) => structuredClone(data) }],
});
