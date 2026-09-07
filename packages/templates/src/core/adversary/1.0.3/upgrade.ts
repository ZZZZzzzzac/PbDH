import type { TemplateUpgrade } from "../../types.ts";

export const upgradeFrom102: TemplateUpgrade = {
  fromVersion: "1.0.2",
  upgradeData: (data) => structuredClone(data),
};
