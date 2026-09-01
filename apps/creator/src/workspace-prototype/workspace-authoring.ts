import {
  RESOURCE_PACKAGE_VERSION,
  type ResourcePresentation,
  type ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";
import {
  templateRegistry,
} from "@pbdh/templates/core";

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
  templateId: string,
  templateVersion: string,
): { workspace: CreatorWorkspace; resourceId: string } {
  const template = templateRegistry.resolve(templateId, templateVersion);
  if (!template) throw new Error(`Unsupported Template: ${templateId}@${templateVersion}`);
  const next = createWorkspace(workspace, true);
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
    data: structuredClone(template.defaultData),
    ...(next.document.contractVersion === RESOURCE_PACKAGE_VERSION ? { replacements: [] } : {}),
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
