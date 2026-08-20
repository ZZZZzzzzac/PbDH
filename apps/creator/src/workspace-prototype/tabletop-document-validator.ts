import {
  ContractRuntime,
  validateTabletopDocumentSemantics,
  type ContractCatalog,
  type TabletopDocumentCandidateValidator,
} from "@pbdh/contract-runtime";

import catalogJson from "../../../../contracts/catalog.json";
import tabletopDocumentSchema from "../../../../contracts/tabletop-document/1.0.0-alpha.1/schema.json";

const family = (catalogJson as ContractCatalog).families.find(
  (candidate) => candidate.id === "tabletop-document",
);
const version = family?.versions.find((candidate) => candidate.version === "1.0.0-alpha.1");
if (!version) throw new Error("Missing Tabletop Document Contract 1.0.0-alpha.1");

const catalog: ContractCatalog = {
  catalogVersion: 1,
  families: [{ id: "tabletop-document", versions: [version] }],
};
const runtime = new ContractRuntime(catalog, { [version.schema]: tabletopDocumentSchema });

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
