import type { TemplateUpgrade } from "../../types.ts";

export const upgradeFrom103: TemplateUpgrade = {
  fromVersion: "1.0.3",
  upgradeData: (data) => structuredClone(data),
};
