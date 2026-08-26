import { describe, expect, it, vi } from "vitest";

import type { PlatformCredentials } from "@pbdh/platform-auth/provider";
import {
  loadManageablePublication,
  loadManageablePublications,
  loadPublicationArchive,
  loadPublications,
  loadVisiblePublications,
  republishPublication,
  updatePublicationMetadata,
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

describe("Market publication API", () => {
  it("keeps the server-authoritative unpublished status", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      publications: [apiPublication],
    }));

    const [publication] = await loadPublications(fetcher);

    expect(publication?.status).toBe("unpublished");
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
      .mockResolvedValueOnce(jsonResponse({ publications: [published] }))
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
      .mockResolvedValueOnce(jsonResponse({ publication: { ...apiPublication, status: "published" } }))
      .mockResolvedValueOnce(jsonResponse({
        publication: { ...apiPublication, title: "新标题", status: "published" },
      }));

    const unpublished = await unpublishPublication(apiPublication.publicationId, credentials, fetcher);
    const republished = await republishPublication(apiPublication.publicationId, credentials, fetcher);
    const edited = await updatePublicationMetadata(apiPublication.publicationId, {
      title: "新标题",
      summary: apiPublication.summary,
      language: apiPublication.language,
      tags: apiPublication.tags,
      coverAssetId: apiPublication.coverAssetId,
    }, credentials, fetcher);

    expect(unpublished.status).toBe("unpublished");
    expect(republished.status).toBe("published");
    expect(edited.title).toBe("新标题");
    expect(fetcher.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/publications/publication-123/unpublish", "POST"],
      ["/api/publications/publication-123/republish", "POST"],
      ["/api/publications/publication-123/metadata", "PATCH"],
    ]);
  });
});
