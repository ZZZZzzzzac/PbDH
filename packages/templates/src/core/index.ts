import { adversaryTemplate as legacyAdversaryTemplate } from "./adversary/1.0.0-alpha.1/capability.ts";
import { adversaryTemplate } from "./adversary/1.0.0/capability.ts";
import { temporaryAncestryTemplate } from "./ancestry/0.0.0-dev.1/capability.ts";
import { ancestryTemplate } from "./ancestry/1.0.0/capability.ts";
import { temporaryArmorTemplate } from "./armor/0.0.0-dev.1/capability.ts";
import { armorTemplate } from "./armor/1.0.0/capability.ts";
import { temporaryCommunityTemplate } from "./community/0.0.0-dev.1/capability.ts";
import { communityTemplate } from "./community/1.0.0/capability.ts";
import { temporaryDomainTemplate } from "./domain/0.0.0-dev.1/capability.ts";
import { domainTemplate } from "./domain/1.0.0/capability.ts";
import { temporaryEnvironmentTemplate } from "./environment/0.0.0-dev.1/capability.ts";
import { environmentTemplate } from "./environment/1.0.0/capability.ts";
import { freeTemplate } from "./free/1.0.0/capability.ts";
import { temporaryItemTemplate } from "./item/0.0.0-dev.1/capability.ts";
import { itemTemplate } from "./item/1.0.0/capability.ts";
import { temporaryProfessionTemplate } from "./profession/0.0.0-dev.1/capability.ts";
import { professionTemplate } from "./profession/1.0.0/capability.ts";
import { temporarySubclassTemplate } from "./subclass/0.0.0-dev.1/capability.ts";
import { subclassTemplate } from "./subclass/1.0.0/capability.ts";
import { TemplateRegistry } from "./registry.ts";
import { weaponTemplate as legacyWeaponTemplate } from "./weapon/1.0.0-alpha.1/capability.ts";
import { weaponTemplateV2 } from "./weapon/1.0.0-alpha.2/capability.ts";
import { weaponTemplate } from "./weapon/1.0.0/capability.ts";

export { adversaryTemplate as legacyAdversaryTemplate } from "./adversary/1.0.0-alpha.1/capability.ts";
export { adversaryTemplate } from "./adversary/1.0.0/capability.ts";
export type {
  AdversaryData,
  AdversaryFeature,
} from "./adversary/1.0.0/capability.ts";
export { temporaryAncestryTemplate } from "./ancestry/0.0.0-dev.1/capability.ts";
export type { TemporaryAncestryData, TemporaryAncestryFeature } from "./ancestry/0.0.0-dev.1/capability.ts";
export { ancestryTemplate } from "./ancestry/1.0.0/capability.ts";
export type { AncestryData, AncestryFeature } from "./ancestry/1.0.0/capability.ts";
export { temporaryArmorTemplate } from "./armor/0.0.0-dev.1/capability.ts";
export type { TemporaryArmorData } from "./armor/0.0.0-dev.1/capability.ts";
export { armorTemplate } from "./armor/1.0.0/capability.ts";
export type { ArmorData } from "./armor/1.0.0/capability.ts";
export { temporaryCommunityTemplate } from "./community/0.0.0-dev.1/capability.ts";
export type { TemporaryCommunityData } from "./community/0.0.0-dev.1/capability.ts";
export { communityTemplate } from "./community/1.0.0/capability.ts";
export type { CommunityData } from "./community/1.0.0/capability.ts";
export { temporaryDomainTemplate } from "./domain/0.0.0-dev.1/capability.ts";
export type { TemporaryDomainData } from "./domain/0.0.0-dev.1/capability.ts";
export { domainTemplate } from "./domain/1.0.0/capability.ts";
export type { DomainData } from "./domain/1.0.0/capability.ts";
export { temporaryEnvironmentTemplate } from "./environment/0.0.0-dev.1/capability.ts";
export type { TemporaryEnvironmentData, TemporaryEnvironmentFeature } from "./environment/0.0.0-dev.1/capability.ts";
export { environmentTemplate } from "./environment/1.0.0/capability.ts";
export type { EnvironmentData, EnvironmentFeature } from "./environment/1.0.0/capability.ts";
export { freeTemplate } from "./free/1.0.0/capability.ts";
export type { FreeContentBlock, FreeData } from "./free/1.0.0/capability.ts";
export { temporaryItemTemplate } from "./item/0.0.0-dev.1/capability.ts";
export type { TemporaryItemData } from "./item/0.0.0-dev.1/capability.ts";
export { itemTemplate } from "./item/1.0.0/capability.ts";
export type { ItemData } from "./item/1.0.0/capability.ts";
export { temporaryProfessionTemplate } from "./profession/0.0.0-dev.1/capability.ts";
export type { TemporaryProfessionData } from "./profession/0.0.0-dev.1/capability.ts";
export { professionTemplate } from "./profession/1.0.0/capability.ts";
export type { ProfessionData } from "./profession/1.0.0/capability.ts";
export { temporarySubclassTemplate } from "./subclass/0.0.0-dev.1/capability.ts";
export type { TemporarySubclassData } from "./subclass/0.0.0-dev.1/capability.ts";
export { subclassTemplate } from "./subclass/1.0.0/capability.ts";
export type { SubclassData } from "./subclass/1.0.0/capability.ts";
export { weaponTemplate as legacyWeaponTemplate } from "./weapon/1.0.0-alpha.1/capability.ts";
export { weaponTemplateV2 } from "./weapon/1.0.0-alpha.2/capability.ts";
export type { WeaponDataV2 } from "./weapon/1.0.0-alpha.2/capability.ts";
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

export const templateRegistry = new TemplateRegistry([
  adversaryTemplate,
  legacyAdversaryTemplate,
  temporaryAncestryTemplate,
  ancestryTemplate,
  temporaryArmorTemplate,
  armorTemplate,
  temporaryCommunityTemplate,
  communityTemplate,
  temporaryDomainTemplate,
  domainTemplate,
  temporaryEnvironmentTemplate,
  environmentTemplate,
  freeTemplate,
  temporaryItemTemplate,
  itemTemplate,
  temporaryProfessionTemplate,
  professionTemplate,
  temporarySubclassTemplate,
  subclassTemplate,
  weaponTemplate,
  legacyWeaponTemplate,
  weaponTemplateV2,
]);
