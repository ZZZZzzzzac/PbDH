import { domainAuthoring as previous } from "../1.0.1/authoring-editor.tsx";
import type { TemplateAuthoringCapability } from "../../types.ts";

export const domainAuthoring: TemplateAuthoringCapability = { ...previous, templateVersion: "1.1.0", replacements: "after" };
