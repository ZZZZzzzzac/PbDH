import type { ReactNode } from "react";

import type { RendererRevisionCapability } from "@pbdh/resource-renderer/core";

type TrustedRenderer = RendererRevisionCapability<any, any, ReactNode>;
type RendererLoader = () => Promise<TrustedRenderer>;

const loaders = new Map<string, RendererLoader>([
  ["敌人@1.0.0-alpha.1", async () => (await import("./adversary/1.0.0-alpha.1/renderer.tsx")).adversaryRendererRevision],
  ["敌人@1.0.0", async () => (await import("./adversary/1.0.0/renderer.tsx")).adversaryRendererRevision],
  ["武器@1.0.0-alpha.1", async () => (await import("./weapon/1.0.0-alpha.1/renderer.tsx")).weaponRendererRevision],
  ["武器@1.0.0", async () => (await import("./weapon/1.0.0/renderer.tsx")).weaponRendererRevision],
  ["自由@1.0.0", async () => (await import("./free/1.0.0/renderer.tsx")).freeRendererRevision],
  ["护甲@1.0.0", async () => (await import("./armor/1.0.0/renderer.tsx")).armorRendererRevision],
  ["种族@1.0.0", async () => (await import("./ancestry/1.0.0/renderer.tsx")).ancestryRendererRevision],
  ["社群@1.0.0", async () => (await import("./community/1.0.0/renderer.tsx")).communityRendererRevision],
  ["职业@1.0.0", async () => (await import("./profession/1.0.0/renderer.tsx")).professionRendererRevision],
  ["子职业@1.0.0", async () => (await import("./subclass/1.0.0/renderer.tsx")).subclassRendererRevision],
  ["物品@1.0.0", async () => (await import("./item/1.0.0/renderer.tsx")).itemRendererRevision],
  ["领域卡@1.0.0", async () => (await import("./domain/1.0.0/renderer.tsx")).domainRendererRevision],
  ["环境@1.0.0", async () => (await import("./environment/1.0.0/renderer.tsx")).environmentRendererRevision],
]);

export function listLazyRendererBindings(): readonly string[] {
  return [...loaders.keys()];
}

export async function loadTrustedRenderer(
  templateId: string,
  version: string,
): Promise<TrustedRenderer | undefined> {
  return loaders.get(`${templateId}@${version}`)?.();
}
