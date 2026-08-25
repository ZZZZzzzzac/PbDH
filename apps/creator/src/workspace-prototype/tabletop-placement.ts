import type { TabletopInstanceResourceCopy } from "@pbdh/tabletop/core";

import type { CreatorWorkspace, WorkspaceResource } from "./workspace-model.ts";

export type TabletopPlacementSnapshot = {
  resource: TabletopInstanceResourceCopy;
  assets: CreatorWorkspace["document"]["assets"];
  media: Map<string, Uint8Array>;
};

export function snapshotWorkspaceResourceForTabletop(
  workspace: CreatorWorkspace,
  resourceId: string,
): TabletopPlacementSnapshot {
  const source = workspace.document.resources.find((resource) => resource.id === resourceId);
  if (!source) throw new Error("tabletop.source-resource.not-found");

  const assetIds = new Set(Object.values(source.media));
  const assets = workspace.document.assets.filter((asset) => assetIds.has(asset.id));
  if (assets.length !== assetIds.size) throw new Error("tabletop.source-media-asset.not-found");

  const media = new Map<string, Uint8Array>();
  for (const asset of assets) {
    const bytes = workspace.media.get(asset.id);
    if (!bytes) throw new Error("tabletop.source-media-bytes.not-found");
    media.set(asset.id, new Uint8Array(bytes));
  }

  return {
    resource: tabletopResourceCopy(workspace, source),
    assets: structuredClone(assets),
    media,
  };
}

function tabletopResourceCopy(
  workspace: CreatorWorkspace,
  resource: WorkspaceResource,
): TabletopInstanceResourceCopy {
  return {
    source: { packageId: workspace.document.package.id, resourceId: resource.id },
    template: structuredClone(resource.template),
    presentation: structuredClone(resource.presentation),
    data: structuredClone(resource.data) as Record<string, unknown>,
    labels: [],
    media: structuredClone(resource.media),
  };
}
