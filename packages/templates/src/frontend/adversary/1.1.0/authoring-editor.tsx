import { adversaryAuthoring as previous } from "../1.0.5/authoring-editor.tsx";
import type { TemplateAuthoringCapability } from "../../types.ts";

export const adversaryAuthoring: TemplateAuthoringCapability = { ...previous, templateVersion: "1.1.0", replacements: "after" };
