import type { TemplateAuthoringCapability } from "./types.ts";
import { resolveTemplateFrontend, supportedTemplateFrontends } from "./template-frontend-registry.ts";

export const supportedAuthoringCapabilities: readonly TemplateAuthoringCapability[] = supportedTemplateFrontends.map((frontend) => frontend.authoring);

export function trustedAuthoringFor(templateId: string, version: string): TemplateAuthoringCapability | undefined {
  return resolveTemplateFrontend(templateId, version)?.authoring;
}
