import type {
  DexieLocalDocumentStore,
  LocalDocumentEnvelope,
  LocalDocumentKind,
  LocalDocumentSync,
} from "@pbdh/local-storage";


export type CloudCredentials = {
  accessToken: string;
  siteSessionId: string;
  accountId: string;
  canWrite: boolean;
};

export type RemoteCloudDocument<T = unknown> = {
  documentId: string;
  documentKind: LocalDocumentKind;
  contractFamily: string;
  contractVersion: string;
  revision: number;
  assetIds: string[];
  payload: T;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  purgeAfter: string | null;
};

export class CloudApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly missingAssetIds: readonly string[] = [],
  ) {
    super(message);
  }
}

export interface CloudDocumentApi {
  listDocuments(
    documentKind: LocalDocumentKind,
    includeDeleted: boolean,
    credentials: CloudCredentials,
  ): Promise<RemoteCloudDocument[]>;
  getDocument(
    documentId: string,
    credentials: CloudCredentials,
  ): Promise<RemoteCloudDocument>;
  getMedia(
    documentId: string,
    assetId: string,
    credentials: CloudCredentials,
  ): Promise<Uint8Array>;
  prepareMedia(
    assetId: string,
    bytes: Uint8Array,
    credentials: CloudCredentials,
  ): Promise<void>;
  putDocument(
    local: LocalDocumentEnvelope,
    mutationId: string,
    credentials: CloudCredentials,
    force?: boolean,
  ): Promise<RemoteCloudDocument>;
  trashDocument(
    documentId: string,
    mutationId: string,
    baseRevision: number,
    credentials: CloudCredentials,
  ): Promise<RemoteCloudDocument>;
  restoreDocument(
    documentId: string,
    mutationId: string,
    baseRevision: number,
    credentials: CloudCredentials,
  ): Promise<RemoteCloudDocument>;
  deleteDocument(
    documentId: string,
    baseRevision: number,
    credentials: CloudCredentials,
  ): Promise<void>;
}

type LocalDocumentStore = Pick<
  DexieLocalDocumentStore,
  "list" | "get" | "put" | "getMedia"
>;

export type FlushResult = {
  synced: number;
  pending: number;
  conflicts: number;
};

export function pendingSync(
  current: LocalDocumentSync,
  mutationId = crypto.randomUUID(),
): LocalDocumentSync {
  if (current.scope === "local-only" || current.state === "conflict") return current;
  return {
    scope: "cloud",
    state: "pending",
    baseRevision: current.baseRevision,
    accountId: current.accountId,
    mutationId,
    lastError: null,
  };
}

export class CloudDocumentCoordinator {
  readonly #store: LocalDocumentStore;
  readonly #api: CloudDocumentApi;
  readonly #mutationId: () => string;

  constructor(
    store: LocalDocumentStore,
    api: CloudDocumentApi,
    mutationId: () => string = () => crypto.randomUUID(),
  ) {
    this.#store = store;
    this.#api = api;
    this.#mutationId = mutationId;
  }

  async enableCloud(
    documentKind: LocalDocumentKind,
    documentId: string,
    credentials: CloudCredentials,
  ): Promise<void> {
    const local = await this.#store.get(documentKind, documentId);
    if (!local) throw new Error("没有找到需要同步的本地文档。");
    if (local.sync.scope === "cloud") return;
    local.sync = {
      scope: "cloud",
      state: "pending",
      baseRevision: null,
      accountId: credentials.accountId,
      mutationId: this.#mutationId(),
      lastError: null,
    };
    await this.#store.put(local);
  }

  async flush(
    documentKind: LocalDocumentKind,
    credentials: CloudCredentials,
  ): Promise<FlushResult> {
    const documents = await this.#store.list(documentKind);
    const pending = documents.filter((document) =>
      document.sync.scope === "cloud"
      && document.sync.state === "pending"
      && document.sync.accountId === credentials.accountId);
    if (!credentials.canWrite) {
      return { synced: 0, pending: pending.length, conflicts: 0 };
    }
    const result: FlushResult = { synced: 0, pending: 0, conflicts: 0 };
    for (const document of pending) {
      const outcome = await this.#flushOne(document, credentials);
      result[outcome] += 1;
    }
    return result;
  }

  async overwriteWithLocal(
    documentKind: LocalDocumentKind,
    documentId: string,
    credentials: CloudCredentials,
  ): Promise<RemoteCloudDocument> {
    if (!credentials.canWrite) throw new Error("当前会话不能写入云端。");
    const local = await this.#store.get(documentKind, documentId);
    if (!local) throw new Error("没有找到需要覆盖到云端的本地文档。");
    if (local.sync.scope !== "cloud" || local.sync.accountId !== credentials.accountId) {
      throw new Error("当前账号不能覆盖该云文档。");
    }
    const mutationId = this.#mutationId();
    const remote = await this.#putWithMissingMedia(local, mutationId, credentials, true);
    const latest = await this.#store.get(documentKind, documentId);
    if (latest) {
      latest.sync = {
        scope: "cloud",
        state: "clean",
        baseRevision: String(remote.revision),
        accountId: credentials.accountId,
        mutationId: null,
        lastError: null,
      };
      await this.#store.put(latest);
    }
    return remote;
  }

  async #flushOne(
    document: LocalDocumentEnvelope,
    credentials: CloudCredentials,
  ): Promise<keyof FlushResult> {
    const mutationId = document.sync.mutationId ?? this.#mutationId();
    if (!document.sync.mutationId) {
      document.sync = { ...document.sync, mutationId, lastError: null };
      await this.#store.put(document);
    }
    try {
      const remote = await this.#putWithMissingMedia(document, mutationId, credentials);
      const latest = await this.#store.get(document.documentKind, document.documentId);
      if (!latest) return "synced";
      latest.sync = latest.sync.mutationId === mutationId
        ? {
            scope: "cloud",
            state: "clean",
            baseRevision: String(remote.revision),
            accountId: credentials.accountId,
            mutationId: null,
            lastError: null,
          }
        : {
            ...latest.sync,
            baseRevision: String(remote.revision),
          };
      await this.#store.put(latest);
      return "synced";
    } catch (error) {
      const latest = await this.#store.get(document.documentKind, document.documentId);
      if (latest?.sync.mutationId === mutationId) {
        const conflict = error instanceof CloudApiError
          && error.code === "CLOUD_DOCUMENT_REVISION_CONFLICT";
        latest.sync = {
          ...latest.sync,
          state: conflict ? "conflict" : "pending",
          lastError: error instanceof Error ? error.message : "云同步失败",
        };
        await this.#store.put(latest);
        return conflict ? "conflicts" : "pending";
      }
      return "pending";
    }
  }
  async #putWithMissingMedia(
    document: LocalDocumentEnvelope,
    mutationId: string,
    credentials: CloudCredentials,
    force = false,
  ): Promise<RemoteCloudDocument> {
    try {
      return await this.#api.putDocument(document, mutationId, credentials, force);
    } catch (error) {
      if (!(error instanceof CloudApiError) || error.code !== "CLOUD_MEDIA_NOT_READY") throw error;
      const missing = [...new Set(error.missingAssetIds)];
      if (!missing.length || missing.some((id) => !document.assetIds.includes(id))) throw error;
      // 由服务端判断已有所有权和市场引用权限；只补传本次明确缺少的图片。
      const media = await this.#store.getMedia(missing);
      for (const assetId of missing) {
        const bytes = media.get(assetId);
        if (!bytes) throw new Error(`Missing local media: ${assetId}`);
        await this.#api.prepareMedia(assetId, bytes, credentials);
      }
      return this.#api.putDocument(document, mutationId, credentials, force);
    }
  }
}

type ApiErrorPayload = {
  error?: { code?: string; message?: string; fieldErrors?: Array<{ path?: string; code?: string; message?: string }> };
};

export class HttpCloudDocumentApi implements CloudDocumentApi {
  readonly #fetch: typeof fetch;

  constructor(fetcher?: typeof fetch) {
    this.#fetch = fetcher ?? globalThis.fetch.bind(globalThis);
  }

  async listDocuments(
    documentKind: LocalDocumentKind,
    includeDeleted: boolean,
    credentials: CloudCredentials,
  ): Promise<RemoteCloudDocument[]> {
    const query = new URLSearchParams({
      documentKind,
      includeDeleted: String(includeDeleted),
    });
    const response = await this.#fetch(`/api/cloud/documents?${query}`, {
      headers: requestHeaders(credentials),
    });
    const payload = await jsonPayload<ApiErrorPayload & { documents?: RemoteCloudDocument[] }>(response);
    if (!response.ok || !payload.documents) throw responseError(response, payload, "云文档列表读取失败。");
    return payload.documents;
  }

  async getDocument(
    documentId: string,
    credentials: CloudCredentials,
  ): Promise<RemoteCloudDocument> {
    const response = await this.#fetch(`/api/cloud/documents/${encodeURIComponent(documentId)}`, {
      headers: requestHeaders(credentials),
    });
    const payload = await jsonPayload<ApiErrorPayload & { document?: RemoteCloudDocument }>(response);
    if (!response.ok || !payload.document) throw responseError(response, payload, "云文档读取失败。");
    return payload.document;
  }

  async getMedia(
    documentId: string,
    assetId: string,
    credentials: CloudCredentials,
  ): Promise<Uint8Array> {
    const response = await this.#fetch(
      `/api/cloud/documents/${encodeURIComponent(documentId)}/media/${encodeURIComponent(assetId)}`,
      { headers: requestHeaders(credentials) },
    );
    if (!response.ok) await throwApiError(response, "云文档媒体读取失败。");
    return new Uint8Array(await response.arrayBuffer());
  }

  async prepareMedia(
    assetId: string,
    bytes: Uint8Array,
    credentials: CloudCredentials,
  ): Promise<void> {
    const body = new Uint8Array(bytes.byteLength);
    body.set(bytes);
    const response = await this.#fetch(`/api/cloud/media/${encodeURIComponent(assetId)}`, {
      method: "PUT",
      headers: requestHeaders(credentials, { "Content-Type": "image/webp" }),
      body,
    });
    if (!response.ok) await throwApiError(response, "媒体同步失败。");
  }

  async putDocument(
    local: LocalDocumentEnvelope,
    mutationId: string,
    credentials: CloudCredentials,
    force = false,
  ): Promise<RemoteCloudDocument> {
    const response = await this.#fetch(
      `/api/cloud/documents/${encodeURIComponent(local.documentId)}`,
      {
        method: "PUT",
        headers: requestHeaders(credentials, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          mutationId,
          documentKind: local.documentKind,
          contractFamily: local.contractFamily,
          contractVersion: local.contractVersion,
          baseRevision: revisionNumber(local.sync.baseRevision),
          assetIds: local.assetIds,
          payload: local.payload,
          force,
        }),
      },
    );
    const payload = await response.json() as ApiErrorPayload & { document?: RemoteCloudDocument };
    if (!response.ok || !payload.document) throw responseError(response, payload, "文档同步失败。");
    return payload.document;
  }

  async trashDocument(
    documentId: string,
    mutationId: string,
    baseRevision: number,
    credentials: CloudCredentials,
  ): Promise<RemoteCloudDocument> {
    return this.#lifecycle(documentId, "trash", mutationId, baseRevision, credentials);
  }

  async restoreDocument(
    documentId: string,
    mutationId: string,
    baseRevision: number,
    credentials: CloudCredentials,
  ): Promise<RemoteCloudDocument> {
    return this.#lifecycle(documentId, "restore", mutationId, baseRevision, credentials);
  }

  async deleteDocument(
    documentId: string,
    baseRevision: number,
    credentials: CloudCredentials,
  ): Promise<void> {
    const query = new URLSearchParams({ baseRevision: String(baseRevision) });
    const response = await this.#fetch(
      `/api/cloud/documents/${encodeURIComponent(documentId)}?${query}`,
      { method: "DELETE", headers: requestHeaders(credentials) },
    );
    if (!response.ok) await throwApiError(response, "云文档永久删除失败。");
  }

  async #lifecycle(
    documentId: string,
    operation: "trash" | "restore",
    mutationId: string,
    baseRevision: number,
    credentials: CloudCredentials,
  ): Promise<RemoteCloudDocument> {
    const response = await this.#fetch(
      `/api/cloud/documents/${encodeURIComponent(documentId)}/${operation}`,
      {
        method: "POST",
        headers: requestHeaders(credentials, { "Content-Type": "application/json" }),
        body: JSON.stringify({ mutationId, baseRevision }),
      },
    );
    const payload = await jsonPayload<ApiErrorPayload & { document?: RemoteCloudDocument }>(response);
    if (!response.ok || !payload.document) throw responseError(response, payload, "云文档状态更新失败。");
    return payload.document;
  }
}

async function jsonPayload<T extends ApiErrorPayload>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    return {} as T;
  }
}

function revisionNumber(revision: string | null): number | null {
  if (revision === null) return null;
  const parsed = Number(revision);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error("无效的本地云 revision。");
  return parsed;
}

function requestHeaders(credentials: CloudCredentials, initial?: HeadersInit): Headers {
  const headers = new Headers(initial);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${credentials.accessToken}`);
  headers.set("X-PbDH-Session", credentials.siteSessionId);
  return headers;
}

async function throwApiError(response: Response, fallback: string): Promise<never> {
  let payload: ApiErrorPayload = {};
  try {
    payload = await response.json() as ApiErrorPayload;
  } catch {
    // 非 JSON 错误仍保留 HTTP 状态和稳定的本地提示。
  }
  throw responseError(response, payload, fallback);
}

function responseError(response: Response, payload: ApiErrorPayload, fallback: string): CloudApiError {
  return new CloudApiError(
    response.status,
    payload.error?.code ?? "CLOUD_REQUEST_FAILED",
    payload.error?.message ?? fallback,
    payload.error?.code === "CLOUD_MEDIA_NOT_READY"
      ? (payload.error.fieldErrors ?? []).flatMap((field) => field.path === "/assetIds" && field.code === "CLOUD_MEDIA_NOT_READY" && typeof field.message === "string" ? [field.message] : [])
      : [],
  );
}
