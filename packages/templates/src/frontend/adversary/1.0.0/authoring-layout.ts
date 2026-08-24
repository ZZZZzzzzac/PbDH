import type { AuthoringLayout } from "../../types.ts";
import { adversaryAuthoringLayout as legacyAdversaryAuthoringLayout } from "../1.0.0-alpha.1/authoring-layout.ts";

export const adversaryAuthoringLayout: AuthoringLayout = {
  ...legacyAdversaryAuthoringLayout,
  templateVersion: "1.0.0",
};
