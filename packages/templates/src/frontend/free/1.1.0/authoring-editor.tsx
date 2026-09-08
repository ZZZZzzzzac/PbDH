import { freeAuthoring as previous } from "../1.0.2/authoring-editor.tsx";
import type { TemplateAuthoringCapability } from "../../types.ts";

export const freeAuthoring: TemplateAuthoringCapability = { ...previous, templateVersion: "1.1.0", replacements: "after" };
