import type { LocalDocumentSync } from "@pbdh/local-storage";
import type { TabletopDocumentModel } from "@pbdh/tabletop/core";
import { TabletopContextMenu } from "@pbdh/tabletop/react";
import { templateRegistry } from "@pbdh/templates/core";

import type { CreatorAppMode } from "./creator-layout.tsx";
import type { WorkspaceResourceSelection } from "./gm-tabletop-session.ts";
import type { CreatorWorkspace } from "./workspace-model.ts";

export type CreatorContextMenuState =
  | { kind: "resource"; workspaceKey: string; resourceId: string; x: number; y: number }
  | { kind: "instance"; instanceId: string; x: number; y: number }
  | { kind: "canvas"; x: number; y: number }
  | { kind: "workspace"; workspaceKey: string; x: number; y: number }
  | null;

type TabletopInstance = TabletopDocumentModel["instances"][number];

export type CreatorContextMenuCommand =
  | { type: "close" | "new-package" | "import-package" | "export-package" | "publish-package" | "new-resource" | "new-folder" }
  | { type: "sync-workspace" | "resolve-workspace-conflict" | "edit-package" | "close-package"; workspaceKey: string }
  | { type: "place-selected" | "delete-selected-resources" }
  | { type: "place-resource" | "open-resource" | "open-resource-tab" | "duplicate-resource" | "copy-resource" | "delete-resource"; workspaceKey: string; resourceId: string }
  | { type: "view-instance" | "edit-instance" | "duplicate-instance" | "delete-instances" | "rotate-instance" | "flip-instance" }
  | { type: "replace-instance"; replacementId: string }
  | { type: "sync-tabletop" | "resolve-tabletop-conflict" | "rename-tabletop" | "duplicate-tabletop" | "import-tabletop" | "export-tabletop" | "print-tabletop" | "arrange-tabletop" | "expand-tabletop" | "clear-tabletop" | "delete-tabletop" };

export function CreatorContextMenus({
  state,
  snapshot,
  execute,
}: {
  state: CreatorContextMenuState;
  snapshot: {
    appMode: CreatorAppMode;
    workspaces: readonly CreatorWorkspace[];
    workspaceSync: ReadonlyMap<string, LocalDocumentSync>;
    tabletopSync: ReadonlyMap<string, LocalDocumentSync>;
    activeTabletop?: TabletopDocumentModel;
    tabletopView: "canvas" | "instance-editor";
    resourceMultiSelect: boolean;
    selectedWorkspaceResources: readonly WorkspaceResourceSelection[];
    selectedInstance?: TabletopInstance;
    selectedInstanceEditable: boolean;
    selectedInstanceCount: number;
  };
  execute(command: CreatorContextMenuCommand): void;
}) {
  if (!state) return null;

  if (state.kind === "workspace") return <TabletopContextMenu
    className="context-menu workspace-context-menu"
    x={state.x}
    y={state.y}
    estimatedWidth={210}
    estimatedHeight={260}
    onClose={() => execute({ type: "close" })}
  >
    {(snapshot.workspaceSync.get(state.workspaceKey)?.scope ?? "local-only") === "local-only" && <button type="button" role="menuitem" onClick={() => execute({ type: "sync-workspace", workspaceKey: state.workspaceKey })}>同步到云端</button>}
    {snapshot.workspaceSync.get(state.workspaceKey)?.state === "conflict" && <button type="button" role="menuitem" onClick={() => execute({ type: "resolve-workspace-conflict", workspaceKey: state.workspaceKey })}>解决云冲突</button>}
    <i />
    <button type="button" role="menuitem" onClick={() => execute({ type: "new-package" })}>新建资源包</button>
    <button type="button" role="menuitem" onClick={() => execute({ type: "import-package" })}>导入 .pbres</button>
    <button type="button" role="menuitem" onClick={() => execute({ type: "export-package" })}>导出 .pbres</button>
    <button type="button" role="menuitem" onClick={() => execute({ type: "edit-package", workspaceKey: state.workspaceKey })}>编辑资源包信息</button>
    <button type="button" role="menuitem" onClick={() => execute({ type: "publish-package" })}>发布到资源市场</button>
    <i />
    <button type="button" role="menuitem" onClick={() => execute({ type: "new-resource" })}>新建资源</button>
    <button type="button" role="menuitem" onClick={() => execute({ type: "new-folder" })}>新建文件夹</button>
    <i />
    <button type="button" role="menuitem" onClick={() => execute({ type: "close-package", workspaceKey: state.workspaceKey })}>关闭资源包</button>
  </TabletopContextMenu>;

  if (state.kind === "resource") return <TabletopContextMenu
    className="context-menu resource-context-menu"
    x={state.x}
    y={state.y}
    estimatedWidth={230}
    estimatedHeight={snapshot.resourceMultiSelect ? 260 : 190}
    onClose={() => execute({ type: "close" })}
  >
    {snapshot.appMode === "gm" && snapshot.activeTabletop && snapshot.tabletopView === "canvas" && snapshot.resourceMultiSelect && snapshot.selectedWorkspaceResources.length > 0 && <>
      <button type="button" role="menuitem" onClick={() => execute({ type: "place-selected" })}>批量放到当前桌面（{snapshot.selectedWorkspaceResources.length}）</button><i />
    </>}
    {snapshot.appMode === "gm" && snapshot.activeTabletop && snapshot.tabletopView === "canvas" && !snapshot.resourceMultiSelect && <>
      <button type="button" role="menuitem" onClick={() => execute({ type: "place-resource", workspaceKey: state.workspaceKey, resourceId: state.resourceId })}>放到当前桌面</button><i />
    </>}
    <button type="button" role="menuitem" onClick={() => execute({ type: "open-resource", workspaceKey: state.workspaceKey, resourceId: state.resourceId })}>打开</button>
    <button type="button" role="menuitem" onClick={() => execute({ type: "open-resource-tab", workspaceKey: state.workspaceKey, resourceId: state.resourceId })}>在新标签页打开</button>
    <i />
    <button type="button" role="menuitem" onClick={() => execute({ type: "duplicate-resource", workspaceKey: state.workspaceKey, resourceId: state.resourceId })}>复制</button>
    <button type="button" role="menuitem" onClick={() => execute({ type: "copy-resource", workspaceKey: state.workspaceKey, resourceId: state.resourceId })}>复制到资源包…</button>
    {snapshot.resourceMultiSelect && snapshot.selectedWorkspaceResources.length > 0
      ? <button type="button" role="menuitem" className="delete" onClick={() => execute({ type: "delete-selected-resources" })}>删除已选（{snapshot.selectedWorkspaceResources.length}）</button>
      : <button type="button" role="menuitem" className="delete" onClick={() => execute({ type: "delete-resource", workspaceKey: state.workspaceKey, resourceId: state.resourceId })}>删除</button>}
  </TabletopContextMenu>;

  if (state.kind === "instance") return <TabletopContextMenu
    className="context-menu instance-context-menu"
    x={state.x}
    y={state.y}
    estimatedWidth={190}
    estimatedHeight={330}
    onClose={() => execute({ type: "close" })}
  >
    <button type="button" role="menuitem" onClick={() => execute({ type: "view-instance" })}>查看详情</button>
    {snapshot.selectedInstanceEditable && <button type="button" role="menuitem" onClick={() => execute({ type: "edit-instance" })}>编辑卡牌</button>}
    {snapshot.selectedInstance?.resource.replacements.map((replacement) => {
      const label = templateRegistry.resolve(snapshot.selectedInstance!.resource.template.id, snapshot.selectedInstance!.resource.template.version)
        ?.tabletop.replacements.find((candidate) => candidate.id === replacement.replacementId)?.label ?? "切换形态";
      return <button type="button" role="menuitem" key={replacement.replacementId} onClick={() => execute({ type: "replace-instance", replacementId: replacement.replacementId })}>{label}</button>;
    })}
    <button type="button" role="menuitem" onClick={() => execute({ type: "rotate-instance" })}>顺时针旋转 90°</button>
    {snapshot.selectedInstance?.resource.media.back && <button type="button" role="menuitem" onClick={() => execute({ type: "flip-instance" })}>{snapshot.selectedInstance.flipped ? "翻至正面" : "翻至背面"}</button>}
    <button type="button" role="menuitem" onClick={() => execute({ type: "duplicate-instance" })}>复制</button>
    <button type="button" role="menuitem" className="delete" onClick={() => execute({ type: "delete-instances" })}>{snapshot.selectedInstanceCount > 1 ? `删除已选（${snapshot.selectedInstanceCount}）` : "删除"}</button>
  </TabletopContextMenu>;

  const tabletopId = snapshot.activeTabletop?.id;
  return <TabletopContextMenu className="context-menu canvas-context-menu" x={state.x} y={state.y} estimatedWidth={240} estimatedHeight={360} onClose={() => execute({ type: "close" })}>
    {tabletopId && (snapshot.tabletopSync.get(tabletopId)?.scope ?? "local-only") === "local-only" && <button type="button" role="menuitem" onClick={() => execute({ type: "sync-tabletop" })}>同步到云端</button>}
    {tabletopId && snapshot.tabletopSync.get(tabletopId)?.state === "conflict" && <button type="button" role="menuitem" onClick={() => execute({ type: "resolve-tabletop-conflict" })}>解决云冲突</button>}
    <i />
    <button type="button" role="menuitem" onClick={() => execute({ type: "rename-tabletop" })}>重命名</button>
    <button type="button" role="menuitem" onClick={() => execute({ type: "duplicate-tabletop" })}>复制桌面</button>
    <i />
    <button type="button" role="menuitem" onClick={() => execute({ type: "import-tabletop" })}>导入 .pbtab</button>
    <button type="button" role="menuitem" onClick={() => execute({ type: "export-tabletop" })}>导出 .pbtab</button>
    <button type="button" role="menuitem" onClick={() => execute({ type: "print-tabletop" })}>打印</button>
    <button type="button" role="menuitem" onClick={() => execute({ type: "arrange-tabletop" })}>整理卡牌</button>
    <button type="button" role="menuitem" onClick={() => execute({ type: "expand-tabletop" })}>扩大桌面</button>
    <button type="button" role="menuitem" className="delete" onClick={() => execute({ type: "clear-tabletop" })}>清空桌面</button>
    <i />
    <button type="button" role="menuitem" className="delete" onClick={() => execute({ type: "delete-tabletop" })}>删除桌面</button>
  </TabletopContextMenu>;
}
