import {
  computeResourcePackageSnapshotDigest,
  type ContractDiagnostic,
  type ResourcePackageCandidate,
} from "@pbdh/contract-runtime";
import { upgradeTemplateResourceToCurrent } from "@pbdh/templates/core";

import { validateResourcePackageCandidate } from "./resource-package-validator.ts";

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
): Promise<ResourcePackageCandidate> {
  const document = structuredClone(candidate.document);
  let changed = false;
  document.resources = document.resources.map((resource) => {
    const upgraded = upgradeTemplateResourceToCurrent(resource);
    changed ||= upgraded.template.version !== resource.template.version;
    return upgraded;
  });
  if (!changed) return { document: candidate.document, media: new Map(candidate.media) };
  document.snapshotDigest = await computeResourcePackageSnapshotDigest(document, candidate.media);
  const diagnostics = await validateResourcePackageCandidate(document, candidate.media);
  if (diagnostics.some((item) => item.severity === "error")) {
    throw new CreatorTemplateUpgradeError(diagnostics);
  }
  return { document, media: new Map(candidate.media) };
}
