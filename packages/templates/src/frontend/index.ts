export { adversaryAuthoringLayout } from "./adversary/1.0.0/authoring-layout.ts";
export { armorAuthoringLayout } from "./armor/1.0.0/authoring-layout.ts";
export {
  armorRendererRevision,
  armorRendererStyles,
  type ArmorRuntimeState,
} from "./armor/1.0.0/renderer.tsx";
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
export { adversaryRendererFor, armorRendererFor, freeRendererFor, weaponRendererFor } from "./renderer-registry.ts";
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
