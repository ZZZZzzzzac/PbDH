import { environmentAuthoring as previous } from "../1.0.3/authoring-editor.tsx";
import type { TemplateAuthoringCapability } from "../../types.ts";

export const environmentAuthoring: TemplateAuthoringCapability = { ...previous, templateVersion: "1.1.0", replacements: "after" };
