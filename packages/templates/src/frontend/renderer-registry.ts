import type { ReactNode } from "react";

import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";

import { adversaryRendererRevision } from "./adversary/1.0.0/renderer.tsx";
import { freeRendererRevision } from "./free/1.0.0/renderer.tsx";
import { armorRendererRevision } from "./armor/1.0.0/renderer.tsx";
import { ancestryRendererRevision } from "./ancestry/1.0.0/renderer.tsx";
import { communityRendererRevision } from "./community/1.0.0/renderer.tsx";
import { domainRendererRevision } from "./domain/1.0.0/renderer.tsx";
import { environmentRendererRevision } from "./environment/1.0.0/renderer.tsx";
import { itemRendererRevision } from "./item/1.0.0/renderer.tsx";
import { professionRendererRevision } from "./profession/1.0.0/renderer.tsx";
import { subclassRendererRevision } from "./subclass/1.0.0/renderer.tsx";
import { weaponRendererRevision } from "./weapon/1.0.0/renderer.tsx";

type TrustedRenderer = RendererRevisionCapability<any, any, ReactNode>;

const rendererResolvers = new Map<string, (version: string) => TrustedRenderer>();

export function adversaryRendererFor(version: string) {
  if (version === adversaryRendererRevision.templateVersion) {
    return adversaryRendererRevision;
  }
  throw new Error(`Unsupported adversary Renderer version: ${version}`);
}

export function weaponRendererFor(version: string): TrustedRenderer {
  if (version === weaponRendererRevision.templateVersion) {
    return weaponRendererRevision;
  }
  throw new Error(`Unsupported weapon Renderer version: ${version}`);
}

export function freeRendererFor(version: string) {
  if (version === freeRendererRevision.templateVersion) return freeRendererRevision;
  throw new Error(`Unsupported free Renderer version: ${version}`);
}

export function armorRendererFor(version: string) {
  if (version === armorRendererRevision.templateVersion) return armorRendererRevision;
  throw new Error(`Unsupported armor Renderer version: ${version}`);
}

export function ancestryRendererFor(version: string) {
  if (version === ancestryRendererRevision.templateVersion) return ancestryRendererRevision;
  throw new Error(`Unsupported ancestry Renderer version: ${version}`);
}

export function communityRendererFor(version: string) {
  if (version === communityRendererRevision.templateVersion) return communityRendererRevision;
  throw new Error(`Unsupported community Renderer version: ${version}`);
}

export function professionRendererFor(version: string) {
  if (version === professionRendererRevision.templateVersion) return professionRendererRevision;
  throw new Error(`Unsupported profession Renderer version: ${version}`);
}

export function subclassRendererFor(version: string) {
  if (version === subclassRendererRevision.templateVersion) return subclassRendererRevision;
  throw new Error(`Unsupported subclass Renderer version: ${version}`);
}

export function itemRendererFor(version: string) {
  if (version === itemRendererRevision.templateVersion) return itemRendererRevision;
  throw new Error(`Unsupported item Renderer version: ${version}`);
}

export function domainRendererFor(version: string) {
  if (version === domainRendererRevision.templateVersion) return domainRendererRevision;
  throw new Error(`Unsupported domain Renderer version: ${version}`);
}

export function environmentRendererFor(version: string) {
  if (version === environmentRendererRevision.templateVersion) return environmentRendererRevision;
  throw new Error(`Unsupported environment Renderer version: ${version}`);
}

rendererResolvers.set("敌人", adversaryRendererFor);
rendererResolvers.set("武器", weaponRendererFor);
rendererResolvers.set("自由", freeRendererFor);
rendererResolvers.set("护甲", armorRendererFor);
rendererResolvers.set("种族", ancestryRendererFor);
rendererResolvers.set("社群", communityRendererFor);
rendererResolvers.set("职业", professionRendererFor);
rendererResolvers.set("子职业", subclassRendererFor);
rendererResolvers.set("物品", itemRendererFor);
rendererResolvers.set("领域卡", domainRendererFor);
rendererResolvers.set("环境", environmentRendererFor);

export function trustedRendererFor(templateId: string, version: string) {
  const resolve = rendererResolvers.get(templateId);
  if (!resolve) return undefined;
  try {
    return resolve(version);
  } catch {
    return undefined;
  }
}
