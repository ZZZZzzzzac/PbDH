import { adversaryTemplate as legacyAdversaryTemplate } from "./adversary/1.0.0-alpha.1/capability.ts";
import { adversaryTemplate } from "./adversary/1.0.0/capability.ts";
import { TemplateRegistry } from "./registry.ts";
import { weaponTemplate as legacyWeaponTemplate } from "./weapon/1.0.0-alpha.1/capability.ts";
import { weaponTemplate } from "./weapon/1.0.0/capability.ts";

export { adversaryTemplate } from "./adversary/1.0.0/capability.ts";
export { adversaryTemplate as legacyAdversaryTemplate } from "./adversary/1.0.0-alpha.1/capability.ts";
export type {
  AdversaryData,
  AdversaryFeature,
} from "./adversary/1.0.0/capability.ts";
export { weaponTemplate } from "./weapon/1.0.0/capability.ts";
export { weaponTemplate as legacyWeaponTemplate } from "./weapon/1.0.0-alpha.1/capability.ts";
export type { WeaponData } from "./weapon/1.0.0/capability.ts";
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
  legacyAdversaryTemplate,
  weaponTemplate,
  legacyWeaponTemplate,
]);
