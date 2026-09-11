import type { CreatorWorkspace } from "./workspace-model.ts";

export type WorkspaceSnapshotUpdate = {
  baseline: readonly CreatorWorkspace[];
  replaceKeys?: readonly string[];
  removeKeys?: readonly string[];
};

export function mergeWorkspaceSnapshot(
  current: readonly CreatorWorkspace[],
  restored: readonly CreatorWorkspace[],
  update: WorkspaceSnapshotUpdate,
): CreatorWorkspace[] {
  const baseline = new Map(update.baseline.map((workspace) => [workspace.key, workspace]));
  const incoming = new Map(restored.map((workspace) => [workspace.key, workspace]));
  const replace = new Set(update.replaceKeys);
  const remove = new Set(update.removeKeys);
  const currentKeys = new Set(current.map((workspace) => workspace.key));
  const next = current.flatMap((workspace) => {
    // 只接纳操作开始后没有继续编辑的目标；无关工作区和新编辑保持原样。
    if (baseline.get(workspace.key) !== workspace) return [workspace];
    if (remove.has(workspace.key)) return [];
    return [replace.has(workspace.key) ? incoming.get(workspace.key) ?? workspace : workspace];
  });
  for (const workspace of restored) {
    // 请求期间已从界面删除的工作区不能被旧快照复活。
    if (!currentKeys.has(workspace.key) && !baseline.has(workspace.key) && !remove.has(workspace.key)) next.push(workspace);
  }
  return next;
}
