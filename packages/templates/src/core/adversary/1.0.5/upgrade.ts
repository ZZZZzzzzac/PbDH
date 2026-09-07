import type { TemplateUpgrade } from "../../types.ts";

export const upgradeFrom104: TemplateUpgrade = {
  fromVersion: "1.0.4",
  upgradeData: (data) => structuredClone(data),
};
