import type { TrustedTemplateRenderer } from "./template-frontend-registry.ts";

export type TemplateFrontendManifestEntry = {
  templateId: string;
  templateVersion: string;
  loadRenderer: () => Promise<TrustedTemplateRenderer>;
  stableReferenceCard: boolean;
};

export const templateFrontendManifest: readonly TemplateFrontendManifestEntry[] = [
  entry("敌人", () => import("./adversary/1.0.0/renderer.tsx").then((module) => module.adversaryRendererRevision)),
  entry("种族", () => import("./ancestry/1.0.0/renderer.tsx").then((module) => module.ancestryRendererRevision), true),
  entry("护甲", () => import("./armor/1.0.0/renderer.tsx").then((module) => module.armorRendererRevision)),
  entry("社群", () => import("./community/1.0.0/renderer.tsx").then((module) => module.communityRendererRevision), true),
  entry("领域卡", () => import("./domain/1.0.0/renderer.tsx").then((module) => module.domainRendererRevision), true),
  entry("环境", () => import("./environment/1.0.0/renderer.tsx").then((module) => module.environmentRendererRevision)),
  entry("自由", () => import("./free/1.0.0/renderer.tsx").then((module) => module.freeRendererRevision)),
  entry("物品", () => import("./item/1.0.0/renderer.tsx").then((module) => module.itemRendererRevision), true),
  entry("职业", () => import("./profession/1.0.0/renderer.tsx").then((module) => module.professionRendererRevision), true),
  entry("子职业", () => import("./subclass/1.0.0/renderer.tsx").then((module) => module.subclassRendererRevision), true),
  entry("武器", () => import("./weapon/1.0.0/renderer.tsx").then((module) => module.weaponRendererRevision)),
];

export function manifestEntryFor(templateId: string, templateVersion: string) {
  return templateFrontendManifest.find((entry) =>
    entry.templateId === templateId && entry.templateVersion === templateVersion);
}

function entry(
  templateId: string,
  loadRenderer: () => Promise<TrustedTemplateRenderer>,
  stableReferenceCard = false,
): TemplateFrontendManifestEntry {
  return { templateId, templateVersion: "1.0.0", loadRenderer, stableReferenceCard };
}
