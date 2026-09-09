import {
  ContractRuntime,
  validateTabletopDocumentSemantics,
  validateTabletopDocumentReferences,
  type ContractCatalog,
  type ContractDiagnostic,
  type TabletopDocument,
  type TabletopDocumentCandidateValidator,
} from "@pbdh/contract-runtime";
import { templateValidationMetadata } from "@pbdh/templates/core/validation";
import type { AnySchema, ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";

import catalogJson from "../../../../contracts/catalog.json";
import stableTabletopDocumentSchema from "../../../../contracts/tabletop-document/1.0.0/schema.json";

const family = (catalogJson as ContractCatalog).families.find(
  (candidate) => candidate.id === "tabletop-document",
);
const versions = family?.versions.filter((candidate) => candidate.version === "1.0.0") ?? [];
if (versions.length !== 1) throw new Error("Missing Tabletop Document Contract");

const catalog: ContractCatalog = {
  catalogVersion: 1,
  families: [{ id: "tabletop-document", versions }],
};
const runtime = new ContractRuntime(catalog, {
  "tabletop-document/1.0.0/schema.json": stableTabletopDocumentSchema,
});
const stateAjv = new Ajv2020({ allErrors: true, strict: true });
const stateValidators = new Map<string, ValidateFunction>();

function templateDiagnostic(
  document: TabletopDocument,
  code: string,
  location: string,
  params: Record<string, unknown>,
): ContractDiagnostic {
  return {
    code,
    severity: "error",
    family: "tabletop-document",
    version: document.contractVersion,
    location,
    params,
  };
}

function validateTemplateStateAndReplacements(document: TabletopDocument): ContractDiagnostic[] {
  if (document.contractVersion !== "1.0.0") return [];
  const diagnostics: ContractDiagnostic[] = [];
  for (const [instanceIndex, instance] of document.instances.entries()) {
    const reference = instance.resourceCopy.template;
    const template = templateValidationMetadata(reference.id, reference.version);
    if (!template) {
      diagnostics.push(templateDiagnostic(
        document,
        "tabletop-document.template.not-found",
        `/instances/${instanceIndex}/resourceCopy/template`,
        { templateId: reference.id, templateVersion: reference.version },
      ));
      continue;
    }

    const templateKey = `${template.id}@${template.version}`;
    let validateState = stateValidators.get(templateKey);
    if (!validateState) {
      validateState = stateAjv.compile(template.tabletop.stateSchema as AnySchema);
      stateValidators.set(templateKey, validateState);
    }
    if (!validateState(instance.state)) {
      diagnostics.push(templateDiagnostic(
        document,
        "tabletop-document.state.invalid-for-template",
        `/instances/${instanceIndex}/state`,
        {
          templateId: template.id,
          templateVersion: template.version,
          errors: (validateState.errors ?? []).map((error) => ({
            path: error.instancePath,
            keyword: error.keyword,
          })),
        },
      ));
    }

    const declaredReplacementIds = new Set(template.tabletop.replacements.map((replacement) => replacement.id));
    const boundReplacementIds = new Set<string>();
    for (const [replacementIndex, replacement] of (instance.resourceCopy.replacements ?? []).entries()) {
      const location = `/instances/${instanceIndex}/resourceCopy/replacements/${replacementIndex}/replacementId`;
      if (boundReplacementIds.has(replacement.replacementId)) {
        diagnostics.push(templateDiagnostic(
          document,
          "tabletop-document.replacement-id.duplicate",
          location,
          { replacementId: replacement.replacementId },
        ));
      } else if (!declaredReplacementIds.has(replacement.replacementId)) {
        diagnostics.push(templateDiagnostic(
          document,
          "tabletop-document.replacement-id.not-declared",
          location,
          { replacementId: replacement.replacementId, templateId: template.id, templateVersion: template.version },
        ));
      }
      boundReplacementIds.add(replacement.replacementId);
    }
  }
  return diagnostics.sort((left, right) => left.location.localeCompare(right.location)
    || left.code.localeCompare(right.code));
}

export async function validateTabletopDocumentUpdate(document: TabletopDocument, assetIds: ReadonlySet<string>) {
  const diagnostics = runtime.validate({ family: "tabletop-document", version: document.contractVersion, mode: "production", candidate: document });
  if (diagnostics.length) return diagnostics;
  return [...validateTabletopDocumentReferences(document, assetIds), ...validateTemplateStateAndReplacements(document)];
}

export const validateTabletopDocumentCandidate: TabletopDocumentCandidateValidator = async (
  document,
  media,
) => {
  const schemaDiagnostics = runtime.validate({
    family: "tabletop-document",
    version: document.contractVersion,
    mode: "production",
    candidate: document,
  });
  if (schemaDiagnostics.length > 0) return schemaDiagnostics;
  return [
    ...await validateTabletopDocumentSemantics(document, media),
    ...validateTemplateStateAndReplacements(document),
  ];
};
