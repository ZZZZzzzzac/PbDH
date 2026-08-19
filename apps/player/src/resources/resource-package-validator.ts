import {
  ContractRuntime,
  validateResourcePackageSemantics,
  type ContractCatalog,
  type ResourcePackageCandidateValidator,
} from "@pbdh/contract-runtime";

import catalogJson from "../../../../contracts/catalog.json";
import resourcePackageSchema from "../../../../contracts/resource-package/1.0.0-alpha.1/schema.json";

const resourceFamily = (catalogJson as ContractCatalog).families.find(
  (family) => family.id === "resource-package",
);
const version = resourceFamily?.versions.find(
  (candidate) => candidate.version === "1.0.0-alpha.1",
);

if (!version) throw new Error("Missing Resource Package Contract 1.0.0-alpha.1");

const runtime = new ContractRuntime({
  catalogVersion: 1,
  families: [{ id: "resource-package", versions: [version] }],
}, { [version.schema]: resourcePackageSchema });

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
