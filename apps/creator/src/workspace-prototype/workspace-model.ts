import {
  computeResourcePackageSnapshotDigest,
  RESOURCE_PACKAGE_VERSION,
  type ResourcePresentation,
  type ResourcePackageCandidate,
  type ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";
import {
  adversaryTemplate,
  armorTemplate,
  templateRegistry,
  weaponTemplate,
  type AdversaryData,
  type ArmorData,
  type WeaponData,
} from "@pbdh/templates/core";

export type WorkspaceFolder = {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  collapsed: boolean;
};

export type WorkspaceResourceLocation = {
  resourceId: string;
  parentId: string | null;
  order: number;
};

export type WorkspaceNodeRef =
  | { kind: "folder"; id: string }
  | { kind: "resource"; id: string };

export type WorkspaceTreeItem = WorkspaceNodeRef & {
  parentId: string | null;
  order: number;
};

export type CreatorWorkspace = ResourcePackageCandidate & {
  key: string;
  dirty: boolean;
  dirtyResourceIds: string[];
  folders: WorkspaceFolder[];
  resourceLocations: WorkspaceResourceLocation[];
  openResourceIds: string[];
  previewResourceId: string | null;
  currentFolderId: string | null;
};

export type ImportPlan = "insert" | "no-op" | "update" | "conflict";
export type WorkspaceResource = ResourcePackageLogicalDocument["resources"][number];

function cloneMedia(media: ReadonlyMap<string, Uint8Array>): Map<string, Uint8Array> {
  return new Map([...media].map(([id, bytes]) => [id, bytes.slice()]));
}

export function createWorkspace(
  candidate: ResourcePackageCandidate,
  dirty = false,
): CreatorWorkspace {
  const document = structuredClone(candidate.document);
  const source = candidate as Partial<CreatorWorkspace>;
  const layout = source.folders && source.resourceLocations
    ? {
        folders: structuredClone(source.folders),
        resourceLocations: structuredClone(source.resourceLocations),
      }
    : deriveWorkspaceLayout(document);
  normalizeDeterministicOrders(document, layout.folders, layout.resourceLocations);
  const resourceIds = new Set(document.resources.map((resource) => resource.id));
  const openResourceIds = source.openResourceIds?.filter((id) => resourceIds.has(id))
    ?? document.resources.slice(0, 1).map((resource) => resource.id);
  return {
    key: candidate.document.package.id,
    document,
    media: cloneMedia(candidate.media),
    dirty,
    dirtyResourceIds: source.dirtyResourceIds?.filter((id) => resourceIds.has(id)) ?? [],
    ...layout,
    openResourceIds,
    previewResourceId: source.previewResourceId && resourceIds.has(source.previewResourceId)
      ? source.previewResourceId
      : null,
    currentFolderId: source.currentFolderId && layout.folders.some((folder) => folder.id === source.currentFolderId)
      ? source.currentFolderId
      : layout.resourceLocations.find((location) => location.resourceId === openResourceIds[0])?.parentId ?? null,
  };
}

export function workspaceResource(
  workspace: CreatorWorkspace,
  resourceId = workspace.document.resources[0]?.id,
): WorkspaceResource {
  const resource = workspace.document.resources.find((candidate) => candidate.id === resourceId);
  if (!resource) throw new Error(`Missing resource: ${resourceId ?? "<none>"}`);
  return resource;
}

function assertTemplate(resource: WorkspaceResource, id: string): void {
  const template = templateRegistry.resolve(resource.template.id, resource.template.version);
  if (!template || template.id !== id) {
    throw new Error(`Expected registered ${id} Template, received ${resource.template.id}@${resource.template.version}`);
  }
}

export function adversaryData(workspace: CreatorWorkspace, resourceId?: string): AdversaryData {
  const resource = workspaceResource(workspace, resourceId);
  assertTemplate(resource, adversaryTemplate.id);
  return resource.data as AdversaryData;
}

export function weaponData(workspace: CreatorWorkspace, resourceId?: string): WeaponData {
  const resource = workspaceResource(workspace, resourceId);
  assertTemplate(resource, weaponTemplate.id);
  return resource.data as WeaponData;
}

export function armorData(workspace: CreatorWorkspace, resourceId?: string): ArmorData {
  const resource = workspaceResource(workspace, resourceId);
  assertTemplate(resource, armorTemplate.id);
  return resource.data as ArmorData;
}

export function updateAdversaryData(
  workspace: CreatorWorkspace,
  update: (data: AdversaryData) => void,
  resourceId?: string,
): CreatorWorkspace {
  const next = createWorkspace(workspace, true);
  update(adversaryData(next, resourceId));
  markResourceDirty(next, workspaceResource(next, resourceId).id);
  return next;
}

export function updateWeaponData(
  workspace: CreatorWorkspace,
  update: (data: WeaponData) => void,
  resourceId?: string,
): CreatorWorkspace {
  const next = createWorkspace(workspace, true);
  update(weaponData(next, resourceId));
  markResourceDirty(next, workspaceResource(next, resourceId).id);
  return next;
}

export function updateArmorData(
  workspace: CreatorWorkspace,
  update: (data: ArmorData) => void,
  resourceId?: string,
): CreatorWorkspace {
  const next = createWorkspace(workspace, true);
  update(armorData(next, resourceId));
  markResourceDirty(next, workspaceResource(next, resourceId).id);
  return next;
}

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

export function treeItemsInFolder(
  workspace: CreatorWorkspace,
  parentId: string | null,
): WorkspaceTreeItem[] {
  return sortWorkspaceTreeItems(workspace.document, workspace.folders, [
    ...workspace.folders
      .filter((folder) => folder.parentId === parentId)
      .map((folder) => ({ kind: "folder" as const, id: folder.id, parentId, order: folder.order })),
    ...workspace.resourceLocations
      .filter((location) => location.parentId === parentId)
      .map((location) => ({ kind: "resource" as const, id: location.resourceId, parentId, order: location.order })),
  ]).map((item, order) => ({ ...item, order }));
}

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
  let next = createWorkspace(workspace, true);
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
  let next = createWorkspace(workspace, true);
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
  const ordered = next;
  ordered.openResourceIds = [...ordered.openResourceIds.filter((id) => id !== ordered.previewResourceId), nextId];
  ordered.previewResourceId = null;
  ordered.currentFolderId = sourceLocation.parentId;
  markResourceDirty(ordered, nextId);
  return { workspace: ordered, resourceId: nextId };
}

export function copyWorkspaceResourceToPackage(
  sourceWorkspace: CreatorWorkspace,
  targetWorkspace: CreatorWorkspace,
  resourceId: string,
): { workspace: CreatorWorkspace; resourceId: string; copiedResourceIds: string[] } {
  workspaceResource(sourceWorkspace, resourceId);
  const sourceById = new Map(sourceWorkspace.document.resources.map((resource) => [resource.id, resource]));
  const resourcesToCopy: WorkspaceResource[] = [];
  const queued = [resourceId];
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

  const next = createWorkspace(targetWorkspace, true);
  const copiedIdBySourceId = new Map<string, string>();
  for (const source of resourcesToCopy) {
    let copiedId = `resource-${uuidV7()}`;
    while (next.document.resources.some((resource) => resource.id === copiedId)) {
      copiedId = `resource-${uuidV7()}`;
    }
    copiedIdBySourceId.set(source.id, copiedId);
  }

  const occupiedPaths = new Set(next.document.resources.map((resource) => resource.path));
  const copiedResourceIds: string[] = [];
  for (const source of resourcesToCopy) {
    const copiedId = copiedIdBySourceId.get(source.id)!;
    const filename = source.path.split("/").at(-1) ?? `${source.id}.json`;
    const extensionIndex = filename.lastIndexOf(".");
    const stem = extensionIndex > 0 ? filename.slice(0, extensionIndex) : filename;
    const extension = extensionIndex > 0 ? filename.slice(extensionIndex) : ".json";
    let copiedFilename = filename;
    let sequence = 1;
    while (occupiedPaths.has(workspacePath(next, next.currentFolderId, copiedFilename))) {
      sequence += 1;
      copiedFilename = `${stem}-copy-${sequence}${extension}`;
    }
    const copiedPath = workspacePath(next, next.currentFolderId, copiedFilename);
    occupiedPaths.add(copiedPath);
    const copied = structuredClone(source);
    copied.id = copiedId;
    copied.path = copiedPath;
    copied.replacements = (copied.replacements ?? [])
      .map((replacement) => ({
        ...replacement,
        targetResourceId: copiedIdBySourceId.get(replacement.targetResourceId) ?? "",
      }))
      .filter((replacement) => replacement.targetResourceId !== "");
    next.document.resources.push(copied);
    next.resourceLocations.push({
      resourceId: copiedId,
      parentId: next.currentFolderId,
      order: treeItemsInFolder(next, next.currentFolderId).length,
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
  next.openResourceIds = [
    ...next.openResourceIds.filter((id) => id !== next.previewResourceId),
    copiedIdBySourceId.get(resourceId)!,
  ];
  next.previewResourceId = null;
  syncEmptyDirectories(next);
  return {
    workspace: next,
    resourceId: copiedIdBySourceId.get(resourceId)!,
    copiedResourceIds,
  };
}

export function clearAdversaryFeature(
  workspace: CreatorWorkspace,
  index: number,
  resourceId?: string,
): CreatorWorkspace {
  return updateAdversaryData(workspace, (data) => {
    const feature = data.特性[index];
    if (!feature) return;
    feature.名称 = "";
    feature.原名 = "";
    feature.类型 = "";
    feature.特性描述 = "";
  }, resourceId);
}

export function deleteAdversaryFeature(
  workspace: CreatorWorkspace,
  index: number,
  resourceId?: string,
): CreatorWorkspace {
  return updateAdversaryData(workspace, (data) => {
    data.特性.splice(index, 1);
  }, resourceId);
}

export function removePortrait(workspace: CreatorWorkspace, resourceId?: string): CreatorWorkspace {
  const next = createWorkspace(workspace, true);
  const resource = workspaceResource(next, resourceId);
  const removedAssetId = resource?.media.portrait;
  if (resource) delete resource.media.portrait;
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

export function planImport(
  current: CreatorWorkspace | undefined,
  incoming: ResourcePackageCandidate,
): ImportPlan {
  if (!current || current.document.package.id !== incoming.document.package.id) return "insert";
  if (current.dirty) return "conflict";
  if (current.document.snapshotDigest === incoming.document.snapshotDigest) return "no-op";
  return "update";
}

function uuidV7(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let timestamp = BigInt(Date.now());
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function createBlankWorkspace(name: string): Promise<CreatorWorkspace> {
  const packageId = uuidV7();
  const document: ResourcePackageLogicalDocument = {
    contractVersion: RESOURCE_PACKAGE_VERSION,
    package: {
      id: packageId,
      version: "1.0.0",
      name: name.trim() || "未命名资源包",
      description: "Creator Workspace 本地原型",
    },
    targets: [],
    license: { label: "Public Domain", declaration: "Public Domain" },
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
  next.document.snapshotDigest = await computeResourcePackageSnapshotDigest(next.document, next.media);
  next.dirtyResourceIds = [];
  return next;
}

function markResourceDirty(workspace: CreatorWorkspace, resourceId: string): void {
  if (!workspace.dirtyResourceIds.includes(resourceId)) workspace.dirtyResourceIds.push(resourceId);
}

function deriveWorkspaceLayout(document: ResourcePackageLogicalDocument): {
  folders: WorkspaceFolder[];
  resourceLocations: WorkspaceResourceLocation[];
} {
  const folders: WorkspaceFolder[] = [];
  const resourceLocations: WorkspaceResourceLocation[] = [];
  const folderIdByPath = new Map<string, string>();
  const nextOrderByParent = new Map<string, number>();
  const parentKey = (parentId: string | null) => parentId ?? "<root>";
  const takeOrder = (parentId: string | null) => {
    const key = parentKey(parentId);
    const order = nextOrderByParent.get(key) ?? 0;
    nextOrderByParent.set(key, order + 1);
    return order;
  };
  const ensureFolderPath = (path: string): string | null => {
    const segments = path.split("/").filter(Boolean);
    let parentId: string | null = null;
    let currentPath = "";
    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      let id = folderIdByPath.get(currentPath);
      if (!id) {
        id = `folder-${folderIdByPath.size + 1}`;
        folderIdByPath.set(currentPath, id);
        folders.push({ id, name: segment, parentId, order: takeOrder(parentId), collapsed: false });
      }
      parentId = id;
    }
    return parentId;
  };

  for (const resource of document.resources) {
    const segments = resource.path.split("/");
    const parentId = ensureFolderPath(segments.slice(0, -1).join("/"));
    resourceLocations.push({ resourceId: resource.id, parentId, order: takeOrder(parentId) });
  }
  for (const directory of document.emptyDirectories) ensureFolderPath(directory);
  return { folders, resourceLocations };
}

function requireWorkspaceFolder(workspace: CreatorWorkspace, folderId: string): WorkspaceFolder {
  const folder = workspace.folders.find((candidate) => candidate.id === folderId);
  if (!folder) throw new Error("文件夹不存在");
  return folder;
}

function requireWorkspaceFolderOrRoot(workspace: CreatorWorkspace, folderId: string | null): void {
  if (folderId !== null) requireWorkspaceFolder(workspace, folderId);
}

function requireResourceLocation(workspace: CreatorWorkspace, resourceId: string): WorkspaceResourceLocation {
  const location = workspace.resourceLocations.find((candidate) => candidate.resourceId === resourceId);
  if (!location) throw new Error("资源不存在");
  return location;
}

function descendantWorkspaceFolderIds(workspace: CreatorWorkspace, folderId: string): string[] {
  return workspace.folders
    .filter((folder) => folder.parentId === folderId)
    .flatMap((folder) => [folder.id, ...descendantWorkspaceFolderIds(workspace, folder.id)]);
}

function workspaceFolderPath(workspace: CreatorWorkspace, folderId: string | null): string {
  if (!folderId) return "";
  const segments: string[] = [];
  let current: WorkspaceFolder | undefined = requireWorkspaceFolder(workspace, folderId);
  while (current) {
    segments.unshift(current.name);
    current = current.parentId ? requireWorkspaceFolder(workspace, current.parentId) : undefined;
  }
  return segments.join("/");
}

function workspacePath(workspace: CreatorWorkspace, folderId: string | null, filename: string): string {
  const folderPath = workspaceFolderPath(workspace, folderId);
  return folderPath ? `${folderPath}/${filename}` : filename;
}

function syncWorkspacePaths(workspace: CreatorWorkspace): void {
  const paths = new Set<string>();
  for (const resource of workspace.document.resources) {
    const location = requireResourceLocation(workspace, resource.id);
    const filename = resource.path.split("/").at(-1) ?? `${resource.id}.json`;
    const path = workspacePath(workspace, location.parentId, filename);
    if (paths.has(path)) throw new Error("目标文件夹已有同名资源");
    paths.add(path);
    resource.path = path;
  }
  syncEmptyDirectories(workspace);
}

function syncEmptyDirectories(workspace: CreatorWorkspace): void {
  workspace.document.emptyDirectories = workspace.folders
    .filter((folder) => !workspace.folders.some((candidate) => candidate.parentId === folder.id)
      && !workspace.resourceLocations.some((location) => location.parentId === folder.id))
    .map((folder) => workspaceFolderPath(workspace, folder.id))
    .sort();
}

function normalizeDeterministicOrders(
  document: ResourcePackageLogicalDocument,
  folders: WorkspaceFolder[],
  resourceLocations: WorkspaceResourceLocation[],
): void {
  const parentIds = new Set<string | null>([
    null,
    ...folders.map((folder) => folder.parentId),
    ...resourceLocations.map((location) => location.parentId),
  ]);
  for (const parentId of parentIds) {
    const items = sortWorkspaceTreeItems(document, folders, [
      ...folders
        .filter((folder) => folder.parentId === parentId)
        .map((folder) => ({ kind: "folder" as const, id: folder.id, parentId, order: 0 })),
      ...resourceLocations
        .filter((location) => location.parentId === parentId)
        .map((location) => ({ kind: "resource" as const, id: location.resourceId, parentId, order: 0 })),
    ]);
    const orderByKey = new Map(items.map((item, index) => [`${item.kind}:${item.id}`, index]));
    folders
      .filter((folder) => folder.parentId === parentId)
      .forEach((folder) => { folder.order = orderByKey.get(`folder:${folder.id}`)!; });
    resourceLocations
      .filter((location) => location.parentId === parentId)
      .forEach((location) => { location.order = orderByKey.get(`resource:${location.resourceId}`)!; });
  }
}

function sortWorkspaceTreeItems(
  document: ResourcePackageLogicalDocument,
  folders: WorkspaceFolder[],
  items: WorkspaceTreeItem[],
): WorkspaceTreeItem[] {
  const label = (item: WorkspaceTreeItem) => item.kind === "folder"
    ? folders.find((folder) => folder.id === item.id)?.name ?? item.id
    : document.resources.find((resource) => resource.id === item.id)?.path.split("/").at(-1) ?? item.id;
  return items.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
    const byLabel = label(left).localeCompare(label(right), "zh-CN", { numeric: true, sensitivity: "base" });
    return byLabel || left.id.localeCompare(right.id);
  });
}
