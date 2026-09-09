import type { TrustedTemplateRenderer } from "./template-frontend-registry.ts";
import type { TemplateAuthoringCapability } from "./types.ts";

export type TemplateFrontendManifestEntry = {
  templateId: string;
  templateVersion: string;
  loadRenderer: () => Promise<TrustedTemplateRenderer>;
  loadAuthoring: () => Promise<TemplateAuthoringCapability>;
  stableReferenceCard: boolean;
};

export const templateFrontendManifest: readonly TemplateFrontendManifestEntry[] = [
  entry("敌人", "1.1.0", () => import("./adversary/1.1.0/renderer.tsx").then((module) => module.adversaryRendererRevision), () => import("./adversary/1.1.0/authoring-editor.tsx").then((module) => module.adversaryAuthoring)),
  entry("种族", "1.1.0", () => import("./ancestry/1.1.0/renderer.tsx").then((module) => module.ancestryRendererRevision), () => import("./ancestry/1.1.0/authoring-editor.tsx").then((module) => module.ancestryAuthoring), true),
  entry("护甲", "1.1.0", () => import("./armor/1.1.0/renderer.tsx").then((module) => module.armorRendererRevision), () => import("./armor/1.1.0/authoring-editor.tsx").then((module) => module.armorAuthoring)),
  entry("社群", "1.1.0", () => import("./community/1.1.0/renderer.tsx").then((module) => module.communityRendererRevision), () => import("./community/1.1.0/authoring-editor.tsx").then((module) => module.communityAuthoring), true),
  entry("领域卡", "1.1.0", () => import("./domain/1.1.0/renderer.tsx").then((module) => module.domainRendererRevision), () => import("./domain/1.1.0/authoring-editor.tsx").then((module) => module.domainAuthoring), true),
  entry("环境", "1.1.0", () => import("./environment/1.1.0/renderer.tsx").then((module) => module.environmentRendererRevision), () => import("./environment/1.1.0/authoring-editor.tsx").then((module) => module.environmentAuthoring)),
  entry("自由", "1.1.0", () => import("./free/1.1.0/renderer.tsx").then((module) => module.freeRendererRevision), () => import("./free/1.1.0/authoring-editor.tsx").then((module) => module.freeAuthoring)),
  entry("物品", "1.1.0", () => import("./item/1.1.0/renderer.tsx").then((module) => module.itemRendererRevision), () => import("./item/1.1.0/authoring-editor.tsx").then((module) => module.itemAuthoring), true),
  entry("职业", "1.1.0", () => import("./profession/1.1.0/renderer.tsx").then((module) => module.professionRendererRevision), () => import("./profession/1.1.0/authoring-editor.tsx").then((module) => module.professionAuthoring), true),
  entry("子职业", "1.1.0", () => import("./subclass/1.1.0/renderer.tsx").then((module) => module.subclassRendererRevision), () => import("./subclass/1.1.0/authoring-editor.tsx").then((module) => module.subclassAuthoring), true),
  entry("武器", "1.1.0", () => import("./weapon/1.1.0/renderer.tsx").then((module) => module.weaponRendererRevision), () => import("./weapon/1.1.0/authoring-editor.tsx").then((module) => module.weaponAuthoring)),
  entry("敌人", "1.0.0", () => import("./adversary/1.0.0/renderer.tsx").then((module) => module.adversaryRendererRevision), () => import("./adversary/1.0.0/authoring-editor.tsx").then((module) => module.adversaryAuthoring)),
  entry("种族", "1.0.0", () => import("./ancestry/1.0.0/renderer.tsx").then((module) => module.ancestryRendererRevision), () => import("./ancestry/1.0.0/authoring-editor.tsx").then((module) => module.ancestryAuthoring), true),
  entry("护甲", "1.0.0", () => import("./armor/1.0.0/renderer.tsx").then((module) => module.armorRendererRevision), () => import("./armor/1.0.0/authoring-editor.tsx").then((module) => module.armorAuthoring)),
  entry("社群", "1.0.0", () => import("./community/1.0.0/renderer.tsx").then((module) => module.communityRendererRevision), () => import("./community/1.0.0/authoring-editor.tsx").then((module) => module.communityAuthoring), true),
  entry("领域卡", "1.0.0", () => import("./domain/1.0.0/renderer.tsx").then((module) => module.domainRendererRevision), () => import("./domain/1.0.0/authoring-editor.tsx").then((module) => module.domainAuthoring), true),
  entry("环境", "1.0.0", () => import("./environment/1.0.0/renderer.tsx").then((module) => module.environmentRendererRevision), () => import("./environment/1.0.0/authoring-editor.tsx").then((module) => module.environmentAuthoring)),
  entry("自由", "1.0.0", () => import("./free/1.0.0/renderer.tsx").then((module) => module.freeRendererRevision), () => import("./free/1.0.0/authoring-editor.tsx").then((module) => module.freeAuthoring)),
  entry("物品", "1.0.0", () => import("./item/1.0.0/renderer.tsx").then((module) => module.itemRendererRevision), () => import("./item/1.0.0/authoring-editor.tsx").then((module) => module.itemAuthoring), true),
  entry("职业", "1.0.0", () => import("./profession/1.0.0/renderer.tsx").then((module) => module.professionRendererRevision), () => import("./profession/1.0.0/authoring-editor.tsx").then((module) => module.professionAuthoring), true),
  entry("子职业", "1.0.0", () => import("./subclass/1.0.0/renderer.tsx").then((module) => module.subclassRendererRevision), () => import("./subclass/1.0.0/authoring-editor.tsx").then((module) => module.subclassAuthoring), true),
  entry("武器", "1.0.0", () => import("./weapon/1.0.0/renderer.tsx").then((module) => module.weaponRendererRevision), () => import("./weapon/1.0.0/authoring-editor.tsx").then((module) => module.weaponAuthoring)),
  entry("敌人", "1.0.1", () => import("./adversary/1.0.1/renderer.tsx").then((module) => module.adversaryRendererRevision), () => import("./adversary/1.0.1/authoring-editor.tsx").then((module) => module.adversaryAuthoring)),
  entry("敌人", "1.0.2", () => import("./adversary/1.0.2/renderer.tsx").then((module) => module.adversaryRendererRevision), () => import("./adversary/1.0.2/authoring-editor.tsx").then((module) => module.adversaryAuthoring)),
  entry("敌人", "1.0.3", () => import("./adversary/1.0.3/renderer.tsx").then((module) => module.adversaryRendererRevision), () => import("./adversary/1.0.3/authoring-editor.tsx").then((module) => module.adversaryAuthoring)),
  entry("敌人", "1.0.4", () => import("./adversary/1.0.4/renderer.tsx").then((module) => module.adversaryRendererRevision), () => import("./adversary/1.0.4/authoring-editor.tsx").then((module) => module.adversaryAuthoring)),
  entry("敌人", "1.0.5", () => import("./adversary/1.0.5/renderer.tsx").then((module) => module.adversaryRendererRevision), () => import("./adversary/1.0.5/authoring-editor.tsx").then((module) => module.adversaryAuthoring)),
  entry("种族", "1.0.1", () => import("./ancestry/1.0.1/renderer.tsx").then((module) => module.ancestryRendererRevision), () => import("./ancestry/1.0.1/authoring-editor.tsx").then((module) => module.ancestryAuthoring), true),
  entry("护甲", "1.0.1", () => import("./armor/1.0.1/renderer.tsx").then((module) => module.armorRendererRevision), () => import("./armor/1.0.1/authoring-editor.tsx").then((module) => module.armorAuthoring)),
  entry("社群", "1.0.1", () => import("./community/1.0.1/renderer.tsx").then((module) => module.communityRendererRevision), () => import("./community/1.0.1/authoring-editor.tsx").then((module) => module.communityAuthoring), true),
  entry("领域卡", "1.0.1", () => import("./domain/1.0.1/renderer.tsx").then((module) => module.domainRendererRevision), () => import("./domain/1.0.1/authoring-editor.tsx").then((module) => module.domainAuthoring), true),
  entry("环境", "1.0.1", () => import("./environment/1.0.1/renderer.tsx").then((module) => module.environmentRendererRevision), () => import("./environment/1.0.1/authoring-editor.tsx").then((module) => module.environmentAuthoring)),
  entry("环境", "1.0.2", () => import("./environment/1.0.2/renderer.tsx").then((module) => module.environmentRendererRevision), () => import("./environment/1.0.2/authoring-editor.tsx").then((module) => module.environmentAuthoring)),
  entry("环境", "1.0.3", () => import("./environment/1.0.3/renderer.tsx").then((module) => module.environmentRendererRevision), () => import("./environment/1.0.3/authoring-editor.tsx").then((module) => module.environmentAuthoring)),
  entry("自由", "1.0.1", () => import("./free/1.0.1/renderer.tsx").then((module) => module.freeRendererRevision), () => import("./free/1.0.1/authoring-editor.tsx").then((module) => module.freeAuthoring)),
  entry("物品", "1.0.1", () => import("./item/1.0.1/renderer.tsx").then((module) => module.itemRendererRevision), () => import("./item/1.0.1/authoring-editor.tsx").then((module) => module.itemAuthoring), true),
  entry("职业", "1.0.1", () => import("./profession/1.0.1/renderer.tsx").then((module) => module.professionRendererRevision), () => import("./profession/1.0.1/authoring-editor.tsx").then((module) => module.professionAuthoring), true),
  entry("子职业", "1.0.1", () => import("./subclass/1.0.1/renderer.tsx").then((module) => module.subclassRendererRevision), () => import("./subclass/1.0.1/authoring-editor.tsx").then((module) => module.subclassAuthoring), true),
  entry("武器", "1.0.1", () => import("./weapon/1.0.1/renderer.tsx").then((module) => module.weaponRendererRevision), () => import("./weapon/1.0.1/authoring-editor.tsx").then((module) => module.weaponAuthoring)),
  entry("自由", "1.0.2", () => import("./free/1.0.2/renderer.tsx").then((module) => module.freeRendererRevision), () => import("./free/1.0.2/authoring-editor.tsx").then((module) => module.freeAuthoring)),
];

export function manifestEntryFor(templateId: string, templateVersion: string) {
  return templateFrontendManifest.find((entry) =>
    entry.templateId === templateId && entry.templateVersion === templateVersion);
}

function entry(
  templateId: string,
  templateVersion: string,
  loadRenderer: () => Promise<TrustedTemplateRenderer>,
  loadAuthoring: () => Promise<TemplateAuthoringCapability>,
  stableReferenceCard = false,
): TemplateFrontendManifestEntry {
  return { templateId, templateVersion, loadRenderer, loadAuthoring, stableReferenceCard };
}
