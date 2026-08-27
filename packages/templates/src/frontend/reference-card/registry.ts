import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";
import type { ReactNode } from "react";

import { ancestryAuthoringLayout } from "../ancestry/1.0.0/authoring-layout.ts";
import { ancestryRendererRevision } from "../ancestry/1.0.0/renderer.tsx";
import { communityAuthoringLayout } from "../community/1.0.0/authoring-layout.ts";
import { communityRendererRevision } from "../community/1.0.0/renderer.tsx";
import { domainAuthoringLayout } from "../domain/1.0.0/authoring-layout.ts";
import { domainRendererRevision } from "../domain/1.0.0/renderer.tsx";
import { itemAuthoringLayout } from "../item/1.0.0/authoring-layout.ts";
import { itemRendererRevision } from "../item/1.0.0/renderer.tsx";
import { professionAuthoringLayout } from "../profession/1.0.0/authoring-layout.ts";
import { professionRendererRevision } from "../profession/1.0.0/renderer.tsx";
import { subclassAuthoringLayout } from "../subclass/1.0.0/authoring-layout.ts";
import { subclassRendererRevision } from "../subclass/1.0.0/renderer.tsx";
import type { AuthoringLayout } from "../types.ts";

export const stableReferenceTemplateIds = ["种族", "社群", "职业", "子职业", "物品", "领域卡"] as const;
export type StableReferenceTemplateId = typeof stableReferenceTemplateIds[number];

const authoringLayouts = new Map<StableReferenceTemplateId, AuthoringLayout>([
  ["种族", ancestryAuthoringLayout],
  ["社群", communityAuthoringLayout],
  ["职业", professionAuthoringLayout],
  ["子职业", subclassAuthoringLayout],
  ["物品", itemAuthoringLayout],
  ["领域卡", domainAuthoringLayout],
]);

const renderers = new Map<StableReferenceTemplateId, RendererRevisionCapability<Record<string, unknown>, Record<string, string>, ReactNode>>([
  ["种族", ancestryRendererRevision as RendererRevisionCapability<Record<string, unknown>, Record<string, string>, ReactNode>],
  ["社群", communityRendererRevision as RendererRevisionCapability<Record<string, unknown>, Record<string, string>, ReactNode>],
  ["职业", professionRendererRevision as RendererRevisionCapability<Record<string, unknown>, Record<string, string>, ReactNode>],
  ["子职业", subclassRendererRevision as RendererRevisionCapability<Record<string, unknown>, Record<string, string>, ReactNode>],
  ["物品", itemRendererRevision as RendererRevisionCapability<Record<string, unknown>, Record<string, string>, ReactNode>],
  ["领域卡", domainRendererRevision as RendererRevisionCapability<Record<string, unknown>, Record<string, string>, ReactNode>],
]);

export function isStableReferenceTemplateId(id: string): id is StableReferenceTemplateId {
  return stableReferenceTemplateIds.includes(id as StableReferenceTemplateId);
}

export function stableReferenceAuthoringLayoutFor(id: string, version: string): AuthoringLayout | undefined {
  return version === "1.0.0" && isStableReferenceTemplateId(id) ? authoringLayouts.get(id) : undefined;
}

export function stableReferenceRendererFor(id: string, version: string) {
  if (version !== "1.0.0" || !isStableReferenceTemplateId(id)) return undefined;
  return renderers.get(id);
}
