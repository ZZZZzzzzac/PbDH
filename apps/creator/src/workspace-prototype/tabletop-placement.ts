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
  assets: CreatorWorkspace["document"]["assets"];
  media: Map<string, Uint8Array>;
};

export type PreparedTabletopReplacement = {
  command: Extract<TabletopCommand, { type: "replace" }>;
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

export function prepareWorkspaceReplacement(
  resolveTemplate: TabletopTemplateResolver,
  workspaces: readonly CreatorWorkspace[],
  instance: TabletopInstance,
  replacementId: string,
  newInstanceId: string,
): PreparedTabletopReplacement {
  const { workspace, target } = replacementTarget(workspaces, instance, replacementId);
  const template = resolveTemplate(target.template.id, target.template.version);
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

export function workspaceReplacementTemplate(workspaces: readonly CreatorWorkspace[], instance: TabletopInstance, replacementId: string) {
  return replacementTarget(workspaces, instance, replacementId).target.template;
}

function replacementTarget(workspaces: readonly CreatorWorkspace[], instance: TabletopInstance, replacementId: string) {
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
  return { workspace, target };
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
