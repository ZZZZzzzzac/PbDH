import { adversaryTemplate } from "./adversary/1.0.0-alpha.1/capability.ts";
import { temporaryAncestryTemplate } from "./ancestry/0.0.0-dev.1/capability.ts";
import { temporaryCommunityTemplate } from "./community/0.0.0-dev.1/capability.ts";
import { temporaryDomainTemplate } from "./domain/0.0.0-dev.1/capability.ts";
import { temporaryEnvironmentTemplate } from "./environment/0.0.0-dev.1/capability.ts";
import { temporaryArmorTemplate } from "./armor/0.0.0-dev.1/capability.ts";
import { temporaryItemTemplate } from "./item/0.0.0-dev.1/capability.ts";
import { temporaryProfessionTemplate } from "./profession/0.0.0-dev.1/capability.ts";
import { temporarySubclassTemplate } from "./subclass/0.0.0-dev.1/capability.ts";
import { TemplateRegistry } from "./registry.ts";
import { weaponTemplate } from "./weapon/1.0.0-alpha.1/capability.ts";
import { weaponTemplateV2 } from "./weapon/1.0.0-alpha.2/capability.ts";

export { adversaryTemplate } from "./adversary/1.0.0-alpha.1/capability.ts";
export { temporaryAncestryTemplate } from "./ancestry/0.0.0-dev.1/capability.ts";
export type { TemporaryAncestryData, TemporaryAncestryFeature } from "./ancestry/0.0.0-dev.1/capability.ts";
export { temporaryCommunityTemplate } from "./community/0.0.0-dev.1/capability.ts";
export type { TemporaryCommunityData } from "./community/0.0.0-dev.1/capability.ts";
export { temporaryDomainTemplate } from "./domain/0.0.0-dev.1/capability.ts";
export type { TemporaryDomainData } from "./domain/0.0.0-dev.1/capability.ts";
export { temporaryEnvironmentTemplate } from "./environment/0.0.0-dev.1/capability.ts";
export type { TemporaryEnvironmentData, TemporaryEnvironmentFeature } from "./environment/0.0.0-dev.1/capability.ts";
export { temporaryArmorTemplate } from "./armor/0.0.0-dev.1/capability.ts";
export type { TemporaryArmorData } from "./armor/0.0.0-dev.1/capability.ts";
export { temporaryItemTemplate } from "./item/0.0.0-dev.1/capability.ts";
export type { TemporaryItemData } from "./item/0.0.0-dev.1/capability.ts";
export { temporaryProfessionTemplate } from "./profession/0.0.0-dev.1/capability.ts";
export type { TemporaryProfessionData } from "./profession/0.0.0-dev.1/capability.ts";
export { temporarySubclassTemplate } from "./subclass/0.0.0-dev.1/capability.ts";
export type { TemporarySubclassData } from "./subclass/0.0.0-dev.1/capability.ts";
export type {
  AdversaryData,
  AdversaryFeature,
} from "./adversary/1.0.0-alpha.1/capability.ts";
export { weaponTemplate } from "./weapon/1.0.0-alpha.1/capability.ts";
export type { WeaponData } from "./weapon/1.0.0-alpha.1/capability.ts";
export { weaponTemplateV2 } from "./weapon/1.0.0-alpha.2/capability.ts";
export type { WeaponDataV2 } from "./weapon/1.0.0-alpha.2/capability.ts";
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
  temporaryAncestryTemplate,
  temporaryCommunityTemplate,
  temporaryDomainTemplate,
  temporaryEnvironmentTemplate,
  temporaryArmorTemplate,
  temporaryItemTemplate,
  temporaryProfessionTemplate,
  temporarySubclassTemplate,
  weaponTemplate,
  weaponTemplateV2,
]);
