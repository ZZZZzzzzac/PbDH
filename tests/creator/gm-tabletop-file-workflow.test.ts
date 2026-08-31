import { writePbtab, type TabletopDocument, type TabletopDocumentCandidate } from "@pbdh/contract-runtime";
import { createTabletopDocument } from "@pbdh/tabletop/core";
import { describe, expect, test, vi } from "vitest";

import tabletopFixture from "../../contracts/conformance/tabletop-document/1.0.0/valid/basic.json";
import {
  runGmTabletopFileWorkflow,
  type GmTabletopFileWorkflowPorts,
} from "../../apps/creator/src/workspace-prototype/gm-tabletop-file-workflow.ts";

const document = tabletopFixture as unknown as TabletopDocument;
const candidate: TabletopDocumentCandidate = { document, media: new Map() };
const tabletop = createTabletopDocument(document.documentId, document.name);
const localSync = { scope: "local-only", state: "clean", baseRevision: null } as const;
const cloudSync = {
  scope: "cloud",
  state: "clean",
  baseRevision: "4",
  accountId: "account",
} as const;
const credentials = {
  accountId: "account",
  accessToken: "token",
  siteSessionId: "session",
  canWrite: true,
};

function ports(
  repositoryOverrides: Partial<GmTabletopFileWorkflowPorts["repository"]> = {},
): GmTabletopFileWorkflowPorts {
  return {
    repository: {
      duplicate: vi.fn().mockResolvedValue(tabletop),
      import: vi.fn().mockResolvedValue(tabletop),
      importDisposition: vi.fn().mockResolvedValue("new"),
      save: vi.fn().mockResolvedValue(candidate),
      syncState: vi.fn().mockResolvedValue(localSync),
      trash: vi.fn().mockResolvedValue(undefined),
      ...repositoryOverrides,
    },
    cloudDocuments: {
      trash: vi.fn().mockResolvedValue({ workspaces: [], tabletops: [] }),
    },
  };
}

describe("GM tabletop file workflow", () => {
  test("inspects an archive and exposes repository conflict disposition", async () => {
    const adapter = ports({ importDisposition: vi.fn().mockResolvedValue("conflict") });

    const result = await runGmTabletopFileWorkflow({
      type: "inspect-import",
      bytes: writePbtab(candidate.document, candidate.media),
    }, adapter);

    expect(result).toMatchObject({
      type: "import-conflict",
      candidate: { document: { documentId: document.documentId } },
    });
    expect(adapter.repository.importDisposition).toHaveBeenCalledOnce();
    expect(adapter.repository.import).not.toHaveBeenCalled();
  });

  test("duplicates through the repository and returns its persisted sync state", async () => {
    const adapter = ports();

    const result = await runGmTabletopFileWorkflow({
      type: "duplicate",
      tabletop,
      media: new Map(),
      accountId: "account",
    }, adapter);

    expect(result).toEqual({ type: "duplicated", tabletop, sync: localSync });
    expect(adapter.repository.duplicate).toHaveBeenCalledWith(tabletop, new Map(), "account");
    expect(adapter.repository.syncState).toHaveBeenCalledWith(tabletop.id);
  });

  test("routes local and cloud trash through their distinct persistence boundaries", async () => {
    const adapter = ports();

    await expect(runGmTabletopFileWorkflow({
      type: "trash",
      tabletopId: tabletop.id,
      sync: localSync,
      credentials: null,
    }, adapter)).resolves.toEqual({ type: "trashed-local" });
    expect(adapter.repository.trash).toHaveBeenCalledWith(tabletop.id);
    expect(adapter.cloudDocuments.trash).not.toHaveBeenCalled();

    await expect(runGmTabletopFileWorkflow({
      type: "trash",
      tabletopId: tabletop.id,
      sync: cloudSync,
      credentials,
    }, adapter)).resolves.toMatchObject({ type: "trashed-cloud" });
    expect(adapter.cloudDocuments.trash).toHaveBeenCalledWith(
      "gm-tabletop-document",
      tabletop.id,
      credentials,
    );
  });

  test("blocks cloud trash before invoking adapters for a read-only session", async () => {
    const adapter = ports();

    await expect(runGmTabletopFileWorkflow({
      type: "trash",
      tabletopId: tabletop.id,
      sync: cloudSync,
      credentials: { ...credentials, canWrite: false },
    }, adapter)).rejects.toThrow("当前会话不能删除云端桌面");
    expect(adapter.repository.trash).not.toHaveBeenCalled();
    expect(adapter.cloudDocuments.trash).not.toHaveBeenCalled();
  });
});
