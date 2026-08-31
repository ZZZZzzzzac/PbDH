import { readFileSync } from "node:fs";

import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import type { PlatformCredentials } from "@pbdh/platform-auth/provider";
import { describe, expect, test, vi } from "vitest";

import minotaurPackage from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import {
  prepareCreatorPublication,
  publishCreatorWorkspace,
  type CreatorPublicationDraft,
  type CreatorPublicationPort,
} from "../../apps/creator/src/workspace-prototype/creator-publication-workflow.ts";
import { PublicationApiError } from "../../apps/creator/src/workspace-prototype/publication-api.ts";
import { createWorkspace } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";

const credentials: PlatformCredentials = {
  accountId: "account",
  accessToken: "token",
  siteSessionId: "session",
  canWrite: true,
};
const document = minotaurPackage as unknown as ResourcePackageLogicalDocument;
const asset = document.assets[0]!;
const bytes = new Uint8Array(readFileSync(new URL(
  `../../contracts/conformance/resource-package/1.0.0/media/${asset.id.replace("sha256:", "")}.webp`,
  import.meta.url,
)));
const workspace = createWorkspace({ document, media: new Map([[asset.id, bytes]]) });

function port(overrides: Partial<CreatorPublicationPort> = {}): CreatorPublicationPort {
  return {
    suggestVersion: vi.fn().mockResolvedValue("2.1.0"),
    generateCover: vi.fn().mockResolvedValue({ assetId: asset.id, asset, bytes, url: "blob:cover" }),
    publish: vi.fn().mockResolvedValue({
      publication: {
        publicationId: "publication",
        packageVersion: "2.1.0",
        created: false,
        idempotent: false,
      },
    }),
    ...overrides,
  };
}

function draft(): CreatorPublicationDraft {
  return {
    package: {
      name: "荒野遭遇集",
      version: "2.1.0",
      description: "公开说明",
      targets: [],
    },
    publication: {
      title: "荒野遭遇集",
      summary: "公开说明",
      language: "中文",
      tags: [],
      licenseId: "public-domain",
    },
    cover: { assetId: asset.id, asset, bytes, url: "blob:cover" },
  };
}

describe("Creator publication workflow", () => {
  test("rejects signed-out preparation before invoking remote or rendering adapters", async () => {
    const adapter = port();
    const result = await prepareCreatorPublication(workspace, null, adapter);

    expect(result).toMatchObject({ ok: false, title: "需要登录" });
    expect(adapter.suggestVersion).not.toHaveBeenCalled();
    expect(adapter.generateCover).not.toHaveBeenCalled();
  });

  test("prepares one complete draft behind the workflow interface", async () => {
    const result = await prepareCreatorPublication(workspace, credentials, port());

    expect(result).toMatchObject({
      ok: true,
      draft: {
        package: { name: document.package.name, version: "2.1.0" },
        publication: { title: document.package.name, language: "中文", tags: [] },
        cover: { assetId: asset.id },
      },
    });
  });

  test("publishes a validated snapshot and returns the persisted workspace outcome", async () => {
    const adapter = port();
    const result = await publishCreatorWorkspace(workspace, draft(), credentials, adapter);

    expect(result).toMatchObject({
      ok: true,
      workspace: { dirty: false, dirtyResourceIds: [], document: { package: { name: "荒野遭遇集", version: "2.1.0" } } },
      message: "已更新已有的“荒野遭遇集”",
    });
    expect(adapter.publish).toHaveBeenCalledOnce();
  });

  test("collapses repeated backend field errors into stable diagnostics", async () => {
    const adapter = port({
      publish: vi.fn().mockRejectedValue(new PublicationApiError(
        "invalid",
        "PUBLICATION_CANDIDATE_INVALID",
        422,
        [
          { path: "/resources/0", code: "template.version.unsupported", message: "unsupported" },
          { path: "/resources/1", code: "template.version.unsupported", message: "unsupported" },
        ],
      )),
    });
    const result = await publishCreatorWorkspace(workspace, draft(), credentials, adapter);

    expect(result).toMatchObject({
      ok: false,
      title: "发布失败",
      diagnostics: [{
        code: "template.version.unsupported",
        params: { message: "unsupported", count: 2 },
      }],
    });
  });
});
