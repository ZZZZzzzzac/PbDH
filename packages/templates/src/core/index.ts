import { adversaryTemplate } from "./adversary/1.0.0-alpha.1/capability.ts";
import { TemplateRegistry } from "./registry.ts";

export { adversaryTemplate } from "./adversary/1.0.0-alpha.1/capability.ts";
export type {
  AdversaryData,
  AdversaryFeature,
} from "./adversary/1.0.0-alpha.1/capability.ts";
export { TemplateRegistry } from "./registry.ts";
export type {
  MediaSlot,
  TabletopCommand,
  TemplateCoreCapability,
  TemplateLifecycleState,
  TemplateProjection,
} from "./types.ts";

export const templateRegistry = new TemplateRegistry([
  adversaryTemplate,
]);
