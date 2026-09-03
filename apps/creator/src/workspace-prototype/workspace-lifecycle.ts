import {
  computeResourcePackageSnapshotDigest,
  RESOURCE_PACKAGE_VERSION,
  type ResourcePackageCandidate,
  type ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";

import {
  createWorkspace,
  uuidV7,
  type CreatorWorkspace,
  type ImportPlan,
} from "./workspace-core.ts";

const DEFAULT_RESOURCE_LICENSE = {
  label: "保留所有权利",
  declaration: "All rights reserved.",
} as const;

export function planImport(
  current: CreatorWorkspace | undefined,
  incoming: ResourcePackageCandidate,
): ImportPlan {
  if (!current || current.document.package.id !== incoming.document.package.id) return "insert";
  if (current.dirty) return "conflict";
  if (current.document.snapshotDigest === incoming.document.snapshotDigest) return "no-op";
  return "update";
}

export async function createBlankWorkspace(name: string): Promise<CreatorWorkspace> {
  const packageId = uuidV7();
  const document: ResourcePackageLogicalDocument = {
    contractVersion: RESOURCE_PACKAGE_VERSION,
    package: {
      id: packageId,
      version: "1.0.0",
      name: name.trim() || "未命名资源包",
      description: "",
    },
    targets: [],
    license: { ...DEFAULT_RESOURCE_LICENSE },
    forkSource: null,
    assets: [],
    resources: [],
    emptyDirectories: [],
    snapshotDigest: `sha256:${"0".repeat(64)}`,
  };
  document.snapshotDigest = await computeResourcePackageSnapshotDigest(document, new Map());
  return createWorkspace({ document, media: new Map() });
}

export async function forkCurrentWorkspace(
  workspace: CreatorWorkspace,
  publicationSource?: {
    publicationId: string;
    packageId: string;
    version: string;
    snapshotDigest: string;
  },
): Promise<CreatorWorkspace> {
  const next = createWorkspace(workspace, false);
  const sourcePackageId = next.document.package.id;
  next.document.package.id = uuidV7();
  next.document.package.version = "1.0.0";
  next.document.package.name = `${next.document.package.name}${publicationSource ? "（Fork 草稿）" : "（本地副本）"}`;
  if (publicationSource) {
    next.document.forkSource = {
      publicationId: publicationSource.publicationId,
      packageId: publicationSource.packageId,
      version: publicationSource.version,
      snapshotDigest: publicationSource.snapshotDigest,
      copiedResources: next.document.resources.map((resource) => ({
        packageId: sourcePackageId,
        resourceId: resource.id,
      })),
    };
  } else next.document.forkSource = null;
  next.document.snapshotDigest = await computeResourcePackageSnapshotDigest(next.document, next.media);
  next.dirtyResourceIds = [];
  next.key = next.document.package.id;
  return next;
}

export async function prepareWorkspaceExport(
  workspace: CreatorWorkspace,
): Promise<CreatorWorkspace> {
  const next = createWorkspace(workspace, false);
  next.document.contractVersion = RESOURCE_PACKAGE_VERSION;
  if (!next.document.license.label.trim() || !next.document.license.declaration.trim()) {
    next.document.license = { ...DEFAULT_RESOURCE_LICENSE };
  }
  next.document.resources.forEach((resource) => {
    resource.attribution ??= { artworkCredit: "", sourceLabel: next.document.package.name };
  });
  next.document.snapshotDigest = await computeResourcePackageSnapshotDigest(next.document, next.media);
  next.dirtyResourceIds = [];
  return next;
}
