import type { AuthoringLayout } from "../../types.ts";
import { weaponAuthoringLayout as legacyWeaponAuthoringLayout } from "../1.0.0-alpha.1/authoring-layout.ts";

export const weaponAuthoringLayout: AuthoringLayout = {
  ...legacyWeaponAuthoringLayout,
  templateVersion: "1.0.0",
};
