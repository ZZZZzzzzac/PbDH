import type { TemplateUpgrade } from "../../types.ts";

export const upgradeFrom100: TemplateUpgrade = {
  fromVersion: "1.0.0",
  upgradeData: (data) => structuredClone(data),
};
