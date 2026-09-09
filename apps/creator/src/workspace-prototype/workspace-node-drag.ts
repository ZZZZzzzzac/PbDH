import type { WorkspaceNodeRef } from "./workspace-model.ts";
export const workspaceNodeDataType = "application/x-pbdh-workspace-node";
export type WorkspaceNodeDrag = WorkspaceNodeRef & { workspaceKey: string };
export function readWorkspaceNodeDrag(dataTransfer: Pick<DataTransfer, "getData">): WorkspaceNodeDrag | null {
  try {
    const value = JSON.parse(dataTransfer.getData(workspaceNodeDataType));
    return value && typeof value.workspaceKey === "string" && typeof value.id === "string"
      && (value.kind === "folder" || value.kind === "resource") ? value : null;
  } catch { return null; }
}
