import {
  ContractRuntime,
  validateResourcePackageSemantics,
  type ContractCatalog,
  type ResourcePackageCandidateValidator,
} from "@pbdh/contract-runtime";
import { templateValidationMetadata } from "@pbdh/templates/core/validation";

import catalogJson from "../../../../contracts/catalog.json";
import resourcePackageSchema from "../../../../contracts/resource-package/1.0.0/schema.json";
import resourcePackageSchema110 from "../../../../contracts/resource-package/1.1.0/schema.json";

const resourceFamily = (catalogJson as ContractCatalog).families.find(
  (family) => family.id === "resource-package",
);
const versions = resourceFamily?.versions.filter(
  (candidate) => candidate.version === "1.0.0" || candidate.version === "1.1.0",
) ?? [];

if (versions.length !== 2) throw new Error("Missing Resource Package Contract");

const catalog: ContractCatalog = {
  catalogVersion: 1,
  families: [{ id: "resource-package", versions }],
};
const runtime = new ContractRuntime(catalog, {
  "resource-package/1.0.0/schema.json": resourcePackageSchema,
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
  if (schemaDiagnostics.length) return schemaDiagnostics;
  const diagnostics = await validateResourcePackageSemantics(document, media);
  if (diagnostics.length) return diagnostics;
  for (const [resourceIndex, resource] of document.resources.entries()) {
    const template = templateValidationMetadata(
      resource.template.id,
      resource.template.version,
    );
    const allowed = new Set(template?.tabletop.replacements.map((replacement) => replacement.id) ?? []);
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
  }
  return diagnostics;
};
