import { readFileSync } from "node:fs";

import { describe, expect, test, vi } from "vitest";

import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import type { PlatformCredentials } from "@pbdh/platform-auth/provider";
import minotaurPackage from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import {
  publishCandidate,
} from "../../apps/creator/src/workspace-prototype/publication-api.ts";

describe("Creator publication API", () => {
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
    const credentials: PlatformCredentials = {
      accountId: "account",
      accessToken: "token",
      siteSessionId: "session",
      canWrite: true,
    };

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
