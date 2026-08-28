export { adversaryAuthoringLayout } from "./adversary/1.0.0/authoring-layout.ts";
export { armorAuthoringLayout } from "./armor/1.0.0/authoring-layout.ts";
export { ancestryAuthoringLayout } from "./ancestry/1.0.0/authoring-layout.ts";
export { communityAuthoringLayout } from "./community/1.0.0/authoring-layout.ts";
export { domainAuthoringLayout } from "./domain/1.0.0/authoring-layout.ts";
export { environmentAuthoringLayout } from "./environment/1.0.0/authoring-layout.ts";
export { itemAuthoringLayout } from "./item/1.0.0/authoring-layout.ts";
export { professionAuthoringLayout } from "./profession/1.0.0/authoring-layout.ts";
export { subclassAuthoringLayout } from "./subclass/1.0.0/authoring-layout.ts";
export {
  armorRendererRevision,
  armorRendererStyles,
  type ArmorRuntimeState,
} from "./armor/1.0.0/renderer.tsx";
export { ancestryRendererRevision, ancestryRendererStyles } from "./ancestry/1.0.0/renderer.tsx";
export { communityRendererRevision, communityRendererStyles } from "./community/1.0.0/renderer.tsx";
export { domainRendererRevision, domainRendererStyles } from "./domain/1.0.0/renderer.tsx";
export {
  environmentRendererRevision,
  environmentRendererStyles,
  type EnvironmentRuntimeState,
} from "./environment/1.0.0/renderer.tsx";
export { itemRendererRevision, itemRendererStyles } from "./item/1.0.0/renderer.tsx";
export { professionRendererRevision, professionRendererStyles } from "./profession/1.0.0/renderer.tsx";
export { subclassRendererRevision, subclassRendererStyles } from "./subclass/1.0.0/renderer.tsx";
export {
  isStableReferenceTemplateId,
  stableReferenceAuthoringLayoutFor,
  stableReferenceRendererFor,
  stableReferenceTemplateIds,
  type StableReferenceTemplateId,
} from "./reference-card/registry.ts";
export { adversaryAuthoringLayout as legacyAdversaryAuthoringLayout } from "./adversary/1.0.0-alpha.1/authoring-layout.ts";
export {
  adversaryCardDesignSource,
  adversaryRendererRevision,
  adversaryRendererStyles,
  type AdversaryRuntimeState,
} from "./adversary/1.0.0/renderer.tsx";
export { adversaryRendererRevision as legacyAdversaryRendererRevision } from "./adversary/1.0.0-alpha.1/renderer.tsx";
export {
  buildTemplateSupportManifest,
  type TemplateSupportManifest,
} from "./support-manifest.ts";
export {
  adversaryRendererFor,
  ancestryRendererFor,
  armorRendererFor,
  communityRendererFor,
  domainRendererFor,
  environmentRendererFor,
  freeRendererFor,
  itemRendererFor,
  professionRendererFor,
  subclassRendererFor,
  trustedRendererFor,
  weaponRendererFor,
} from "./renderer-registry.ts";
export { freeAuthoringLayout } from "./free/1.0.0/authoring-layout.ts";
export {
  freeRendererRevision,
  freeRendererStyles,
  type FreeRuntimeState,
} from "./free/1.0.0/renderer.tsx";
export { weaponAuthoringLayout } from "./weapon/1.0.0/authoring-layout.ts";
export { weaponAuthoringLayout as legacyWeaponAuthoringLayout } from "./weapon/1.0.0-alpha.1/authoring-layout.ts";
export {
  weaponCardDesignSource,
  weaponRendererRevision,
  weaponRendererStyles,
  type WeaponRuntimeState,
} from "./weapon/1.0.0/renderer.tsx";
export { weaponRendererRevision as legacyWeaponRendererRevision } from "./weapon/1.0.0-alpha.1/renderer.tsx";
export { weaponAuthoringLayoutV2 } from "./weapon/1.0.0-alpha.2/authoring-layout.ts";
export {
  weaponCardDesignSourceV2,
  weaponRendererRevisionV2,
  weaponRendererStylesV2,
  type WeaponRuntimeStateV2,
} from "./weapon/1.0.0-alpha.2/renderer.tsx";
export type {
  AuthoringControl,
  AuthoringField,
  AuthoringLayout,
  AuthoringRepeat,
  AuthoringSection,
} from "./types.ts";
