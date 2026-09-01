import type { TemplateAuthoringCapability } from "../types.ts";
import { resolveTemplateFrontend, supportedTemplateFrontends } from "../template-frontend-registry.ts";

export const stableReferenceTemplateIds = supportedTemplateFrontends
  .filter((frontend) => frontend.stableReferenceCard)
  .map((frontend) => frontend.templateId) as StableReferenceTemplateId[];
export type StableReferenceTemplateId = "种族" | "社群" | "职业" | "子职业" | "物品" | "领域卡";

export function isStableReferenceTemplateId(id: string): id is StableReferenceTemplateId {
  return stableReferenceTemplateIds.includes(id as StableReferenceTemplateId);
}

export function stableReferenceAuthoringFor(id: string, version: string): TemplateAuthoringCapability | undefined {
  const frontend = resolveTemplateFrontend(id, version);
  return frontend?.stableReferenceCard ? frontend.authoring : undefined;
}

export function stableReferenceRendererFor(id: string, version: string) {
  const frontend = resolveTemplateFrontend(id, version);
  return frontend?.stableReferenceCard ? frontend.rendererRevision : undefined;
}
