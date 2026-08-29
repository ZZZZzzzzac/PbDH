import {
  ContractRuntime,
  validateTabletopDocumentSemantics,
  type ContractCatalog,
  type TabletopDocumentCandidateValidator,
} from "@pbdh/contract-runtime";

import catalogJson from "../../../../contracts/catalog.json";
import tabletopDocumentSchema from "../../../../contracts/tabletop-document/1.0.0-alpha.1/schema.json";
import stableTabletopDocumentSchema from "../../../../contracts/tabletop-document/1.0.0/schema.json";

const family = (catalogJson as ContractCatalog).families.find(
  (candidate) => candidate.id === "tabletop-document",
);
const versions = family?.versions.filter((candidate) => candidate.version === "1.0.0-alpha.1"
  || candidate.version === "1.0.0") ?? [];
if (versions.length !== 2) throw new Error("Missing supported Tabletop Document Contracts");

const catalog: ContractCatalog = {
  catalogVersion: 1,
  families: [{ id: "tabletop-document", versions }],
};
const runtime = new ContractRuntime(catalog, {
  "tabletop-document/1.0.0-alpha.1/schema.json": tabletopDocumentSchema,
  "tabletop-document/1.0.0/schema.json": stableTabletopDocumentSchema,
});

export const validateTabletopDocumentCandidate: TabletopDocumentCandidateValidator = async (
  document,
  media,
) => {
  const schemaDiagnostics = runtime.validate({
    family: "tabletop-document",
    version: document.contractVersion,
    mode: "development",
    candidate: document,
  });
  return schemaDiagnostics.length > 0
    ? schemaDiagnostics
    : validateTabletopDocumentSemantics(document, media);
};
