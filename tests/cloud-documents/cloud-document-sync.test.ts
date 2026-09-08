import { describe, expect, test, vi } from "vitest";

import {
  CloudApiError,
  CloudDocumentCoordinator,
  HttpCloudDocumentApi,
  type CloudCredentials,
  type CloudDocumentApi,
  type RemoteCloudDocument,
} from "../../packages/cloud-documents/src/index.ts";
import type {
  LocalDocumentEnvelope,
  LocalDocumentKind,
  LocalMediaAssetRecord,
} from "../../packages/local-storage/src/index.ts";


const credentials: CloudCredentials = {
  accessToken: "token",
  siteSessionId: "session",
  accountId: "account-1",
  canWrite: true,
};

describe("Cloud Document browser transport", () => {
  test("preserves the server's missing media list", async () => {
    const api = new HttpCloudDocumentApi(vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: {
      code: "CLOUD_MEDIA_NOT_READY", message: "missing",
      fieldErrors: [{ path: "/assetIds", code: "CLOUD_MEDIA_NOT_READY", message: "sha256:new" }],
    } }), { status: 422 })));
    await expect(api.putDocument(envelope(), "mutation", credentials)).rejects.toMatchObject({ missingAssetIds: ["sha256:new"] });
  });
  test("calls the browser fetch implementation with the global receiver", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = function (this: unknown) {
      if (this !== globalThis) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      return Promise.resolve(new Response(JSON.stringify({ documents: [] }), {
        headers: { "Content-Type": "application/json" },
      }));
    } as typeof fetch;

    try {
      const api = new HttpCloudDocumentApi();
      await expect(api.listDocuments("creator-workspace", true, credentials))
        .resolves.toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

function envelope(
  documentId = "workspace-1",
  documentKind: LocalDocumentKind = "creator-workspace",
): LocalDocumentEnvelope<{ name: string }> {
  return {
    documentId,
    documentKind,
    contractFamily: "creator-workspace-draft",
    contractVersion: "1",
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
    assetIds: ["sha256:asset"],
    sync: { scope: "local-only", state: "clean", baseRevision: null },
    payload: { name: "荒野遭遇集" },
  };
}

class FakeStore {
  readonly documents = new Map<string, LocalDocumentEnvelope>();
  readonly media = new Map<string, Uint8Array>([["sha256:asset", new Uint8Array([1, 2, 3])]]);

  async list<T>(kind: LocalDocumentKind): Promise<Array<LocalDocumentEnvelope<T>>> {
    return [...this.documents.values()]
      .filter((item) => item.documentKind === kind)
      .map((item) => structuredClone(item) as LocalDocumentEnvelope<T>);
  }

  async get<T>(kind: LocalDocumentKind, id: string): Promise<LocalDocumentEnvelope<T> | undefined> {
    const found = this.documents.get(id);
    return found?.documentKind === kind
      ? structuredClone(found) as LocalDocumentEnvelope<T>
      : undefined;
  }

  async put<T>(value: LocalDocumentEnvelope<T>, media: readonly LocalMediaAssetRecord[] = []): Promise<void> {
    this.documents.set(value.documentId, structuredClone(value) as LocalDocumentEnvelope);
    for (const asset of media) this.media.set(asset.assetId, new Uint8Array(asset.bytes));
  }

  async getMedia(assetIds: readonly string[]): Promise<Map<string, Uint8Array>> {
    return new Map(assetIds.flatMap((assetId) => {
      const bytes = this.media.get(assetId);
      return bytes ? [[assetId, new Uint8Array(bytes)] as const] : [];
    }));
  }
}

function remote(local: LocalDocumentEnvelope, revision: number): RemoteCloudDocument {
  return {
    documentId: local.documentId,
    documentKind: local.documentKind,
    contractFamily: local.contractFamily,
    contractVersion: local.contractVersion,
    revision,
    assetIds: [...local.assetIds],
    payload: structuredClone(local.payload),
    createdAt: local.createdAt,
    updatedAt: local.updatedAt,
    deletedAt: null,
    purgeAfter: null,
  };
}

function api(put = vi.fn<CloudDocumentApi["putDocument"]>()): CloudDocumentApi & { calls: string[] } {
  const calls: string[] = [];
  if (!put.getMockImplementation()) {
    put.mockImplementation(async (local) => {
      calls.push(`document:${local.documentId}`);
      return remote(local, (Number(local.sync.baseRevision) || 0) + 1);
    });
  }
  return {
    calls,
    async listDocuments() {
      return [];
    },
    async getDocument(documentId) {
      const local = envelope(documentId);
      return remote(local, 1);
    },
    async getMedia() {
      return new Uint8Array([1, 2, 3]);
    },
    async prepareMedia(assetId) {
      calls.push(`media:${assetId}`);
    },
    putDocument: put,
    async trashDocument(documentId) {
      const local = envelope(documentId);
      return { ...remote(local, 2), deletedAt: "2026-08-26T01:00:00.000Z" };
    },
    async restoreDocument(documentId) {
      return remote(envelope(documentId), 3);
    },
    async deleteDocument() {},
  };
}

describe("Cloud Document durable outbox", () => {
  test("uploads only missing references and deduplicates the server list", async () => {
    const store = new FakeStore();
    const local = envelope();
    local.assetIds.push("sha256:new");
    store.documents.set(local.documentId, local);
    store.media.set("sha256:new", new Uint8Array([4]));
    const put = vi.fn<CloudDocumentApi["putDocument"]>()
      .mockRejectedValueOnce(new CloudApiError(422, "CLOUD_MEDIA_NOT_READY", "missing", ["sha256:new", "sha256:new"]))
      .mockImplementation(async (value) => remote(value, 1));
    const cloud = api(put);
    const coordinator = new CloudDocumentCoordinator(store, cloud);
    await coordinator.enableCloud("creator-workspace", local.documentId, credentials);
    expect(await coordinator.flush("creator-workspace", credentials)).toEqual({ synced: 1, pending: 0, conflicts: 0 });
    expect(cloud.calls).toEqual(["media:sha256:new"]);
  });

  test("does not upload on conflict or upload an unrelated server-requested asset", async () => {
    for (const error of [
      new CloudApiError(409, "CLOUD_DOCUMENT_REVISION_CONFLICT", "conflict"),
      new CloudApiError(422, "CLOUD_MEDIA_NOT_READY", "missing", ["sha256:unrelated"]),
    ]) {
      const store = new FakeStore();
      store.documents.set("workspace-1", envelope());
      const cloud = api(vi.fn<CloudDocumentApi["putDocument"]>().mockRejectedValue(error));
      const coordinator = new CloudDocumentCoordinator(store, cloud);
      await coordinator.enableCloud("creator-workspace", "workspace-1", credentials);
      await coordinator.flush("creator-workspace", credentials);
      expect(cloud.calls).toEqual([]);
    }
  });

  test("forced overwrite also skips already authorized media", async () => {
    const store = new FakeStore();
    store.documents.set("workspace-1", envelope());
    const cloud = api();
    const coordinator = new CloudDocumentCoordinator(store, cloud);
    await coordinator.enableCloud("creator-workspace", "workspace-1", credentials);
    await coordinator.overwriteWithLocal("creator-workspace", "workspace-1", credentials);
    expect(cloud.calls).toEqual(["document:workspace-1"]);
  });
  test("does not read or upload local images when the server already accepts their references", async () => {
    const store = new FakeStore();
    const cloud = api();
    const readMedia = vi.spyOn(store, "getMedia");
    store.documents.set("workspace-1", envelope());
    const coordinator = new CloudDocumentCoordinator(store, cloud);
    await coordinator.enableCloud("creator-workspace", "workspace-1", credentials);
    expect(await coordinator.flush("creator-workspace", credentials)).toEqual({ synced: 1, pending: 0, conflicts: 0 });
    expect(readMedia).not.toHaveBeenCalled();
    expect(cloud.calls).toEqual(["document:workspace-1"]);
  });
  test("requires an explicit enable action, then prepares media before the first revision", async () => {
    const store = new FakeStore();
    const put = vi.fn<CloudDocumentApi["putDocument"]>()
      .mockRejectedValueOnce(new CloudApiError(422, "CLOUD_MEDIA_NOT_READY", "missing", ["sha256:asset"]))
      .mockImplementation(async (local) => remote(local, 1));
    const cloud = api(put);
    store.documents.set("workspace-1", envelope());
    const coordinator = new CloudDocumentCoordinator(store, cloud, () => "mutation-1");

    expect((await store.get("creator-workspace", "workspace-1"))?.sync.scope).toBe("local-only");
    await coordinator.enableCloud("creator-workspace", "workspace-1", credentials);
    expect((await store.get("creator-workspace", "workspace-1"))?.sync).toMatchObject({
      scope: "cloud",
      state: "pending",
      baseRevision: null,
      mutationId: "mutation-1",
    });

    const result = await coordinator.flush("creator-workspace", credentials);

    expect(result).toEqual({ synced: 1, pending: 0, conflicts: 0 });
    expect(cloud.calls).toEqual(["media:sha256:asset"]);
    expect(put.mock.calls.map(([, id]) => id)).toEqual(["mutation-1", "mutation-1"]);
    expect((await store.get("creator-workspace", "workspace-1"))?.sync).toMatchObject({
      scope: "cloud",
      state: "clean",
      baseRevision: "1",
      mutationId: null,
    });
  });

  test("keeps the same durable mutation pending across network failure and retry", async () => {
    const store = new FakeStore();
    const put = vi.fn<CloudDocumentApi["putDocument"]>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockImplementation(async (local) => remote(local, 5));
    const cloud = api(put);
    const pending = envelope();
    pending.sync = {
      scope: "cloud",
      state: "pending",
      baseRevision: "4",
      accountId: "account-1",
      mutationId: "mutation-stable",
      lastError: null,
    };
    store.documents.set(pending.documentId, pending);
    let coordinator = new CloudDocumentCoordinator(store, cloud, () => "mutation-unused");

    expect(await coordinator.flush("creator-workspace", credentials))
      .toEqual({ synced: 0, pending: 1, conflicts: 0 });
    expect((await store.get("creator-workspace", pending.documentId))?.sync.mutationId)
      .toBe("mutation-stable");

    coordinator = new CloudDocumentCoordinator(store, cloud, () => "mutation-after-restart");
    expect(await coordinator.flush("creator-workspace", credentials))
      .toEqual({ synced: 1, pending: 0, conflicts: 0 });
    expect(put.mock.calls.map(([, mutationId]) => mutationId))
      .toEqual(["mutation-stable", "mutation-stable"]);
  });

  test("preserves local content and marks an explicit revision conflict", async () => {
    const store = new FakeStore();
    const cloud = api(vi.fn<CloudDocumentApi["putDocument"]>().mockRejectedValue(
      new CloudApiError(409, "CLOUD_DOCUMENT_REVISION_CONFLICT", "云端文档已变化"),
    ));
    const pending = envelope();
    pending.sync = {
      scope: "cloud",
      state: "pending",
      baseRevision: "1",
      accountId: "account-1",
      mutationId: "mutation-conflict",
      lastError: null,
    };
    store.documents.set(pending.documentId, pending);
    const coordinator = new CloudDocumentCoordinator(store, cloud);

    expect(await coordinator.flush("creator-workspace", credentials))
      .toEqual({ synced: 0, pending: 0, conflicts: 1 });
    const conflicted = await store.get<{ name: string }>("creator-workspace", pending.documentId);
    expect(conflicted?.payload).toEqual({ name: "荒野遭遇集" });
    expect(conflicted?.sync.state).toBe("conflict");
    expect(conflicted?.sync.mutationId).toBe("mutation-conflict");
  });

  test("a replaced session leaves the outbox untouched", async () => {
    const store = new FakeStore();
    const cloud = api();
    const pending = envelope();
    pending.sync = {
      scope: "cloud",
      state: "pending",
      baseRevision: null,
      accountId: "account-1",
      mutationId: "mutation-1",
      lastError: null,
    };
    store.documents.set(pending.documentId, pending);
    const coordinator = new CloudDocumentCoordinator(store, cloud);

    expect(await coordinator.flush("creator-workspace", { ...credentials, canWrite: false }))
      .toEqual({ synced: 0, pending: 1, conflicts: 0 });
    expect(cloud.calls).toEqual([]);
    expect((await store.get("creator-workspace", pending.documentId))?.sync.state).toBe("pending");
  });

  test("one failed tabletop does not block another tabletop from syncing", async () => {
    const store = new FakeStore();
    const first = envelope("tabletop-failed", "gm-tabletop-document");
    const second = envelope("tabletop-synced", "gm-tabletop-document");
    for (const document of [first, second]) {
      document.sync = {
        scope: "cloud",
        state: "pending",
        baseRevision: null,
        accountId: "account-1",
        mutationId: `mutation-${document.documentId}`,
        lastError: null,
      };
      store.documents.set(document.documentId, document);
    }
    const cloud = api(vi.fn<CloudDocumentApi["putDocument"]>().mockImplementation(async (local) => {
      if (local.documentId === first.documentId) throw new TypeError("offline for one document");
      return remote(local, 1);
    }));

    expect(await new CloudDocumentCoordinator(store, cloud).flush("gm-tabletop-document", credentials))
      .toEqual({ synced: 1, pending: 1, conflicts: 0 });
    expect((await store.get("gm-tabletop-document", first.documentId))?.sync.state).toBe("pending");
    expect((await store.get("gm-tabletop-document", second.documentId))?.sync).toMatchObject({
      state: "clean",
      baseRevision: "1",
    });
  });

  test("explicit local overwrite uploads media and resolves a conflict with the new revision", async () => {
    const store = new FakeStore();
    const put = vi.fn<CloudDocumentApi["putDocument"]>()
      .mockRejectedValueOnce(new CloudApiError(422, "CLOUD_MEDIA_NOT_READY", "missing", ["sha256:asset"]))
      .mockImplementation(async (local, _mutationId, _credentials, force) => {
        expect(force).toBe(true);
        return remote(local, 7);
      });
    const cloud = api(put);
    const conflicted = envelope();
    conflicted.sync = {
      scope: "cloud",
      state: "conflict",
      baseRevision: "5",
      accountId: "account-1",
      mutationId: "old-mutation",
      lastError: "云端文档已变化",
    };
    store.documents.set(conflicted.documentId, conflicted);
    const coordinator = new CloudDocumentCoordinator(store, cloud, () => "force-mutation");

    await coordinator.overwriteWithLocal("creator-workspace", conflicted.documentId, credentials);

    expect(cloud.calls).toEqual(["media:sha256:asset"]);
    expect((await store.get("creator-workspace", conflicted.documentId))?.sync).toEqual({
      scope: "cloud",
      state: "clean",
      baseRevision: "7",
      accountId: "account-1",
      mutationId: null,
      lastError: null,
    });
  });
});
