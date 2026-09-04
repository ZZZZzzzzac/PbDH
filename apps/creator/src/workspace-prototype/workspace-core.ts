import type {
  ResourcePackageCandidate,
  ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";

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

export function markResourceDirty(workspace: CreatorWorkspace, resourceId: string): void {
  if (!workspace.dirtyResourceIds.includes(resourceId)) workspace.dirtyResourceIds.push(resourceId);
}

export function treeItemsInFolder(
  workspace: CreatorWorkspace,
  parentId: string | null,
  direction: "ascending" | "descending" = "ascending",
): WorkspaceTreeItem[] {
  return sortWorkspaceTreeItems(workspace.document, workspace.folders, [
    ...workspace.folders
      .filter((folder) => folder.parentId === parentId)
      .map((folder) => ({ kind: "folder" as const, id: folder.id, parentId, order: folder.order })),
    ...workspace.resourceLocations
      .filter((location) => location.parentId === parentId)
      .map((location) => ({ kind: "resource" as const, id: location.resourceId, parentId, order: location.order })),
  ], direction).map((item, order) => ({ ...item, order }));
}

export function workspaceTreeItemsByParent(
  workspace: CreatorWorkspace,
  direction: "ascending" | "descending" = "ascending",
): ReadonlyMap<string | null, WorkspaceTreeItem[]> {
  const itemsByParent = new Map<string | null, WorkspaceTreeItem[]>([[null, []]]);
  const folderNameById = new Map(workspace.folders.map((folder) => [folder.id, folder.name]));
  const resourceNameById = new Map(workspace.document.resources.map((resource) => [
    resource.id,
    resource.path.split("/").at(-1) ?? resource.id,
  ]));
  const add = (item: WorkspaceTreeItem) => {
    const items = itemsByParent.get(item.parentId) ?? [];
    items.push(item);
    itemsByParent.set(item.parentId, items);
  };

  for (const folder of workspace.folders) {
    add({ kind: "folder", id: folder.id, parentId: folder.parentId, order: folder.order });
    if (!itemsByParent.has(folder.id)) itemsByParent.set(folder.id, []);
  }
  for (const location of workspace.resourceLocations) {
    add({ kind: "resource", id: location.resourceId, parentId: location.parentId, order: location.order });
  }

  const label = (item: WorkspaceTreeItem) => item.kind === "folder"
    ? folderNameById.get(item.id) ?? item.id
    : resourceNameById.get(item.id) ?? item.id;
  for (const [parentId, items] of itemsByParent) {
    items.sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
      const byLabel = label(left).localeCompare(label(right), "zh-CN", { numeric: true, sensitivity: "base" });
      const byId = left.id.localeCompare(right.id);
      return direction === "ascending" ? byLabel || byId : -(byLabel || byId);
    });
    itemsByParent.set(parentId, items.map((item, order) => ({ ...item, order })));
  }
  return itemsByParent;
}

export function uuidV7(): string {
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

export function requireWorkspaceFolder(workspace: CreatorWorkspace, folderId: string): WorkspaceFolder {
  const folder = workspace.folders.find((candidate) => candidate.id === folderId);
  if (!folder) throw new Error("文件夹不存在");
  return folder;
}

export function requireWorkspaceFolderOrRoot(workspace: CreatorWorkspace, folderId: string | null): void {
  if (folderId !== null) requireWorkspaceFolder(workspace, folderId);
}

export function requireResourceLocation(workspace: CreatorWorkspace, resourceId: string): WorkspaceResourceLocation {
  const location = workspace.resourceLocations.find((candidate) => candidate.resourceId === resourceId);
  if (!location) throw new Error("资源不存在");
  return location;
}

export function descendantWorkspaceFolderIds(workspace: CreatorWorkspace, folderId: string): string[] {
  return workspace.folders
    .filter((folder) => folder.parentId === folderId)
    .flatMap((folder) => [folder.id, ...descendantWorkspaceFolderIds(workspace, folder.id)]);
}

export function workspaceResourceCountByFolder(workspace: CreatorWorkspace): ReadonlyMap<string, number> {
  const folderById = new Map(workspace.folders.map((folder) => [folder.id, folder]));
  const counts = new Map(workspace.folders.map((folder) => [folder.id, 0]));
  for (const location of workspace.resourceLocations) {
    let folderId = location.parentId;
    while (folderId) {
      counts.set(folderId, (counts.get(folderId) ?? 0) + 1);
      folderId = folderById.get(folderId)?.parentId ?? null;
    }
  }
  return counts;
}

export function workspaceFolderPath(workspace: CreatorWorkspace, folderId: string | null): string {
  if (!folderId) return "";
  const segments: string[] = [];
  let current: WorkspaceFolder | undefined = requireWorkspaceFolder(workspace, folderId);
  while (current) {
    segments.unshift(current.name);
    current = current.parentId ? requireWorkspaceFolder(workspace, current.parentId) : undefined;
  }
  return segments.join("/");
}

export function workspacePath(workspace: CreatorWorkspace, folderId: string | null, filename: string): string {
  const folderPath = workspaceFolderPath(workspace, folderId);
  return folderPath ? `${folderPath}/${filename}` : filename;
}

export function syncWorkspacePaths(workspace: CreatorWorkspace): void {
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

export function syncEmptyDirectories(workspace: CreatorWorkspace): void {
  workspace.document.emptyDirectories = workspace.folders
    .filter((folder) => !workspace.folders.some((candidate) => candidate.parentId === folder.id)
      && !workspace.resourceLocations.some((location) => location.parentId === folder.id))
    .map((folder) => workspaceFolderPath(workspace, folder.id))
    .sort();
}

export function normalizeDeterministicOrders(
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
  direction: "ascending" | "descending" = "ascending",
): WorkspaceTreeItem[] {
  const label = (item: WorkspaceTreeItem) => item.kind === "folder"
    ? folders.find((folder) => folder.id === item.id)?.name ?? item.id
    : document.resources.find((resource) => resource.id === item.id)?.path.split("/").at(-1) ?? item.id;
  return items.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
    const byLabel = label(left).localeCompare(label(right), "zh-CN", { numeric: true, sensitivity: "base" });
    const byId = left.id.localeCompare(right.id);
    return direction === "ascending" ? byLabel || byId : -(byLabel || byId);
  });
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
        folders.push({ id, name: segment, parentId, order: takeOrder(parentId), collapsed: true });
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
