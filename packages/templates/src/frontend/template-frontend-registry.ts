import type { ReactNode } from "react";

import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";

import { adversaryAuthoring } from "./adversary/1.0.0/authoring-editor.tsx";
import { adversaryRendererRevision } from "./adversary/1.0.0/renderer.tsx";
import { ancestryAuthoring } from "./ancestry/1.0.0/authoring-editor.tsx";
import { ancestryRendererRevision } from "./ancestry/1.0.0/renderer.tsx";
import { armorAuthoring } from "./armor/1.0.0/authoring-editor.tsx";
import { armorRendererRevision } from "./armor/1.0.0/renderer.tsx";
import { communityAuthoring } from "./community/1.0.0/authoring-editor.tsx";
import { communityRendererRevision } from "./community/1.0.0/renderer.tsx";
import { domainAuthoring } from "./domain/1.0.0/authoring-editor.tsx";
import { domainRendererRevision } from "./domain/1.0.0/renderer.tsx";
import { environmentAuthoring } from "./environment/1.0.0/authoring-editor.tsx";
import { environmentRendererRevision } from "./environment/1.0.0/renderer.tsx";
import { freeAuthoring } from "./free/1.0.0/authoring-editor.tsx";
import { freeRendererRevision } from "./free/1.0.0/renderer.tsx";
import { itemAuthoring } from "./item/1.0.0/authoring-editor.tsx";
import { itemRendererRevision } from "./item/1.0.0/renderer.tsx";
import { professionAuthoring } from "./profession/1.0.0/authoring-editor.tsx";
import { professionRendererRevision } from "./profession/1.0.0/renderer.tsx";
import { subclassAuthoring } from "./subclass/1.0.0/authoring-editor.tsx";
import { subclassRendererRevision } from "./subclass/1.0.0/renderer.tsx";
import type { TemplateAuthoringCapability } from "./types.ts";
import { weaponAuthoring } from "./weapon/1.0.0/authoring-editor.tsx";
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
  binding(ancestryAuthoring, ancestryRendererRevision),
  binding(armorAuthoring, armorRendererRevision),
  binding(communityAuthoring, communityRendererRevision),
  binding(domainAuthoring, domainRendererRevision),
  binding(environmentAuthoring, environmentRendererRevision),
  binding(freeAuthoring, freeRendererRevision),
  binding(itemAuthoring, itemRendererRevision),
  binding(professionAuthoring, professionRendererRevision),
  binding(subclassAuthoring, subclassRendererRevision),
  binding(weaponAuthoring, weaponRendererRevision),
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
  authoring: TemplateAuthoringCapability,
  rendererRevision: TrustedTemplateRenderer,
): TemplateFrontendCapability {
  if (authoring.templateId !== rendererRevision.templateId
    || authoring.templateVersion !== rendererRevision.templateVersion) {
    throw new Error(`Template frontend binding mismatch: ${authoring.templateId}@${authoring.templateVersion}`);
  }
  const manifest = manifestEntryFor(authoring.templateId, authoring.templateVersion);
  if (!manifest) throw new Error(`Template frontend manifest missing: ${authoring.templateId}@${authoring.templateVersion}`);
  return {
    templateId: authoring.templateId,
    templateVersion: authoring.templateVersion,
    authoring,
    rendererRevision,
    loadRenderer: manifest.loadRenderer,
    stableReferenceCard: manifest.stableReferenceCard,
  };
}
