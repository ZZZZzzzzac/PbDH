import { adversaryTemplate } from "./adversary/1.0.0/capability.ts";
import { ancestryTemplate } from "./ancestry/1.0.0/capability.ts";
import { armorTemplate } from "./armor/1.0.0/capability.ts";
import { communityTemplate } from "./community/1.0.0/capability.ts";
import { domainTemplate } from "./domain/1.0.0/capability.ts";
import { environmentTemplate } from "./environment/1.0.0/capability.ts";
import { freeTemplate } from "./free/1.0.0/capability.ts";
import { itemTemplate } from "./item/1.0.0/capability.ts";
import { professionTemplate } from "./profession/1.0.0/capability.ts";
import { subclassTemplate } from "./subclass/1.0.0/capability.ts";
import { TemplateRegistry } from "./registry.ts";
import { weaponTemplate } from "./weapon/1.0.0/capability.ts";

export { adversaryTemplate } from "./adversary/1.0.0/capability.ts";
export type {
  AdversaryData,
  AdversaryFeature,
} from "./adversary/1.0.0/capability.ts";
export { ancestryTemplate } from "./ancestry/1.0.0/capability.ts";
export type { AncestryData, AncestryFeature } from "./ancestry/1.0.0/capability.ts";
export { armorTemplate } from "./armor/1.0.0/capability.ts";
export type { ArmorData } from "./armor/1.0.0/capability.ts";
export { communityTemplate } from "./community/1.0.0/capability.ts";
export type { CommunityData } from "./community/1.0.0/capability.ts";
export { domainTemplate } from "./domain/1.0.0/capability.ts";
export type { DomainData } from "./domain/1.0.0/capability.ts";
export { environmentTemplate } from "./environment/1.0.0/capability.ts";
export type { EnvironmentData, EnvironmentFeature } from "./environment/1.0.0/capability.ts";
export { freeTemplate } from "./free/1.0.0/capability.ts";
export type { FreeContentBlock, FreeData } from "./free/1.0.0/capability.ts";
export { itemTemplate } from "./item/1.0.0/capability.ts";
export type { ItemData } from "./item/1.0.0/capability.ts";
export { professionTemplate } from "./profession/1.0.0/capability.ts";
export type { ProfessionData } from "./profession/1.0.0/capability.ts";
export { subclassTemplate } from "./subclass/1.0.0/capability.ts";
export type { SubclassData } from "./subclass/1.0.0/capability.ts";
export { weaponTemplate } from "./weapon/1.0.0/capability.ts";
export type { WeaponData } from "./weapon/1.0.0/capability.ts";
export { TemplateRegistry } from "./registry.ts";
export type {
  MediaSlot,
  TabletopCommand,
  TabletopReplacement,
  TemplateCoreCapability,
  TemplateLifecycleState,
  TemplateProjection,
} from "./types.ts";

export const currentTemplates = Object.freeze([
  adversaryTemplate,
  ancestryTemplate,
  armorTemplate,
  communityTemplate,
  domainTemplate,
  environmentTemplate,
  freeTemplate,
  itemTemplate,
  professionTemplate,
  subclassTemplate,
  weaponTemplate,
]);

export function currentTemplateFor(id: string) {
  return currentTemplates.find((template) => template.id === id);
}

export const templateRegistry = new TemplateRegistry([
  adversaryTemplate,
  ancestryTemplate,
  armorTemplate,
  communityTemplate,
  domainTemplate,
  environmentTemplate,
  freeTemplate,
  itemTemplate,
  professionTemplate,
  subclassTemplate,
  weaponTemplate,
]);
