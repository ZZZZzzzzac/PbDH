export type PublicationStatus = "published" | "unpublished";
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
  packageName?: string;
  packageDescription?: string;
  targets?: Array<{ systemPackageId: string; version: string }>;
  snapshotDigest: string;
  title: string;
  ownerAccountId: string;
  author: string;
  summary: string;
  kind: PublicationKind;
  templateIds: string[];
  systems: string[];
  systemLabels: string[];
  language: string;
  categories: string[];
  tags: string[];
  license: string;
  licenseDeclaration?: string;
  updatedAt: string;
  resourceCount: number;
  status: PublicationStatus;
  cover: { assetId: string; url: string; alt: string };
  archiveUrl: string;
  archiveName: string;
  resources: PublicationResource[];
  matchedResourceIds?: string[];
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

export type CatalogSort = "relevance" | "recent" | "title";

export type CatalogFacet = { value: string; count: number };

export type CatalogFacets = {
  templateIds: CatalogFacet[];
  systems: CatalogFacet[];
  languages: CatalogFacet[];
  categories: CatalogFacet[];
};

export type CatalogQuery = {
  query: string;
  filters: CatalogFilters;
  sort: CatalogSort;
  page: number;
  pageSize: number;
  authorAccountId?: string;
};

export type CatalogPage = {
  publications: Publication[];
  facets: CatalogFacets;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export function summarizePublicationTemplates(
  publication: Pick<Publication, "templateIds" | "resources">,
  limit = 3,
): { templateIds: string[]; omittedCount: number } {
  const counts = new Map(publication.templateIds.map((templateId, index) => [
    templateId,
    { count: 0, index },
  ]));
  for (const resource of publication.resources) {
    const current = counts.get(resource.templateId);
    if (current) current.count += 1;
    else counts.set(resource.templateId, { count: 1, index: counts.size });
  }
  const sorted = [...counts.entries()]
    .sort((left, right) => right[1].count - left[1].count || left[1].index - right[1].index)
    .map(([templateId]) => templateId);
  return {
    templateIds: sorted.slice(0, limit),
    omittedCount: Math.max(0, sorted.length - limit),
  };
}

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
    if (!intersects(filters.templateIds, publication.templateIds)) return false;
    if (!intersects(filters.systems, publication.systems)) return false;
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
  creatorMode: "import" | "fork";
  focusLocator?: { resourceId: string };
  targetRoute: "weapons" | "armor" | "ancestries" | "communities" | "classes" | "subclasses" | "loot" | "domain-cards" | "other-resources" | "creator-ingress";
  autoInstall: false;
  autoPlace: false;
};

export function createHandoffIntent(
  publication: Publication,
  target: HandoffTarget,
  focusedResourceId?: string,
  allowUnpublished = false,
  creatorMode: "import" | "fork" = "import",
): HandoffIntent {
  if (!canAcquirePublication(publication, allowUnpublished)) {
    throw new Error("publication.unpublished");
  }
  const effectiveFocusResourceId = target === "player" ? undefined : focusedResourceId;
  const focusedResource = effectiveFocusResourceId
    ? publication.resources.find((resource) => resource.id === effectiveFocusResourceId)
    : undefined;
  if (effectiveFocusResourceId && !focusedResource) throw new Error("focus.resource.not-found");
  if (creatorMode === "fork" && target !== "creator") throw new Error("handoff.fork.target-not-creator");

  let targetRoute: HandoffIntent["targetRoute"];
  if (target === "creator" || target === "gm") targetRoute = "creator-ingress";
  else if (focusedResource?.templateId === "武器" || (!focusedResource && publication.kind === "weapon")) {
    targetRoute = "weapons";
  } else if (
    focusedResource?.templateId === "护甲"
    || (!focusedResource && publication.templateIds.length === 1 && publication.templateIds[0] === "护甲")
  ) {
    targetRoute = "armor";
  } else {
    const templateId = focusedResource?.templateId
      ?? (publication.templateIds.length === 1 ? publication.templateIds[0] : undefined);
    targetRoute = ({
      种族: "ancestries",
      社群: "communities",
      职业: "classes",
      子职业: "subclasses",
      物品: "loot",
      领域卡: "domain-cards",
    } as Partial<Record<string, HandoffIntent["targetRoute"]>>)[templateId ?? ""] ?? "other-resources";
  }

  return {
    kind: "publication-handoff",
    target,
    publicationId: publication.id,
    packageId: publication.packageId,
    packageVersion: publication.packageVersion,
    snapshotDigest: publication.snapshotDigest,
    acquisition: "complete-resource-package",
    creatorMode,
    ...(effectiveFocusResourceId ? { focusLocator: { resourceId: effectiveFocusResourceId } } : {}),
    targetRoute,
    autoInstall: false,
    autoPlace: false,
  };
}

export function canAcquirePublication(
  publication: Publication,
  canManage: boolean,
): boolean {
  return publication.status === "published" || canManage;
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
  if (intent.creatorMode === "fork") url.searchParams.set("creatorMode", "fork");
  if (intent.focusLocator) url.searchParams.set("focusResourceId", intent.focusLocator.resourceId);
  return url;
}

export function createPlayerHandoffUrl(
  intent: HandoffIntent,
  playerBaseUrl: string | URL,
): URL {
  if (intent.target !== "player") throw new Error("handoff.target.not-player");
  const url = new URL(playerBaseUrl);
  url.searchParams.set("pbdhHandoff", "publication");
  url.searchParams.set("target", "player");
  url.searchParams.set("publicationId", intent.publicationId);
  url.searchParams.set("packageId", intent.packageId);
  url.searchParams.set("packageVersion", intent.packageVersion);
  url.searchParams.set("snapshotDigest", intent.snapshotDigest);
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

export function canManagePublication(
  publication: Publication,
  accountId: string,
  isAdmin = false,
): boolean {
  return isAdmin || publication.ownerAccountId === accountId;
}
