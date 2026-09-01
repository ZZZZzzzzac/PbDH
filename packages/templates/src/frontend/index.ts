export { adversaryAuthoring, AdversaryAuthoringEditor } from "./adversary/1.0.0/authoring-editor.tsx";
export { ancestryAuthoring, AncestryAuthoringEditor } from "./ancestry/1.0.0/authoring-editor.tsx";
export { armorAuthoring, ArmorAuthoringEditor } from "./armor/1.0.0/authoring-editor.tsx";
export { communityAuthoring, CommunityAuthoringEditor } from "./community/1.0.0/authoring-editor.tsx";
export { domainAuthoring, DomainAuthoringEditor } from "./domain/1.0.0/authoring-editor.tsx";
export { environmentAuthoring, EnvironmentAuthoringEditor } from "./environment/1.0.0/authoring-editor.tsx";
export { freeAuthoring, FreeAuthoringEditor } from "./free/1.0.0/authoring-editor.tsx";
export { itemAuthoring, ItemAuthoringEditor } from "./item/1.0.0/authoring-editor.tsx";
export { professionAuthoring, ProfessionAuthoringEditor } from "./profession/1.0.0/authoring-editor.tsx";
export { subclassAuthoring, SubclassAuthoringEditor } from "./subclass/1.0.0/authoring-editor.tsx";
export { weaponAuthoring, WeaponAuthoringEditor } from "./weapon/1.0.0/authoring-editor.tsx";
export { TemplateAuthoringSurface } from "./authoring-surface.tsx";
export { supportedAuthoringCapabilities, trustedAuthoringFor } from "./authoring-registry.ts";
export {
  resolveTemplateFrontend,
  supportedTemplateFrontends,
  type TemplateFrontendCapability,
  type TrustedTemplateRenderer,
} from "./template-frontend-registry.ts";
export {
  armorRendererRevision,
  armorRendererStyles,
  type ArmorRuntimeState,
} from "./armor/1.0.0/renderer.tsx";
export { ancestryFrameHeight, ancestryRendererRevision, ancestryRendererStyles } from "./ancestry/1.0.0/renderer.tsx";
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
  stableReferenceAuthoringFor,
  stableReferenceRendererFor,
  stableReferenceTemplateIds,
  type StableReferenceTemplateId,
} from "./reference-card/registry.ts";
export {
  adversaryCardRenderSource,
  adversaryRendererRevision,
  adversaryRendererStyles,
  type AdversaryRuntimeState,
} from "./adversary/1.0.0/renderer.tsx";
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
export {
  freeRendererRevision,
  freeRendererStyles,
  type FreeRuntimeState,
} from "./free/1.0.0/renderer.tsx";
export {
  weaponCardRenderSource,
  weaponRendererRevision,
  weaponRendererStyles,
  type WeaponRuntimeState,
} from "./weapon/1.0.0/renderer.tsx";
export type { TemplateAuthoringCapability, TemplateAuthoringEditorProps } from "./types.ts";
