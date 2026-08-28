import {
  ContractRuntime,
  normalizeSystemPackageDocument,
  validateSystemPackageSemantics,
  type AnySystemPackageDocument,
  type ContractCatalog,
} from "@pbdh/contract-runtime";

import catalogJson from "../../../contracts/catalog.json";
import systemPackageAlpha2Schema from "../../../contracts/system-package/1.0.0-alpha.2/schema.json";
import systemPackageSchema from "../../../contracts/system-package/1.0.0/schema.json";

const family = (catalogJson as ContractCatalog).families.find(
  (candidate) => candidate.id === "system-package",
);
const versions = family?.versions.filter((candidate) =>
  candidate.version === "1.0.0-alpha.2" || candidate.version === "1.0.0") ?? [];

if (versions.length !== 2) throw new Error("Missing supported System Package Contract");

const runtime = new ContractRuntime({
  catalogVersion: 1,
  families: [{ id: "system-package", versions }],
}, {
  "system-package/1.0.0-alpha.2/schema.json": systemPackageAlpha2Schema,
  "system-package/1.0.0/schema.json": systemPackageSchema,
});

export function validateSystemPackageDocument(document: AnySystemPackageDocument) {
  const schemaDiagnostics = runtime.validate({
    family: "system-package",
    version: document.contractVersion,
    mode: "development",
    candidate: document,
  });
  return schemaDiagnostics.length
    ? schemaDiagnostics
    : validateSystemPackageSemantics(normalizeSystemPackageDocument(document));
}
