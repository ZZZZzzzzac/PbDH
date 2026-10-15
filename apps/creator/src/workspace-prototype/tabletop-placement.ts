import {
  type TabletopCommand,
  type TabletopInstance,
  type TabletopInstanceResourceCopy,
} from "@pbdh/tabletop/core";
import type { TemplateCoreCapability } from "@pbdh/templates/core";
import { loadTemplateCore } from "@pbdh/templates/core/lazy";

import type { CreatorWorkspace, WorkspaceResource } from "./workspace-model.ts";

export type TabletopTemplateResolver = (id: string, version: string) => TemplateCoreCapability<any> | undefined;

export async function loadTabletopTemplates(
  references: readonly { id: string; version: string }[],
  load: typeof loadTemplateCore = loadTemplateCore,
): Promise<TabletopTemplateResolver> {
  const unique = new Map(references.map((reference) => [`${reference.id}@${reference.version}`, reference]));
  const entries = await Promise.all([...unique].map(async ([key, reference]) => {
    const template = await load(reference.id, reference.version);
    if (!template || template.id !== reference.id || template.version !== reference.version) {
      throw new Error(`模板能力不可用：${key}`);
    }
    return [key, template] as const;
  }));
  const templates = new Map(entries);
  return (id, version) => templates.get(`${id}@${version}`);
}

export type TabletopPlacementSnapshot = {
  resource: TabletopInstanceResourceCopy;
  backResource?: TabletopInstanceResourceCopy;
  assets: CreatorWorkspace["document"]["assets"];
  media: Map<string, Uint8Array>;
};

export type PreparedTabletopFlip = {
  command: Extract<TabletopCommand, { type: "flip" }>;
  media: Map<string, Uint8Array>;
};

export function snapshotWorkspaceResourceForTabletop(
  workspace: CreatorWorkspace,
  resourceId: string,
  includeBack = true,
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

  const backId = !source.media.back && includeBack
    ? source.replacements?.find((item) => item.replacementId === "alternate-form")?.targetResourceId : undefined;
  const back = backId ? snapshotWorkspaceResourceForTabletop(workspace, backId, false) : undefined;
  back?.media.forEach((bytes, id) => media.set(id, bytes));
  return {
    resource: tabletopResourceCopy(workspace, source),
    ...(back ? { backResource: back.resource } : {}),
    assets: structuredClone([...new Map([...assets, ...(back?.assets ?? [])].map((asset) => [asset.id, asset])).values()]),
    media,
  };
}

export function prepareWorkspaceFlip(
  workspaces: readonly CreatorWorkspace[],
  instance: TabletopInstance,
): PreparedTabletopFlip {
  if (instance.flipped || instance.backResource || instance.resource.media.back) {
    return { command: { type: "flip", instanceId: instance.id }, media: new Map() };
  }
  const source = instance.resource.source;
  const back = instance.resource.replacements.find((item) => item.replacementId === "alternate-form");
  const workspace = workspaces.find((item) => item.document.package.id === source?.packageId);
  if (!workspace || !back) throw new Error("卡背来源不可用，当前卡牌未改变。");
  const snapshot = snapshotWorkspaceResourceForTabletop(workspace, back.targetResourceId, false);
  return {
    command: {
      type: "flip",
      instanceId: instance.id,
      backResource: snapshot.resource,
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
