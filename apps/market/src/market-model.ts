export type PublicationStatus = "available" | "withdrawn";
export type PublicationKind = "enemy" | "weapon" | "mixed";
export type HandoffTarget = "player" | "creator" | "gm";

export type PublicationResource = {
  id: string;
  name: string;
  templateId: string;
  path: string;
  data: Record<string, unknown>;
  source: unknown;
};

export type Publication = {
  id: string;
  packageId: string;
  packageVersion: string;
  snapshotDigest: string;
  title: string;
  ownerAccountId: string;
  author: string;
  summary: string;
  kind: PublicationKind;
  templateIds: string[];
  system: string;
  systemLabel: string;
  language: string;
  categories: string[];
  tags: string[];
  license: string;
  updatedAt: string;
  resourceCount: number;
  status: PublicationStatus;
  cover: { assetId: string; url: string; alt: string };
  archiveUrl: string;
  archiveName: string;
  resources: PublicationResource[];
  mediaUrls?: Record<string, string>;
};

export type PublicationDisplayMetadata = Pick<
  Publication,
  "title" | "summary" | "language" | "categories" | "tags" | "cover"
>;

export type CatalogFilters = {
  templateIds: string[];
  systems: string[];
  languages: string[];
  categories: string[];
};

export const emptyCatalogFilters: CatalogFilters = {
  templateIds: [],
  systems: [],
  languages: [],
  categories: [],
};

function intersects(selected: readonly string[], values: readonly string[]) {
  return selected.length === 0 || selected.some((value) => values.includes(value));
}

export function filterPublications(
  publications: readonly Publication[],
  query: string,
  filters: CatalogFilters,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  return publications.filter((publication) => {
    if (publication.status !== "available") return false;
    if (!intersects(filters.templateIds, publication.templateIds)) return false;
    if (!intersects(filters.systems, [publication.system])) return false;
    if (!intersects(filters.languages, [publication.language])) return false;
    if (!intersects(filters.categories, publication.categories)) return false;
    if (!normalizedQuery) return true;
    const searchText = [
      publication.title,
      publication.author,
      publication.summary,
      ...publication.tags,
      ...publication.resources.flatMap((resource) => [resource.name, resource.path, resource.templateId]),
    ].join(" ").toLocaleLowerCase("zh-CN");
    return searchText.includes(normalizedQuery);
  });
}

export type HandoffIntent = {
  kind: "publication-handoff";
  target: HandoffTarget;
  publicationId: string;
  packageId: string;
  packageVersion: string;
  snapshotDigest: string;
  acquisition: "complete-resource-package";
  focusLocator?: { resourceId: string };
  targetRoute: "weapons" | "other-resources" | "creator-ingress";
  autoInstall: false;
  autoPlace: false;
};

export function createHandoffIntent(
  publication: Publication,
  target: HandoffTarget,
  focusedResourceId?: string,
): HandoffIntent {
  if (publication.status !== "available") {
    throw new Error("publication.withdrawn");
  }
  if (focusedResourceId && !publication.resources.some((resource) => resource.id === focusedResourceId)) {
    throw new Error("focus.resource.not-found");
  }

  let targetRoute: HandoffIntent["targetRoute"];
  if (target === "creator" || target === "gm") targetRoute = "creator-ingress";
  else targetRoute = publication.kind === "weapon" ? "weapons" : "other-resources";

  return {
    kind: "publication-handoff",
    target,
    publicationId: publication.id,
    packageId: publication.packageId,
    packageVersion: publication.packageVersion,
    snapshotDigest: publication.snapshotDigest,
    acquisition: "complete-resource-package",
    ...(focusedResourceId ? { focusLocator: { resourceId: focusedResourceId } } : {}),
    targetRoute,
    autoInstall: false,
    autoPlace: false,
  };
}

export function createCreatorHandoffUrl(
  intent: HandoffIntent,
  creatorBaseUrl: string | URL,
): URL {
  if (intent.target !== "creator" && intent.target !== "gm") {
    throw new Error("handoff.target.not-creator-hosted");
  }
  const url = new URL(creatorBaseUrl);
  url.searchParams.set("pbdhHandoff", "publication");
  url.searchParams.set("target", intent.target);
  url.searchParams.set("publicationId", intent.publicationId);
  url.searchParams.set("packageId", intent.packageId);
  url.searchParams.set("packageVersion", intent.packageVersion);
  url.searchParams.set("snapshotDigest", intent.snapshotDigest);
  if (intent.focusLocator) url.searchParams.set("focusResourceId", intent.focusLocator.resourceId);
  return url;
}

export function toggleFilterValue(values: readonly string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function updatePublicationDisplayMetadata(
  publication: Publication,
  metadata: PublicationDisplayMetadata,
): Publication {
  return {
    ...publication,
    ...structuredClone(metadata),
  };
}

export function setPublicationStatus(
  publication: Publication,
  status: PublicationStatus,
): Publication {
  return publication.status === status ? publication : { ...publication, status };
}

export function publicationsOwnedBy(
  publications: readonly Publication[],
  accountId: string,
): Publication[] {
  return publications.filter((publication) => publication.ownerAccountId === accountId);
}

export function canManagePublication(publication: Publication, accountId: string): boolean {
  return publication.ownerAccountId === accountId;
}
