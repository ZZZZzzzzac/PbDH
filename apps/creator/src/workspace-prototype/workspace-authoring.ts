import {
  RESOURCE_PACKAGE_VERSION,
  type ResourceAttribution,
  type ResourcePresentation,
  type ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";
import type { TemplateCoreCapability } from "@pbdh/templates/core";

import {
  createWorkspace,
  markResourceDirty,
  syncEmptyDirectories,
  treeItemsInFolder,
  workspacePath,
  workspaceResource,
  type CreatorWorkspace,
  type WorkspaceResource,
} from "./workspace-core.ts";

export function updateWorkspaceResourceData(
  workspace: CreatorWorkspace,
  update: (data: Record<string, unknown>) => void,
  resourceId?: string,
): CreatorWorkspace {
  const next = createWorkspace(workspace, true);
  const resource = workspaceResource(next, resourceId);
  if (!resource.data || typeof resource.data !== "object" || Array.isArray(resource.data)) {
    throw new Error(`Resource data must be an object: ${resource.id}`);
  }
  update(resource.data as Record<string, unknown>);
  markResourceDirty(next, resource.id);
  return next;
}

export function updateResourcePresentation(
  workspace: CreatorWorkspace,
  update: (presentation: ResourcePresentation) => void,
  resourceId?: string,
): CreatorWorkspace {
  const next = createWorkspace(workspace, true);
  const resource = workspaceResource(next, resourceId);
  update(resource.presentation);
  markResourceDirty(next, resource.id);
  return next;
}

export function resolveResourceAttribution(
  resource: WorkspaceResource,
  packageName: string,
): ResourceAttribution {
  return resource.attribution
    ? structuredClone(resource.attribution)
    : { artworkCredit: "", sourceLabel: packageName };
}

export function updateResourceAttribution(
  workspace: CreatorWorkspace,
  update: (attribution: ResourceAttribution) => void,
  resourceId?: string,
): CreatorWorkspace {
  const next = createWorkspace(workspace, true);
  if (next.document.contractVersion !== RESOURCE_PACKAGE_VERSION) {
    next.document.contractVersion = RESOURCE_PACKAGE_VERSION;
    next.document.resources.forEach((candidate) => {
      candidate.attribution ??= { artworkCredit: "", sourceLabel: next.document.package.name };
      markResourceDirty(next, candidate.id);
    });
  }
  const resource = workspaceResource(next, resourceId);
  resource.attribution ??= { artworkCredit: "", sourceLabel: next.document.package.name };
  update(resource.attribution);
  markResourceDirty(next, resource.id);
  return next;
}

export function updateWorkspacePackageMetadata(
  workspace: CreatorWorkspace,
  metadata: { name: string; description: string; version: string; targets?: ResourcePackageLogicalDocument["targets"] },
): CreatorWorkspace {
  const next = createWorkspace(workspace, true);
  next.document.package.name = metadata.name.trim();
  next.document.package.description = metadata.description.trim();
  next.document.package.version = metadata.version.trim();
  if (metadata.targets) next.document.targets = structuredClone(metadata.targets);
  return next;
}

export function updateResourceReplacement(
  workspace: CreatorWorkspace,
  resourceId: string,
  replacementId: string,
  targetResourceId: string | null,
): CreatorWorkspace {
  const next = createWorkspace(workspace, true);
  const resource = workspaceResource(next, resourceId);
  const retained = (resource.replacements ?? []).filter(
    (replacement) => replacement.replacementId !== replacementId,
  );
  resource.replacements = targetResourceId
    ? [...retained, { replacementId, targetResourceId }]
    : retained;
  markResourceDirty(next, resource.id);
  return next;
}

export function addTemplateResource(
  workspace: CreatorWorkspace,
  template: TemplateCoreCapability<any>,
): { workspace: CreatorWorkspace; resourceId: string } {
  const next = createWorkspace(workspace, true);
  if (next.document.contractVersion !== RESOURCE_PACKAGE_VERSION) {
    next.document.contractVersion = RESOURCE_PACKAGE_VERSION;
    next.document.resources.forEach((resource) => {
      resource.attribution ??= { artworkCredit: "", sourceLabel: next.document.package.name };
      markResourceDirty(next, resource.id);
    });
  }
  let sequence = next.document.resources.length + 1;
  let resourceId = `resource-${sequence}`;
  while (next.document.resources.some((resource) => resource.id === resourceId)) {
    sequence += 1;
    resourceId = `resource-${sequence}`;
  }
  const filename = `${resourceId}.json`;
  const path = workspacePath(next, next.currentFolderId, filename);
  next.document.resources.push({
    id: resourceId,
    path,
    template: { id: template.id, version: template.version },
    presentation: structuredClone(template.defaultPresentation),
    attribution: { artworkCredit: "", sourceLabel: next.document.package.name },
    data: structuredClone(template.defaultData),
    replacements: [],
    media: {},
  });
  next.resourceLocations.push({
    resourceId,
    parentId: next.currentFolderId,
    order: treeItemsInFolder(next, next.currentFolderId).length,
  });
  next.openResourceIds = [...next.openResourceIds.filter((id) => id !== next.previewResourceId), resourceId];
  next.previewResourceId = null;
  markResourceDirty(next, resourceId);
  syncEmptyDirectories(next);
  return { workspace: next, resourceId };
}

export function removePortrait(workspace: CreatorWorkspace, resourceId?: string): CreatorWorkspace {
  const next = createWorkspace(workspace, true);
  const resource = workspaceResource(next, resourceId);
  const removedAssetId = resource.media.portrait;
  delete resource.media.portrait;
  resource.presentation.mode = "text";
  if (removedAssetId && !next.document.resources.some((candidate) =>
    Object.values(candidate.media).includes(removedAssetId))) {
    next.document.assets = next.document.assets.filter((asset) => asset.id !== removedAssetId);
    next.media.delete(removedAssetId);
  }
  markResourceDirty(next, resource.id);
  return next;
}

export function replacePortrait(
  workspace: CreatorWorkspace,
  asset: ResourcePackageLogicalDocument["assets"][number],
  bytes: Uint8Array,
  resourceId?: string,
): CreatorWorkspace {
  const next = createWorkspace(workspace, true);
  const resource = workspaceResource(next, resourceId);
  const previousAssetId = resource.media.portrait;
  if (previousAssetId && !next.document.resources.some((candidate) =>
    candidate.id !== resource.id && Object.values(candidate.media).includes(previousAssetId))) {
    next.document.assets = next.document.assets.filter((candidate) => candidate.id !== previousAssetId);
    next.media.delete(previousAssetId);
  }
  next.document.assets = next.document.assets.filter((candidate) => candidate.id !== asset.id);
  next.document.assets.push(asset);
  next.media.set(asset.id, bytes.slice());
  resource.media.portrait = asset.id;
  markResourceDirty(next, resource.id);
  return next;
}
