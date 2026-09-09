import type {
  ContractDiagnostic,
  ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";
import type { PlatformCredentials } from "@pbdh/platform-auth/provider";

import {
  generatedPublicationCover,
  publicationLicense,
  type PublicationCoverDraft,
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
  type PublishVersionSuggestion,
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
  versionSuggestion?: PublishVersionSuggestion & { automatic: boolean };
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
    licenseId: string;
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
  ): Promise<PublishVersionSuggestion>;
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

function embeddedPublicationCover(workspace: CreatorWorkspace): PublicationCoverDraft | null {
  const assetId = workspace.document.publication?.coverAssetId;
  if (!assetId) return null;
  const asset = workspace.document.assets.find((candidate) => candidate.id === assetId);
  const bytes = workspace.media.get(assetId);
  if (!asset || !bytes) return null;
  return {
    assetId,
    url: "",
    asset: structuredClone(asset),
    bytes: bytes.slice(),
  };
}

async function creatorPublicationDraft(
  workspace: CreatorWorkspace,
  version: string,
  port: CreatorPublicationPort,
  allowEmptyCover = false,
): Promise<CreatorPublicationDraft> {
  const publication = workspace.document.publication;
  let cover = embeddedPublicationCover(workspace);
  if (!cover) {
    try {
      cover = await port.generateCover(workspace);
    } catch (error) {
      if (!allowEmptyCover) throw error;
      cover = { assetId: "", url: "" };
    }
  }
  return {
    package: {
      name: workspace.document.package.name,
      version,
      description: workspace.document.package.description,
      targets: structuredClone(workspace.document.targets),
    },
    publication: {
      title: workspace.document.package.name,
      summary: workspace.document.package.description,
      language: publication?.language ?? "中文",
      tags: [...(publication?.tags ?? [])],
      licenseId: workspace.document.license.label,
    },
    cover,
  };
}

export async function prepareCreatorPackageInformation(
  workspace: CreatorWorkspace,
  port: CreatorPublicationPort = browserPublicationPort,
): Promise<CreatorPublicationPreparation> {
  try {
    return {
      ok: true,
      draft: await creatorPublicationDraft(workspace, workspace.document.package.version, port, true),
    };
  } catch {
    return {
      ok: false,
      title: "无法准备资源包信息",
      diagnostics: [diagnostic("creator.publication-cover.render-failed", "/publication/cover")],
    };
  }
}

export async function prepareCreatorPublication(
  workspace: CreatorWorkspace,
  credentials: PlatformCredentials | null,
  port: CreatorPublicationPort = browserPublicationPort,
): Promise<CreatorPublicationPreparation> {
  if (!credentials) return authRequiredFailure();
  try {
    const suggestion = await port.suggestVersion(workspace.document, credentials);
    return {
      ok: true,
      draft: {
        ...await creatorPublicationDraft(workspace, suggestion.version, port),
        versionSuggestion: { ...suggestion, automatic: true },
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

async function prepareCreatorCandidate(
  workspace: CreatorWorkspace,
  draft: CreatorPublicationDraft,
) {
  const editedWorkspace = updateWorkspacePackageMetadata(workspace, draft.package);
  return preparePublicationCandidate(editedWorkspace, {
    title: draft.publication.title,
    summary: draft.publication.summary,
    language: draft.publication.language,
    tags: draft.publication.tags,
    coverAssetId: draft.cover.assetId,
  }, draft.cover.asset && draft.cover.bytes
    ? { asset: draft.cover.asset, bytes: draft.cover.bytes }
    : undefined, publicationLicense(draft.publication.licenseId, workspace.document.license));
}

export async function saveCreatorPackageInformation(
  workspace: CreatorWorkspace,
  draft: CreatorPublicationDraft,
): Promise<CreatorPublicationResult> {
  const edited = updateWorkspacePackageMetadata(workspace, draft.package);
  edited.document.license = publicationLicense(draft.publication.licenseId, workspace.document.license);
  edited.document.publication = {
    language: draft.publication.language,
    tags: [...draft.publication.tags],
    coverAssetId: draft.cover.assetId,
  };
  if (draft.cover.asset && draft.cover.bytes) {
    const asset = structuredClone(draft.cover.asset);
    const index = edited.document.assets.findIndex((candidate) => candidate.id === asset.id);
    if (index >= 0) edited.document.assets[index] = asset;
    else edited.document.assets.push(asset);
    edited.media.set(asset.id, new Uint8Array(draft.cover.bytes));
  }
  return {
    ok: true,
    workspace: edited,
    message: "资源包信息已保存",
  };
}

export async function publishCreatorWorkspace(
  workspace: CreatorWorkspace,
  draft: CreatorPublicationDraft,
  credentials: PlatformCredentials | null,
  port: CreatorPublicationPort = browserPublicationPort,
): Promise<CreatorPublicationResult> {
  if (!credentials) return authRequiredFailure();

  try {
    let selectedDraft = draft;
    if (draft.versionSuggestion?.automatic) {
      const edited = await saveCreatorPackageInformation(workspace, draft);
      if (!edited.ok) return edited;
      const suggestion = await port.suggestVersion(edited.workspace.document, credentials);
      selectedDraft = { ...draft, package: { ...draft.package, version: suggestion.version } };
    }
    const prepared = await prepareCreatorCandidate(workspace, selectedDraft);
    if (!prepared.ok) return { ok: false, title: "发布门禁未通过", diagnostics: prepared.diagnostics };
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
