import type { ReactNode } from "react";

import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";

import { adversaryAuthoring } from "./adversary/1.0.0/authoring-layout.ts";
import { adversaryRendererRevision } from "./adversary/1.0.0/renderer.tsx";
import { ancestryAuthoringLayout } from "./ancestry/1.0.0/authoring-layout.ts";
import { ancestryRendererRevision } from "./ancestry/1.0.0/renderer.tsx";
import { armorAuthoringLayout } from "./armor/1.0.0/authoring-layout.ts";
import { armorRendererRevision } from "./armor/1.0.0/renderer.tsx";
import { communityAuthoringLayout } from "./community/1.0.0/authoring-layout.ts";
import { communityRendererRevision } from "./community/1.0.0/renderer.tsx";
import { domainAuthoringLayout } from "./domain/1.0.0/authoring-layout.ts";
import { domainRendererRevision } from "./domain/1.0.0/renderer.tsx";
import { environmentAuthoringLayout } from "./environment/1.0.0/authoring-layout.ts";
import { environmentRendererRevision } from "./environment/1.0.0/renderer.tsx";
import { freeAuthoringLayout } from "./free/1.0.0/authoring-layout.ts";
import { freeRendererRevision } from "./free/1.0.0/renderer.tsx";
import { itemAuthoringLayout } from "./item/1.0.0/authoring-layout.ts";
import { itemRendererRevision } from "./item/1.0.0/renderer.tsx";
import { professionAuthoringLayout } from "./profession/1.0.0/authoring-layout.ts";
import { professionRendererRevision } from "./profession/1.0.0/renderer.tsx";
import { subclassAuthoringLayout } from "./subclass/1.0.0/authoring-layout.ts";
import { subclassRendererRevision } from "./subclass/1.0.0/renderer.tsx";
import type { AuthoringLayout, TemplateAuthoringCapability } from "./types.ts";
import { weaponAuthoringLayout } from "./weapon/1.0.0/authoring-layout.ts";
import { weaponRendererRevision } from "./weapon/1.0.0/renderer.tsx";
import { manifestEntryFor } from "./template-frontend-manifest.ts";

export type TrustedTemplateRenderer = RendererRevisionCapability<any, any, ReactNode>;

export type TemplateFrontendCapability = {
  templateId: string;
  templateVersion: string;
  authoring: TemplateAuthoringCapability;
  rendererRevision: TrustedTemplateRenderer;
  loadRenderer: () => Promise<TrustedTemplateRenderer>;
  stableReferenceCard: boolean;
};

export const supportedTemplateFrontends: readonly TemplateFrontendCapability[] = [
  binding(adversaryAuthoring, adversaryRendererRevision),
  binding(ancestryAuthoringLayout, ancestryRendererRevision),
  binding(armorAuthoringLayout, armorRendererRevision),
  binding(communityAuthoringLayout, communityRendererRevision),
  binding(domainAuthoringLayout, domainRendererRevision),
  binding(environmentAuthoringLayout, environmentRendererRevision),
  binding(freeAuthoringLayout, freeRendererRevision),
  binding(itemAuthoringLayout, itemRendererRevision),
  binding(professionAuthoringLayout, professionRendererRevision),
  binding(subclassAuthoringLayout, subclassRendererRevision),
  binding(weaponAuthoringLayout, weaponRendererRevision),
];

const frontendsByKey = new Map(supportedTemplateFrontends.map((frontend) => [
  `${frontend.templateId}@${frontend.templateVersion}`,
  frontend,
]));

export function resolveTemplateFrontend(
  templateId: string,
  templateVersion: string,
): TemplateFrontendCapability | undefined {
  return frontendsByKey.get(`${templateId}@${templateVersion}`);
}

function binding(
  authoring: AuthoringLayout | TemplateAuthoringCapability,
  rendererRevision: TrustedTemplateRenderer,
): TemplateFrontendCapability {
  const capability: TemplateAuthoringCapability = "layout" in authoring
    ? authoring
    : { layout: authoring, previewControls: [] };
  const authoringLayout = capability.layout;
  if (authoringLayout.templateId !== rendererRevision.templateId
    || authoringLayout.templateVersion !== rendererRevision.templateVersion) {
    throw new Error(`Template frontend binding mismatch: ${authoringLayout.templateId}@${authoringLayout.templateVersion}`);
  }
  const manifest = manifestEntryFor(authoringLayout.templateId, authoringLayout.templateVersion);
  if (!manifest) throw new Error(`Template frontend manifest missing: ${authoringLayout.templateId}@${authoringLayout.templateVersion}`);
  return {
    templateId: authoringLayout.templateId,
    templateVersion: authoringLayout.templateVersion,
    authoring: capability,
    rendererRevision,
    loadRenderer: manifest.loadRenderer,
    stableReferenceCard: manifest.stableReferenceCard,
  };
}
