import type {
  ResourcePackageCandidate,
  ResourcePackageLogicalDocument,
  SystemPackageDocument,
} from "@pbdh/contract-runtime";

import { routeResourcePackage, type RoutedResource } from "./route-resource-package.ts";

export type InstalledResourcePackage = {
  document: ResourcePackageLogicalDocument;
  media: Map<string, Uint8Array>;
  routes: RoutedResource[];
};

export type ResourceLibrary = ReadonlyMap<string, InstalledResourcePackage>;

export type ResourcePackageInstallPlan =
  | { kind: "insert"; candidate: ResourcePackageCandidate; routes: RoutedResource[] }
  | { kind: "update"; candidate: ResourcePackageCandidate; routes: RoutedResource[]; existing: InstalledResourcePackage }
  | { kind: "no-op"; existing: InstalledResourcePackage };

export function planResourcePackageInstall(input: {
  currentSystem: SystemPackageDocument;
  library: ResourceLibrary;
  candidate: ResourcePackageCandidate;
}): ResourcePackageInstallPlan {
  const existing = input.library.get(input.candidate.document.package.id);
  if (existing?.document.snapshotDigest === input.candidate.document.snapshotDigest) {
    return { kind: "no-op", existing };
  }

  const routes = routeResourcePackage({
    currentSystem: input.currentSystem,
    resourcePackage: input.candidate.document,
  });
  return existing
    ? { kind: "update", candidate: input.candidate, routes, existing }
    : { kind: "insert", candidate: input.candidate, routes };
}

export function commitResourcePackageInstall(
  library: ResourceLibrary,
  plan: Exclude<ResourcePackageInstallPlan, { kind: "no-op" }>,
): ResourceLibrary {
  const next = new Map(library);
  next.set(plan.candidate.document.package.id, {
    document: structuredClone(plan.candidate.document),
    media: new Map(plan.candidate.media),
    routes: plan.routes,
  });
  return next;
}
