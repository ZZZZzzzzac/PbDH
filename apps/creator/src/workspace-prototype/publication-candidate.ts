import type {
  ContractDiagnostic,
  ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";
import { computeResourcePackageSnapshotDigest } from "@pbdh/contract-runtime";

import { validateResourcePackageCandidate } from "./resource-package-validator.ts";
import {
  prepareWorkspaceExport,
  type CreatorWorkspace,
} from "./workspace-model.ts";

export type PublicationMetadata = {
  title: string;
  summary: string;
  language: string;
  tags: string[];
  coverAssetId: string;
};

export type PublicationCover = {
  asset: ResourcePackageLogicalDocument["assets"][number];
  bytes: Uint8Array;
};

export type PublicationLicense = ResourcePackageLogicalDocument["license"];

export type PublicationCandidate = {
  document: ResourcePackageLogicalDocument;
  media: Map<string, Uint8Array>;
  metadata: PublicationMetadata;
};

export type PublicationCandidateResult =
  | { ok: true; candidate: PublicationCandidate }
  | { ok: false; diagnostics: ContractDiagnostic[] };

export function defaultPublicationCoverAssetId(
  document: ResourcePackageLogicalDocument,
): string {
  const declaredAssetIds = new Set(document.assets.map((asset) => asset.id));
  const firstCardAssetId = Object.values(document.resources[0]?.media ?? {})
    .find((assetId) => declaredAssetIds.has(assetId));
  return firstCardAssetId ?? document.assets[0]?.id ?? "";
}

export async function preparePublicationCandidate(
  workspace: CreatorWorkspace,
  metadata: PublicationMetadata,
  cover?: PublicationCover,
  license?: PublicationLicense,
): Promise<PublicationCandidateResult> {
  const prepared = await prepareWorkspaceExport(workspace);
  const document = structuredClone(prepared.document);
  const media = new Map(prepared.media);

  if (license) document.license = structuredClone(license);

  if (cover) {
    const existingAssetIndex = document.assets.findIndex((asset) => asset.id === cover.asset.id);
    if (existingAssetIndex >= 0) document.assets[existingAssetIndex] = structuredClone(cover.asset);
    else document.assets.push(structuredClone(cover.asset));
    media.set(cover.asset.id, new Uint8Array(cover.bytes));
  }

  document.snapshotDigest = await computeResourcePackageSnapshotDigest(document, media);

  const diagnostics = await validateResourcePackageCandidate(document, media);
  if (diagnostics.some((item) => item.severity === "error")) {
    return { ok: false, diagnostics };
  }

  return {
    ok: true,
    candidate: {
      document,
      media,
      metadata: structuredClone(metadata),
    },
  };
}
