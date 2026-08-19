import {
  computeResourcePackageSnapshotDigest,
  type ResourcePresentation,
  type ResourcePackageCandidate,
  type ResourcePackageLogicalDocument,
} from "@pbdh/contract-runtime";
import {
  adversaryTemplate,
  templateRegistry,
  weaponTemplate,
  type AdversaryData,
  type WeaponData,
} from "@pbdh/templates/core";

export type CreatorWorkspace = ResourcePackageCandidate & {
  key: string;
  dirty: boolean;
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
  return {
    key: candidate.document.package.id,
    document: structuredClone(candidate.document),
    media: cloneMedia(candidate.media),
    dirty,
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

function assertTemplate(resource: WorkspaceResource, id: string, version: string): void {
  if (resource.template.id !== id || resource.template.version !== version) {
    throw new Error(`Expected ${id}@${version}, received ${resource.template.id}@${resource.template.version}`);
  }
}

export function adversaryData(workspace: CreatorWorkspace, resourceId?: string): AdversaryData {
  const resource = workspaceResource(workspace, resourceId);
  assertTemplate(resource, adversaryTemplate.id, adversaryTemplate.version);
  return resource.data as AdversaryData;
}

export function weaponData(workspace: CreatorWorkspace, resourceId?: string): WeaponData {
  const resource = workspaceResource(workspace, resourceId);
  assertTemplate(resource, weaponTemplate.id, weaponTemplate.version);
  return resource.data as WeaponData;
}

export function updateAdversaryData(
  workspace: CreatorWorkspace,
  update: (data: AdversaryData) => void,
  resourceId?: string,
): CreatorWorkspace {
  const next = createWorkspace(workspace, true);
  update(adversaryData(next, resourceId));
  return next;
}

export function updateWeaponData(
  workspace: CreatorWorkspace,
  update: (data: WeaponData) => void,
  resourceId?: string,
): CreatorWorkspace {
  const next = createWorkspace(workspace, true);
  update(weaponData(next, resourceId));
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
  next.document.resources.push({
    id: resourceId,
    path: `resources/${resourceId}.json`,
    template: { id: template.id, version: template.version },
    presentation: structuredClone(template.defaultPresentation),
    data: structuredClone(template.defaultData),
    media: {},
  });
  return { workspace: next, resourceId };
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
  if (previousAssetId) {
    next.document.assets = next.document.assets.filter((candidate) => candidate.id !== previousAssetId);
    next.media.delete(previousAssetId);
  }
  next.document.assets = next.document.assets.filter((candidate) => candidate.id !== asset.id);
  next.document.assets.push(asset);
  next.media.set(asset.id, bytes.slice());
  resource.media.portrait = asset.id;
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
    contractVersion: "1.0.0-alpha.1",
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
    resources: [{
      id: "enemy-1",
      path: "resources/enemy-1.json",
      template: { id: adversaryTemplate.id, version: adversaryTemplate.version },
      presentation: adversaryTemplate.defaultPresentation,
      data: structuredClone(adversaryTemplate.defaultData),
      media: {},
    }],
    emptyDirectories: [],
    snapshotDigest: `sha256:${"0".repeat(64)}`,
  };
  document.snapshotDigest = await computeResourcePackageSnapshotDigest(document, new Map());
  return createWorkspace({ document, media: new Map() });
}

export async function forkCurrentWorkspace(
  workspace: CreatorWorkspace,
): Promise<CreatorWorkspace> {
  const next = createWorkspace(workspace, false);
  next.document.package.id = uuidV7();
  next.document.package.version = "1.0.0";
  next.document.package.name = `${next.document.package.name}（本地副本）`;
  next.document.snapshotDigest = await computeResourcePackageSnapshotDigest(next.document, next.media);
  next.key = next.document.package.id;
  return next;
}

export async function prepareWorkspaceExport(
  workspace: CreatorWorkspace,
): Promise<CreatorWorkspace> {
  const next = createWorkspace(workspace, false);
  next.document.snapshotDigest = await computeResourcePackageSnapshotDigest(next.document, next.media);
  return next;
}
