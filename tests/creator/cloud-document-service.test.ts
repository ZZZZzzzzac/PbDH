import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import type {
  CloudCredentials,
  CloudDocumentApi,
  RemoteCloudDocument,
} from "@pbdh/cloud-documents";
import type { ResourcePackageLogicalDocument } from "@pbdh/contract-runtime";
import { DexieLocalDocumentStore, PbDHLocalDatabase } from "@pbdh/local-storage";
import {
  createTabletopDocument,
  executeTabletopCommand,
  type TabletopCapability,
} from "@pbdh/tabletop/core";

import minotaurPackage from "../../contracts/conformance/resource-package/1.0.0-alpha.1/valid/minotaur-wrecker.json";
import { CreatorCloudDocumentService } from "../../apps/creator/src/workspace-prototype/cloud-document-service.ts";
import { CreatorWorkspaceRepository } from "../../apps/creator/src/workspace-prototype/creator-workspace-repository.ts";
import { TabletopDocumentRepository } from "../../apps/creator/src/workspace-prototype/tabletop-document-repository.ts";
import { createWorkspace } from "../../apps/creator/src/workspace-prototype/workspace-model.ts";

const databases: PbDHLocalDatabase[] = [];
const credentials: CloudCredentials = {
  accessToken: "token",
  siteSessionId: "session",
  accountId: "account-1",
  canWrite: true,
};

function database() {
  const value = new PbDHLocalDatabase(`pbdh-cloud-recovery-test-${crypto.randomUUID()}`);
  databases.push(value);
  return value;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (value) => {
    value.close();
    await value.delete();
  }));
});

class RecoveryApi implements CloudDocumentApi {
  constructor(
    readonly documents: RemoteCloudDocument[],
    readonly media: ReadonlyMap<string, Uint8Array>,
  ) {}

  async listDocuments(documentKind: RemoteCloudDocument["documentKind"], includeDeleted: boolean) {
    return this.documents.filter((document) => document.documentKind === documentKind
      && (includeDeleted || document.deletedAt === null));
  }

  async getDocument(documentId: string) {
    return structuredClone(this.documents.find((document) => document.documentId === documentId)!);
  }

  async getMedia(_documentId: string, assetId: string) {
    return new Uint8Array(this.media.get(assetId)!);
  }

  async prepareMedia() {}

  async putDocument(): Promise<RemoteCloudDocument> {
    throw new Error("unexpected put");
  }

  async trashDocument(): Promise<RemoteCloudDocument> {
    throw new Error("unexpected trash");
  }

  async restoreDocument(): Promise<RemoteCloudDocument> {
    throw new Error("unexpected restore");
  }
}

describe("Creator and GM cloud recovery", () => {
  test("restores a real workspace media and an independent tabletop instance", async () => {
    const sourceStore = new DexieLocalDocumentStore(database());
    const sourceWorkspaceRepository = new CreatorWorkspaceRepository(sourceStore);
    const sourceTabletopRepository = new TabletopDocumentRepository(sourceStore);
    const packageDocument = minotaurPackage as ResourcePackageLogicalDocument;
    const asset = packageDocument.assets[0]!;
    const bytes = new Uint8Array(readFileSync(path.join(
      process.cwd(),
      "contracts/conformance/resource-package/1.0.0-alpha.1/media/0e282056f7db585202319c5c8df5857189a8f4280dcd0015814bbfadc89b7034.webp",
    )));
    const workspace = createWorkspace({ document: packageDocument, media: new Map([[asset.id, bytes]]) });
    await sourceWorkspaceRepository.save(workspace);
    const workspaceEnvelope = await sourceStore.get("creator-workspace", workspace.key);

    const capabilities = new Set<TabletopCapability>(["place"]);
    const emptyTabletop = createTabletopDocument("01989f4e-7b2c-7000-8000-000000000041", "陨落神殿");
    const tabletop = executeTabletopCommand(emptyTabletop, {
      type: "place",
      instanceId: "01989f4e-7b2c-7000-8000-000000000042",
      resource: {
        source: { packageId: workspace.key, resourceId: packageDocument.resources[0]!.id },
        template: structuredClone(packageDocument.resources[0]!.template),
        presentation: structuredClone(packageDocument.resources[0]!.presentation),
        data: structuredClone(packageDocument.resources[0]!.data) as Record<string, unknown>,
        labels: [],
        media: {},
      },
      state: { currentHp: "4", currentStress: "2" },
      position: { x: 128, y: 256 },
    }, { capabilities }).document;
    const tabletopCandidate = await sourceTabletopRepository.save(tabletop, new Map());

    const remotes: RemoteCloudDocument[] = [
      {
        documentId: workspace.key,
        documentKind: "creator-workspace",
        contractFamily: workspaceEnvelope!.contractFamily,
        contractVersion: workspaceEnvelope!.contractVersion,
        revision: 3,
        assetIds: [...workspaceEnvelope!.assetIds],
        payload: structuredClone(workspaceEnvelope!.payload),
        createdAt: workspaceEnvelope!.createdAt,
        updatedAt: workspaceEnvelope!.updatedAt,
        deletedAt: null,
        purgeAfter: null,
      },
      {
        documentId: tabletop.id,
        documentKind: "gm-tabletop-document",
        contractFamily: "tabletop-document",
        contractVersion: tabletopCandidate.document.contractVersion,
        revision: 8,
        assetIds: [],
        payload: structuredClone(tabletopCandidate.document),
        createdAt: tabletopCandidate.document.createdAt,
        updatedAt: tabletopCandidate.document.updatedAt,
        deletedAt: null,
        purgeAfter: null,
      },
    ];

    const targetStore = new DexieLocalDocumentStore(database());
    const targetWorkspaceRepository = new CreatorWorkspaceRepository(targetStore);
    const targetTabletopRepository = new TabletopDocumentRepository(targetStore);
    const service = new CreatorCloudDocumentService(
      targetStore,
      targetWorkspaceRepository,
      targetTabletopRepository,
      new RecoveryApi(remotes, new Map([[asset.id, bytes]])),
    );

    const recovered = await service.recover(credentials);

    expect(recovered.workspaces[0]?.sync.baseRevision).toBe("3");
    expect(recovered.workspaces[0]?.sync.accountId).toBe("account-1");
    expect(recovered.workspaces[0]?.workspace.media.get(asset.id)).toEqual(bytes);
    expect(recovered.tabletops[0]?.sync.baseRevision).toBe("8");
    expect(recovered.tabletops[0]?.sync.accountId).toBe("account-1");
    expect(recovered.tabletops[0]?.model.instances[0]).toMatchObject({
      state: { currentHp: "4", currentStress: "2" },
      position: { x: 128, y: 256 },
    });
  });
});
