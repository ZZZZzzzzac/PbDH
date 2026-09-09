import {
  loadPbres,
  writePbres,
  type ContractDiagnostic,
  type ResourcePackageCandidate,
} from "@pbdh/contract-runtime";
import {
  createResourceConversionRegistry,
  createPbresCandidateValidator,
  type ResourceFormatId,
} from "@pbdh/resource-conversion";

import type { CreatorConversionReview } from "./creator-dialogs.tsx";
import { safeFileName, resourceContainer } from "./creator-file-actions.ts";
import { materializeCreatorResourceConversion } from "./materialize-resource-conversion.ts";
import { validateResourcePackageCandidate } from "./resource-package-validator.ts";
import { prepareWorkspaceExport, type CreatorWorkspace } from "./workspace-model.ts";
import { loadTemplateCore } from "@pbdh/templates/core/lazy";

const resourceConversionRegistry = createResourceConversionRegistry(createPbresCandidateValidator(loadTemplateCore));

export type CreatorPackageFileCommand =
  | { type: "inspect-import"; bytes: Uint8Array }
  | { type: "export-workspace"; workspace: CreatorWorkspace }
  | { type: "export-third-party"; formatId: Exclude<ResourceFormatId, "pbres">; workspace: CreatorWorkspace }
  | { type: "convert"; formatId: Exclude<ResourceFormatId, "pbres">; bytes: Uint8Array; fileName: string }
  | { type: "export-conversion"; review: CreatorConversionReview };

export type CreatorPackageFileResult =
  | { type: "import-ready"; candidate: ResourcePackageCandidate }
  | { type: "invalid"; title: string; diagnostics: ContractDiagnostic[] }
  | { type: "workspace-export"; workspace: CreatorWorkspace; bytes: Uint8Array; fileName: string; message: string }
  | { type: "third-party-export"; workspace: CreatorWorkspace; bytes: Uint8Array; fileName: string; message: string }
  | { type: "conversion-review"; review: CreatorConversionReview }
  | { type: "conversion-export"; bytes: Uint8Array; fileName: string }
  | { type: "no-conversion" };

export async function runCreatorPackageFileWorkflow(
  command: CreatorPackageFileCommand,
): Promise<CreatorPackageFileResult> {
  if (command.type === "inspect-import") {
    const result = await loadPbres(command.bytes, validateResourcePackageCandidate);
    if (!result.candidate) return { type: "invalid", title: "导入失败 · 零写入", diagnostics: result.diagnostics };
    return { type: "import-ready", candidate: result.candidate };
  }

  if (command.type === "export-workspace") {
    const workspace = await prepareWorkspaceExport(command.workspace);
    const diagnostics = await validateResourcePackageCandidate(workspace.document, workspace.media);
    if (diagnostics.some((item) => item.severity === "error")) {
      return { type: "invalid", title: "导出门禁未通过", diagnostics };
    }
    return {
      type: "workspace-export",
      workspace,
      bytes: writePbres(workspace.document, workspace.media),
      fileName: `${safeFileName(workspace.document.package.name)}.pbres`,
      message: `已导出完整 .pbres · ${workspace.document.snapshotDigest.slice(0, 18)}…`,
    };
  }

  if (command.type === "export-third-party") {
    const workspace = await prepareWorkspaceExport(command.workspace);
    const diagnostics = await validateResourcePackageCandidate(workspace.document, workspace.media);
    if (diagnostics.some((item) => item.severity === "error")) {
      return { type: "invalid", title: "导出门禁未通过", diagnostics };
    }
    const pbres = await resourceConversionRegistry.import("pbres", {
      bytes: writePbres(workspace.document, workspace.media),
      fileName: `${safeFileName(workspace.document.package.name)}.pbres`,
      container: "pbres",
    });
    if (!pbres.ok) {
      return {
        type: "conversion-review",
        review: {
          formatId: command.formatId,
          sourceFileName: workspace.document.package.name,
          candidate: null,
          converted: pbres.report.converted,
          failed: pbres.report.failed,
          diagnostics: pbres.report.diagnostics,
        },
      };
    }
    const exported = await resourceConversionRegistry.export(command.formatId, pbres.batch, {
      packageName: workspace.document.package.name,
      packageVersion: workspace.document.package.version,
    });
    if (!exported.ok) {
      return {
        type: "conversion-review",
        review: {
          formatId: command.formatId,
          sourceFileName: workspace.document.package.name,
          candidate: null,
          converted: exported.report.converted,
          failed: exported.report.failed,
          diagnostics: exported.report.diagnostics,
        },
      };
    }
    return {
      type: "third-party-export",
      workspace,
      bytes: exported.artifact.bytes,
      fileName: exported.artifact.fileName,
      message: `已导出 ${command.formatId} 格式 · ${exported.report.converted} 项资源`,
    };
  }

  if (command.type === "export-conversion") {
    if (!command.review.candidate) return { type: "no-conversion" };
    return {
      type: "conversion-export",
      bytes: writePbres(command.review.candidate.document, command.review.candidate.media),
      fileName: `${safeFileName(command.review.candidate.document.package.name)}.pbres`,
    };
  }

  let review: CreatorConversionReview;
  try {
    const imported = await resourceConversionRegistry.import(command.formatId, {
      bytes: command.bytes,
      fileName: command.fileName,
      container: resourceContainer(command.fileName),
    });
    if (!imported.ok) {
      review = {
        formatId: command.formatId,
        sourceFileName: command.fileName,
        candidate: null,
        converted: imported.report.converted,
        failed: imported.report.failed,
        diagnostics: imported.report.diagnostics,
      };
    } else {
      const materialized = await materializeCreatorResourceConversion(imported.batch);
      review = {
        formatId: command.formatId,
        sourceFileName: command.fileName,
        candidate: materialized.candidate,
        converted: materialized.converted,
        failed: imported.report.failed + materialized.skipped,
        diagnostics: [...imported.report.diagnostics, ...materialized.diagnostics],
      };
    }
  } catch (error) {
    review = {
      formatId: command.formatId,
      sourceFileName: command.fileName,
      candidate: null,
      converted: 0,
      failed: 1,
      diagnostics: [{
        code: "creator.resource-conversion.failed",
        severity: "error",
        message: error instanceof Error ? error.message : "第三方资源转换失败。",
      }],
    };
  }
  return { type: "conversion-review", review };
}
