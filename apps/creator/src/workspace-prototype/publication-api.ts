import {
  classifyResourcePackageVersionChange,
  createResourcePackageVersionBaseline,
  writePbres,
  type ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";
import type { PlatformCredentials } from "@pbdh/platform-auth/provider";

import type { PublicationCandidate } from "./publication-candidate.ts";

export class PublicationApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly fieldErrors: ReadonlyArray<{ path: string; code: string; message: string }> = [],
  ) {
    super(message);
  }
}

export type PublishedPublication = {
  publicationId: string;
  packageVersion: string;
  created: boolean;
  idempotent: boolean;
};

type ManageablePublication = {
  publicationId: string;
  packageId: string;
};

export async function suggestPublishVersion(
  document: ResourcePackageLogicalDocument,
  credentials: PlatformCredentials,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  if (!credentials.canWrite) {
    throw new PublicationApiError("当前设备已失去云端写入权，请重新接管账号会话。", "AUTH_SESSION_REPLACED", 401);
  }
  const headers = {
    Authorization: `Bearer ${credentials.accessToken}`,
    "X-PbDH-Session": credentials.siteSessionId,
  };
  const listResponse = await fetcher("/api/publications/manageable", { headers });
  const listPayload = await readJson(listResponse);
  if (!listResponse.ok) throw publicationResponseError(listResponse, listPayload);
  const publications = Array.isArray(listPayload.publications)
    ? listPayload.publications as ManageablePublication[]
    : [];
  const current = publications.find((publication) => publication.packageId === document.package.id);
  if (!current) return "1.0.0";

  const detailResponse = await fetcher(
    `/api/publications/${encodeURIComponent(current.publicationId)}/manage`,
    { headers },
  );
  const detailPayload = await readJson(detailResponse);
  if (!detailResponse.ok || !isLogicalDocument(detailPayload.publication?.document)) {
    throw publicationResponseError(detailResponse, detailPayload);
  }
  const classification = await classifyResourcePackageVersionChange(
    await createResourcePackageVersionBaseline(detailPayload.publication.document),
    document,
  );
  return classification.minimumVersion;
}

export async function publishCandidate(
  candidate: PublicationCandidate,
  credentials: PlatformCredentials,
  fetcher: typeof fetch = fetch,
): Promise<{ publication: PublishedPublication }> {
  if (!credentials.canWrite) {
    throw new PublicationApiError("当前设备已失去云端写入权，请重新接管账号会话。", "AUTH_SESSION_REPLACED", 401);
  }
  const form = new FormData();
  form.set("metadata", JSON.stringify(candidate.metadata));
  const archiveBytes = writePbres(candidate.document, candidate.media);
  const archiveBuffer = new ArrayBuffer(archiveBytes.byteLength);
  new Uint8Array(archiveBuffer).set(archiveBytes);
  form.set(
    "archive",
    new Blob([archiveBuffer], {
      type: "application/vnd.pbdh.resource-package+zip",
    }),
    `${candidate.document.package.id}-${candidate.document.package.version}.pbres`,
  );
  const response = await fetcher("/api/publications", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "X-PbDH-Session": credentials.siteSessionId,
    },
    body: form,
  });
  const payload = await response.json() as {
    publication?: PublishedPublication;
    error?: {
      code?: string;
      message?: string;
      fieldErrors?: Array<{ path?: string; code?: string; message?: string }>;
    };
  };
  if (!response.ok || !payload.publication) {
    throw new PublicationApiError(
      payload.error?.message ?? "发布失败。",
      payload.error?.code ?? "PUBLICATION_REQUEST_FAILED",
      response.status,
      (payload.error?.fieldErrors ?? []).map((item) => ({
        path: item.path ?? "/publication",
        code: item.code ?? "PUBLICATION_CANDIDATE_INVALID",
        message: item.message ?? item.code ?? "发布校验失败",
      })),
    );
  }
  return { publication: payload.publication };
}

type PublicationResponsePayload = {
  publications?: unknown;
  publication?: { document?: unknown };
  error?: {
    code?: string;
    message?: string;
    fieldErrors?: Array<{ path?: string; code?: string; message?: string }>;
  };
};

async function readJson(response: Response): Promise<PublicationResponsePayload> {
  return await response.json() as PublicationResponsePayload;
}

function publicationResponseError(
  response: Response,
  payload: PublicationResponsePayload,
): PublicationApiError {
  return new PublicationApiError(
    payload.error?.message ?? "无法读取资源包的已发布版本。",
    payload.error?.code ?? "PUBLICATION_BASELINE_REQUEST_FAILED",
    response.status,
    (payload.error?.fieldErrors ?? []).map((item) => ({
      path: item.path ?? "/publication",
      code: item.code ?? "PUBLICATION_BASELINE_REQUEST_FAILED",
      message: item.message ?? item.code ?? "无法读取已发布版本",
    })),
  );
}

function isLogicalDocument(value: unknown): value is ResourcePackageLogicalDocument {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ResourcePackageLogicalDocument>;
  return candidate.contractVersion === "1.0.0"
    && Boolean(candidate.package && typeof candidate.package.id === "string")
    && Array.isArray(candidate.resources)
    && Array.isArray(candidate.targets);
}
