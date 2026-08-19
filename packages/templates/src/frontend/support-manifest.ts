import type { TemplateCoreCapability } from "../core/index.ts";

import type { AuthoringLayout } from "./types.ts";

type AnyTemplate = TemplateCoreCapability<any>;

export type TemplateSupportManifest = {
  templates: Array<{
    id: string;
    version: string;
    rendererRevision: string;
  }>;
};

function hasCompleteCore(template: AnyTemplate): boolean {
  const candidate = template as unknown as Record<string, unknown>;
  const tabletop = candidate.tabletop as Record<string, unknown> | undefined;
  return Boolean(
    candidate.schema
    && candidate.defaultData
    && typeof candidate.proposeResourceId === "function"
    && typeof candidate.project === "function"
    && Array.isArray(candidate.mediaSlots)
    && candidate.defaultPresentation
    && typeof candidate.rendererRevision === "string"
    && tabletop?.stateSchema
    && typeof tabletop.defaultState === "function"
    && Array.isArray(tabletop.commands)
    && Array.isArray(tabletop.replacements)
    && Object.hasOwn(candidate, "upgradeFrom"),
  );
}

export function buildTemplateSupportManifest(input: {
  templates: readonly AnyTemplate[];
  authoringLayouts: readonly AuthoringLayout[];
  rendererRevisions: ReadonlySet<string>;
}): TemplateSupportManifest {
  const layouts = new Set(
    input.authoringLayouts.map((layout) => `${layout.templateId}@${layout.templateVersion}`),
  );
  return {
    templates: input.templates
      .filter((template) =>
        hasCompleteCore(template)
        && layouts.has(`${template.id}@${template.version}`)
        && input.rendererRevisions.has(template.rendererRevision))
      .map((template) => ({
        id: template.id,
        version: template.version,
        rendererRevision: template.rendererRevision,
      }))
      .sort((left, right) => `${left.id}@${left.version}`.localeCompare(`${right.id}@${right.version}`)),
  };
}
