import type { ContractDiagnostic, ResourcePackageCandidate } from "@pbdh/contract-runtime";
import { createPbresCandidateValidator, upgradePbresTemplateVersions } from "@pbdh/resource-conversion";
import { upgradeTemplateResources, type TemplateUpgradeSelection } from "@pbdh/templates/core";
import { loadTemplateCore } from "@pbdh/templates/core/lazy";

const validate = createPbresCandidateValidator(loadTemplateCore);

export class CreatorTemplateUpgradeError extends Error {
  constructor(readonly diagnostics: ContractDiagnostic[]) {
    super(diagnostics[0]?.code ?? "template.upgrade.failed");
  }
}

export async function upgradeCreatorTemplateCandidate(
  candidate: {
    document: ResourcePackageCandidate["document"];
    media: ReadonlyMap<string, Uint8Array>;
  },
  selections: readonly TemplateUpgradeSelection[],
): Promise<ResourcePackageCandidate> {
  const result = await upgradePbresTemplateVersions(candidate, selections, { upgradeResources: upgradeTemplateResources, validate });
  if (!result.candidate) throw new CreatorTemplateUpgradeError(result.diagnostics);
  return result.candidate;
}
