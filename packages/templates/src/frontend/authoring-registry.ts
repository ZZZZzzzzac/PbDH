import { adversaryAuthoringLayout } from "./adversary/1.0.0/authoring-layout.ts";
import { ancestryAuthoringLayout } from "./ancestry/1.0.0/authoring-layout.ts";
import { armorAuthoringLayout } from "./armor/1.0.0/authoring-layout.ts";
import { communityAuthoringLayout } from "./community/1.0.0/authoring-layout.ts";
import { domainAuthoringLayout } from "./domain/1.0.0/authoring-layout.ts";
import { environmentAuthoringLayout } from "./environment/1.0.0/authoring-layout.ts";
import { freeAuthoringLayout } from "./free/1.0.0/authoring-layout.ts";
import { itemAuthoringLayout } from "./item/1.0.0/authoring-layout.ts";
import { professionAuthoringLayout } from "./profession/1.0.0/authoring-layout.ts";
import { subclassAuthoringLayout } from "./subclass/1.0.0/authoring-layout.ts";
import type { AuthoringLayout } from "./types.ts";
import { weaponAuthoringLayout } from "./weapon/1.0.0/authoring-layout.ts";

export const supportedAuthoringLayouts: readonly AuthoringLayout[] = [
  adversaryAuthoringLayout,
  ancestryAuthoringLayout,
  armorAuthoringLayout,
  communityAuthoringLayout,
  domainAuthoringLayout,
  environmentAuthoringLayout,
  freeAuthoringLayout,
  itemAuthoringLayout,
  professionAuthoringLayout,
  subclassAuthoringLayout,
  weaponAuthoringLayout,
];

const authoringLayouts = new Map(supportedAuthoringLayouts.map((layout) => [
  `${layout.templateId}@${layout.templateVersion}`,
  layout,
]));

export function trustedAuthoringLayoutFor(templateId: string, version: string): AuthoringLayout | undefined {
  return authoringLayouts.get(`${templateId}@${version}`);
}
