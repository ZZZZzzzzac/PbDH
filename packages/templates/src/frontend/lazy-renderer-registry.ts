import { manifestEntryFor, templateFrontendManifest } from "./template-frontend-manifest.ts";

export function listLazyRendererBindings(): readonly string[] {
  return templateFrontendManifest.map((frontend) => `${frontend.templateId}@${frontend.templateVersion}`);
}

export async function loadTrustedRenderer(
  templateId: string,
  version: string,
) {
  return manifestEntryFor(templateId, version)?.loadRenderer();
}
