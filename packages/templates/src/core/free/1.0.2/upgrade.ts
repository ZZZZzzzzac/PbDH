import type { TemplateUpgrade } from "../../types.ts";

export const upgradeFrom101: TemplateUpgrade = {
  fromVersion: "1.0.1",
  upgradeData: (data) => structuredClone(data),
};
