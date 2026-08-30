import type {
  CatalogPage,
  CatalogQuery,
  Publication,
  PublicationKind,
  PublicationResource,
} from "./market-model.ts";
import type { AuthStatus } from "@pbdh/platform-auth/core";
import {
  platformRequestHeaders,
  type PlatformCredentials,
} from "@pbdh/platform-auth/provider";
import { systemPackageLabel } from "./system-package-labels.ts";

type ApiResourceSummary = {
  id: string;
  path: string;
  template: { id: string; version: string };
  name: string;
};

type ApiPublication = {
  publicationId: string;
  packageId: string;
  packageVersion: string;
  snapshotDigest: string;
  title: string;
  summary: string;
  language: string;
  tags: string[];
  coverAssetId: string;
  author: { accountId: string; username: string | null };
  updatedAt: string;
  templateIds: string[];
  targetSystemPackageIds: string[];
  license: { label: string; declaration: string };
  resourceCount: number;
  resources: ApiResourceSummary[];
  status: "published" | "unpublished";
  matchedResourceIds?: string[];
  document?: {
    package?: { name: string; version: string; description: string };
    targets?: Array<{ systemPackageId: string; version: string }>;
    assets: Array<{ id: string }>;
    resources: Array<ApiResourceSummary & { data: Record<string, unknown>; presentation: unknown; media: Record<string, string> }>;
  };
};

type ApiCatalogFacet = { value: string; count: number };

type ApiCatalogPayload = ApiErrorPayload & {
  publications?: ApiPublication[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  facets?: {
    templateIds: ApiCatalogFacet[];
    targetSystemPackageIds: ApiCatalogFacet[];
    languages: ApiCatalogFacet[];
    categories: ApiCatalogFacet[];
  };
};

type ApiErrorPayload = { error?: { code?: string; message?: string } };

export type PublicationMetadataInput = {
  title: string;
  summary: string;
  language: string;
  tags: string[];
  coverAssetId: string;
};

export type PublicationInformationInput = PublicationMetadataInput & {
  package: { name: string; version: string; description: string };
  targets: Array<{ systemPackageId: string; version: string }>;
  coverAsset?: {
    id: string;
    mediaType: "image/webp";
    byteLength: string;
    width: string;
    height: string;
  };
};

export class MarketApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function loadPublications(fetcher: typeof fetch = fetch): Promise<Publication[]> {
  return (await loadPublicationCatalog({
    query: "",
    filters: { templateIds: [], systems: [], languages: [], categories: [] },
    sort: "recent",
    page: 1,
    pageSize: 24,
  }, fetcher)).publications;
}

export async function loadPublicationCatalog(
  query: CatalogQuery,
  fetcher: typeof fetch = fetch,
): Promise<CatalogPage> {
  const parameters = new URLSearchParams();
  if (query.query.trim()) parameters.set("q", query.query.trim());
  if (query.authorAccountId) parameters.set("authorAccountId", query.authorAccountId);
  for (const value of query.filters.templateIds) parameters.append("templateId", value);
  for (const value of query.filters.systems) parameters.append("targetSystemPackageId", value);
  for (const value of query.filters.languages) parameters.append("language", value);
  for (const value of query.filters.categories) parameters.append("category", value);
  parameters.set("sort", query.sort);
  parameters.set("page", String(query.page));
  parameters.set("pageSize", String(query.pageSize));
  const response = await fetcher(`/api/publications?${parameters}`, {
    headers: { Accept: "application/json" },
  });
  const payload = await response.json() as ApiCatalogPayload;
  if (!response.ok || !payload.publications || !payload.pagination || !payload.facets) {
    throw new Error(payload.error?.message ?? "资源市场暂不可用。");
  }
  return {
    publications: payload.publications.map(publicationFromApi),
    facets: {
      templateIds: payload.facets.templateIds,
      systems: payload.facets.targetSystemPackageIds,
      languages: payload.facets.languages,
      categories: payload.facets.categories,
    },
    ...payload.pagination,
  };
}

export async function loadPublication(
  publicationId: string,
  fetcher: typeof fetch = fetch,
): Promise<Publication> {
  const response = await fetcher(`/api/publications/${encodeURIComponent(publicationId)}`, {
    headers: { Accept: "application/json" },
  });
  const payload = await response.json() as ApiErrorPayload & { publication?: ApiPublication };
  if (!response.ok || !payload.publication) throw apiError(response, payload, "无法打开该资源包。");
  return publicationFromApi(payload.publication);
}

export async function loadManageablePublications(
  credentials: PlatformCredentials,
  fetcher: typeof fetch = fetch,
  createObjectUrl: (blob: Blob) => string = URL.createObjectURL,
): Promise<Publication[]> {
  const response = await fetcher("/api/publications/manageable", {
    headers: authenticatedHeaders(credentials),
  });
  const payload = await response.json() as ApiErrorPayload & { publications?: ApiPublication[] };
  if (!response.ok || !payload.publications) throw apiError(response, payload, "无法读取可管理的资源包。");
  return Promise.all(payload.publications.map((publication) =>
    publicationFromManageableApi(publication, credentials, fetcher, createObjectUrl)
  ));
}

export async function loadManageablePublication(
  publicationId: string,
  credentials: PlatformCredentials,
  fetcher: typeof fetch = fetch,
  createObjectUrl: (blob: Blob) => string = URL.createObjectURL,
): Promise<Publication> {
  const response = await fetcher(`/api/publications/${encodeURIComponent(publicationId)}/manage`, {
    headers: authenticatedHeaders(credentials),
  });
  const payload = await response.json() as ApiErrorPayload & { publication?: ApiPublication };
  if (!response.ok || !payload.publication) throw apiError(response, payload, "无法打开该资源包。");
  return publicationFromManageableApi(payload.publication, credentials, fetcher, createObjectUrl);
}

export async function loadVisiblePublications(
  status: AuthStatus,
  credentials: PlatformCredentials | null,
  fetcher: typeof fetch = fetch,
  createObjectUrl: (blob: Blob) => string = URL.createObjectURL,
  onPrivateCatalogError?: (error: unknown) => void,
): Promise<Publication[] | null> {
  if (status === "loading" || status === "working") return null;
  if (!credentials) return loadPublications(fetcher);
  const [publicResult, manageableResult] = await Promise.allSettled([
    loadPublications(fetcher),
    loadManageablePublications(credentials, fetcher, createObjectUrl),
  ]);
  if (publicResult.status === "rejected") throw publicResult.reason;
  const publications = publicResult.value;
  if (manageableResult.status === "rejected") {
    onPrivateCatalogError?.(manageableResult.reason);
    return publications;
  }
  const manageable = manageableResult.value;
  const visible = new Map(publications.map((publication) => [publication.id, publication]));
  for (const publication of manageable) visible.set(publication.id, publication);
  return [...visible.values()];
}

export async function loadPublicationArchive(
  publicationId: string,
  credentials: PlatformCredentials | null,
  fetcher: typeof fetch = fetch,
): Promise<Blob> {
  const headers = credentials
    ? platformRequestHeaders(credentials, { Accept: "application/vnd.pbdh.resource-package+zip" })
    : new Headers({ Accept: "application/vnd.pbdh.resource-package+zip" });
  const response = await fetcher(`/api/publications/${encodeURIComponent(publicationId)}/download`, { headers });
  if (!response.ok) throw new Error("无法下载该资源包。");
  return response.blob();
}

export function unpublishPublication(
  publicationId: string,
  credentials: PlatformCredentials,
  fetcher: typeof fetch = fetch,
): Promise<Publication> {
  return mutatePublication(publicationId, "unpublish", "POST", undefined, credentials, fetcher);
}

export async function unpublishLoadedPublication(
  publication: Publication,
  credentials: PlatformCredentials,
  fetcher: typeof fetch = fetch,
): Promise<Publication> {
  const updated = await unpublishPublication(publication.id, credentials, fetcher);
  return {
    ...publication,
    status: updated.status,
    updatedAt: updated.updatedAt,
  };
}

export function republishPublication(
  publicationId: string,
  credentials: PlatformCredentials,
  fetcher: typeof fetch = fetch,
): Promise<Publication> {
  return mutatePublication(publicationId, "republish", "POST", undefined, credentials, fetcher);
}

export function updatePublicationInformation(
  publicationId: string,
  information: PublicationInformationInput,
  credentials: PlatformCredentials,
  fetcher: typeof fetch = fetch,
  cover: Blob | undefined = undefined,
): Promise<Publication> {
  if (cover) return updatePublicationInformationWithCover(publicationId, information, cover, credentials, fetcher);
  return mutatePublication(publicationId, "information", "PATCH", information, credentials, fetcher);
}

async function updatePublicationInformationWithCover(
  publicationId: string,
  information: PublicationInformationInput,
  cover: Blob,
  credentials: PlatformCredentials,
  fetcher: typeof fetch,
): Promise<Publication> {
  if (!credentials.canWrite) {
    throw new MarketApiError("当前设备已失去云端写入权，请重新接管账号会话。", "AUTH_SESSION_REPLACED", 401);
  }
  const body = new FormData();
  body.set("information", JSON.stringify(information));
  body.set("cover", cover, "publication-cover.webp");
  const response = await fetcher(
    `/api/publications/${encodeURIComponent(publicationId)}/information-with-cover`,
    { method: "PATCH", headers: authenticatedHeaders(credentials), body },
  );
  const payload = await response.json() as ApiErrorPayload & { publication?: ApiPublication };
  if (!response.ok || !payload.publication) throw apiError(response, payload, "无法更新资源包封面。");
  return publicationFromApi(payload.publication);
}

export async function deletePublication(
  publicationId: string,
  credentials: PlatformCredentials,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (!credentials.canWrite) {
    throw new MarketApiError("当前设备已失去云端写入权，请重新接管账号会话。", "AUTH_SESSION_REPLACED", 401);
  }
  const response = await fetcher(`/api/publications/${encodeURIComponent(publicationId)}`, {
    method: "DELETE",
    headers: authenticatedHeaders(credentials),
  });
  if (response.ok) return;
  const payload = await response.json() as ApiErrorPayload;
  throw apiError(response, payload, "无法永久删除该资源包。");
}

async function mutatePublication(
  publicationId: string,
  action: "unpublish" | "republish" | "information",
  method: "POST" | "PATCH",
  body: PublicationMetadataInput | PublicationInformationInput | undefined,
  credentials: PlatformCredentials,
  fetcher: typeof fetch,
): Promise<Publication> {
  if (!credentials.canWrite) {
    throw new MarketApiError("当前设备已失去云端写入权，请重新接管账号会话。", "AUTH_SESSION_REPLACED", 401);
  }
  const response = await fetcher(
    `/api/publications/${encodeURIComponent(publicationId)}/${action}`,
    {
      method,
      headers: authenticatedHeaders(credentials, body !== undefined),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  const payload = await response.json() as ApiErrorPayload & { publication?: ApiPublication };
  if (!response.ok || !payload.publication) throw apiError(response, payload, "无法更新资源包。");
  return publicationFromApi(payload.publication);
}

function authenticatedHeaders(credentials: PlatformCredentials, json = false): Headers {
  const headers = platformRequestHeaders(credentials, { Accept: "application/json" });
  if (json) headers.set("Content-Type", "application/json");
  return headers;
}

async function publicationFromManageableApi(
  source: ApiPublication,
  credentials: PlatformCredentials,
  fetcher: typeof fetch,
  createObjectUrl: (blob: Blob) => string,
): Promise<Publication> {
  const publication = publicationFromApi(source);
  const assetIds = [...new Set([source.coverAssetId, ...(source.document?.assets.map((asset) => asset.id) ?? [])])];
  const mediaEntries = await Promise.all(assetIds.map(async (assetId) => {
    const response = await fetcher(mediaUrl(source.publicationId, assetId), {
      headers: platformRequestHeaders(credentials, { Accept: "image/webp,image/*" }),
    });
    if (!response.ok) throw new Error("无法读取资源包媒体。");
    return [assetId, createObjectUrl(await response.blob())] as const;
  }));
  const mediaUrls = Object.fromEntries(mediaEntries);
  return {
    ...publication,
    cover: { ...publication.cover, url: mediaUrls[source.coverAssetId] ?? publication.cover.url },
    mediaUrls,
  };
}

function apiError(response: Response, payload: ApiErrorPayload, fallback: string): MarketApiError {
  return new MarketApiError(
    payload.error?.message ?? fallback,
    payload.error?.code ?? "MARKET_REQUEST_FAILED",
    response.status,
  );
}

function publicationFromApi(source: ApiPublication): Publication {
  const mappedResources: PublicationResource[] = source.document
    ? source.document.resources.map((resource) => ({
        id: resource.id,
        name: String(resource.data.名称 ?? resource.name),
        templateId: resource.template.id,
        path: resource.path,
        data: resource.data,
        source: resource,
      }))
    : source.resources.map((resource) => ({
        id: resource.id,
        name: resource.name,
        templateId: resource.template.id,
        path: resource.path,
        data: {},
        source: resource,
      }));
  const kind = publicationKind(source.templateIds);
  const systemLabels = source.targetSystemPackageIds.map(systemPackageLabel);
  return {
    id: source.publicationId,
    packageId: source.packageId,
    packageVersion: source.packageVersion,
    packageName: source.document?.package?.name ?? source.title,
    packageDescription: source.document?.package?.description ?? source.summary,
    targets: source.document?.targets ?? source.targetSystemPackageIds.map((systemPackageId) => ({ systemPackageId, version: "1.0.0" })),
    snapshotDigest: source.snapshotDigest,
    title: source.title,
    ownerAccountId: source.author.accountId,
    author: source.author.username ?? "未设置用户名",
    summary: source.summary,
    kind,
    templateIds: source.templateIds,
    systems: source.targetSystemPackageIds,
    systemLabels,
    language: source.language,
    categories: source.tags,
    tags: source.tags,
    license: source.license.label,
    updatedAt: source.updatedAt,
    resourceCount: source.resourceCount,
    status: source.status,
    cover: {
      assetId: source.coverAssetId,
      url: mediaUrl(source.publicationId, source.coverAssetId),
      alt: `${source.title}封面`,
    },
    archiveUrl: `/api/publications/${encodeURIComponent(source.publicationId)}/download`,
    archiveName: pbresArchiveName(source.document?.package?.name ?? source.title),
    resources: mappedResources,
    matchedResourceIds: source.matchedResourceIds,
    mediaUrls: Object.fromEntries(
      (source.document?.assets ?? [{ id: source.coverAssetId }]).map((asset) => [
        asset.id,
        mediaUrl(source.publicationId, asset.id),
      ]),
    ),
  };
}

export function pbresArchiveName(packageName: string): string {
  const normalized = packageName
    .trim()
    .replace(/[\u0000-\u001f\\/:*?"<>|]/gu, "-")
    .replace(/\s+/gu, " ")
    .replace(/[. ]+$/gu, "")
    .slice(0, 120);
  const safeStem = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/iu.test(normalized)
    ? `${normalized}-资源包`
    : normalized || "资源包";
  return `${safeStem}.pbres`;
}

function publicationKind(templateIds: string[]): PublicationKind {
  if (templateIds.length === 1 && templateIds[0] === "敌人") return "enemy";
  if (templateIds.length === 1 && templateIds[0] === "武器") return "weapon";
  return "mixed";
}

function mediaUrl(publicationId: string, assetId: string): string {
  return `/api/publications/${encodeURIComponent(publicationId)}/media/${encodeURIComponent(assetId)}`;
}
