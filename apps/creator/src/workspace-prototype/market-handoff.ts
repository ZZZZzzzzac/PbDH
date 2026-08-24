export type CreatorMarketHandoff = {
  target: "creator" | "gm";
  publicationId: string;
  snapshotDigest: string;
  focusResourceId?: string;
};

export function parseCreatorMarketHandoff(sourceUrl: string | URL): CreatorMarketHandoff | null {
  const url = new URL(sourceUrl);
  if (url.searchParams.get("pbdhHandoff") !== "publication") return null;
  const target = url.searchParams.get("target");
  const publicationId = url.searchParams.get("publicationId")?.trim();
  const snapshotDigest = url.searchParams.get("snapshotDigest")?.trim();
  if ((target !== "creator" && target !== "gm") || !publicationId || !snapshotDigest) return null;
  const focusResourceId = url.searchParams.get("focusResourceId")?.trim();
  return {
    target,
    publicationId,
    snapshotDigest,
    ...(focusResourceId ? { focusResourceId } : {}),
  };
}

export function withoutCreatorMarketHandoff(sourceUrl: string | URL): URL {
  const url = new URL(sourceUrl);
  for (const key of ["pbdhHandoff", "target", "publicationId", "snapshotDigest", "focusResourceId"]) {
    url.searchParams.delete(key);
  }
  return url;
}
