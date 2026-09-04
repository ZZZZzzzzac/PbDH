import type { TrustedTemplateRenderer } from "./template-frontend-registry.ts";

export type TemplateFrontendManifestEntry = {
  templateId: string;
  templateVersion: string;
  loadRenderer: () => Promise<TrustedTemplateRenderer>;
  stableReferenceCard: boolean;
};

export const templateFrontendManifest: readonly TemplateFrontendManifestEntry[] = [
  entry("敌人", "1.0.0", () => import("./adversary/1.0.0/renderer.tsx").then((module) => module.adversaryRendererRevision)),
  entry("种族", "1.0.0", () => import("./ancestry/1.0.0/renderer.tsx").then((module) => module.ancestryRendererRevision), true),
  entry("护甲", "1.0.0", () => import("./armor/1.0.0/renderer.tsx").then((module) => module.armorRendererRevision)),
  entry("社群", "1.0.0", () => import("./community/1.0.0/renderer.tsx").then((module) => module.communityRendererRevision), true),
  entry("领域卡", "1.0.0", () => import("./domain/1.0.0/renderer.tsx").then((module) => module.domainRendererRevision), true),
  entry("环境", "1.0.0", () => import("./environment/1.0.0/renderer.tsx").then((module) => module.environmentRendererRevision)),
  entry("自由", "1.0.0", () => import("./free/1.0.0/renderer.tsx").then((module) => module.freeRendererRevision)),
  entry("物品", "1.0.0", () => import("./item/1.0.0/renderer.tsx").then((module) => module.itemRendererRevision), true),
  entry("职业", "1.0.0", () => import("./profession/1.0.0/renderer.tsx").then((module) => module.professionRendererRevision), true),
  entry("子职业", "1.0.0", () => import("./subclass/1.0.0/renderer.tsx").then((module) => module.subclassRendererRevision), true),
  entry("武器", "1.0.0", () => import("./weapon/1.0.0/renderer.tsx").then((module) => module.weaponRendererRevision)),
  entry("敌人", "1.0.1", () => import("./adversary/1.0.1/renderer.tsx").then((module) => module.adversaryRendererRevision)),
  entry("种族", "1.0.1", () => import("./ancestry/1.0.1/renderer.tsx").then((module) => module.ancestryRendererRevision), true),
  entry("护甲", "1.0.1", () => import("./armor/1.0.1/renderer.tsx").then((module) => module.armorRendererRevision)),
  entry("社群", "1.0.1", () => import("./community/1.0.1/renderer.tsx").then((module) => module.communityRendererRevision), true),
  entry("领域卡", "1.0.1", () => import("./domain/1.0.1/renderer.tsx").then((module) => module.domainRendererRevision), true),
  entry("环境", "1.0.1", () => import("./environment/1.0.1/renderer.tsx").then((module) => module.environmentRendererRevision)),
  entry("自由", "1.0.1", () => import("./free/1.0.1/renderer.tsx").then((module) => module.freeRendererRevision)),
  entry("物品", "1.0.1", () => import("./item/1.0.1/renderer.tsx").then((module) => module.itemRendererRevision), true),
  entry("职业", "1.0.1", () => import("./profession/1.0.1/renderer.tsx").then((module) => module.professionRendererRevision), true),
  entry("子职业", "1.0.1", () => import("./subclass/1.0.1/renderer.tsx").then((module) => module.subclassRendererRevision), true),
  entry("武器", "1.0.1", () => import("./weapon/1.0.1/renderer.tsx").then((module) => module.weaponRendererRevision)),
];

export function manifestEntryFor(templateId: string, templateVersion: string) {
  return templateFrontendManifest.find((entry) =>
    entry.templateId === templateId && entry.templateVersion === templateVersion);
}

function entry(
  templateId: string,
  templateVersion: string,
  loadRenderer: () => Promise<TrustedTemplateRenderer>,
  stableReferenceCard = false,
): TemplateFrontendManifestEntry {
  return { templateId, templateVersion, loadRenderer, stableReferenceCard };
}
