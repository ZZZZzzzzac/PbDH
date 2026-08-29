import {
  ContractRuntime,
  validateResourcePackageSemantics,
  type ContractCatalog,
  type ResourcePackageCandidateValidator,
} from "@pbdh/contract-runtime";
import { templateRegistry } from "@pbdh/templates/core";

import catalogJson from "../../../../contracts/catalog.json";
import legacyResourcePackageSchema from "../../../../contracts/resource-package/1.0.0-alpha.1/schema.json";
import resourcePackageSchema from "../../../../contracts/resource-package/1.0.0/schema.json";

const resourceFamily = (catalogJson as ContractCatalog).families.find(
  (family) => family.id === "resource-package",
);
const versions = resourceFamily?.versions.filter(
  (candidate) => candidate.version === "1.0.0-alpha.1" || candidate.version === "1.0.0",
) ?? [];

if (versions.length !== 2) throw new Error("Missing supported Resource Package Contracts");

const catalog: ContractCatalog = {
  catalogVersion: 1,
  families: [{ id: "resource-package", versions }],
};
const runtime = new ContractRuntime(catalog, {
  "resource-package/1.0.0-alpha.1/schema.json": legacyResourcePackageSchema,
  "resource-package/1.0.0/schema.json": resourcePackageSchema,
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
  if (schemaDiagnostics.length) return schemaDiagnostics;
  const diagnostics = await validateResourcePackageSemantics(document, media);
  if (diagnostics.length) return diagnostics;
  document.resources.forEach((resource, resourceIndex) => {
    const allowed = new Set(templateRegistry.resolve(
      resource.template.id,
      resource.template.version,
    )?.tabletop.replacements.map((replacement) => replacement.id) ?? []);
    (resource.replacements ?? []).forEach((replacement, replacementIndex) => {
      if (!allowed.has(replacement.replacementId)) diagnostics.push({
        code: "template.replacement.unsupported",
        severity: "error",
        family: "resource-template",
        version: resource.template.version,
        location: `/resources/${resourceIndex}/replacements/${replacementIndex}/replacementId`,
        params: { replacementId: replacement.replacementId },
      });
    });
  });
  return diagnostics;
};
