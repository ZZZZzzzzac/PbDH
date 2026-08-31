import { canonicalCardDesignSize } from "@pbdh/resource-renderer/core";
import {
  clampTabletopPosition,
  executeTabletopCommand,
  type TabletopCapability,
  type TabletopCommand,
  type TabletopDocumentModel,
} from "@pbdh/tabletop/core";
import { templateRegistry } from "@pbdh/templates/core";

import {
  containGmTabletopInstances,
  gmCardPixelsPerDesignUnit,
  prepareWorkspaceReplacement,
  snapshotWorkspaceResourceForTabletop,
} from "./tabletop-placement.ts";
import type { CreatorWorkspace } from "./workspace-model.ts";

export type WorkspaceResourceSelection = { workspaceKey: string; resourceId: string };
export type TabletopSelectionMode = "replace" | "add" | "toggle";

export type GmTabletopSessionResult =
  | { ok: false; error: string }
  | {
      ok: true;
      tabletop: TabletopDocumentModel;
      media?: Map<string, Uint8Array>;
      selectedInstanceIds?: string[];
    };

export const gmTabletopCapabilities = new Set<TabletopCapability>([
  "place",
  "move",
  "uniform-scale",
  "rotate",
  "flip",
  "layer",
  "arrange",
  "clear",
  "duplicate",
  "delete",
  "replace",
  "edit-instance-data",
  "template-state-command",
]);

export function executeGmTabletopCommand(
  tabletop: TabletopDocumentModel,
  command: TabletopCommand,
): GmTabletopSessionResult {
  const result = executeTabletopCommand(tabletop, command, {
    capabilities: gmTabletopCapabilities,
    templateCommands: (instance) => templateRegistry.resolve(
      instance.resource.template.id,
      instance.resource.template.version,
    )?.tabletop.commands ?? [],
  });
  if (result.diagnostics.length > 0) return { ok: false, error: result.diagnostics[0]!.code };
  return { ok: true, tabletop: containGmTabletopInstances(result.document) };
}

export function selectTabletopInstances(
  current: readonly string[],
  instanceId: string,
  mode: TabletopSelectionMode = "replace",
): string[] {
  if (mode === "replace") return [instanceId];
  if (mode === "add") return [...new Set([...current, instanceId])];
  return current.includes(instanceId)
    ? current.filter((id) => id !== instanceId)
    : [...current, instanceId];
}

export function placeWorkspaceResourcesOnTabletop(
  tabletop: TabletopDocumentModel,
  workspaces: readonly CreatorWorkspace[],
  selections: readonly WorkspaceResourceSelection[],
  firstPosition?: { x: number; y: number },
  createId: () => string = () => crypto.randomUUID(),
): GmTabletopSessionResult {
  if (selections.length === 0) return { ok: true, tabletop, selectedInstanceIds: [] };
  let next = tabletop;
  const media = new Map<string, Uint8Array>();
  const placedIds: string[] = [];
  try {
    selections.forEach((selection, index) => {
      const workspace = workspaces.find((item) => item.key === selection.workspaceKey);
      const source = workspace?.document.resources.find((item) => item.id === selection.resourceId);
      if (!workspace || !source) throw new Error("找不到要放置的资源");
      const template = templateRegistry.resolve(source.template.id, source.template.version);
      if (!template) throw new Error("找不到卡牌类型");
      const snapshot = snapshotWorkspaceResourceForTabletop(workspace, source.id);
      const instanceId = createId();
      const sequence = next.instances.length;
      const origin = firstPosition ?? {
        x: 56 + (sequence % 3) * 380,
        y: 88 + Math.floor(sequence / 3) * 180,
      };
      const position = clampTabletopPosition(
        { resource: snapshot.resource, scale: 1, rotation: 0 },
        { ...next.canvas, containment: "full", pixelsPerUnit: gmCardPixelsPerDesignUnit },
        { x: origin.x + index * 28, y: origin.y + index * 28 },
      );
      const placed = executeTabletopCommand(next, {
        type: "place",
        instanceId,
        resource: snapshot.resource,
        state: template.tabletop.defaultState(source.data as never),
        position,
        assets: snapshot.assets,
      }, { capabilities: gmTabletopCapabilities });
      if (placed.diagnostics.length > 0) throw new Error(placed.diagnostics[0]!.code);
      next = placed.document;
      placedIds.push(instanceId);
      snapshot.media.forEach((bytes, id) => media.set(id, bytes));
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "无法复制桌面资源" };
  }
  return { ok: true, tabletop: containGmTabletopInstances(next), media, selectedInstanceIds: placedIds };
}

export function replaceTabletopInstanceFromWorkspace(
  tabletop: TabletopDocumentModel,
  workspaces: readonly CreatorWorkspace[],
  instanceId: string,
  replacementId: string,
  createId: () => string = () => crypto.randomUUID(),
): GmTabletopSessionResult {
  const instance = tabletop.instances.find((candidate) => candidate.id === instanceId);
  if (!instance) return { ok: false, error: "tabletop.instance.not-found" };
  try {
    const prepared = prepareWorkspaceReplacement(workspaces, instance, replacementId, createId());
    const replaced = executeTabletopCommand(tabletop, prepared.command, {
      capabilities: gmTabletopCapabilities,
    });
    if (replaced.diagnostics.length > 0) return { ok: false, error: replaced.diagnostics[0]!.code };
    return {
      ok: true,
      tabletop: containGmTabletopInstances(replaced.document),
      media: prepared.media,
      selectedInstanceIds: [prepared.command.newInstanceId],
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "tabletop.replacement.invalid" };
  }
}

export function arrangeGmTabletop(
  tabletop: TabletopDocumentModel,
  viewportWidth: number,
): GmTabletopSessionResult {
  if (tabletop.instances.length === 0) return { ok: true, tabletop };
  const gap = 24;
  const inset = 24;
  const widths = tabletop.instances.map((instance) =>
    canonicalCardDesignSize.width * gmCardPixelsPerDesignUnit * instance.scale);
  const widest = Math.max(240, ...widths);
  const columns = Math.max(1, Math.floor((viewportWidth - inset * 2 + gap) / (widest + gap)));
  const rowHeights: number[] = [];
  tabletop.instances.forEach((instance, index) => {
    const row = Math.floor(index / columns);
    const height = canonicalCardDesignSize.height * gmCardPixelsPerDesignUnit * instance.scale;
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, height);
  });
  const rowTops = rowHeights.map((_height, row) => inset + rowHeights
    .slice(0, row)
    .reduce((total, height) => total + height + gap, 0));
  const canvas = {
    width: Math.max(tabletop.canvas.width, inset * 2 + columns * widest + Math.max(0, columns - 1) * gap),
    height: Math.max(tabletop.canvas.height, (rowTops.at(-1) ?? inset) + (rowHeights.at(-1) ?? 0) + inset),
  };
  const arranged = executeTabletopCommand({ ...tabletop, canvas }, {
    type: "arrange",
    placements: tabletop.instances.map((instance, index) => ({
      instanceId: instance.id,
      position: {
        x: inset + (index % columns) * (widest + gap),
        y: rowTops[Math.floor(index / columns)] ?? inset,
      },
      layer: index,
      rotation: 0,
    })),
  }, { capabilities: gmTabletopCapabilities });
  if (arranged.diagnostics.length > 0) return { ok: false, error: arranged.diagnostics[0]!.code };
  return { ok: true, tabletop: containGmTabletopInstances(arranged.document) };
}
