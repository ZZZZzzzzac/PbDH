import { writePbres } from "@pbdh/contract-runtime";
import type { PlatformCredentials } from "@pbdh/platform-auth/provider";

import type { PublicationCandidate } from "./publication-candidate.ts";

export class PublicationApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
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
    error?: { code?: string; message?: string };
  };
  if (!response.ok || !payload.publication) {
    throw new PublicationApiError(
      payload.error?.message ?? "发布失败。",
      payload.error?.code ?? "PUBLICATION_REQUEST_FAILED",
      response.status,
    );
  }
  return { publication: payload.publication };
}
