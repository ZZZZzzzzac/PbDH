import {
  classifyResourcePackageVersionChange,
  computeResourcePackageSnapshotDigest,
  ContractRuntime,
  createResourcePackageVersionBaseline,
  loadPbres,
  validateResourcePackageSemantics,
  writePbres,
  type ContractCatalog,
  type ContractDiagnostic,
  type ResourcePackageLogicalDocument,
  type ResourcePackageCandidateValidator,
} from "@pbdh/contract-runtime";

import { upgradeTemplateResources, type TemplateUpgradeSelection } from "@pbdh/templates/core";

import { asJsonObject, exportFailure, isJsonValue, report, text } from "../shared.ts";
import { validateTemplateData } from "../template-validation.ts";
import type { JsonObject, JsonValue, ResourceFormatAdapter, ResourceKind, TemporaryResource } from "../types.ts";

import catalogJson from "../../../../contracts/catalog.json";
import resourcePackageSchema100 from "../../../../contracts/resource-package/1.0.0/schema.json";
import resourcePackageSchema110 from "../../../../contracts/resource-package/1.1.0/schema.json";

const upstreamRevision = "pbdh.resource-package@1.1.0";
const resourceFamily = (catalogJson as ContractCatalog).families.find((family) => family.id === "resource-package");
const contractVersions = resourceFamily?.versions.filter(
  (version) => version.version === "1.0.0" || version.version === "1.1.0",
) ?? [];
if (contractVersions.length !== 2) throw new Error("Missing Resource Package Contract");
const contractRuntime = new ContractRuntime({
  catalogVersion: 1,
  families: [{ id: "resource-package", versions: contractVersions }],
}, {
  "resource-package/1.0.0/schema.json": resourcePackageSchema100,
  "resource-package/1.1.0/schema.json": resourcePackageSchema110,
});

function templateContractDiagnostic(
  version: ResourcePackageLogicalDocument["contractVersion"],
  resourceIndex: number,
  diagnostic: ReturnType<typeof validateTemplateData>[number],
): ContractDiagnostic {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    family: "resource-package",
    version,
    location: `/resources/${resourceIndex}/data${diagnostic.path ?? ""}`,
    params: diagnostic.details ?? {},
  };
}

export const validatePbresConversionCandidate: ResourcePackageCandidateValidator = async (document, media) => {
  const schemaDiagnostics = contractRuntime.validate({
    family: "resource-package",
    version: document.contractVersion,
    mode: "development",
    candidate: document,
  });
  if (schemaDiagnostics.length > 0) return schemaDiagnostics;
  const semanticDiagnostics = await validateResourcePackageSemantics(document, media);
  if (semanticDiagnostics.length > 0) return semanticDiagnostics;
  return document.resources.flatMap((resource, index) => {
    const data = asJsonObject(resource.data);
    if (!data) return [templateContractDiagnostic(document.contractVersion, index, {
      code: "conversion.template-data.invalid",
      severity: "error",
      message: "Template data 必须是对象。",
    })];
    return validateTemplateData(resource.template.id, resource.template.version, data)
      .map((diagnostic) => templateContractDiagnostic(document.contractVersion, index, diagnostic));
  });
};

export async function upgradePbresTemplateVersions(
  candidate: { document: ResourcePackageLogicalDocument; media: ReadonlyMap<string, Uint8Array> },
  selections: readonly TemplateUpgradeSelection[],
) {
  const document = structuredClone(candidate.document);
  const resources = upgradeTemplateResources(document.resources, selections);
  if (resources.every((resource, index) => resource === document.resources[index])) {
    return { candidate: { document: candidate.document, media: new Map(candidate.media) }, diagnostics: [] };
  }
  const baseline = await createResourcePackageVersionBaseline(document);
  document.resources = resources;
  const classification = await classifyResourcePackageVersionChange(baseline, document);
  document.package.version = classification.minimumVersion;
  document.snapshotDigest = await computeResourcePackageSnapshotDigest(document, candidate.media);
  const diagnostics = await validatePbresConversionCandidate(document, candidate.media);
  return diagnostics.some((item) => item.severity === "error")
    ? { candidate: null, diagnostics }
    : { candidate: { document, media: new Map(candidate.media) }, diagnostics };
}

function kindFor(templateId: string): ResourceKind {
  if (templateId === "敌人") return "adversary";
  if (templateId === "武器") return "weapon";
  if (templateId === "护甲") return "armor";
  if (templateId === "物品") return "item";
  if (templateId === "职业") return "class";
  if (templateId === "子职业") return "subclass";
  if (templateId === "种族") return "ancestry";
  if (templateId === "社群") return "community";
  if (templateId === "领域卡") return "domain";
  if (templateId === "环境") return "environment";
  if (templateId === "自由") return "free";
  return "free";
}

export const pbresAdapter: ResourceFormatAdapter = {
  id: "pbres",
  upstreamRevision,
  async import(input) {
    const loaded = await loadPbres(input.bytes, validatePbresConversionCandidate);
    if (!loaded.candidate) {
      return {
        ok: false,
        report: report("pbres", "import", 0, loaded.diagnostics.map((item) => ({
          code: item.code,
          severity: item.severity,
          message: `${item.code} @ ${item.location}`,
          path: item.location,
          details: isJsonValue(item.params) ? item.params as JsonObject : undefined,
        }))),
      };
    }
    const document = loaded.candidate.document;
    const documentUpstreamRevision = `pbdh.resource-package@${document.contractVersion}`;
    const resources: TemporaryResource[] = document.resources.map((resource, index) => ({
      sourceId: resource.id,
      kind: kindFor(resource.template.id),
      name: text(asJsonObject(resource.data)?.名称) || resource.id,
      fields: asJsonObject(resource.data) ?? { value: resource.data },
      source: {
        formatId: "pbres",
        upstreamRevision: documentUpstreamRevision,
        path: `/resources/${index}`,
        raw: structuredClone(resource) as JsonValue,
      },
    }));
    return {
      ok: true,
      batch: {
        name: document.package.name,
        version: document.package.version,
        resources,
        sourceDocument: { formatId: "pbres", upstreamRevision: documentUpstreamRevision, container: "pbres" },
        nativePackage: document,
        media: loaded.candidate.media,
      },
      report: report("pbres", "import", resources.length, loaded.diagnostics.map((item) => ({
        code: item.code, severity: item.severity, message: item.code, path: item.location,
      }))),
    };
  },
  export(batch) {
    if (!batch.nativePackage) return exportFailure("pbres", [{
      code: "pbres.materialization.required",
      severity: "error",
      message: "第三方候选必须先由调用方分配 Resource Package 与 Resource ID，再导出 .pbres。",
    }]);
    let bytes: Uint8Array;
    try {
      bytes = writePbres(batch.nativePackage as ResourcePackageLogicalDocument, batch.media);
    } catch (error) {
      return exportFailure("pbres", [{
        code: "pbres.write.failed",
        severity: "error",
        message: error instanceof Error ? error.message : "pbres 写出失败。",
      }]);
    }
    return {
      ok: true,
      artifact: { bytes, fileName: `${batch.nativePackage.package.name}.pbres`, container: "pbres", mediaType: "application/zip" },
      report: report("pbres", "export", batch.resources.length),
    };
  },
};
