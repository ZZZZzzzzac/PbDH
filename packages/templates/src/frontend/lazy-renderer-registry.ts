import { templateFrontendManifest } from "./template-frontend-manifest.ts";
export { manifestEntryFor as resolveTemplateFrontend } from "./template-frontend-manifest.ts";
export { loadTrustedRenderer, loadTrustedAuthoring } from "./template-loaders.ts";
export { LazyCanonicalCardSurface as CanonicalCardSurface, useTemplateAuthoring, useTemplateCore, TemplateLoadStatus } from "./lazy-surfaces.tsx";
export { TemplateAuthoringSurface } from "./authoring-surface.tsx";

export function listLazyRendererBindings(): readonly string[] {
  return templateFrontendManifest.map((frontend) => `${frontend.templateId}@${frontend.templateVersion}`);
}
