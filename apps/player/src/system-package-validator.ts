import {
  ContractRuntime,
  normalizeSystemPackageDocument,
  validateSystemPackageSemantics,
  type ContractCatalog,
  type SystemPackageSourceDocument,
} from "@pbdh/contract-runtime";

import catalogJson from "../../../contracts/catalog.json";
import systemPackageSchema from "../../../contracts/system-package/1.0.0/schema.json";

const family = (catalogJson as ContractCatalog).families.find(
  (candidate) => candidate.id === "system-package",
);
const versions = family?.versions.filter((candidate) => candidate.version === "1.0.0") ?? [];

if (versions.length !== 1) throw new Error("Missing System Package Contract");

const runtime = new ContractRuntime({
  catalogVersion: 1,
  families: [{ id: "system-package", versions }],
}, {
  "system-package/1.0.0/schema.json": systemPackageSchema,
});

export function validateSystemPackageDocument(document: SystemPackageSourceDocument) {
  const schemaDiagnostics = runtime.validate({
    family: "system-package",
    version: document.contractVersion,
    mode: "production",
    candidate: document,
  });
  return schemaDiagnostics.length
    ? schemaDiagnostics
    : validateSystemPackageSemantics(normalizeSystemPackageDocument(document));
}
