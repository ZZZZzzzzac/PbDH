import {
  loadPbtab,
  writePbtab,
  type ContractDiagnostic,
  type TabletopDocumentCandidate,
} from "@pbdh/contract-runtime";
import type { CloudCredentials } from "@pbdh/cloud-documents";
import type { LocalDocumentSync } from "@pbdh/local-storage";
import type { TabletopDocumentModel } from "@pbdh/tabletop/core";

import type {
  CreatorCloudDocumentService,
  CreatorCloudRecovery,
} from "./cloud-document-service.ts";
import { safeFileName } from "./creator-file-actions.ts";
import type {
  TabletopDocumentRepository,
  TabletopImportConflictResolution,
} from "./tabletop-document-repository.ts";
import { containGmTabletopInstances } from "./tabletop-placement.ts";
import { validateTabletopDocumentCandidate } from "./tabletop-document-validator.ts";

type TabletopFileRepository = Pick<
  TabletopDocumentRepository,
  "duplicate" | "import" | "importDisposition" | "save" | "syncState" | "trash"
>;

export type GmTabletopFileWorkflowPorts = {
  repository: TabletopFileRepository;
  cloudDocuments: Pick<CreatorCloudDocumentService, "trash">;
};

export type GmTabletopFileCommand =
  | {
    type: "duplicate";
    tabletop: TabletopDocumentModel;
    media: ReadonlyMap<string, Uint8Array>;
    accountId: string | null;
  }
  | {
    type: "trash";
    tabletopId: string;
    sync: LocalDocumentSync | undefined;
    credentials: CloudCredentials | null;
  }
  | {
    type: "export";
    tabletop: TabletopDocumentModel;
    media: ReadonlyMap<string, Uint8Array>;
    accountId: string | null;
  }
  | { type: "inspect-import"; bytes: Uint8Array }
  | {
    type: "commit-import";
    candidate: TabletopDocumentCandidate;
    accountId: string | null;
    resolution: TabletopImportConflictResolution;
  };

export type GmTabletopFileResult =
  | { type: "duplicated"; tabletop: TabletopDocumentModel; sync: LocalDocumentSync | undefined }
  | { type: "trashed-local" }
  | { type: "trashed-cloud"; snapshot: CreatorCloudRecovery }
  | { type: "tabletop-export"; bytes: Uint8Array; fileName: string }
  | { type: "invalid"; title: string; diagnostics: ContractDiagnostic[] }
  | { type: "import-same"; candidate: TabletopDocumentCandidate }
  | { type: "import-conflict"; candidate: TabletopDocumentCandidate }
  | { type: "import-ready"; candidate: TabletopDocumentCandidate }
  | {
    type: "imported";
    tabletop: TabletopDocumentModel;
    media: ReadonlyMap<string, Uint8Array>;
    resolution: TabletopImportConflictResolution;
  };

export async function runGmTabletopFileWorkflow(
  command: GmTabletopFileCommand,
  ports: GmTabletopFileWorkflowPorts,
): Promise<GmTabletopFileResult> {
  if (command.type === "duplicate") {
    const tabletop = await ports.repository.duplicate(
      command.tabletop,
      command.media,
      command.accountId,
    );
    return {
      type: "duplicated",
      tabletop,
      sync: await ports.repository.syncState(tabletop.id),
    };
  }

  if (command.type === "trash") {
    if (command.sync?.scope !== "cloud") {
      await ports.repository.trash(command.tabletopId);
      return { type: "trashed-local" };
    }
    if (!command.credentials?.canWrite) {
      throw new Error("当前会话不能删除云端桌面。");
    }
    return {
      type: "trashed-cloud",
      snapshot: await ports.cloudDocuments.trash(
        "gm-tabletop-document",
        command.tabletopId,
        command.credentials,
      ),
    };
  }

  if (command.type === "export") {
    const candidate = await ports.repository.save(
      command.tabletop,
      command.media,
      command.accountId,
    );
    return {
      type: "tabletop-export",
      bytes: writePbtab(candidate.document, candidate.media),
      fileName: `${safeFileName(command.tabletop.name)}.pbtab`,
    };
  }

  if (command.type === "inspect-import") {
    const loaded = await loadPbtab(command.bytes, validateTabletopDocumentCandidate);
    if (!loaded.candidate) {
      return {
        type: "invalid",
        title: "导入失败 · 零写入",
        diagnostics: loaded.diagnostics,
      };
    }
    const disposition = await ports.repository.importDisposition(loaded.candidate);
    if (disposition === "same") return { type: "import-same", candidate: loaded.candidate };
    if (disposition === "conflict") return { type: "import-conflict", candidate: loaded.candidate };
    return { type: "import-ready", candidate: loaded.candidate };
  }

  const tabletop = containGmTabletopInstances(await ports.repository.import(
    command.candidate,
    command.accountId,
    command.resolution,
  ));
  return {
    type: "imported",
    tabletop,
    media: command.candidate.media,
    resolution: command.resolution,
  };
}
