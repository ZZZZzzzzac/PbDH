import { describe, expect, it, vi } from "vitest";

import type { PlatformCredentials } from "@pbdh/platform-auth/provider";
import {
  loadManageablePublication,
  loadManageablePublications,
  loadPublicationArchive,
  deletePublication,
  loadPublicationCatalog,
  loadPublications,
  loadVisiblePublications,
  republishPublication,
  updatePublicationInformation,
  unpublishLoadedPublication,
  unpublishPublication,
} from "../../apps/market/src/market-api.ts";

const credentials: PlatformCredentials = {
  accessToken: "token-123",
  siteSessionId: "session-123",
  accountId: "account-123",
  canWrite: true,
};

const apiPublication = {
  publicationId: "publication-123",
  packageId: "package-123",
  packageVersion: "1.0.0",
  snapshotDigest: `sha256:${"1".repeat(64)}`,
  title: "荒野遭遇集",
  summary: "包含牛头人破坏者。",
  language: "zh-CN",
  tags: ["敌人"],
  coverAssetId: `sha256:${"2".repeat(64)}`,
  author: { accountId: "account-123", username: "zac" },
  updatedAt: "2026-08-25T00:00:00Z",
  templateIds: ["敌人"],
  targetSystemPackageIds: [],
  license: { label: "公有领域", declaration: "" },
  resourceCount: 1,
  resources: [{
    id: "resource-123",
    path: "resources/minotaur.json",
    template: { id: "敌人", version: "1.0.0" },
    name: "牛头人破坏者",
  }],
  status: "unpublished",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function binaryResponse(body = "media") {
  return new Response(new Blob([body], { type: "image/webp" }), { status: 200 });
}

it("管理列表与归档下载将明确的会话替换回报账号状态", async () => {
  const onSessionReplaced = vi.fn();
  const session = { ...credentials, onSessionReplaced };
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse({ error: { code: "AUTH_SESSION_REPLACED" } }, 401));
  await expect(loadManageablePublications(session, fetcher)).rejects.toMatchObject({ code: "AUTH_SESSION_REPLACED" });
  expect(onSessionReplaced).toHaveBeenCalledOnce();
  await expect(loadPublicationArchive("publication-123", session, fetcher)).rejects.toThrow("无法下载");
  expect(onSessionReplaced).toHaveBeenCalledTimes(2);
});

function catalogResponse(publications: unknown[]) {
  return {
    publications,
    pagination: { page: 1, pageSize: 24, total: publications.length, hasMore: false },
    facets: {
      templateIds: [{ value: "敌人", count: publications.length }],
      targetSystemPackageIds: [],
      languages: [{ value: "zh-CN", count: publications.length }],
      categories: [{ value: "敌人", count: publications.length }],
    },
  };
}

describe("Market publication API", () => {
  it("keeps the server-authoritative unpublished status", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(catalogResponse([apiPublication])));

    const [publication] = await loadPublications(fetcher);

    expect(publication?.status).toBe("unpublished");
  });

  it("shows the preset system name instead of its stable identifier", async () => {
    const heartOfHopefind = {
      ...apiPublication,
      publicationId: "publication-heart-of-hopefind",
      title: "寻望之心官方资源",
      targetSystemPackageIds: ["01a04186-51be-74e1-b94f-ec17d354dc00"],
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(catalogResponse([heartOfHopefind])));

    const [publication] = await loadPublications(fetcher);

    expect(publication?.systemLabels).toEqual(["寻望之心"]);
  });

  it("serializes server-side filters, sorting, and pagination without losing repeated values", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(catalogResponse([apiPublication])));

    const catalog = await loadPublicationCatalog({
      query: " 牛头人 ",
      filters: {
        templateIds: ["敌人", "环境"],
        systems: ["system-a", "system-b"],
        languages: ["zh-CN"],
        categories: ["荒野"],
      },
      sort: "relevance",
      page: 2,
      pageSize: 12,
      authorAccountId: "account-123",
    }, fetcher);

    const url = new URL(String(fetcher.mock.calls[0]?.[0]), "https://pbdh.test");
    expect(url.searchParams.get("q")).toBe("牛头人");
    expect(url.searchParams.getAll("templateId")).toEqual(["敌人", "环境"]);
    expect(url.searchParams.getAll("targetSystemPackageId")).toEqual(["system-a", "system-b"]);
    expect(url.searchParams.get("language")).toBe("zh-CN");
    expect(url.searchParams.get("category")).toBe("荒野");
    expect(url.searchParams.get("sort")).toBe("relevance");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("pageSize")).toBe("12");
    expect(url.searchParams.get("authorAccountId")).toBe("account-123");
    expect(catalog.facets.templateIds).toEqual([{ value: "敌人", count: 1 }]);
  });

  it("loads manageable publications and unpublished detail with active-session headers", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ publications: [apiPublication] }))
      .mockResolvedValueOnce(binaryResponse("cover-list"))
      .mockResolvedValueOnce(jsonResponse({ publication: apiPublication }))
      .mockResolvedValueOnce(binaryResponse("cover-detail"));
    const createObjectUrl = vi.fn((blob: Blob) => `blob:test-${blob.size}`);

    const publications = await loadManageablePublications(credentials, fetcher, createObjectUrl);
    const publication = await loadManageablePublication(apiPublication.publicationId, credentials, fetcher, createObjectUrl);

    expect(publications).toHaveLength(1);
    expect(publication.status).toBe("unpublished");
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/publications/manageable",
      `/api/publications/publication-123/media/${encodeURIComponent(apiPublication.coverAssetId)}`,
      "/api/publications/publication-123/manage",
      `/api/publications/publication-123/media/${encodeURIComponent(apiPublication.coverAssetId)}`,
    ]);
    for (const [, init] of fetcher.mock.calls) {
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer token-123");
      expect(headers.get("X-PbDH-Session")).toBe("session-123");
    }
  });

  it("does not commit an anonymous catalog while authentication is restoring", async () => {
    const fetcher = vi.fn<typeof fetch>();

    await expect(loadVisiblePublications("loading", null, fetcher)).resolves.toBeNull();
    await expect(loadVisiblePublications("working", null, fetcher)).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps the public catalog visible when private media hydration fails", async () => {
    const published = { ...apiPublication, publicationId: "public-123", status: "published" as const };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(catalogResponse([published])))
      .mockResolvedValueOnce(jsonResponse({ publications: [apiPublication] }))
      .mockResolvedValueOnce(jsonResponse({
        error: { code: "PUBLICATION_MEDIA_NOT_FOUND", message: "没有找到该媒体。" },
      }, 404));

    const visible = await loadVisiblePublications("authenticated", credentials, fetcher);

    expect(visible?.map((publication) => publication.id)).toEqual(["public-123"]);
  });

  it("downloads an unpublished archive with active-session headers", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(binaryResponse("pbres"));

    const archive = await loadPublicationArchive(apiPublication.publicationId, credentials, fetcher);

    expect(archive.size).toBe(5);
    const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-123");
    expect(headers.get("X-PbDH-Session")).toBe("session-123");
  });

  it("uses authenticated lifecycle endpoints and returns their authoritative state", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ publication: { ...apiPublication, status: "unpublished" } }))
      .mockResolvedValueOnce(jsonResponse({ publication: { ...apiPublication, status: "published" } }));

    const unpublished = await unpublishPublication(apiPublication.publicationId, credentials, fetcher);
    const republished = await republishPublication(apiPublication.publicationId, credentials, fetcher);

    expect(unpublished.status).toBe("unpublished");
    expect(republished.status).toBe("published");
    expect(fetcher.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/publications/publication-123/unpublish", "POST"],
      ["/api/publications/publication-123/republish", "POST"],
    ]);
  });

  it("uploads a cropped market cover together with the unified package information", async () => {
    const updatedCoverId = `sha256:${"a".repeat(64)}`;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      publication: { ...apiPublication, coverAssetId: updatedCoverId, status: "published" },
    }));
    const cover = new Blob(["RIFF0000WEBPcover"], { type: "image/webp" });

    const updated = await updatePublicationInformation(apiPublication.publicationId, {
      package: { name: "荒野遭遇集", version: "1.0.0", description: "包含牛头人破坏者。" },
      targets: [],
      title: "荒野遭遇集",
      summary: "包含牛头人破坏者。",
      language: "zh-CN",
      tags: ["荒野"],
      license: { label: "DPCGL", declaration: "Darrington Press Community Gaming License (DPCGL)" },
      coverAssetId: updatedCoverId,
      coverAsset: {
        id: updatedCoverId,
        mediaType: "image/webp",
        byteLength: String(cover.size),
        width: "630",
        height: "880",
      },
    }, credentials, fetcher, cover);

    expect(updated.cover.assetId).toBe(updatedCoverId);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("/api/publications/publication-123/information-with-cover");
    expect(init?.method).toBe("PATCH");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-123");
    expect(headers.has("Content-Type")).toBe(false);
    expect(init?.body).toBeInstanceOf(FormData);
    const body = init?.body as FormData;
    const uploadedCover = body.get("cover") as File;
    expect(uploadedCover.name).toBe("publication-cover.webp");
    expect(uploadedCover.type).toBe("image/webp");
    expect(uploadedCover.size).toBe(cover.size);
    expect(JSON.parse(String(body.get("information")))).toMatchObject({
      package: { name: "荒野遭遇集" },
      license: { label: "DPCGL" },
      coverAssetId: updatedCoverId,
    });
  });

  it("cancels publication without reloading every package asset", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      publication: { ...apiPublication, status: "unpublished", updatedAt: "2026-08-30T01:02:03Z" },
    }));
    const loaded = {
      ...(await loadPublications(vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(catalogResponse([{ ...apiPublication, status: "published" }])),
      )))[0]!,
      cover: { assetId: apiPublication.coverAssetId, url: "blob:loaded-cover", alt: apiPublication.title },
      mediaUrls: { [apiPublication.coverAssetId]: "blob:loaded-cover", "sha256:extra": "blob:loaded-extra" },
    };

    const unpublished = await unpublishLoadedPublication(loaded, credentials, fetcher);

    expect(unpublished.status).toBe("unpublished");
    expect(unpublished.updatedAt).toBe("2026-08-30T01:02:03Z");
    expect(unpublished.cover.url).toBe("blob:loaded-cover");
    expect(unpublished.mediaUrls).toEqual(loaded.mediaUrls);
    expect(fetcher.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/publications/publication-123/unpublish", "POST"],
    ]);
  });

  it("permanently deletes an unpublished publication through the authenticated endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));

    await deletePublication(apiPublication.publicationId, credentials, fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/publications/publication-123",
      expect.objectContaining({ method: "DELETE" }),
    );
    const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-123");
    expect(headers.get("X-PbDH-Session")).toBe("session-123");
  });
});
