import { readFileSync } from "node:fs";

import { describe, expect, test, vi } from "vitest";

import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import type { PlatformCredentials } from "@pbdh/platform-auth/provider";
import minotaurPackage from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import {
  publishCandidate,
  suggestPublishVersion,
} from "../../apps/creator/src/workspace-prototype/publication-api.ts";

describe("Creator publication API", () => {
  const credentials: PlatformCredentials = {
    accountId: "account",
    accessToken: "token",
    siteSessionId: "session",
    canWrite: true,
  };

  test("defaults a new Resource Package to 1.0.0", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      publications: [],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    await expect(suggestPublishVersion(
      minotaurPackage as unknown as ResourcePackageLogicalDocument,
      credentials,
      fetcher,
    )).resolves.toEqual({ version: "1.0.0", summary: "首次发布" });
    expect(fetcher).toHaveBeenCalledWith("/api/publications/manageable", {
      headers: {
        Authorization: "Bearer token",
        "X-PbDH-Session": "session",
      },
    });
  });

  test("invalid catalog responses are not treated as a first publication", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(suggestPublishVersion(minotaurPackage as unknown as ResourcePackageLogicalDocument, credentials, fetcher))
      .rejects.toMatchObject({ code: "PUBLICATION_CATALOG_INVALID" });
  });

  test("fills the computed minimum version from a current 1.1.0 Market snapshot", async () => {
    const previous = structuredClone(minotaurPackage) as unknown as ResourcePackageLogicalDocument;
    previous.contractVersion = "1.1.0";
    const current = structuredClone(previous);
    current.package.version = "9.9.9";
    current.package.description = "修改后的说明";
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        publications: [{ publicationId: "publication-1", packageId: previous.package.id }],
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        publication: { document: previous },
      }), { status: 200, headers: { "content-type": "application/json" } }));

    await expect(suggestPublishVersion(current, credentials, fetcher)).resolves.toEqual({ version: "1.0.1", summary: "更新现有内容" });
    expect(fetcher).toHaveBeenLastCalledWith("/api/publications/publication-1/manage", {
      headers: {
        Authorization: "Bearer token",
        "X-PbDH-Session": "session",
      },
    });
  });

  test("preserves backend field errors instead of hiding validation details", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      schemaVersion: "1.0.0",
      error: {
        code: "PUBLICATION_CANDIDATE_INVALID",
        message: "资源包未通过发布校验。",
        fieldErrors: [{
          path: "/resources/0",
          code: "template.version.unsupported",
          message: "template.version.unsupported",
        }],
      },
    }), { status: 422, headers: { "content-type": "application/json" } }));

    const document = minotaurPackage as unknown as ResourcePackageLogicalDocument;
    const media = new Map(document.assets.map((asset) => [
      asset.id,
      new Uint8Array(readFileSync(new URL(
        `../../contracts/conformance/resource-package/1.0.0/media/${asset.id.replace("sha256:", "")}.webp`,
        import.meta.url,
      ))),
    ]));
    await expect(publishCandidate({
      document,
      media,
      metadata: {
        title: "牛头人",
        summary: "测试",
        language: "zh-CN",
        tags: [],
        coverAssetId: document.assets[0]!.id,
      },
    }, credentials, fetcher)).rejects.toMatchObject({
      code: "PUBLICATION_CANDIDATE_INVALID",
      fieldErrors: [{
        path: "/resources/0",
        code: "template.version.unsupported",
        message: "template.version.unsupported",
      }],
    });
  });
});
