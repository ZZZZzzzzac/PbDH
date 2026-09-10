import type { ReactNode } from "react";
import { playerCardAuthoring } from "./player-card/1.0.0/authoring-editor.tsx";
import { playerCardRendererRevision } from "./player-card/1.0.0/renderer.tsx";

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
import { adversaryAuthoring as adversaryAuthoring101 } from "./adversary/1.0.1/authoring-editor.tsx";
import { adversaryRendererRevision as adversaryRendererRevision101 } from "./adversary/1.0.1/renderer.tsx";
import { adversaryAuthoring as adversaryAuthoring102 } from "./adversary/1.0.2/authoring-editor.tsx";
import { adversaryRendererRevision as adversaryRendererRevision102 } from "./adversary/1.0.2/renderer.tsx";
import { adversaryAuthoring as adversaryAuthoring103 } from "./adversary/1.0.3/authoring-editor.tsx";
import { adversaryAuthoring as adversaryAuthoring104 } from "./adversary/1.0.4/authoring-editor.tsx";
import { adversaryAuthoring as adversaryAuthoring105 } from "./adversary/1.0.5/authoring-editor.tsx";
import { adversaryRendererRevision as adversaryRendererRevision103 } from "./adversary/1.0.3/renderer.tsx";
import { adversaryRendererRevision as adversaryRendererRevision104 } from "./adversary/1.0.4/renderer.tsx";
import { adversaryRendererRevision as adversaryRendererRevision105 } from "./adversary/1.0.5/renderer.tsx";
import { ancestryAuthoring as ancestryAuthoring101 } from "./ancestry/1.0.1/authoring-editor.tsx";
import { ancestryRendererRevision as ancestryRendererRevision101 } from "./ancestry/1.0.1/renderer.tsx";
import { armorAuthoring as armorAuthoring101 } from "./armor/1.0.1/authoring-editor.tsx";
import { armorRendererRevision as armorRendererRevision101 } from "./armor/1.0.1/renderer.tsx";
import { communityAuthoring as communityAuthoring101 } from "./community/1.0.1/authoring-editor.tsx";
import { communityRendererRevision as communityRendererRevision101 } from "./community/1.0.1/renderer.tsx";
import { domainAuthoring as domainAuthoring101 } from "./domain/1.0.1/authoring-editor.tsx";
import { domainRendererRevision as domainRendererRevision101 } from "./domain/1.0.1/renderer.tsx";
import { environmentAuthoring as environmentAuthoring101 } from "./environment/1.0.1/authoring-editor.tsx";
import { environmentRendererRevision as environmentRendererRevision101 } from "./environment/1.0.1/renderer.tsx";
import { environmentAuthoring as environmentAuthoring102 } from "./environment/1.0.2/authoring-editor.tsx";
import { environmentAuthoring as environmentAuthoring103 } from "./environment/1.0.3/authoring-editor.tsx";
import { environmentRendererRevision as environmentRendererRevision102 } from "./environment/1.0.2/renderer.tsx";
import { environmentRendererRevision as environmentRendererRevision103 } from "./environment/1.0.3/renderer.tsx";
import { freeAuthoring as freeAuthoring101 } from "./free/1.0.1/authoring-editor.tsx";
import { freeRendererRevision as freeRendererRevision101 } from "./free/1.0.1/renderer.tsx";
import { freeAuthoring as freeAuthoring102 } from "./free/1.0.2/authoring-editor.tsx";
import { freeRendererRevision as freeRendererRevision102 } from "./free/1.0.2/renderer.tsx";
import { itemAuthoring as itemAuthoring101 } from "./item/1.0.1/authoring-editor.tsx";
import { itemRendererRevision as itemRendererRevision101 } from "./item/1.0.1/renderer.tsx";
import { professionAuthoring as professionAuthoring101 } from "./profession/1.0.1/authoring-editor.tsx";
import { professionRendererRevision as professionRendererRevision101 } from "./profession/1.0.1/renderer.tsx";
import { subclassAuthoring as subclassAuthoring101 } from "./subclass/1.0.1/authoring-editor.tsx";
import { subclassRendererRevision as subclassRendererRevision101 } from "./subclass/1.0.1/renderer.tsx";
import { weaponAuthoring as weaponAuthoring101 } from "./weapon/1.0.1/authoring-editor.tsx";
import { weaponRendererRevision as weaponRendererRevision101 } from "./weapon/1.0.1/renderer.tsx";
import { manifestEntryFor } from "./template-frontend-manifest.ts";

import { adversaryAuthoring as adversaryAuthoring110 } from "./adversary/1.1.0/authoring-editor.tsx";
import { adversaryRendererRevision as adversaryRendererRevision110 } from "./adversary/1.1.0/renderer.tsx";
import { ancestryAuthoring as ancestryAuthoring110 } from "./ancestry/1.1.0/authoring-editor.tsx";
import { ancestryRendererRevision as ancestryRendererRevision110 } from "./ancestry/1.1.0/renderer.tsx";
import { armorAuthoring as armorAuthoring110 } from "./armor/1.1.0/authoring-editor.tsx";
import { armorRendererRevision as armorRendererRevision110 } from "./armor/1.1.0/renderer.tsx";
import { communityAuthoring as communityAuthoring110 } from "./community/1.1.0/authoring-editor.tsx";
import { communityRendererRevision as communityRendererRevision110 } from "./community/1.1.0/renderer.tsx";
import { domainAuthoring as domainAuthoring110 } from "./domain/1.1.0/authoring-editor.tsx";
import { domainRendererRevision as domainRendererRevision110 } from "./domain/1.1.0/renderer.tsx";
import { environmentAuthoring as environmentAuthoring110 } from "./environment/1.1.0/authoring-editor.tsx";
import { environmentRendererRevision as environmentRendererRevision110 } from "./environment/1.1.0/renderer.tsx";
import { freeAuthoring as freeAuthoring110 } from "./free/1.1.0/authoring-editor.tsx";
import { freeRendererRevision as freeRendererRevision110 } from "./free/1.1.0/renderer.tsx";
import { itemAuthoring as itemAuthoring110 } from "./item/1.1.0/authoring-editor.tsx";
import { itemRendererRevision as itemRendererRevision110 } from "./item/1.1.0/renderer.tsx";
import { professionAuthoring as professionAuthoring110 } from "./profession/1.1.0/authoring-editor.tsx";
import { professionRendererRevision as professionRendererRevision110 } from "./profession/1.1.0/renderer.tsx";
import { subclassAuthoring as subclassAuthoring110 } from "./subclass/1.1.0/authoring-editor.tsx";
import { subclassRendererRevision as subclassRendererRevision110 } from "./subclass/1.1.0/renderer.tsx";
import { weaponAuthoring as weaponAuthoring110 } from "./weapon/1.1.0/authoring-editor.tsx";
import { weaponRendererRevision as weaponRendererRevision110 } from "./weapon/1.1.0/renderer.tsx";

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
  binding(playerCardAuthoring, playerCardRendererRevision),
  binding(adversaryAuthoring110, adversaryRendererRevision110),
  binding(ancestryAuthoring110, ancestryRendererRevision110),
  binding(armorAuthoring110, armorRendererRevision110),
  binding(communityAuthoring110, communityRendererRevision110),
  binding(domainAuthoring110, domainRendererRevision110),
  binding(environmentAuthoring110, environmentRendererRevision110),
  binding(freeAuthoring110, freeRendererRevision110),
  binding(itemAuthoring110, itemRendererRevision110),
  binding(professionAuthoring110, professionRendererRevision110),
  binding(subclassAuthoring110, subclassRendererRevision110),
  binding(weaponAuthoring110, weaponRendererRevision110),
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
  binding(adversaryAuthoring101, adversaryRendererRevision101),
  binding(adversaryAuthoring102, adversaryRendererRevision102),
  binding(adversaryAuthoring103, adversaryRendererRevision103),
  binding(adversaryAuthoring104, adversaryRendererRevision104),
  binding(adversaryAuthoring105, adversaryRendererRevision105),
  binding(ancestryAuthoring101, ancestryRendererRevision101),
  binding(armorAuthoring101, armorRendererRevision101),
  binding(communityAuthoring101, communityRendererRevision101),
  binding(domainAuthoring101, domainRendererRevision101),
  binding(environmentAuthoring101, environmentRendererRevision101),
  binding(environmentAuthoring102, environmentRendererRevision102),
  binding(environmentAuthoring103, environmentRendererRevision103),
  binding(freeAuthoring101, freeRendererRevision101),
  binding(itemAuthoring101, itemRendererRevision101),
  binding(professionAuthoring101, professionRendererRevision101),
  binding(subclassAuthoring101, subclassRendererRevision101),
  binding(weaponAuthoring101, weaponRendererRevision101),
  binding(freeAuthoring102, freeRendererRevision102),
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
