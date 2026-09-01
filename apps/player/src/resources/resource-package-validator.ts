import {
  ContractRuntime,
  validateResourcePackageSemantics,
  type ContractCatalog,
  type ResourcePackageCandidateValidator,
} from "@pbdh/contract-runtime";

import catalogJson from "../../../../contracts/catalog.json";
import resourcePackageSchema100 from "../../../../contracts/resource-package/1.0.0/schema.json";
import resourcePackageSchema110 from "../../../../contracts/resource-package/1.1.0/schema.json";

const resourceFamily = (catalogJson as ContractCatalog).families.find(
  (family) => family.id === "resource-package",
);
const versions = resourceFamily?.versions.filter(
  (candidate) => candidate.version === "1.0.0" || candidate.version === "1.1.0",
) ?? [];

if (versions.length !== 2) throw new Error("Missing Resource Package Contract");

const runtime = new ContractRuntime({
  catalogVersion: 1,
  families: [{ id: "resource-package", versions }],
}, {
  "resource-package/1.0.0/schema.json": resourcePackageSchema100,
  "resource-package/1.1.0/schema.json": resourcePackageSchema110,
});

export const validateResourcePackageCandidate: ResourcePackageCandidateValidator = async (
  document,
  media,
) => {
  const schemaDiagnostics = runtime.validate({
    family: "resource-package",
    version: document.contractVersion,
    mode: "development",
    candidate: document,
  });
  return schemaDiagnostics.length
    ? schemaDiagnostics
    : validateResourcePackageSemantics(document, media);
};
