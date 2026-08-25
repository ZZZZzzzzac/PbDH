import type { ResourcePackageCandidate } from "@pbdh/contract-runtime";

export type CreatorMarketHandoff = {
  target: "creator" | "gm";
  publicationId: string;
  packageId: string;
  packageVersion: string;
  snapshotDigest: string;
  focusResourceId?: string;
};

export type CreatorMarketHandoffMismatch =
  | "creator.market-handoff.package-id-mismatch"
  | "creator.market-handoff.package-version-mismatch"
  | "creator.market-handoff.snapshot-mismatch"
  | "creator.market-handoff.focus-resource-not-found";

export function parseCreatorMarketHandoff(sourceUrl: string | URL): CreatorMarketHandoff | null {
  const url = new URL(sourceUrl);
  if (url.searchParams.get("pbdhHandoff") !== "publication") return null;
  const target = url.searchParams.get("target");
  const publicationId = url.searchParams.get("publicationId")?.trim();
  const packageId = url.searchParams.get("packageId")?.trim();
  const packageVersion = url.searchParams.get("packageVersion")?.trim();
  const snapshotDigest = url.searchParams.get("snapshotDigest")?.trim();
  if ((target !== "creator" && target !== "gm")
    || !publicationId
    || !packageId
    || !packageVersion
    || !snapshotDigest) return null;
  const focusResourceId = url.searchParams.get("focusResourceId")?.trim();
  return {
    target,
    publicationId,
    packageId,
    packageVersion,
    snapshotDigest,
    ...(focusResourceId ? { focusResourceId } : {}),
  };
}

export function withoutCreatorMarketHandoff(sourceUrl: string | URL): URL {
  const url = new URL(sourceUrl);
  for (const key of [
    "pbdhHandoff",
    "target",
    "publicationId",
    "packageId",
    "packageVersion",
    "snapshotDigest",
    "focusResourceId",
  ]) {
    url.searchParams.delete(key);
  }
  return url;
}

export function creatorMarketHandoffMismatch(
  handoff: CreatorMarketHandoff,
  candidate: ResourcePackageCandidate,
): CreatorMarketHandoffMismatch | null {
  if (candidate.document.package.id !== handoff.packageId) {
    return "creator.market-handoff.package-id-mismatch";
  }
  if (candidate.document.package.version !== handoff.packageVersion) {
    return "creator.market-handoff.package-version-mismatch";
  }
  if (candidate.document.snapshotDigest !== handoff.snapshotDigest) {
    return "creator.market-handoff.snapshot-mismatch";
  }
  if (handoff.focusResourceId
    && !candidate.document.resources.some((resource) => resource.id === handoff.focusResourceId)) {
    return "creator.market-handoff.focus-resource-not-found";
  }
  return null;
}
