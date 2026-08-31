import type {
  ContractDiagnostic,
  ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";
import type { PlatformCredentials } from "@pbdh/platform-auth/provider";

import {
  generatedPublicationCover,
  publicationLicenseId,
  publicationLicenses,
  type PublicationCoverDraft,
  type PublicationLicenseId,
} from "./creator-publication.ts";
import {
  preparePublicationCandidate,
  type PublicationCandidate,
} from "./publication-candidate.ts";
import {
  PublicationApiError,
  publishCandidate,
  suggestPublishVersion,
  type PublishedPublication,
} from "./publication-api.ts";
import {
  collapsePublicationFieldErrors,
  publicationSuccessMessage,
} from "./publication-feedback.ts";
import {
  updateWorkspacePackageMetadata,
  type CreatorWorkspace,
} from "./workspace-model.ts";

export type CreatorPublicationDraft = {
  package: {
    name: string;
    version: string;
    description: string;
    targets: ResourcePackageLogicalDocument["targets"];
  };
  publication: {
    title: string;
    summary: string;
    language: string;
    tags: string[];
    licenseId: PublicationLicenseId;
  };
  cover: PublicationCoverDraft;
};

export type CreatorPublicationFailure = {
  ok: false;
  title: string;
  diagnostics: ContractDiagnostic[];
};

export type CreatorPublicationPreparation =
  | CreatorPublicationFailure
  | { ok: true; draft: CreatorPublicationDraft };

export type CreatorPublicationResult =
  | CreatorPublicationFailure
  | { ok: true; workspace: CreatorWorkspace; message: string };

export type CreatorPublicationPort = {
  suggestVersion(
    document: ResourcePackageLogicalDocument,
    credentials: PlatformCredentials,
  ): Promise<string>;
  generateCover(workspace: CreatorWorkspace): Promise<PublicationCoverDraft>;
  publish(
    candidate: PublicationCandidate,
    credentials: PlatformCredentials,
  ): Promise<{ publication: PublishedPublication }>;
};

const browserPublicationPort: CreatorPublicationPort = {
  suggestVersion: suggestPublishVersion,
  generateCover: generatedPublicationCover,
  publish: publishCandidate,
};

export async function prepareCreatorPublication(
  workspace: CreatorWorkspace,
  credentials: PlatformCredentials | null,
  port: CreatorPublicationPort = browserPublicationPort,
): Promise<CreatorPublicationPreparation> {
  if (!credentials) return authRequiredFailure();
  try {
    const version = await port.suggestVersion(workspace.document, credentials);
    const cover = await port.generateCover(workspace);
    return {
      ok: true,
      draft: {
        package: {
          name: workspace.document.package.name,
          version,
          description: workspace.document.package.description,
          targets: structuredClone(workspace.document.targets),
        },
        publication: {
          title: workspace.document.package.name,
          summary: workspace.document.package.description,
          language: "中文",
          tags: [],
          licenseId: publicationLicenseId(workspace.document.license.label),
        },
        cover,
      },
    };
  } catch (error) {
    const apiFailure = error instanceof PublicationApiError;
    return {
      ok: false,
      title: apiFailure ? "无法确定发布版本" : "无法生成发布封面",
      diagnostics: [diagnostic(
        apiFailure
          ? error.code
          : error instanceof Error && error.message === "creator.publication-cover.resource-missing"
            ? "creator.publication-cover.resource-missing"
            : "creator.publication-cover.render-failed",
        "/publication/cover",
      )],
    };
  }
}

export async function publishCreatorWorkspace(
  workspace: CreatorWorkspace,
  draft: CreatorPublicationDraft,
  credentials: PlatformCredentials | null,
  port: CreatorPublicationPort = browserPublicationPort,
): Promise<CreatorPublicationResult> {
  const editedWorkspace = updateWorkspacePackageMetadata(workspace, draft.package);
  const prepared = await preparePublicationCandidate(editedWorkspace, {
    title: draft.publication.title,
    summary: draft.publication.summary,
    language: draft.publication.language,
    tags: draft.publication.tags,
    coverAssetId: draft.cover.assetId,
  }, draft.cover.asset && draft.cover.bytes
    ? { asset: draft.cover.asset, bytes: draft.cover.bytes }
    : undefined, publicationLicenses[draft.publication.licenseId]);
  if (!prepared.ok) {
    return { ok: false, title: "发布门禁未通过", diagnostics: prepared.diagnostics };
  }
  if (!credentials) return authRequiredFailure();

  try {
    const published = await port.publish(prepared.candidate, credentials);
    return {
      ok: true,
      workspace: {
        ...workspace,
        document: prepared.candidate.document,
        media: prepared.candidate.media,
        dirty: false,
        dirtyResourceIds: [],
      },
      message: publicationSuccessMessage(prepared.candidate.document.package.name, published.publication),
    };
  } catch (error) {
    const fieldDiagnostics = error instanceof PublicationApiError
      ? collapsePublicationFieldErrors(error.fieldErrors).map((item) => diagnostic(
          item.code,
          item.path,
          { message: item.message, count: item.count },
          "resource-package",
        ))
      : [];
    return {
      ok: false,
      title: "发布失败",
      diagnostics: fieldDiagnostics.length > 0 ? fieldDiagnostics : [diagnostic(
        error instanceof PublicationApiError ? error.code : "PUBLICATION_REQUEST_FAILED",
        "/publication",
        { message: error instanceof Error ? error.message : "unknown" },
      )],
    };
  }
}

function authRequiredFailure(): CreatorPublicationFailure {
  return {
    ok: false,
    title: "需要登录",
    diagnostics: [diagnostic("AUTH_REQUIRED", "/publication")],
  };
}

function diagnostic(
  code: string,
  location: string,
  params: Record<string, unknown> = {},
  family = "creator-prototype",
): ContractDiagnostic {
  return { code, severity: "error", family, version: "1", location, params };
}
