import type { Publication, PublicationKind, PublicationResource } from "./market-model.ts";
import type { AuthStatus } from "@pbdh/platform-auth/core";
import {
  platformRequestHeaders,
  type PlatformCredentials,
} from "@pbdh/platform-auth/provider";

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
  document?: {
    package?: { name: string };
    assets: Array<{ id: string }>;
    resources: Array<ApiResourceSummary & { data: Record<string, unknown>; presentation: unknown; media: Record<string, string> }>;
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
  const response = await fetcher("/api/publications", { headers: { Accept: "application/json" } });
  const payload = await response.json() as ApiErrorPayload & { publications?: ApiPublication[] };
  if (!response.ok || !payload.publications) throw new Error(payload.error?.message ?? "资源市场暂不可用。");
  return payload.publications.map(publicationFromApi);
}

export async function loadPublication(
  publicationId: string,
  fetcher: typeof fetch = fetch,
): Promise<Publication> {
  const response = await fetcher(`/api/publications/${encodeURIComponent(publicationId)}`, {
    headers: { Accept: "application/json" },
  });
  const payload = await response.json() as ApiErrorPayload & { publication?: ApiPublication };
  if (!response.ok || !payload.publication) throw new Error(payload.error?.message ?? "无法打开该出版物。");
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

export function republishPublication(
  publicationId: string,
  credentials: PlatformCredentials,
  fetcher: typeof fetch = fetch,
): Promise<Publication> {
  return mutatePublication(publicationId, "republish", "POST", undefined, credentials, fetcher);
}

export function updatePublicationMetadata(
  publicationId: string,
  metadata: PublicationMetadataInput,
  credentials: PlatformCredentials,
  fetcher: typeof fetch = fetch,
): Promise<Publication> {
  return mutatePublication(publicationId, "metadata", "PATCH", metadata, credentials, fetcher);
}

async function mutatePublication(
  publicationId: string,
  action: "unpublish" | "republish" | "metadata",
  method: "POST" | "PATCH",
  body: PublicationMetadataInput | undefined,
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
  if (!response.ok || !payload.publication) throw apiError(response, payload, "无法更新出版物。");
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
  const assetIds = source.document?.assets.map((asset) => asset.id) ?? [source.coverAssetId];
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
  const firstSystem = source.targetSystemPackageIds[0] ?? "未指定";
  return {
    id: source.publicationId,
    packageId: source.packageId,
    packageVersion: source.packageVersion,
    snapshotDigest: source.snapshotDigest,
    title: source.title,
    ownerAccountId: source.author.accountId,
    author: source.author.username ?? "未设置用户名",
    summary: source.summary,
    kind,
    templateIds: source.templateIds,
    system: firstSystem,
    systemLabel: firstSystem === "01a0132c-4eef-7703-94ac-ec8d1a660001" ? "Daggerheart Core" : firstSystem,
    language: source.language,
    categories: source.templateIds,
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
