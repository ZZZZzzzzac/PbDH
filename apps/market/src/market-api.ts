import type { Publication, PublicationKind, PublicationResource } from "./market-model.ts";

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
  document?: {
    package?: { name: string };
    assets: Array<{ id: string }>;
    resources: Array<ApiResourceSummary & { data: Record<string, unknown>; presentation: unknown; media: Record<string, string> }>;
  };
};

type ApiErrorPayload = { error?: { code?: string; message?: string } };

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
    status: "available",
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
