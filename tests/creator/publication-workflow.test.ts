import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { DexieLocalDocumentStore, PbDHLocalDatabase } from "@pbdh/local-storage";
import { CreatorWorkspaceRepository } from "../../apps/creator/src/workspace-prototype/creator-workspace-repository.ts";

import { loadPbres, writePbres, type ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import type { PlatformCredentials } from "@pbdh/platform-auth/provider";
import { describe, expect, test, vi } from "vitest";

import minotaurPackage from "../../contracts/conformance/resource-package/1.0.0/valid/minotaur-wrecker.json";
import {
  prepareCreatorPackageInformation,
  prepareCreatorPublication,
  publishCreatorWorkspace,
  saveCreatorPackageInformation,
  type CreatorPublicationDraft,
  type CreatorPublicationPort,
} from "../../apps/creator/src/workspace-prototype/creator-publication-workflow.ts";
import { PublicationApiError } from "../../apps/creator/src/workspace-prototype/publication-api.ts";
import { validateResourcePackageCandidate } from "../../apps/creator/src/workspace-prototype/resource-package-validator.ts";
import { createBlankWorkspace, createWorkspace, prepareWorkspaceExport } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";

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
    suggestVersion: vi.fn().mockResolvedValue({ version: "2.1.0", summary: "新增资源或关联" }),
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
  test.each([true, false])("发布时复核自动版本，手动版本不被替换（自动：%s）", async (automatic) => {
    const selected = draft();
    selected.package.version = "9.0.0";
    selected.package.description = "窗口中最终修改的说明";
    selected.publication.summary = selected.package.description;
    selected.versionSuggestion = { version: "2.1.0", summary: "原建议", automatic };
    const adapter = port({
      suggestVersion: vi.fn().mockResolvedValue({ version: "3.0.0", summary: "资源结构或目标声明发生变化" }),
      publish: vi.fn().mockImplementation(async (candidate) => ({ publication: {
        publicationId: "publication", packageVersion: candidate.document.package.version, created: false, idempotent: false,
      } })),
    });
    const result = await publishCreatorWorkspace(workspace, selected, credentials, adapter);
    expect(result).toMatchObject({ ok: true, workspace: { document: { package: {
      version: automatic ? "3.0.0" : "9.0.0", description: selected.package.description,
    } } } });
    if (automatic) expect(adapter.suggestVersion).toHaveBeenCalledWith(expect.objectContaining({
      package: expect.objectContaining({ description: selected.package.description }),
    }), credentials);
    else expect(adapter.suggestVersion).not.toHaveBeenCalled();
    if (!result.ok) throw new Error("Publication failed");
    expect(await validateResourcePackageCandidate(result.workspace.document, result.workspace.media)).toEqual([]);
    expect(workspace.document.package.version).toBe("1.0.0");
  });

  test.each(["empty", "unfinished"])("允许 %s 草稿保存资料，但拒绝发布", async (state) => {
    const source = state === "empty" ? await createBlankWorkspace("草稿") : createWorkspace(workspace);
    if (state === "unfinished") source.document.resources[0]!.path = "";
    const adapter = port({ generateCover: vi.fn().mockRejectedValue(new Error("no cover")) });
    const prepared = await prepareCreatorPackageInformation(source, adapter);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error("Draft preparation failed");
    prepared.draft.package.name = "已修改的草稿";
    prepared.draft.publication.title = "已修改的草稿";
    prepared.draft.publication.language = "English";
    prepared.draft.publication.tags = ["draft"];
    const saved = await saveCreatorPackageInformation(source, prepared.draft);
    expect(saved).toMatchObject({ ok: true, workspace: { dirty: true, document: {
      package: { name: "已修改的草稿" },
      publication: { language: "English", tags: ["draft"] },
    } } });
    if (!saved.ok) throw new Error("Draft save failed");
    const database = new PbDHLocalDatabase(`creator-draft-${crypto.randomUUID()}`);
    try {
      const repository = new CreatorWorkspaceRepository(new DexieLocalDocumentStore(database));
      await repository.save(saved.workspace);
      const restored = (await repository.list())[0]!;
      const reopened = await prepareCreatorPackageInformation(restored, adapter);
      expect(reopened).toMatchObject({ ok: true, draft: {
        package: { name: "已修改的草稿" }, publication: { language: "English", tags: ["draft"] },
      } });
      const exported = await prepareWorkspaceExport(restored);
      expect((await validateResourcePackageCandidate(exported.document, exported.media))
        .some((diagnostic) => diagnostic.severity === "error")).toBe(true);
    } finally {
      database.close();
      await database.delete();
    }
    const publication = await publishCreatorWorkspace(saved.workspace, prepared.draft, credentials, adapter)
      .catch(() => ({ ok: false }));
    expect(publication.ok).toBe(false);
    expect(adapter.publish).not.toHaveBeenCalled();
  });

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
        versionSuggestion: { version: "2.1.0", summary: "新增资源或关联", automatic: true },
        publication: { title: document.package.name, language: "中文", tags: [] },
        cover: { assetId: asset.id },
      },
    });
  });

  test("restores self-contained PBRES publication metadata and cover for local editing", async () => {
    const embeddedDocument = structuredClone(document);
    embeddedDocument.publication = {
      language: "English",
      tags: ["adversary", "encounter"],
      coverAssetId: asset.id,
    };
    embeddedDocument.license = {
      label: "CC BY 4.0",
      declaration: "Creative Commons Attribution 4.0 International",
    };
    const embeddedWorkspace = createWorkspace({
      document: embeddedDocument,
      media: new Map([[asset.id, bytes]]),
    });
    const adapter = port();

    const result = await prepareCreatorPackageInformation(embeddedWorkspace, adapter);

    expect(result).toMatchObject({
      ok: true,
      draft: {
        publication: {
          language: "English",
          tags: ["adversary", "encounter"],
          licenseId: "CC BY 4.0",
        },
        cover: { assetId: asset.id },
      },
    });
    expect(adapter.suggestVersion).not.toHaveBeenCalled();
    expect(adapter.generateCover).not.toHaveBeenCalled();
  });

  test("preserves an unchanged custom license and accepts a newly entered license", async () => {
    const customDocument = structuredClone(document);
    customDocument.license = { label: "自定义许可", declaration: "保留原有的详细许可声明。" };
    const customWorkspace = createWorkspace({ document: customDocument, media: new Map([[asset.id, bytes]]) });
    const prepared = await prepareCreatorPackageInformation(customWorkspace, port());

    expect(prepared).toMatchObject({ ok: true, draft: { publication: { licenseId: "自定义许可" } } });
    if (!prepared.ok) return;
    const preserved = await saveCreatorPackageInformation(customWorkspace, prepared.draft);
    expect(preserved).toMatchObject({
      ok: true,
      workspace: { document: { license: { label: "自定义许可", declaration: "保留原有的详细许可声明。" } } },
    });

    prepared.draft.publication.licenseId = "另一种许可";
    const edited = await saveCreatorPackageInformation(customWorkspace, prepared.draft);
    expect(edited).toMatchObject({
      ok: true,
      workspace: { document: { license: { label: "另一种许可", declaration: "另一种许可" } } },
    });
  });

  test("saves publication fields into the local PBRES without calling the market", async () => {
    const localDraft = draft();
    localDraft.publication.language = "English";
    localDraft.publication.tags = ["domain", "homebrew"];
    localDraft.publication.licenseId = "CC BY-SA 4.0";

    const result = await saveCreatorPackageInformation(workspace, localDraft);

    expect(result).toMatchObject({
      ok: true,
      workspace: {
        dirty: true,
        document: {
          package: { name: "荒野遭遇集", description: "公开说明" },
          publication: {
            language: "English",
            tags: ["domain", "homebrew"],
            coverAssetId: asset.id,
          },
          license: { label: "CC BY-SA 4.0" },
        },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const exported = await prepareWorkspaceExport(result.workspace);
    const roundTrip = await loadPbres(
      writePbres(exported.document, exported.media),
      validateResourcePackageCandidate,
    );
    expect(roundTrip.diagnostics).toEqual([]);
    expect(roundTrip.candidate?.document.publication).toEqual({
      language: "English",
      tags: ["domain", "homebrew"],
      coverAssetId: asset.id,
    });
    expect(roundTrip.candidate?.media.get(asset.id)).toEqual(bytes);
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
