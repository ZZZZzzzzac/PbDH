import {
  ContractRuntime,
  validateSystemPackageSemantics,
  type ContractCatalog,
  type SystemPackageDocument,
} from "@pbdh/contract-runtime";

import catalogJson from "../../../contracts/catalog.json";
import systemPackageSchema from "../../../contracts/system-package/1.0.0-alpha.1/schema.json";

const family = (catalogJson as ContractCatalog).families.find(
  (candidate) => candidate.id === "system-package",
);
const version = family?.versions.find((candidate) => candidate.version === "1.0.0-alpha.1");

if (!version) throw new Error("Missing supported System Package Contract");

const runtime = new ContractRuntime({
  catalogVersion: 1,
  families: [{ id: "system-package", versions: [version] }],
}, { [version.schema]: systemPackageSchema });

export function validateSystemPackageDocument(document: SystemPackageDocument) {
  const schemaDiagnostics = runtime.validate({
    family: "system-package",
    version: document.contractVersion,
    mode: "development",
    candidate: document,
  });
  return schemaDiagnostics.length
    ? schemaDiagnostics
    : validateSystemPackageSemantics(document);
}
