import type { ReactNode } from "react";

import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";

import { resolveTemplateFrontend } from "./template-frontend-registry.ts";

type TrustedRenderer = RendererRevisionCapability<any, any, ReactNode>;

export function adversaryRendererFor(version: string) {
  return rendererFor("敌人", version, "adversary");
}

export function weaponRendererFor(version: string): TrustedRenderer {
  return rendererFor("武器", version, "weapon");
}

export function freeRendererFor(version: string) {
  return rendererFor("自由", version, "free");
}

export function armorRendererFor(version: string) {
  return rendererFor("护甲", version, "armor");
}

export function ancestryRendererFor(version: string) {
  return rendererFor("种族", version, "ancestry");
}

export function communityRendererFor(version: string) {
  return rendererFor("社群", version, "community");
}

export function professionRendererFor(version: string) {
  return rendererFor("职业", version, "profession");
}

export function subclassRendererFor(version: string) {
  return rendererFor("子职业", version, "subclass");
}

export function itemRendererFor(version: string) {
  return rendererFor("物品", version, "item");
}

export function domainRendererFor(version: string) {
  return rendererFor("领域卡", version, "domain");
}

export function environmentRendererFor(version: string) {
  return rendererFor("环境", version, "environment");
}

export function trustedRendererFor(templateId: string, version: string) {
  return resolveTemplateFrontend(templateId, version)?.rendererRevision;
}

function rendererFor(templateId: string, version: string, label: string): TrustedRenderer {
  const renderer = trustedRendererFor(templateId, version);
  if (renderer) return renderer;
  throw new Error(`Unsupported ${label} Renderer version: ${version}`);
}
