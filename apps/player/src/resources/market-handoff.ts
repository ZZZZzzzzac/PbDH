import type { ResourcePackageCandidate } from "@pbdh/contract-runtime";

export type PlayerMarketHandoff = {
  target: "player";
  publicationId: string;
  packageId: string;
  packageVersion: string;
  snapshotDigest: string;
};

export type PlayerMarketHandoffMismatch =
  | "player.market-handoff.package-id-mismatch"
  | "player.market-handoff.package-version-mismatch"
  | "player.market-handoff.snapshot-mismatch";

const handoffKeys = [
  "pbdhHandoff",
  "target",
  "publicationId",
  "packageId",
  "packageVersion",
  "snapshotDigest",
  "focusResourceId",
] as const;

export function parsePlayerMarketHandoff(sourceUrl: string | URL): PlayerMarketHandoff | null {
  const url = new URL(sourceUrl);
  if (url.searchParams.get("pbdhHandoff") !== "publication"
    || url.searchParams.get("target") !== "player") return null;
  const publicationId = url.searchParams.get("publicationId")?.trim();
  const packageId = url.searchParams.get("packageId")?.trim();
  const packageVersion = url.searchParams.get("packageVersion")?.trim();
  const snapshotDigest = url.searchParams.get("snapshotDigest")?.trim();
  if (!publicationId || !packageId || !packageVersion || !snapshotDigest) return null;
  return {
    target: "player",
    publicationId,
    packageId,
    packageVersion,
    snapshotDigest,
  };
}

export function playerMarketArchiveUrl(handoff: PlayerMarketHandoff): string {
  return `/api/publications/${encodeURIComponent(handoff.publicationId)}/download`;
}

export function withoutPlayerMarketHandoff(sourceUrl: string | URL): URL {
  const url = new URL(sourceUrl);
  for (const key of handoffKeys) url.searchParams.delete(key);
  return url;
}

export function playerMarketHandoffMismatch(
  handoff: PlayerMarketHandoff,
  candidate: ResourcePackageCandidate,
): PlayerMarketHandoffMismatch | null {
  if (candidate.document.package.id !== handoff.packageId) {
    return "player.market-handoff.package-id-mismatch";
  }
  if (candidate.document.package.version !== handoff.packageVersion) {
    return "player.market-handoff.package-version-mismatch";
  }
  if (candidate.document.snapshotDigest !== handoff.snapshotDigest) {
    return "player.market-handoff.snapshot-mismatch";
  }
  return null;
}
