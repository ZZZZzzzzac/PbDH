import {
  clampTabletopPosition,
  type TabletopCommand,
  type TabletopDocumentModel,
  type TabletopInstance,
  type TabletopInstanceResourceCopy,
} from "@pbdh/tabletop/core";
import { templateRegistry } from "@pbdh/templates/core";

import type { CreatorWorkspace, WorkspaceResource } from "./workspace-model.ts";

export type TabletopPlacementSnapshot = {
  resource: TabletopInstanceResourceCopy;
  assets: CreatorWorkspace["document"]["assets"];
  media: Map<string, Uint8Array>;
};

export type PreparedTabletopReplacement = {
  command: Extract<TabletopCommand, { type: "replace" }>;
  media: Map<string, Uint8Array>;
};

const daggerheartOfficialResourcePackageId = "01a0132c-4eef-7703-94ac-ec8d1a660002";
export const gmCardPixelsPerDesignUnit = 250 / 63;

export function containGmTabletopInstances(document: TabletopDocumentModel): TabletopDocumentModel {
  let changed = false;
  const instances = document.instances.map((instance) => {
    const position = clampTabletopPosition(instance, {
      ...document.canvas,
      containment: "full",
      pixelsPerUnit: gmCardPixelsPerDesignUnit,
    }, instance.position);
    if (position.x === instance.position.x && position.y === instance.position.y) return instance;
    changed = true;
    return { ...instance, position };
  });
  return changed ? { ...document, instances } : document;
}

export function restoreOfficialTabletopImageModes(
  document: TabletopDocumentModel,
  workspaces: readonly CreatorWorkspace[],
): TabletopDocumentModel {
  let changed = false;
  const instances = document.instances.map((instance) => {
    const source = instance.resource.source;
    if (!source || source.packageId !== daggerheartOfficialResourcePackageId) return instance;
    const workspace = workspaces.find((candidate) => candidate.document.package.id === source.packageId);
    const resource = workspace?.document.resources.find((candidate) => candidate.id === source.resourceId);
    if (!resource || resource.media.portrait !== instance.resource.media.portrait) return instance;
    const restoreMode = instance.resource.presentation.mode === "text"
      && resource.presentation.mode !== "text";
    if (!restoreMode) return instance;
    changed = true;
    return {
      ...instance,
      resource: {
        ...instance.resource,
        presentation: {
          ...instance.resource.presentation,
          mode: resource.presentation.mode,
        },
      },
    };
  });
  return changed ? { ...document, instances } : document;
}

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

export function prepareWorkspaceReplacement(
  workspaces: readonly CreatorWorkspace[],
  instance: TabletopInstance,
  replacementId: string,
  newInstanceId: string,
): PreparedTabletopReplacement {
  const source = instance.resource.source;
  if (!source) throw new Error("tabletop.replacement.source-missing");
  const replacement = instance.resource.replacements.find(
    (candidate) => candidate.replacementId === replacementId,
  );
  if (!replacement) throw new Error("tabletop.replacement.unsupported");
  const workspace = workspaces.find((candidate) => candidate.document.package.id === source.packageId);
  if (!workspace) throw new Error("tabletop.replacement.workspace-not-found");
  const target = workspace.document.resources.find(
    (candidate) => candidate.id === replacement.targetResourceId,
  );
  if (!target) throw new Error("tabletop.replacement.target-not-found");
  const template = templateRegistry.resolve(target.template.id, target.template.version);
  if (!template) throw new Error("tabletop.replacement.template-unsupported");
  const snapshot = snapshotWorkspaceResourceForTabletop(workspace, target.id);
  return {
    command: {
      type: "replace",
      instanceId: instance.id,
      newInstanceId,
      replacementId,
      resource: snapshot.resource,
      state: template.tabletop.defaultState(target.data as never),
      assets: snapshot.assets,
    },
    media: snapshot.media,
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
    replacements: structuredClone(resource.replacements ?? []),
    media: structuredClone(resource.media),
  };
}
