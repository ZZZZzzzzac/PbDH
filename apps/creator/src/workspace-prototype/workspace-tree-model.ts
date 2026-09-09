import {
  createWorkspace,
  descendantWorkspaceFolderIds,
  markResourceDirty,
  normalizeDeterministicOrders,
  requireResourceLocation,
  requireWorkspaceFolder,
  requireWorkspaceFolderOrRoot,
  syncEmptyDirectories,
  syncWorkspacePaths,
  treeItemsInFolder,
  uuidV7,
  workspacePath,
  workspaceResource,
  type CreatorWorkspace,
  type WorkspaceNodeRef,
  type WorkspaceResource,
} from "./workspace-core.ts";

export function createWorkspaceFolder(
  workspace: CreatorWorkspace,
  parentId = workspace.currentFolderId,
  preferredName = "新建文件夹",
): CreatorWorkspace {
  requireWorkspaceFolderOrRoot(workspace, parentId);
  const next = createWorkspace(workspace, true);
  const siblingNames = new Set(next.folders.filter((folder) => folder.parentId === parentId).map((folder) => folder.name));
  let name = preferredName.trim() || "新建文件夹";
  let sequence = 2;
  while (siblingNames.has(name)) {
    name = `${preferredName} ${sequence}`;
    sequence += 1;
  }
  next.folders.push({
    id: `folder-${uuidV7()}`,
    name,
    parentId,
    order: treeItemsInFolder(next, parentId).length,
    collapsed: false,
  });
  next.currentFolderId = next.folders.at(-1)!.id;
  syncEmptyDirectories(next);
  return next;
}

export function selectWorkspaceFolder(
  workspace: CreatorWorkspace,
  folderId: string | null,
): CreatorWorkspace {
  requireWorkspaceFolderOrRoot(workspace, folderId);
  return { ...workspace, currentFolderId: folderId };
}

export function toggleWorkspaceFolder(
  workspace: CreatorWorkspace,
  folderId: string,
): CreatorWorkspace {
  requireWorkspaceFolder(workspace, folderId);
  return {
    ...workspace,
    folders: workspace.folders.map((folder) => folder.id === folderId
      ? { ...folder, collapsed: !folder.collapsed }
      : folder),
  };
}

export function renameWorkspaceFolder(
  workspace: CreatorWorkspace,
  folderId: string,
  name: string,
): CreatorWorkspace {
  const folder = requireWorkspaceFolder(workspace, folderId);
  const normalized = name.trim();
  if (!normalized) throw new Error("文件夹名称不能为空");
  if (workspace.folders.some((candidate) =>
    candidate.id !== folderId
    && candidate.parentId === folder.parentId
    && candidate.name === normalized)) {
    throw new Error("同级文件夹名称不能重复");
  }
  const next = createWorkspace(workspace, true);
  next.folders = next.folders.map((candidate) => candidate.id === folderId
    ? { ...candidate, name: normalized }
    : candidate);
  syncWorkspacePaths(next);
  const folderIds = [folderId, ...descendantWorkspaceFolderIds(next, folderId)];
  next.resourceLocations
    .filter((location) => folderIds.includes(location.parentId ?? ""))
    .forEach((location) => markResourceDirty(next, location.resourceId));
  return next;
}

export function moveWorkspaceNode(
  workspace: CreatorWorkspace,
  node: WorkspaceNodeRef,
  targetParentId: string | null,
): CreatorWorkspace {
  requireWorkspaceFolderOrRoot(workspace, targetParentId);
  if (node.kind === "folder") {
    requireWorkspaceFolder(workspace, node.id);
    if (targetParentId === node.id || descendantWorkspaceFolderIds(workspace, node.id).includes(targetParentId ?? "")) {
      throw new Error("不能把文件夹移动到自身或其子文件夹");
    }
  } else requireResourceLocation(workspace, node.id);

  const sourceParentId = node.kind === "folder"
    ? requireWorkspaceFolder(workspace, node.id).parentId
    : requireResourceLocation(workspace, node.id).parentId;
  if (sourceParentId === targetParentId) return workspace;
  const next = createWorkspace(workspace, true);
  if (node.kind === "folder") {
    next.folders = next.folders.map((folder) => folder.id === node.id ? { ...folder, parentId: targetParentId } : folder);
  } else {
    next.resourceLocations = next.resourceLocations.map((location) => location.resourceId === node.id
      ? { ...location, parentId: targetParentId }
      : location);
  }
  normalizeDeterministicOrders(next.document, next.folders, next.resourceLocations);
  syncWorkspacePaths(next);
  const movedResourceIds = node.kind === "resource"
    ? [node.id]
    : next.resourceLocations
        .filter((location) => [node.id, ...descendantWorkspaceFolderIds(next, node.id)].includes(location.parentId ?? ""))
        .map((location) => location.resourceId);
  movedResourceIds.forEach((resourceId) => markResourceDirty(next, resourceId));
  return next;
}

export function deleteWorkspaceNode(
  workspace: CreatorWorkspace,
  node: WorkspaceNodeRef,
): CreatorWorkspace {
  const folderIds = node.kind === "folder"
    ? [node.id, ...descendantWorkspaceFolderIds(workspace, node.id)]
    : [];
  const resourceIds = node.kind === "resource"
    ? [node.id]
    : workspace.resourceLocations.filter((location) => folderIds.includes(location.parentId ?? "")).map((location) => location.resourceId);
  const sourceParentId = node.kind === "folder"
    ? requireWorkspaceFolder(workspace, node.id).parentId
    : requireResourceLocation(workspace, node.id).parentId;
  const next = createWorkspace(workspace, true);
  next.folders = next.folders.filter((folder) => !folderIds.includes(folder.id));
  next.resourceLocations = next.resourceLocations.filter((location) => !resourceIds.includes(location.resourceId));
  const removedResources = next.document.resources.filter((resource) => resourceIds.includes(resource.id));
  next.document.resources = next.document.resources.filter((resource) => !resourceIds.includes(resource.id));
  next.openResourceIds = next.openResourceIds.filter((id) => !resourceIds.includes(id));
  next.dirtyResourceIds = next.dirtyResourceIds.filter((id) => !resourceIds.includes(id));
  next.previewResourceId = resourceIds.includes(next.previewResourceId ?? "") ? null : next.previewResourceId;
  next.currentFolderId = folderIds.includes(next.currentFolderId ?? "") ? sourceParentId : next.currentFolderId;
  const removedAssetIds = new Set(removedResources.flatMap((resource) => Object.values(resource.media)));
  const retainedAssetIds = new Set(next.document.resources.flatMap((resource) => Object.values(resource.media)));
  next.document.assets = next.document.assets.filter((asset) => !removedAssetIds.has(asset.id) || retainedAssetIds.has(asset.id));
  for (const assetId of removedAssetIds) if (!retainedAssetIds.has(assetId)) next.media.delete(assetId);
  normalizeDeterministicOrders(next.document, next.folders, next.resourceLocations);
  syncEmptyDirectories(next);
  return next;
}

export function previewWorkspaceResource(
  workspace: CreatorWorkspace,
  resourceId: string,
): CreatorWorkspace {
  workspaceResource(workspace, resourceId);
  const parentId = requireResourceLocation(workspace, resourceId).parentId;
  if (workspace.openResourceIds.includes(resourceId)) return { ...workspace, currentFolderId: parentId };
  const openResourceIds = workspace.openResourceIds.filter((id) => id !== workspace.previewResourceId);
  const previewIndex = workspace.previewResourceId
    ? workspace.openResourceIds.indexOf(workspace.previewResourceId)
    : -1;
  openResourceIds.splice(previewIndex >= 0 ? previewIndex : openResourceIds.length, 0, resourceId);
  return { ...workspace, openResourceIds, previewResourceId: resourceId, currentFolderId: parentId };
}

export function pinWorkspaceResource(
  workspace: CreatorWorkspace,
  resourceId: string,
): CreatorWorkspace {
  workspaceResource(workspace, resourceId);
  return workspace.previewResourceId === resourceId ? { ...workspace, previewResourceId: null } : workspace;
}

export function closeWorkspaceResourceTab(
  workspace: CreatorWorkspace,
  resourceId: string,
): { workspace: CreatorWorkspace; nextResourceId: string } {
  const index = workspace.openResourceIds.indexOf(resourceId);
  if (index < 0) return { workspace, nextResourceId: workspace.openResourceIds[0] ?? "" };
  const openResourceIds = workspace.openResourceIds.filter((id) => id !== resourceId);
  return {
    workspace: {
      ...workspace,
      openResourceIds,
      previewResourceId: workspace.previewResourceId === resourceId ? null : workspace.previewResourceId,
    },
    nextResourceId: openResourceIds[Math.min(index, openResourceIds.length - 1)] ?? "",
  };
}

export function duplicateWorkspaceResource(
  workspace: CreatorWorkspace,
  resourceId: string,
): { workspace: CreatorWorkspace; resourceId: string } {
  const source = workspaceResource(workspace, resourceId);
  const sourceLocation = requireResourceLocation(workspace, resourceId);
  const next = createWorkspace(workspace, true);
  let sequence = 1;
  let nextId = `${source.id}-copy`;
  while (next.document.resources.some((resource) => resource.id === nextId)) {
    sequence += 1;
    nextId = `${source.id}-copy-${sequence}`;
  }
  const filename = source.path.split("/").at(-1) ?? `${source.id}.json`;
  const extensionIndex = filename.lastIndexOf(".");
  const stem = extensionIndex > 0 ? filename.slice(0, extensionIndex) : filename;
  const extension = extensionIndex > 0 ? filename.slice(extensionIndex) : ".json";
  let copiedFilename = `${stem}-copy${extension}`;
  sequence = 1;
  const siblingPaths = new Set(next.document.resources.map((resource) => resource.path));
  while (siblingPaths.has(workspacePath(next, sourceLocation.parentId, copiedFilename))) {
    sequence += 1;
    copiedFilename = `${stem}-copy-${sequence}${extension}`;
  }
  next.document.resources.push({ ...structuredClone(source), id: nextId, path: workspacePath(next, sourceLocation.parentId, copiedFilename) });
  next.resourceLocations.push({ resourceId: nextId, parentId: sourceLocation.parentId, order: 0 });
  normalizeDeterministicOrders(next.document, next.folders, next.resourceLocations);
  next.openResourceIds = [...next.openResourceIds.filter((id) => id !== next.previewResourceId), nextId];
  next.previewResourceId = null;
  next.currentFolderId = sourceLocation.parentId;
  markResourceDirty(next, nextId);
  return { workspace: next, resourceId: nextId };
}

export function copyWorkspaceResourceToPackage(
  sourceWorkspace: CreatorWorkspace,
  targetWorkspace: CreatorWorkspace,
  resourceId: string,
): { workspace: CreatorWorkspace; resourceId: string; copiedResourceIds: string[] } {
  return copyWorkspaceResourcesToPackage(sourceWorkspace, targetWorkspace, [resourceId]);
}

export type WorkspaceCopySource = { workspaceKey: string; resourceIds: string[]; folderId?: string };

export function copyWorkspaceResourcesToPackage(
  sourceWorkspace: CreatorWorkspace,
  targetWorkspace: CreatorWorkspace,
  resourceIds: readonly string[],
  folderId?: string,
): { workspace: CreatorWorkspace; resourceId: string; copiedResourceIds: string[] } {
  resourceIds.forEach((id) => workspaceResource(sourceWorkspace, id));
  const folderIds = folderId ? [folderId, ...descendantWorkspaceFolderIds(sourceWorkspace, folderId)] : [];
  if (folderId) requireWorkspaceFolder(sourceWorkspace, folderId);
  const selectedIds = folderId
    ? sourceWorkspace.resourceLocations.filter((location) => folderIds.includes(location.parentId ?? "")).map((location) => location.resourceId)
    : [...resourceIds];
  const sourceById = new Map(sourceWorkspace.document.resources.map((resource) => [resource.id, resource]));
  const resourcesToCopy: WorkspaceResource[] = [];
  const queued = [...selectedIds];
  const visited = new Set<string>();
  while (queued.length > 0) {
    const currentId = queued.shift()!;
    if (visited.has(currentId)) continue;
    const current = sourceById.get(currentId);
    if (!current) continue;
    visited.add(currentId);
    resourcesToCopy.push(current);
    for (const replacement of current.replacements ?? []) queued.push(replacement.targetResourceId);
  }

  let next = createWorkspace(targetWorkspace, true);
  const destinationFolderId = targetWorkspace.currentFolderId;
  const copiedFolderIds = new Map<string, string>();
  const copyFolder = (id: string): string => {
    const existing = copiedFolderIds.get(id);
    if (existing) return existing;
    const folder = requireWorkspaceFolder(sourceWorkspace, id);
    const parentId = id === folderId ? destinationFolderId : copyFolder(folder.parentId!);
    next = createWorkspaceFolder(next, parentId, folder.name);
    copiedFolderIds.set(id, next.currentFolderId!);
    return next.currentFolderId!;
  };
  folderIds.forEach(copyFolder);
  next.currentFolderId = destinationFolderId;
  const copiedIdBySourceId = new Map<string, string>();
  for (const source of resourcesToCopy) {
    let copiedId = `resource-${uuidV7()}`;
    while (next.document.resources.some((resource) => resource.id === copiedId)) copiedId = `resource-${uuidV7()}`;
    copiedIdBySourceId.set(source.id, copiedId);
  }

  const occupiedPaths = new Set(next.document.resources.map((resource) => resource.path));
  const copiedResourceIds: string[] = [];
  for (const source of resourcesToCopy) {
    const copiedId = copiedIdBySourceId.get(source.id)!;
    const sourceParentId = requireResourceLocation(sourceWorkspace, source.id).parentId;
    const parentId = copiedFolderIds.get(sourceParentId ?? "") ?? destinationFolderId;
    const filename = source.path.split("/").at(-1) ?? `${source.id}.json`;
    const extensionIndex = filename.lastIndexOf(".");
    const stem = extensionIndex > 0 ? filename.slice(0, extensionIndex) : filename;
    const extension = extensionIndex > 0 ? filename.slice(extensionIndex) : ".json";
    let copiedFilename = filename;
    let sequence = 1;
    while (occupiedPaths.has(workspacePath(next, parentId, copiedFilename))) {
      sequence += 1;
      copiedFilename = `${stem}-copy-${sequence}${extension}`;
    }
    const copiedPath = workspacePath(next, parentId, copiedFilename);
    occupiedPaths.add(copiedPath);
    const copied = structuredClone(source);
    copied.id = copiedId;
    copied.path = copiedPath;
    copied.replacements = (copied.replacements ?? [])
      .map((replacement) => ({ ...replacement, targetResourceId: copiedIdBySourceId.get(replacement.targetResourceId) ?? "" }))
      .filter((replacement) => replacement.targetResourceId !== "");
    next.document.resources.push(copied);
    next.resourceLocations.push({
      resourceId: copiedId,
      parentId,
      order: treeItemsInFolder(next, parentId).length,
    });
    copiedResourceIds.push(copiedId);
    markResourceDirty(next, copiedId);
  }

  const copiedAssetIds = new Set(resourcesToCopy.flatMap((resource) => Object.values(resource.media)));
  for (const assetId of copiedAssetIds) {
    if (!next.document.assets.some((asset) => asset.id === assetId)) {
      const asset = sourceWorkspace.document.assets.find((candidate) => candidate.id === assetId);
      if (asset) next.document.assets.push(structuredClone(asset));
    }
    const bytes = sourceWorkspace.media.get(assetId);
    if (bytes && !next.media.has(assetId)) next.media.set(assetId, bytes.slice());
  }

  normalizeDeterministicOrders(next.document, next.folders, next.resourceLocations);
  const resourceId = copiedIdBySourceId.get(selectedIds[0] ?? "") ?? "";
  next.openResourceIds = [
    ...next.openResourceIds.filter((id) => id !== next.previewResourceId),
    ...(resourceId ? [resourceId] : []),
  ];
  next.previewResourceId = null;
  syncEmptyDirectories(next);
  return { workspace: next, resourceId, copiedResourceIds };
}
