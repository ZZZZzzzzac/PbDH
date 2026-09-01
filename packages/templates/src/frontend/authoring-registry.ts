import type { AuthoringLayout } from "./types.ts";
import { resolveTemplateFrontend, supportedTemplateFrontends } from "./template-frontend-registry.ts";

export const supportedAuthoringLayouts: readonly AuthoringLayout[] = supportedTemplateFrontends
  .map((frontend) => frontend.authoring.layout);

export function trustedAuthoringLayoutFor(templateId: string, version: string): AuthoringLayout | undefined {
  return resolveTemplateFrontend(templateId, version)?.authoring.layout;
}
